import sys
from pathlib import Path

import numpy as np
import pandas as pd

from contract import DISABLED_VIOLATIONS, REGION_LUMBAR_SPINE, REGION_PROXIMAL_FEMUR
from preprocessing import read_dicom, to_model_input, to_unit_range
from visualize import ASCII_NAMES, gray_rgb, overlay_heatmap, save_panels

WEIGHT_FILES = {REGION_LUMBAR_SPINE: "spine.pt", REGION_PROXIMAL_FEMUR: "femur.pt"}
REGION_SLUGS = {REGION_LUMBAR_SPINE: "spine", REGION_PROXIMAL_FEMUR: "femur"}
TOP_FALSE_ALARMS = 5


def predict(model, x: np.ndarray) -> np.ndarray:
    import torch
    with torch.no_grad():
        return torch.sigmoid(model(torch.from_numpy(x)[None]))[0].numpy()


def main():
    if len(sys.argv) < 3:
        print('Использование: python make_heatmaps.py "<папка_Исследования>" train_index.csv [папка_с_весами]')
        sys.exit(1)
    from gradcam import GradCAM
    from model import load_checkpoint

    root = Path(sys.argv[1])
    index = pd.read_csv(sys.argv[2], keep_default_na=False)
    weights = Path(sys.argv[3]) if len(sys.argv) > 3 else Path("weights")
    out = Path("heatmaps")

    for region, fname in WEIGHT_FILES.items():
        model, meta = load_checkpoint(weights / fname)
        engine = GradCAM(model)
        df = index[(index.region == region) & (index.questionable == "")].reset_index(drop=True)
        arrays = [to_unit_range(read_dicom(root / Path(*r.split("/")))) for r in df.rel_path]
        inputs = [to_model_input(a) for a in arrays]
        probs = np.array([predict(model, x) for x in inputs])
        print(f"{region}: {len(df)} снимков")

        for j, name in enumerate(meta["violations"]):
            if name in DISABLED_VIOLATIONS:
                continue
            truth = df.violations.apply(lambda v: name in v.split(";")).values
            folder = out / f"{REGION_SLUGS[region]}_{ASCII_NAMES[name].replace(' ', '_')}"
            chosen = [(i, "pos") for i in np.where(truth)[0]]
            neg = np.where(~truth)[0]
            chosen += [(i, "fp") for i in neg[np.argsort(-probs[neg, j])][:TOP_FALSE_ALARMS]]
            for i, kind in chosen:
                h = min(arrays[i].shape[0], inputs[i].shape[1])
                cam = engine(inputs[i], j)[:h]
                verdict = "эксперт: нарушение есть" if kind == "pos" else "эксперт: нарушения нет"
                save_panels([(f"{df.study_uid[i][:24]}\n{verdict}", gray_rgb(arrays[i][:h])),
                             (f"{name}\nмодель: {probs[i, j]:.2f}", overlay_heatmap(arrays[i][:h], cam))],
                            folder / f"{kind}_{probs[i, j]:.2f}_{df.study_uid[i][:20]}.png")
            print(f"   {name}: {int(truth.sum())} с нарушением + {min(TOP_FALSE_ALARMS, len(neg))} самых уверенных "
                  f"ложных тревог -> {folder}")
    print("\nВнимание: финальные модели обучались на этих снимках, поэтому уверенность на них завышена. "
          "Смотрим не на цифры, а на то, КУДА смотрит модель.")


if __name__ == "__main__":
    main()
