from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas, auth, crud, ml_classifier

router = APIRouter(prefix="/api/category-finder", tags=["Category Finder"])


@router.get("/suggest", response_model=schemas.CategorySuggestionResponse)
def suggest_category(
    title: str = Query(..., min_length=1, description="Book title to classify"),
    author: Optional[str] = Query(None, description="Author name (optional, improves suggestion accuracy)"),
    db: Session = Depends(get_db),
    _user: models.User = Depends(auth.get_current_user),
):
    """
    Book Classification Assistant: given a title (and optionally an author),
    returns:
      - exact_match: if this exact book is already catalogued, its current
        Main Series / Sub-Series classification.
      - suggestions: best-guess Main Series / Sub-Series classifications
        ranked by confidence. Once the library has enough catalogued data,
        this is powered by an ML model (TF-IDF + KNN + Nearest-Centroid)
        trained on the library's own catalog, so it generalizes even to
        titles that don't closely resemble anything already catalogued -
        not just simple author/title matching.
      - similar_titles: existing books most similar to the one typed (in the
        same trained vector space, once the model is active), for context on
        why a suggestion was made.
      - recommend_new_category: true when nothing catalogued is a confident
        match, signalling that creating a brand-new Main Series / Sub-Series
        is probably the better call rather than force-fitting an existing one.
    The librarian can always override any suggestion manually.
    """
    return crud.suggest_category(db, title=title, author=author)


@router.post("/suggest", response_model=schemas.CategorySuggestionResponse)
def suggest_category_post(
    payload: schemas.CategorySuggestionRequest,
    db: Session = Depends(get_db),
    _user: models.User = Depends(auth.get_current_user),
):
    """Same as GET /suggest, provided as POST for convenience when calling from forms."""
    return crud.suggest_category(db, title=payload.title, author=payload.author)


@router.get("/status", response_model=schemas.ModelStatusOut)
def get_model_status(db: Session = Depends(get_db), _user: models.User = Depends(auth.get_current_user)):
    """Reports whether the ML classifier is currently active, how many
    catalogued books it was trained on, and how many books/categories exist
    in total - shown in the Category Finder page so librarians understand
    why suggestions are (or aren't) ML-powered yet."""
    return ml_classifier.status(db)


@router.post("/retrain", response_model=schemas.ModelStatusOut)
def retrain_model(db: Session = Depends(get_db), _admin: models.User = Depends(auth.require_admin)):
    """Forces an immediate retrain of the ML classifier on the current
    catalog, instead of waiting for the next automatic staleness check.
    Useful right after a bulk import or a round of reclassification."""
    ml_classifier.force_retrain(db)
    return ml_classifier.status(db)
