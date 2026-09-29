from __future__ import annotations

import re
import sys
import time
from pathlib import Path

import pandas as pd

from contract import (DISABLED_VIOLATIONS, REGION_CONFIDENCE, REGION_LUMBAR_SPINE, REGION_PROXIMAL_FEMUR,
                      REPORT_COLUMNS, STATUS_FAILURE, VIOLATION_AXIS_MISALIGNMENT, VIOLATIONS_BY_REGION,
                      axis_probability, build_row)
from preprocessing import pixel_hash, prepare, to_model_input, to_region_input
from spine_axis import estimate_axis

UID_RE = re.compile(r"^[0-9]+(\.[0-9]+)+$")
WEIGHT_FILES = {REGION_LUMBAR_SPINE: "spine.pt", REGION_PROXIMAL_FEMUR: "femur.pt"}
REGION_WEIGHT_FILE = "region.pt"

EVENT_DISAGREE = "Правило по ширине и классификатор зоны расходятся, оставлена зона по правилу"
EVENT_FALLBACK = "Нестандартная ширина, зона определена классификатором"
EVENT_UNSURE = "Нестандартная ширина, классификатор зоны не уверен"
EVENT_NO_MODEL = "Нестандартная ширина, классификатора зоны нет"
EVENT_NO_AXIS = "Угол оси позвоночника не удалось измерить"
EVENT_NO_VISUAL = "Не удалось построить визуализацию нарушений"


class QualityAnalyzer:
    def __init__(self, weights_dir: str | Path | None = None, dummy: bool = False,
                 device: str = "cpu"):
        self.dummy = dummy
        self.models = {}
        self.region_model = None
        self.warnings: list[dict] = []
        if dummy:
            return
        import torch
        from model import load_checkpoint, load_region_checkpoint
        torch.use_deterministic_algorithms(True, warn_only=True)
        self._torch = torch
        self.device = device
        for region, fname in WEIGHT_FILES.items():
            model, meta = load_checkpoint(Path(weights_dir) / fname, device)
            if meta["region"] != region:
                raise ValueError(f"{fname} обучен для зоны {meta['region']!r}, а не {region!r}")
            self.models[region] = (model, meta)
        region_path = Path(weights_dir) / REGION_WEIGHT_FILE
        if region_path.exists():
            self.region_model = load_region_checkpoint(region_path, device)

    def _predict(self, region, x) -> tuple[dict, dict]:
        if self.dummy:
            names = VIOLATIONS_BY_REGION[region]
            return {n: 0.0 for n in names}, {n: 0.5 for n in names}
        model, meta = self.models[region]
        torch = self._torch
        with torch.no_grad():
            logits = model(torch.from_numpy(x)[None].to(self.device))[0]
            probs = torch.sigmoid(logits).cpu().numpy()
        return dict(zip(meta["violations"], map(float, probs))), meta["thresholds"]

    def _classify_region(self, arr01) -> tuple[str, float] | None:
        if self.region_model is None:
            return None
        model, meta = self.region_model
        torch = self._torch
        with torch.no_grad():
            logits = model(torch.from_numpy(to_region_input(arr01))[None].to(self.device))[0]
            probs = torch.softmax(logits, dim=0).cpu().numpy()
        j = int(probs.argmax())
        return meta["classes"][j], float(probs[j])

    def _warn(self, path, ds, rule_region, guess, event):
        self.warnings.append({
            "path_to_study": str(path),
            "rows": int(ds.Rows),
            "columns": int(ds.Columns),
            "zone_by_rule": rule_region or "",
            "zone_by_classifier": guess[0] if guess else "",
            "classifier_confidence": round(guess[1], 4) if guess else None,
            "event": event,
        })

    def _resolve_region(self, path, ds, rule_region, arr01) -> str | None:
        guess = self._classify_region(arr01)
        if rule_region is not None:
            if guess is not None and guess[0] != rule_region:
                self._warn(path, ds, rule_region, guess, EVENT_DISAGREE)
            return rule_region
        if guess is None:
            self._warn(path, ds, rule_region, guess, EVENT_NO_MODEL)
            return None
        if guess[1] >= REGION_CONFIDENCE:
            self._warn(path, ds, rule_region, guess, EVENT_FALLBACK)
            return guess[0]
        self._warn(path, ds, rule_region, guess, EVENT_UNSURE)
        return None

    def _apply_geometry(self, path, ds, region, arr01, probs, thresholds):
        probs = {k: v for k, v in probs.items() if k not in DISABLED_VIOLATIONS}
        thresholds = dict(thresholds)
        axis = None
        if region == REGION_LUMBAR_SPINE:
            axis = estimate_axis(arr01)
            if axis["ok"]:
                probs[VIOLATION_AXIS_MISALIGNMENT] = axis_probability(axis["angle_deg"])
                thresholds[VIOLATION_AXIS_MISALIGNMENT] = 0.5
            else:
                self._warn(path, ds, region, None, EVENT_NO_AXIS)
        return probs, thresholds, axis

    def _save_visual(self, out_path, region, arr01, x, probs, thresholds, axis):
        from gradcam import GradCAM
        from visualize import draw_axis, gray_rgb, overlay_heatmap, save_panels
        active = [n for n, p in probs.items() if p >= thresholds.get(n, 0.5)]
        if not active:
            return
        model, meta = self.models[region]
        engine = GradCAM(model)
        h = min(arr01.shape[0], x.shape[1])
        panels = [(region, gray_rgb(arr01[:h]))]
        for name in active:
            if name == VIOLATION_AXIS_MISALIGNMENT and axis is not None and axis.get("ok"):
                panels.append((f"{name}\nугол {axis['angle_deg']:+.1f}°", draw_axis(arr01[:h], axis)))
            elif name in meta["violations"]:
                cam = engine(x, meta["violations"].index(name))[:h]
                panels.append((f"{name}\nуверенность {probs[name]:.2f}", overlay_heatmap(arr01[:h], cam)))
        save_panels(panels, out_path)

    @staticmethod
    def _study_folder_uid(path: Path) -> str:
        for part in reversed(path.parts):
            if UID_RE.match(part):
                return part
        return ""

    def analyze_study(self, study_dir: str | Path, dedupe: bool = True,
                      visual_dir: str | Path | None = None) -> list[dict]:
        self.warnings = []
        study_dir = Path(study_dir)
        rows, seen = [], set()
        for path in sorted(p for p in study_dir.rglob("*") if p.is_file()):
            start = time.perf_counter()
            try:
                ds, rule_region, arr01 = prepare(path)
                digest = pixel_hash(ds)
                if dedupe and digest in seen:
                    continue
                seen.add(digest)
                study_uid = str(getattr(ds, "StudyInstanceUID", "")) or self._study_folder_uid(path)
                image_uid = str(getattr(ds, "SOPInstanceUID", ""))

                region = self._resolve_region(path, ds, rule_region, arr01)
                if region is None:
                    rows.append(build_row(str(path), study_uid, image_uid, "", {},
                                          time.perf_counter() - start, status=STATUS_FAILURE))
                    continue

                x = to_model_input(arr01)
                probs, thresholds = self._predict(region, x)
                probs, thresholds, axis = self._apply_geometry(path, ds, region, arr01, probs, thresholds)
                rows.append(build_row(str(path), study_uid, image_uid, region, probs,
                                      time.perf_counter() - start, thresholds=thresholds))
                if visual_dir is not None and not self.dummy:
                    try:
                        name = f"{self._study_folder_uid(path) or 'study'}_{digest[:12]}.png"
                        self._save_visual(Path(visual_dir) / name, region, arr01, x, probs, thresholds, axis)
                    except Exception:
                        self._warn(path, ds, region, None, EVENT_NO_VISUAL)
            except Exception:
                rows.append(build_row(str(path), self._study_folder_uid(path), "", "", {},
                                      time.perf_counter() - start, status=STATUS_FAILURE))
        return rows

    def analyze_batch(self, root: str | Path, visual_dir: str | Path | None = None) -> list[dict]:
        root = Path(root)
        studies = sorted({p for p in root.rglob("*") if p.is_dir() and UID_RE.match(p.name)})
        top = [s for s in studies if not any(parent in studies for parent in s.parents)]
        rows, all_warnings = [], []
        for study in top:
            rows.extend(self.analyze_study(study, visual_dir=visual_dir))
            all_warnings.extend(self.warnings)
        self.warnings = all_warnings
        return rows

    @staticmethod
    def write_report(rows: list[dict], path: str | Path) -> None:
        pd.DataFrame(rows, columns=REPORT_COLUMNS).to_excel(path, index=False)

    def write_warnings(self, path: str | Path) -> None:
        pd.DataFrame(self.warnings).to_excel(path, index=False)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Использование: python analyzer.py <папка_с_исследованиями> report.xlsx [--dummy] [--visual]")
        sys.exit(1)
    dummy = "--dummy" in sys.argv
    visual_dir = Path(sys.argv[2]).with_name(Path(sys.argv[2]).stem + "_visual") if "--visual" in sys.argv else None
    analyzer = QualityAnalyzer(None if dummy else "weights", dummy=dummy)
    report_rows = analyzer.analyze_batch(sys.argv[1], visual_dir=visual_dir)
    analyzer.write_report(report_rows, sys.argv[2])
    ok = sum(r["processing_status"] != STATUS_FAILURE for r in report_rows)
    print(f"Строк в отчёте: {len(report_rows)}   Success: {ok}   Failure: {len(report_rows) - ok}")
    print(f"Сохранено: {sys.argv[2]}")
    if visual_dir is not None and visual_dir.exists():
        print(f"Визуализации нарушений: {len(list(visual_dir.glob('*.png')))} шт. в {visual_dir}")
    if analyzer.warnings:
        warn_path = Path(sys.argv[2]).with_name(Path(sys.argv[2]).stem + "_warnings.xlsx")
        analyzer.write_warnings(warn_path)
        print(f"Предупреждений: {len(analyzer.warnings)}, сохранены в {warn_path}")
