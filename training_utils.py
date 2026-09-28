from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.metrics import f1_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import StratifiedGroupKFold

from contract import DISABLED_VIOLATIONS, VIOLATIONS_BY_REGION, threshold_score


def load_region(index_csv: str, region: str) -> tuple[pd.DataFrame, np.ndarray, list[str]]:
    df = pd.read_csv(index_csv, keep_default_na=False)
    df = df[(df.region == region) & (df.questionable == "")].reset_index(drop=True)
    names = VIOLATIONS_BY_REGION[region]
    Y = np.array([[1 if n in v.split(";") else 0 for n in names] for v in df.violations],
                 dtype=np.float32)
    return df, Y, names


def make_folds(df: pd.DataFrame, Y: np.ndarray, n_splits: int = 5, seed: int = 42) -> np.ndarray:
    counts = Y.sum(axis=0)
    rare_first = np.argsort(counts)
    key = []
    for row in Y:
        present = [j for j in rare_first if row[j] == 1]
        key.append(int(present[0]) if present else -1)
    folds = np.full(len(df), -1)
    splitter = StratifiedGroupKFold(n_splits=n_splits, shuffle=True, random_state=seed)
    for fold, (_, val_idx) in enumerate(splitter.split(df, key, groups=df.study_uid)):
        folds[val_idx] = fold
    return folds


def pos_weights(Y: np.ndarray, cap: float = 20.0) -> np.ndarray:
    pos = Y.sum(axis=0)
    neg = len(Y) - pos
    w = np.where(pos > 0, neg / np.maximum(pos, 1), 1.0)
    return np.clip(w, 1.0, cap).astype(np.float32)


def augment(arr01: np.ndarray, rng: np.random.Generator, hflip: bool = True) -> np.ndarray:
    x = arr01
    if hflip and rng.random() < 0.5:
        x = x[:, ::-1]
    contrast = rng.uniform(0.9, 1.1)
    brightness = rng.uniform(-0.05, 0.05)
    x = (x - 0.5) * contrast + 0.5 + brightness
    return np.clip(x, 0.0, 1.0).astype(np.float32)


def best_thresholds(Y: np.ndarray, P: np.ndarray, names: list[str]) -> dict[str, float]:
    thresholds = {}
    for j, name in enumerate(names):
        y, p = Y[:, j], P[:, j]
        if y.sum() == 0:
            thresholds[name] = 0.5
            continue
        candidates = np.unique(np.round(p, 4))
        scores = [f1_score(y, p >= t, zero_division=0) for t in candidates]
        thresholds[name] = float(candidates[int(np.argmax(scores))])
    return thresholds


def quality_scores(P: np.ndarray, names: list[str], thresholds: dict[str, float]) -> np.ndarray:
    cols = [j for j, n in enumerate(names) if n not in DISABLED_VIOLATIONS]
    scores = np.array([[threshold_score(P[i, j], thresholds[names[j]]) for j in cols] for i in range(len(P))])
    return scores.max(axis=1)


def metrics_table(Y: np.ndarray, P: np.ndarray, names: list[str],
                  thresholds: dict[str, float]) -> pd.DataFrame:
    rows = []
    for j, name in enumerate(names):
        y, p, t = Y[:, j], P[:, j], thresholds[name]
        pred = p >= t
        rows.append({
            "нарушение": name + (" (отключено)" if name in DISABLED_VIOLATIONS else ""),
            "примеров": int(y.sum()), "порог": round(t, 3),
            "ROC-AUC": roc_auc_score(y, p) if 0 < y.sum() < len(y) else np.nan,
            "precision": precision_score(y, pred, zero_division=0),
            "recall": recall_score(y, pred, zero_division=0),
            "F1": f1_score(y, pred, zero_division=0),
        })
    any_true = (Y.max(axis=1) > 0).astype(int)
    q = quality_scores(P, names, thresholds)
    any_pred = q >= 0.5
    rows.append({
        "нарушение": "ЛЮБОЕ (quality_class)", "примеров": int(any_true.sum()), "порог": 0.5,
        "ROC-AUC": roc_auc_score(any_true, q) if 0 < any_true.sum() < len(any_true) else np.nan,
        "precision": precision_score(any_true, any_pred, zero_division=0),
        "recall": recall_score(any_true, any_pred, zero_division=0),
        "F1": f1_score(any_true, any_pred, zero_division=0),
    })
    return pd.DataFrame(rows).round(3)


def mean_enabled_auc(Y: np.ndarray, P: np.ndarray, names: list[str]) -> float:
    aucs = [roc_auc_score(Y[:, j], P[:, j]) for j, n in enumerate(names)
            if n not in DISABLED_VIOLATIONS and 0 < Y[:, j].sum() < len(Y)]
    return float(np.mean(aucs))
