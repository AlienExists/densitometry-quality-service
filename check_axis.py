import sys
from pathlib import Path

import numpy as np
import pandas as pd
from PIL import Image, ImageDraw

from contract import AXIS_THRESHOLD_DEG, REGION_LUMBAR_SPINE, VIOLATION_AXIS_MISALIGNMENT, PIXEL_SPACING_MM
from preprocessing import read_dicom, to_unit_range
from spine_axis import estimate_axis

THRESHOLD_DEG = AXIS_THRESHOLD_DEG


def auc(scores, labels):
    scores, labels = np.asarray(scores, float), np.asarray(labels, int)
    order = scores.argsort()
    ranks = np.empty(len(scores)); ranks[order] = np.arange(1, len(scores) + 1)
    for v in np.unique(scores):
        m = scores == v
        ranks[m] = ranks[m].mean()
    pos = labels == 1
    n_pos, n_neg = pos.sum(), (~pos).sum()
    return (ranks[pos].sum() - n_pos * (n_pos + 1) / 2) / (n_pos * n_neg)


def save_preview(arr01, res, label, path):
    img = Image.fromarray((arr01 * 255).astype(np.uint8)).convert("RGB")
    scale = 2
    img = img.resize((img.width * scale, img.height * scale), Image.Resampling.NEAREST)
    draw = ImageDraw.Draw(img)
    if res["ok"]:
        for r, c in zip(res["rows"][::3], res["centers"][::3]):
            draw.ellipse([c * scale - 2, r * scale - 2, c * scale + 2, r * scale + 2], fill=(255, 60, 60))
        h = arr01.shape[0]
        for r0, r1 in ((0, h - 1),):
            x0 = (res["slope"] * r0 * PIXEL_SPACING_MM["row"] + res["intercept_mm"]) / PIXEL_SPACING_MM["col"]
            x1 = (res["slope"] * r1 * PIXEL_SPACING_MM["row"] + res["intercept_mm"]) / PIXEL_SPACING_MM["col"]
            draw.line([(x0 * scale, r0 * scale), (x1 * scale, r1 * scale)], fill=(60, 220, 60), width=2)
        for (sl, ic, seg_rows), color in zip(res["segments"], ((80, 160, 255), (255, 200, 40))):
            if len(seg_rows) and not np.isnan(sl):
                ra, rb = seg_rows.min(), seg_rows.max()
                xa = (sl * ra * PIXEL_SPACING_MM["row"] + ic) / PIXEL_SPACING_MM["col"]
                xb = (sl * rb * PIXEL_SPACING_MM["row"] + ic) / PIXEL_SPACING_MM["col"]
                draw.line([(xa * scale, ra * scale), (xb * scale, rb * scale)], fill=color, width=2)
    text = (f"all {res['angle_deg']:+.1f} | top {res.get('angle_top_deg', float('nan')):+.1f} "
            f"| bottom {res.get('angle_bottom_deg', float('nan')):+.1f} | expert: {'AXIS TILTED' if label else 'normal'}")
    draw.rectangle([0, 0, img.width, 16], fill=(0, 0, 0))
    draw.text((4, 3), text, fill=(255, 255, 255))
    img.save(path)


if len(sys.argv) < 3:
    print('Использование: python check_axis.py "<папка_Исследования>" train_index.csv [labels_by_study.csv]')
    sys.exit(1)

root = Path(sys.argv[1])
tables = {a: pd.read_csv(a, keep_default_na=False) for a in sys.argv[2:4]}
index_name = next((a for a, t in tables.items() if "rel_path" in t.columns), None)
labels_name = next((a for a, t in tables.items() if "comment" in t.columns and "rel_path" not in t.columns), None)
if index_name is None:
    print("ОШИБКА: среди переданных файлов нет train_index.csv (нужна колонка rel_path).")
    print("Переданы:", ", ".join(f"{a} (колонки: {', '.join(t.columns)})" for a, t in tables.items()))
    sys.exit(1)
if index_name != sys.argv[2]:
    print(f"Файлы переданы в другом порядке — это не страшно: выборка взята из {index_name}")
df = tables[index_name].copy()
df = df[(df.region == REGION_LUMBAR_SPINE) & (df.questionable == "")].reset_index(drop=True)
df["axis_label"] = df.violations.apply(lambda v: int(VIOLATION_AXIS_MISALIGNMENT in v.split(";")))
print(f"Снимков позвоночника: {len(df)}, из них с наклоном оси по эксперту: {df.axis_label.sum()}")

results, arrays = [], []
for rel in df.rel_path:
    arr = to_unit_range(read_dicom(root / Path(*rel.split("/"))))
    res = estimate_axis(arr)
    results.append(res)
    arrays.append(arr)

df["angle_deg"] = [r["angle_deg"] for r in results]
df["abs_angle"] = df.angle_deg.abs()
df["residual_mad_mm"] = [r.get("residual_mad_mm", np.nan) for r in results]
df["inverted"] = [r["inverted"] for r in results]
for key in ("angle_top_deg", "angle_bottom_deg", "same_direction", "consistent_tilt_deg", "bend_deg"):
    df[key] = [r.get(key, np.nan) for r in results]
df["scoliosis"] = 0
if labels_name is not None:
    lab = tables[labels_name]
    comments = lab[lab.region == REGION_LUMBAR_SPINE].set_index("study_uid").comment
    df["scoliosis"] = df.study_uid.map(comments).fillna("").str.lower().str.contains("сколиоз").astype(int)
df.drop(columns=[c for c in ("path",) if c in df]).to_csv("axis_angles.csv", index=False)

ok = df.angle_deg.notna()
print(f"Угол посчитан для {ok.sum()} снимков из {len(df)}; инверсия яркости понадобилась: {df.inverted.sum()}")
print("\n|угол| по группам (градусы):")
print(df[ok].groupby("axis_label").abs_angle.describe()[["count", "mean", "50%", "min", "max"]].round(2)
      .rename(index={0: "норма", 1: "ось не выровнена"}).to_string())
print(f"\nROC-AUC модуля угла для нарушения оси: {auc(df[ok].abs_angle, df[ok].axis_label):.3f}")

print(f"ROC-AUC согласованного наклона: {auc(df[ok].consistent_tilt_deg, df[ok].axis_label):.3f}")


def report(name, pred):
    y = df.axis_label == 1
    tp = int((pred & y).sum()); fp = int((pred & ~y).sum()); fn = int((~pred & y).sum())
    prec = tp / (tp + fp) if tp + fp else 0.0
    rec = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * prec * rec / (prec + rec) if prec + rec else 0.0
    fp_sc = int((pred & ~y & (df.scoliosis == 1)).sum())
    print(f"{name:52s} TP={tp} FP={fp} (из них сколиоз {fp_sc}) FN={fn} | P {prec:.2f}  R {rec:.2f}  F1 {f1:.2f}")


print()
report(f"А: |общий угол| > {THRESHOLD_DEG}°", df.abs_angle > THRESHOLD_DEG)
report(f"Б: |общий угол| > {THRESHOLD_DEG}° и половины в одну сторону", (df.abs_angle > THRESHOLD_DEG) & df.same_direction.astype(bool))
report(f"В: обе половины наклонены > {THRESHOLD_DEG}° в одну сторону", df.consistent_tilt_deg > THRESHOLD_DEG)
if df.scoliosis.sum():
    print(f"\nСнимков со сколиозом по комментарию эксперта: {df.scoliosis.sum()}")
    print(df.groupby(["axis_label", "scoliosis"])[["abs_angle", "consistent_tilt_deg", "bend_deg"]].mean().round(2).to_string())

print("\nСнимки, где эксперт отметил наклон оси:")
print(df[df.axis_label == 1][["study_uid", "angle_deg", "angle_top_deg", "angle_bottom_deg", "consistent_tilt_deg"]].round(2).to_string(index=False))

out = Path("axis_previews"); out.mkdir(exist_ok=True)
show = list(df[df.axis_label == 1].index) + list(df[df.axis_label == 0].nlargest(6, "abs_angle").index) \
    + list(df[df.axis_label == 0].nsmallest(3, "abs_angle").index)
for i in show:
    tag = "axis" if df.axis_label[i] else "norm"
    save_preview(arrays[i], results[i], df.axis_label[i], out / f"{tag}_{abs(df.angle_deg[i]):05.1f}_{df.study_uid[i][:20]}.png")
print(f"\nКартинки для проверки глазами: {len(show)} шт. в папке {out}")
print("Таблица со всеми углами: axis_angles.csv")
