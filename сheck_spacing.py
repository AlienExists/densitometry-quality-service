import sys
from collections import Counter
from pathlib import Path
import pydicom

TAGS = ["PixelSpacing", "ImagerPixelSpacing", "PixelAspectRatio", "NominalScannedPixelSpacing"]
counts = {t: Counter() for t in TAGS}
sizes = Counter()
for p in Path(sys.argv[1]).rglob("*.dcm"):
    ds = pydicom.dcmread(str(p), stop_before_pixels=True)
    sizes[(int(ds.Columns))] += 1
    for t in TAGS:
        counts[t][str(getattr(ds, t, "нет"))] += 1
print("ширина снимков:", dict(sizes))
for t, c in counts.items():
    print(f"{t}: {dict(c)}")