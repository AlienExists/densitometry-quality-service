import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "qc"))
import hashlib
import re
import sys
import warnings
from collections import defaultdict
from pathlib import Path

import numpy as np
import pandas as pd
import pydicom
from PIL import Image, ImageDraw

from contract import REGION_BY_COLUMNS, REGION_LUMBAR_SPINE, REGION_PROXIMAL_FEMUR

warnings.filterwarnings("ignore", message="Invalid value for VR UI")
from pydicom.pixels import apply_modality_lut, apply_voi_lut

UID_RE = re.compile(r"^[0-9]+(\.[0-9]+)+$")


def study_of(path: Path, root: Path) -> str:
    for part in path.relative_to(root).parts:
        if UID_RE.match(part):
            return part
    return path.relative_to(root).parts[0]


def preview(ds) -> Image.Image:
    arr = apply_modality_lut(ds.pixel_array, ds)
    try:
        arr = apply_voi_lut(arr, ds)
    except Exception:
        pass
    if getattr(ds, "PhotometricInterpretation", "") == "MONOCHROME1":
        arr = arr.max() - arr
    arr = arr.astype(np.float32)
    lo, hi = float(arr.min()), float(arr.max())
    arr = (arr - lo) / (hi - lo) if hi > lo else np.zeros_like(arr)
    return Image.fromarray((arr * 255).astype(np.uint8))


def save_side_preview(study, images, out_dir: Path):
    tiles = [(Path(p).name, preview(pydicom.dcmread(p))) for p in images]
    w = sum(t.width for _, t in tiles) + 10 * (len(tiles) + 1)
    h = max(t.height for _, t in tiles) + 35
    sheet = Image.new("L", (w, h), 40)
    draw, x = ImageDraw.Draw(sheet), 10
    for name, tile in tiles:
        sheet.paste(tile, (x, 30))
        draw.text((x, 8), name, fill=255)
        x += tile.width + 10
    out_dir.mkdir(exist_ok=True)
    sheet.save(out_dir / f"{study}.png")


if len(sys.argv) < 3:
    print('Использование: python build_index.py "<папка_с_данными>" labels_by_study.csv')
    sys.exit(1)

root = Path(sys.argv[1])
if not root.exists():
    print(f"ОШИБКА: папки нет: {root}")
    sys.exit(1)
labels = pd.read_csv(sys.argv[2], keep_default_na=False)

unique = {}
n_files = 0
for path in sorted(p for p in root.rglob("*.dcm") if p.is_file()):
    n_files += 1
    try:
        ds = pydicom.dcmread(str(path))
        digest = hashlib.md5(ds.PixelData).hexdigest()
    except Exception as exc:
        print(f"пропуск {path.name}: {type(exc).__name__}")
        continue
    key = (study_of(path, root), digest)
    if key not in unique:
        unique[key] = {"study_uid": key[0], "path": str(path),
                       "rel_path": path.relative_to(root).as_posix(), "hash": digest[:12],
                       "rows": int(ds.Rows), "columns": int(ds.Columns),
                       "region": REGION_BY_COLUMNS.get(int(ds.Columns))}
images = pd.DataFrame(unique.values())
print(f"Файлов: {n_files}   уникальных снимков: {len(images)}")

manual = {}
if Path("side_manual.xlsx").exists():
    m = pd.read_excel("side_manual.xlsx", dtype=str).fillna("")
    for _, r in m.iterrows():
        side = r["side"].strip().lower()
        if side in ("right", "left"):
            manual[Path(r["file"]).name, r["study_uid"]] = side
    print(f"Из side_manual.xlsx прочитано сторон: {len(manual)}")

rows, need_side, problems = [], [], []
lab_by_study = labels.groupby("study_uid")

for study, imgs in images.groupby("study_uid"):
    if study not in lab_by_study.groups:
        problems.append((study, "исследования нет в разметке"))
        continue
    lab = lab_by_study.get_group(study)

    sp_img = imgs[imgs.region == REGION_LUMBAR_SPINE]
    sp_lab = lab[lab.region == REGION_LUMBAR_SPINE]
    if len(sp_img) == 1 and len(sp_lab) == 1:
        l = sp_lab.iloc[0]
        rows.append({**sp_img.iloc[0].to_dict(), "side": "", "violations": l.violations,
                     "questionable": l.questionable})
    elif len(sp_img) or len(sp_lab):
        problems.append((study, f"позвоночник: снимков {len(sp_img)}, строк разметки {len(sp_lab)}"))

    f_img = imgs[imgs.region == REGION_PROXIMAL_FEMUR].sort_values("path")
    f_lab = {r.side: r for r in lab[lab.region == REGION_PROXIMAL_FEMUR].itertuples()}

    def add(img, side, l):
        rows.append({**img.to_dict(), "side": side, "violations": l.violations,
                     "questionable": l.questionable})

    if len(f_img) == 1 and len(f_lab) == 1:
        side, l = next(iter(f_lab.items()))
        add(f_img.iloc[0], side, l)
    elif len(f_img) == 2 and len(f_lab) == 2 and f_lab["right"].violations == f_lab["left"].violations:
        for _, img in f_img.iterrows():
            add(img, "any", f_lab["right"])
    elif len(f_img) == 2 and len(f_lab) in (1, 2):
        known = {manual.get((Path(p).name, study)) for p in f_img.path}
        if known == {"right", "left"}:
            for _, img in f_img.iterrows():
                side = manual[Path(img.path).name, study]
                if side in f_lab:
                    add(img, side, f_lab[side])
        else:
            for _, img in f_img.iterrows():
                need_side.append({"study_uid": study, "file": Path(img.path).name,
                                  "rows": img.rows,
                                  "метки_правого": f_lab["right"].violations or "норма" if "right" in f_lab else "НЕТ В РАЗМЕТКЕ",
                                  "метки_левого": f_lab["left"].violations or "норма" if "left" in f_lab else "НЕТ В РАЗМЕТКЕ",
                                  "side": ""})
            save_side_preview(study, list(f_img.path), Path("side_previews"))
    elif len(f_img) or len(f_lab):
        problems.append((study, f"бедро: снимков {len(f_img)}, строк разметки {len(f_lab)}"))

    other = imgs[imgs.region.isna()]
    for _, img in other.iterrows():
        problems.append((study, f"нестандартный снимок {img.rows}x{img.columns} — в обучение не берём"))

out = pd.DataFrame(rows)
out.to_csv("train_index.csv", index=False, encoding="utf-8")
print(f"\ntrain_index.csv: {len(out)} снимков "
      f"(позвоночник {(out.region == REGION_LUMBAR_SPINE).sum()}, "
      f"бедро {(out.region == REGION_PROXIMAL_FEMUR).sum()})")

if need_side:
    pd.DataFrame(need_side).to_excel("need_side.xlsx", index=False)
    n = len({r['study_uid'] for r in need_side})
    print(f"need_side.xlsx: нужно указать сторону в {n} исследованиях "
          f"(картинки — в папке side_previews)")
else:
    print("Сторону указывать больше не нужно.")

if problems:
    print(f"\nОсобые случаи: {len(problems)}")
    for s, msg in problems:
        print(f"   {s[:34]}…  {msg}")
