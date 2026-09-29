import sys
from collections import Counter

import pandas as pd

POS = "Некорректная укладка"
AXIS = "Не выравнена ось позвоночника"
FOREIGN = "Присутствуют посторонние предметы"
ROI = "Некорректная область интереса"
REGION_SPINE = "Поясничный отдел позвоночника"
REGION_FEMUR = "Проксимальный отдел бедра"

COLUMNS = ["n", "study", "sp_pos", "sp_axis", "sp_foreign",
           "rf_pos", "rf_roi", "lf_pos", "lf_roi",
           "it_sp", "it_rf", "it_lf", "comment"]

AREAS = [
    (REGION_SPINE, "", {"sp_pos": POS, "sp_axis": AXIS, "sp_foreign": FOREIGN}, "it_sp"),
    (REGION_FEMUR, "right", {"rf_pos": POS, "rf_roi": ROI}, "it_rf"),
    (REGION_FEMUR, "left", {"lf_pos": POS, "lf_roi": ROI}, "it_lf"),
]


def parse(xlsx_path: str) -> pd.DataFrame:
    raw = pd.read_excel(xlsx_path, sheet_name="Калибровка", header=None,
                        skiprows=2, usecols="A:M", dtype=object)
    raw.columns = COLUMNS
    raw = raw[raw["study"].notna()]

    rows = []
    for _, r in raw.iterrows():
        for region, side, flag_cols, itog_col in AREAS:
            values = [r[c] for c in flag_cols]
            if all(pd.isna(v) for v in values):
                continue

            violations = [name for col, name in flag_cols.items() if r[col] == 1]
            itog = None if pd.isna(r[itog_col]) else int(r[itog_col])

            problem = ""
            if itog == 1 and not violations:
                problem = "итог=1, но ни одно нарушение не отмечено"
            elif itog == 0 and violations:
                problem = "итог=0, но нарушение отмечено"

            rows.append({
                "study_uid": str(r["study"]).strip(),
                "region": region,
                "side": side,
                "violations": ";".join(violations),
                "itog": itog,
                "questionable": problem,
                "comment": "" if pd.isna(r["comment"]) else str(r["comment"]).strip(),
            })
    return pd.DataFrame(rows)


def report(df: pd.DataFrame) -> None:
    print(f"Исследований: {df.study_uid.nunique()}   областей-снимков: {len(df)}")
    for region in (REGION_SPINE, REGION_FEMUR):
        sub = df[df.region == region]
        counts = Counter(v for s in sub.violations for v in s.split(";") if v)
        print(f"\n{region}: {len(sub)} снимков, с нарушениями: {(sub.violations != '').sum()}")
        names = [POS, AXIS, FOREIGN] if region == REGION_SPINE else [POS, ROI]
        for name in names:
            pos = counts.get(name, 0)
            neg = len(sub) - pos
            pw = f"{neg / pos:.1f}" if pos else "—"
            print(f"   {name:36s} положительных: {pos:3d}   pos_weight ≈ {pw}")

    q = df[df.questionable != ""]
    print(f"\nСпорных строк: {len(q)} (исключаются из обучения голов нарушений)")
    for _, r in q.iterrows():
        print(f"   {r.study_uid[:28]}…  {r.region}: {r.questionable}  [{r.comment}]")


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else "разметка.xlsx"
    table = parse(path)
    table.to_csv("labels_by_study.csv", index=False, encoding="utf-8")
    report(table)
    print("\nСохранено: labels_by_study.csv")
