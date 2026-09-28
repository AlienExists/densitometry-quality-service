from __future__ import annotations
import math

REGION_LUMBAR_SPINE = "Поясничный отдел позвоночника"
REGION_PROXIMAL_FEMUR = "Проксимальный отдел бедра"

OFFICIAL_REGIONS: list[str] = [REGION_LUMBAR_SPINE, REGION_PROXIMAL_FEMUR]

REGION_OTHER_INTERNAL = "other"

REGION_LABELS: list[str] = [REGION_LUMBAR_SPINE, REGION_PROXIMAL_FEMUR, REGION_OTHER_INTERNAL]


VIOLATION_INCORRECT_POSITIONING = "Некорректная укладка"
VIOLATION_AXIS_MISALIGNMENT = "Не выравнена ось позвоночника"
VIOLATION_FOREIGN_OBJECT = "Присутствуют посторонние предметы"
VIOLATION_INCORRECT_ROI = "Некорректная область интереса"

SPINE_VIOLATIONS: list[str] = [
    VIOLATION_INCORRECT_POSITIONING,
    VIOLATION_AXIS_MISALIGNMENT,
    VIOLATION_FOREIGN_OBJECT,
]
FEMUR_VIOLATIONS: list[str] = [
    VIOLATION_INCORRECT_POSITIONING,
    VIOLATION_INCORRECT_ROI,
]

VIOLATIONS_BY_REGION: dict[str, list[str]] = {
    REGION_LUMBAR_SPINE: SPINE_VIOLATIONS,
    REGION_PROXIMAL_FEMUR: FEMUR_VIOLATIONS,
}

CANONICAL_ORDER: list[str] = [
    VIOLATION_INCORRECT_POSITIONING,
    VIOLATION_AXIS_MISALIGNMENT,
    VIOLATION_FOREIGN_OBJECT,
    VIOLATION_INCORRECT_ROI,
]


VIOLATION_SEPARATOR = ";"

EMPTY_VIOLATIONS = ""

STATUS_SUCCESS = "Success"
STATUS_FAILURE = "Failure"

REPORT_COLUMNS: list[str] = [
    "path_to_study",
    "study_uid",
    "image_uid",
    "anatomical_region",
    "quality_class",
    "quality_prob",
    "violation_type",
    "processing_status",
    "time_of_processing",
]


PIXEL_SPACING_MM = {"row": 0.60, "col": 0.60}


def pixel_delta_to_mm(d_row: float, d_col: float) -> tuple[float, float]:
    return d_row * PIXEL_SPACING_MM["row"], d_col * PIXEL_SPACING_MM["col"]


def tilt_angle_degrees(d_row: float, d_col: float) -> float:
    mm_row, mm_col = pixel_delta_to_mm(d_row, d_col)
    return math.degrees(math.atan2(mm_col, mm_row))


PAD_HEIGHT = 352
INPUT_CHANNELS = 3

REGION_BY_COLUMNS: dict[int, str] = {
    300: REGION_LUMBAR_SPINE,
    280: REGION_PROXIMAL_FEMUR,
}


def region_from_size(columns: int) -> str | None:
    return REGION_BY_COLUMNS.get(int(columns))


REGION_MODEL_CLASSES: list[str] = [REGION_LUMBAR_SPINE, REGION_PROXIMAL_FEMUR]
REGION_INPUT_SIZE = 224
REGION_CONFIDENCE = 0.9


IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)

DEFAULT_THRESHOLDS: dict[str, float] = {name: 0.5 for name in CANONICAL_ORDER}

DISABLED_VIOLATIONS: set[str] = {VIOLATION_AXIS_MISALIGNMENT}

GEOMETRY_VIOLATIONS: set[str] = {VIOLATION_AXIS_MISALIGNMENT}
AXIS_THRESHOLD_DEG = 5.0


def axis_probability(angle_deg: float) -> float:
    return float(min(abs(angle_deg) / (2 * AXIS_THRESHOLD_DEG), 1.0))


def format_violations(active: list[str], region: str) -> str:
    allowed = set(VIOLATIONS_BY_REGION[region])
    unknown = set(active) - allowed
    if unknown:
        raise ValueError(f"Нарушения {sorted(unknown)} не входят в список для региона {region!r}")

    ordered = [name for name in CANONICAL_ORDER if name in set(active)]
    return VIOLATION_SEPARATOR.join(ordered) if ordered else EMPTY_VIOLATIONS


def derive_quality_class(active: list[str]) -> int:
    return 1 if active else 0


def threshold_score(prob: float, threshold: float) -> float:
    t = min(max(threshold, 1e-6), 1 - 1e-6)
    if prob < t:
        return 0.5 * prob / t
    return 0.5 + 0.5 * (prob - t) / (1 - t)


def derive_quality_prob(
    probabilities: dict[str, float],
    thresholds: dict[str, float] | None = None,
) -> float:
    thresholds = thresholds or DEFAULT_THRESHOLDS
    scores = [threshold_score(p, thresholds.get(name, 0.5)) for name, p in probabilities.items()]
    return max(scores) if scores else 0.0


def active_violations(
    probabilities: dict[str, float],
    thresholds: dict[str, float] | None = None,
) -> list[str]:
    thresholds = thresholds or DEFAULT_THRESHOLDS
    return [name for name, p in probabilities.items() if p >= thresholds.get(name, 0.5)]


def build_row(
    path_to_study: str,
    study_uid: str,
    image_uid: str,
    region: str,
    violation_probs: dict[str, float],
    elapsed_seconds: float,
    thresholds: dict[str, float] | None = None,
    status: str = STATUS_SUCCESS,
) -> dict:
    if status == STATUS_FAILURE:
        return {
            "path_to_study": path_to_study, "study_uid": study_uid, "image_uid": image_uid,
            "anatomical_region": region if region in OFFICIAL_REGIONS else "",
            "quality_class": None, "quality_prob": None,
            "violation_type": EMPTY_VIOLATIONS,
            "processing_status": STATUS_FAILURE,
            "time_of_processing": round(elapsed_seconds, 3),
        }

    active = active_violations(violation_probs, thresholds)
    return {
        "path_to_study": path_to_study, "study_uid": study_uid, "image_uid": image_uid,
        "anatomical_region": region,
        "quality_class": derive_quality_class(active),
        "quality_prob": round(derive_quality_prob(violation_probs, thresholds), 4),
        "violation_type": format_violations(active, region),
        "processing_status": STATUS_SUCCESS,
        "time_of_processing": round(elapsed_seconds, 3),
    }


if __name__ == "__main__":
    import doctest
    doctest.testmod(verbose=False)

    demo = build_row(
        path_to_study="data/study_001/IM0001.dcm",
        study_uid="1.2.840.113619.2.55.3.1",
        image_uid="1.2.840.113619.2.55.3.9",
        region=REGION_LUMBAR_SPINE,
        violation_probs={
            VIOLATION_INCORRECT_POSITIONING: 0.12,
            VIOLATION_AXIS_MISALIGNMENT: 0.81,
            VIOLATION_FOREIGN_OBJECT: 0.63,
        },
        elapsed_seconds=0.312,
    )
    for column in REPORT_COLUMNS:
        print(f"{column:20} {demo[column]!r}")

    print(f"\nУгол при смещении (100 строк, 30 столбцов): "
          f"{tilt_angle_degrees(100, 30):.2f}° (с учётом мм, не по сырым пикселям)")
