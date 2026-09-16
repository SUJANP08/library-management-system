WHERE EACH FILE GOES
====================

Files are laid out in the same structure as your project. Copy them over
the matching paths, EXCEPT the three dotfiles, which were renamed here
because dotfiles are easy to miss in a download:

  backend/gitignore.txt      ->  backend/.gitignore        (new file)
  backend/dockerignore.txt   ->  backend/.dockerignore     (new file)
  backend/env.example.txt    ->  backend/.env.example      (replaces existing)

Everything else keeps its path as-is:

  backend/app/config.py                            (modified)
  backend/app/database.py                          (modified)
  backend/app/main.py                              (modified)
  backend/scripts/__init__.py                      (new, empty)
  backend/scripts/migrate_sqlite_to_postgres.py    (new)
  frontend/src/api/keepAlive.ts                    (new, imported nowhere)
  render.yaml                                      (new, optional, repo root)

NOT MODIFIED: models.py, schemas.py, crud.py, auth.py, every router
(including backup_router.py), requirements.txt, Dockerfile, and the
entire frontend UI.

AFTER COPYING, remove the database from git tracking:

  git rm --cached backend/library.db

This keeps your local copy of the file but stops it being baked into the
Docker image on every deploy.

Full instructions: DEPLOYMENT_RENDER.md
