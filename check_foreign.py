import sys
from pathlib import Path

import numpy as np
import pandas as pd
from PIL import Image, ImageDraw

from contract import REGION_LUMBAR_SPINE, VIOLATION_FOREIGN_OBJECT
from foreign_objects import foreign_object_scores
from preprocessing import read_dicom, to_unit_range
from pydicom.pixels import apply_modality_lut

FEATURES = ["hot_area_mm2", "offspine_hot_area_mm2", "peak_excess", "edge_peak"]


def auc(scores, labels):
    scores, labels = np.asarray(scores, float), np.asarray(labels, int)
    order = scores.argsort()
    ranks = np.empty(len(scores)); ranks[order] = np.arange(1, len(scores) + 1)
    for v in np.unique(scores):
        m = scores == v
        ranks[m] = ranks[m].mean()
    pos = labels == 1
    return (ranks[pos].sum() - pos.sum() * (pos.sum() + 1) / 2) / (pos.sum() * (~pos).sum())


def f1_at(pred, y):
    tp = int((pred & y).sum()); fp = int((pred & ~y).sum()); fn = int((~pred & y).sum())
    p = tp / (tp + fp) if tp + fp else 0.0
    r = tp / (tp + fn) if tp + fn else 0.0
    return tp, fp, fn, p, r, (2 * p * r / (p + r) if p + r else 0.0)


def make_folds(y, n=5, seed=42):
    rng = np.random.default_rng(seed)
    folds = np.empty(len(y), dtype=int)
    for cls in (0, 1):
        idx = np.where(y == cls)[0]
        rng.shuffle(idx)
        folds[idx] = np.arange(len(idx)) % n
    return folds


def cv_threshold(values, y, folds):
    pred = np.zeros(len(y), dtype=bool)
    chosen = []
    for f in np.unique(folds):
        tr, va = folds != f, folds == f
        cands = np.unique(values[tr])
        best = max(cands, key=lambda t: (f1_at(values[tr] > t, y[tr])[5], t))
        chosen.append(best)
        pred[va] = values[va] > best
    return pred, chosen


def save_preview(arr01, s, label, path):
    img = Image.fromarray((arr01 * 255).astype(np.uint8)).convert("RGB")
    rgb = np.array(img)
    rgb[s["hot_mask"]] = (255, 40, 40)
    band = s["band_mask"]
    edge = band ^ np.roll(band, 1, axis=1)
    rgb[edge] = (60, 220, 60)
    scale = 2
    img = Image.fromarray(rgb).resize((rgb.shape[1] * scale, rgb.shape[0] * scale), Image.Resampling.NEAREST)
    draw = ImageDraw.Draw(img)
    draw.rectangle([0, 0, img.width, 16], fill=(0, 0, 0))
    draw.text((4, 3), f"hot {s['hot_area_mm2']:.0f} mm2 | off-spine {s['offspine_hot_area_mm2']:.0f} | "
                      f"peak {s['peak_excess']:.2f} | expert: {'FOREIGN' if label else 'clean'}", fill=(255, 255, 255))
    img.save(path)


if len(sys.argv) < 3:
    print('Использование: python check_foreign.py "<папка_Исследования>" train_index.csv')
    sys.exit(1)

root = Path(sys.argv[1])
df = pd.read_csv(sys.argv[2], keep_default_na=False)
if "rel_path" not in df.columns:
    print("ОШИБКА: вторым аргументом нужен train_index.csv (колонка rel_path)")
    sys.exit(1)
df = df[(df.region == REGION_LUMBAR_SPINE) & (df.questionable == "")].reset_index(drop=True)
df["foreign_label"] = df.violations.apply(lambda v: int(VIOLATION_FOREIGN_OBJECT in v.split(";")))
print(f"Снимков позвоночника: {len(df)}, из них с посторонними предметами по эксперту: {df.foreign_label.sum()}")

def raw_unit_range(ds):
    raw = apply_modality_lut(ds.pixel_array, ds).astype(np.float32)
    if raw.ndim == 3:
        raw = raw[0]
    if getattr(ds, "PhotometricInterpretation", "") == "MONOCHROME1":
        raw = raw.max() - raw
    lo, hi = float(raw.min()), float(raw.max())
    return (raw - lo) / (hi - lo) if hi > lo else np.zeros_like(raw)


arrays, scores, raw_scores, clipped = [], [], [], []
for rel in df.rel_path:
    ds = read_dicom(root / Path(*rel.split("/")))
    arr = to_unit_range(ds)
    arrays.append(arr)
    sc = foreign_object_scores(arr)
    scores.append(sc)
    raw_scores.append(foreign_object_scores(raw_unit_range(ds), axis=None))
    clipped.append(float((arr >= 0.999).mean()))
for k in FEATURES + ["bone_ref"]:
    df[k] = [s[k] for s in scores]
    df["raw_" + k] = [s[k] for s in raw_scores]
df["clipped_share"] = clipped
df.to_csv("foreign_scores.csv", index=False)

print(f"\nДоля пикселей, упёршихся в белый потолок после окна (VOI LUT): "
      f"чистые {df[df.foreign_label == 0].clipped_share.mean():.3%}, с предметами {df[df.foreign_label == 1].clipped_share.mean():.3%}")

y = df.foreign_label.values.astype(bool)
print("\nСредние по группам:")
print(df.groupby("foreign_label")[FEATURES + ["bone_ref"]].mean().round(3)
      .rename(index={0: "чистые", 1: "с предметами"}).to_string())

folds = make_folds(df.foreign_label.values)
print("\nПризнак                   ROC-AUC | честная кросс-валидация порога: TP FP FN  P     R     F1")
print("--- после окна (как видит нейросеть)")
for k in FEATURES + ["---", *["raw_" + f for f in FEATURES]]:
    if k == "---":
        print("--- до окна (сырые значения после Modality LUT)")
        continue
    pred, chosen = cv_threshold(df[k].values, y, folds)
    tp, fp, fn, p, r, f1 = f1_at(pred, y)
    print(f"{k:24s} {auc(df[k], y):7.3f} | {tp:3d} {fp:3d} {fn:3d}  {p:.2f}  {r:.2f}  {f1:.2f}   пороги по частям: {[round(float(c), 3) for c in chosen]}")

out = Path("foreign_previews"); out.mkdir(exist_ok=True)
show = list(df[y].index) + list(df[~y].nlargest(6, "hot_area_mm2").index) + list(df[~y].nsmallest(3, "hot_area_mm2").index)
for i in show:
    tag = "foreign" if y[i] else "clean"
    save_preview(arrays[i], scores[i], y[i], out / f"{tag}_{df.hot_area_mm2[i]:06.0f}_{df.study_uid[i][:20]}.png")
print(f"\nКартинки для проверки глазами: {len(show)} шт. в папке {out}")
print("Таблица со всеми признаками: foreign_scores.csv")
