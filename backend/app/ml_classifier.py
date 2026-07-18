"""
Machine-learning classifier powering the Category Finder / Book
Classification Assistant.

Approach
--------
A small text-classification model is trained directly on the library's own
catalog - (title + author) -> (Main Series, Sub-Series) - using scikit-learn:

  1. TfidfVectorizer over character n-grams (analyzer="char_wb"). Character
     n-grams are script-agnostic: they work for Kannada, English, or mixed/
     transliterated text without needing a language-specific tokenizer or
     stopword list, and are robust to small spelling differences.
  2. A K-Nearest-Neighbours vote (cosine distance) among the closest
     cataloged books - "this new title looks just like these N existing
     books, which are mostly filed under category X".
  3. A Nearest-Centroid model (cosine distance to each category's average
     vector) - "this new title fits the overall theme of category X even
     if no single existing book is a near-duplicate".
  4. The two signals are blended into a single confidence score per
     candidate category, then a small deterministic bonus is added when the
     author already has other books catalogued (a very high-precision
     signal on its own).

This combination is well suited to library catalogs specifically because
they typically have many categories with only a handful of examples each -
a regime where nearest-neighbour/centroid methods are far more reliable
than a purely parametric classifier (e.g. logistic regression) would be.

The model is retrained automatically whenever the catalog changes (a cheap
signature - book count + latest update timestamp - is checked on every
request) and cached in memory between requests so repeated lookups stay
fast.

If the library doesn't have enough data to train on yet, or a new title
looks like nothing already catalogued, the caller is told so explicitly
(via low/zero confidence and the recommend_new_* flags computed in
crud.suggest_category) rather than being handed a fabricated guess - a
librarian can then create a brand-new Sub-Series or Main Series instead.
"""
from __future__ import annotations

import threading
from dataclasses import dataclass
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app import models

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.neighbors import KNeighborsClassifier, NearestCentroid
    from sklearn.metrics.pairwise import cosine_similarity
    SKLEARN_AVAILABLE = True
except ImportError:  # pragma: no cover - only hit if scikit-learn isn't installed
    SKLEARN_AVAILABLE = False


# A library catalog is inherently small, so require only a modest amount of
# data before trusting the model over the plain heuristic fallback.
MIN_BOOKS_TO_TRAIN = 4
MIN_CLASSES_TO_TRAIN = 2


def _book_text(title: str, author: str) -> str:
    """Featurized text for a book: title plus the author repeated so the
    (usually much shorter) author name carries real weight in the char
    n-gram vector instead of being drowned out by a long title."""
    title = (title or "").strip()
    author = (author or "").strip()
    return f"{title}  {author}  {author}".strip()


@dataclass
class TrainedModel:
    vectorizer: "TfidfVectorizer"
    knn: "KNeighborsClassifier"
    centroid: "NearestCentroid"
    labels: list[tuple[int, Optional[int]]]          # class index -> (series_id, sub_series_id)
    book_vectors: object                              # sparse matrix, one row per training book
    book_refs: list[tuple[int, int, Optional[int]]]   # (book_id, series_id, sub_series_id), aligned to book_vectors
    book_count: int
    class_count: int


@dataclass
class Prediction:
    series_id: int
    sub_series_id: Optional[int]
    confidence: float


class _ModelCache:
    def __init__(self):
        self._lock = threading.Lock()
        self._signature = None
        self._model: Optional[TrainedModel] = None

    def get(self, db: Session) -> Optional[TrainedModel]:
        if not SKLEARN_AVAILABLE:
            return None
        sig = _data_signature(db)
        with self._lock:
            if sig != self._signature:
                self._model = _train(db)
                self._signature = sig
            return self._model


_cache = _ModelCache()


def get_model(db: Session) -> Optional[TrainedModel]:
    """Returns the cached trained model, retraining first if the catalog
    has changed since it was last built. Returns None if scikit-learn isn't
    installed or there isn't enough data yet to train a meaningful model."""
    return _cache.get(db)


def force_retrain(db: Session) -> Optional[TrainedModel]:
    """Ignores the cached signature and retrains immediately - used by the
    admin-triggered 'Retrain Model' action so a librarian doesn't have to
    wait for the next catalog change to pick up recent reclassifications."""
    with _cache._lock:
        _cache._signature = None
    return _cache.get(db)


def status(db: Session) -> dict:
    """Lightweight status summary for the Category Finder UI: whether the
    ML model is currently active, and how much data it was trained on."""
    model = get_model(db)
    total_books = db.query(func.count(models.Book.id)).scalar() or 0
    return {
        "sklearn_available": SKLEARN_AVAILABLE,
        "active": model is not None,
        "trained_on_books": model.book_count if model else 0,
        "classes": model.class_count if model else 0,
        "total_books": total_books,
        "min_books_required": MIN_BOOKS_TO_TRAIN,
    }


def _data_signature(db: Session):
    count = db.query(func.count(models.Book.id)).scalar() or 0
    latest = db.query(func.max(models.Book.updated_at)).scalar()
    return (count, latest.isoformat() if latest else None)


def _train(db: Session) -> Optional[TrainedModel]:
    books = db.query(models.Book).all()
    if len(books) < MIN_BOOKS_TO_TRAIN:
        return None

    texts, label_keys = [], []
    for b in books:
        texts.append(_book_text(b.title, b.author))
        label_keys.append((b.series_id, b.sub_series_id))

    distinct_labels = sorted(set(label_keys), key=lambda k: (k[0], k[1] if k[1] is not None else -1))
    if len(distinct_labels) < MIN_CLASSES_TO_TRAIN:
        return None

    label_index = {key: i for i, key in enumerate(distinct_labels)}
    y = [label_index[k] for k in label_keys]

    vectorizer = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 4), min_df=1, sublinear_tf=True)
    X = vectorizer.fit_transform(texts)

    n_neighbors = min(5, len(books))
    knn = KNeighborsClassifier(n_neighbors=n_neighbors, metric="cosine", weights="distance")
    knn.fit(X, y)

    # NearestCentroid only accepts "euclidean"/"manhattan" in current
    # scikit-learn versions (cosine was removed). TfidfVectorizer already
    # L2-normalizes every row by default, so for unit-length vectors
    # Euclidean distance is a monotonic function of cosine distance
    # (||a-b||^2 == 2 - 2*cos_sim), so ranking/centroid behavior is
    # unchanged - this is just working around the removed metric option.
    centroid = NearestCentroid(metric="euclidean")
    centroid.fit(X, y)

    book_refs = [(b.id, b.series_id, b.sub_series_id) for b in books]

    return TrainedModel(
        vectorizer=vectorizer, knn=knn, centroid=centroid,
        labels=distinct_labels, book_vectors=X, book_refs=book_refs,
        book_count=len(books), class_count=len(distinct_labels),
    )


def predict(model: TrainedModel, title: str, author: Optional[str]) -> list[Prediction]:
    """Ranks candidate (Main Series, Sub-Series) classes for a new title/
    author by blending a K-Nearest-Neighbours vote with Nearest-Centroid
    cosine similarity."""
    query = model.vectorizer.transform([_book_text(title, author or "")])

    k = min(len(model.book_refs), model.knn.n_neighbors)
    _, neighbor_idx = model.knn.kneighbors(query, n_neighbors=k)
    vote_counts: dict[int, int] = {}
    for idx in neighbor_idx[0]:
        _, series_id, sub_series_id = model.book_refs[idx]
        key = (series_id, sub_series_id)
        if key in model.labels:
            i = model.labels.index(key)
            vote_counts[i] = vote_counts.get(i, 0) + 1
    total_votes = sum(vote_counts.values()) or 1

    centroid_sims = cosine_similarity(query, model.centroid.centroids_)[0]

    scores: dict[int, float] = {}
    for i in range(len(model.labels)):
        vote_share = vote_counts.get(i, 0) / total_votes
        centroid_sim = max(0.0, float(centroid_sims[i]))
        scores[i] = 0.55 * vote_share + 0.45 * centroid_sim

    ranked = sorted(scores.items(), key=lambda kv: -kv[1])[:5]
    predictions = []
    for i, score in ranked:
        if score <= 0:
            continue
        series_id, sub_series_id = model.labels[i]
        predictions.append(Prediction(series_id=series_id, sub_series_id=sub_series_id,
                                       confidence=round(min(0.97, score), 3)))
    return predictions


def similar_books(model: TrainedModel, title: str, author: Optional[str], top_n: int = 5) -> list[tuple[int, float]]:
    """Returns (book_id, similarity) pairs for the cataloged books most
    similar to the query, computed in the same trained TF-IDF space (more
    principled than a plain string diff, and multilingual by construction)."""
    query = model.vectorizer.transform([_book_text(title, author or "")])
    sims = cosine_similarity(query, model.book_vectors)[0]
    order = sims.argsort()[::-1][:top_n]
    return [(model.book_refs[i][0], float(sims[i])) for i in order if sims[i] > 0.05]
