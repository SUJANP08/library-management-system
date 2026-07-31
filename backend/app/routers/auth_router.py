from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas, auth
from app.config import settings
from app.utils.device_info import summarize_user_agent

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


def _client_ip(request: Request) -> str:
    # Behind a reverse proxy (nginx, per this project's Dockerfile/nginx.conf),
    # the real client IP arrives via X-Forwarded-For; fall back to the direct
    # connecting peer if that header isn't present.
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.post("/login", response_model=schemas.Token)
def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = auth.authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = auth.create_access_token(
        data={"sub": user.username, "role": user.role.value},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )

    # Record who logged in, from where, and with what device/browser - shown
    # to admins on the Settings > Login Activity panel. Best-effort: a
    # logging failure should never block an otherwise-successful login.
    try:
        ua = request.headers.get("user-agent", "")
        log = models.LoginLog(
            user_id=user.id,
            username=user.username,
            full_name=user.full_name,
            role=user.role.value,
            ip_address=_client_ip(request),
            user_agent=ua,
            device_summary=summarize_user_agent(ua),
        )
        db.add(log)
        db.commit()
    except Exception:
        db.rollback()

    return schemas.Token(access_token=access_token, role=user.role.value, username=user.username)


@router.get("/login-history", response_model=list[schemas.LoginLogOut])
def login_history(
    limit: int = 200,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(auth.require_admin),
):
    """Admin-only: who has logged into the system, from what device/IP, and when."""
    return (
        db.query(models.LoginLog)
        .order_by(models.LoginLog.login_at.desc())
        .limit(min(limit, 1000))
        .all()
    )


@router.get("/me", response_model=schemas.UserOut)
def read_current_user(current_user: models.User = Depends(auth.get_current_user)):
    return current_user


@router.post("/register", response_model=schemas.UserOut)
def register_viewer(payload: schemas.UserRegister, db: Session = Depends(get_db)):
    """
    Public, no login required: anyone can create their own account here, but
    it is always created with the Viewer role (view-only access to the book
    catalog and counts) - never Admin. Admins are created separately via the
    admin-only POST /users endpoint below.

    Only name, mobile number, and password are collected (confirm password
    is checked client-side). The mobile number doubles as the login
    username, so there's nothing extra to remember.
    """
    mobile = payload.mobile_number.strip()
    if db.query(models.User).filter(models.User.username == mobile).first():
        raise HTTPException(status_code=400, detail="An account with this mobile number already exists")
    user = models.User(
        username=mobile,
        full_name=payload.full_name,
        mobile_number=mobile,
        hashed_password=auth.get_password_hash(payload.password),
        role=models.UserRole.VIEWER,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/users", response_model=schemas.UserOut)
def create_user(payload: schemas.UserCreate, db: Session = Depends(get_db),
                 _admin: models.User = Depends(auth.require_admin)):
    """Admin-only: create additional viewer/admin accounts."""
    if db.query(models.User).filter(models.User.username == payload.username).first():
        raise HTTPException(status_code=400, detail="Username already exists")
    user = models.User(
        username=payload.username,
        full_name=payload.full_name,
        mobile_number=payload.mobile_number,
        hashed_password=auth.get_password_hash(payload.password),
        role=payload.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/users", response_model=list[schemas.UserOut])
def list_users(db: Session = Depends(get_db), _admin: models.User = Depends(auth.require_admin)):
    return db.query(models.User).all()


@router.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db),
                 admin: models.User = Depends(auth.require_admin)):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"detail": "User deleted"}
