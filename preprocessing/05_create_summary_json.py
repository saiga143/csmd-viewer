import json
from pathlib import Path

import geopandas as gpd
import pandas as pd


INPUT_GPKG_PATH = Path("outputs") / "csmd_viewer_segments_test.gpkg"
OUTPUT_JSON_PATH = Path("website") / "data" / "summary.json"
REQUIRED_COLUMNS = [
    "city",
    "country",
    "region",
    "subregion",
    "population",
    "csmd_label",
]


def percent(numerator: int, denominator: int) -> float:
    if denominator == 0:
        return 0.0
    return round((numerator / denominator) * 100, 1)


def number_of_cities(df: pd.DataFrame) -> int:
    return int(df[["city", "country"]].drop_duplicates().shape[0])


def summarize(df: pd.DataFrame) -> dict:
    deprived = df["csmd_label"] == 1
    non_deprived = df["csmd_label"] == 0

    total_segments = int(len(df))
    deprived_segments = int(deprived.sum())
    non_deprived_segments = int(non_deprived.sum())
    total_population = int(df["population"].sum())
    deprived_population = int(df.loc[deprived, "population"].sum())
    non_deprived_population = int(df.loc[non_deprived, "population"].sum())

    return {
        "total_segments": total_segments,
        "deprived_segments": deprived_segments,
        "non_deprived_segments": non_deprived_segments,
        "total_population": total_population,
        "deprived_population": deprived_population,
        "non_deprived_population": non_deprived_population,
        "deprived_population_share": percent(deprived_population, total_population),
        "deprived_segment_share": percent(deprived_segments, total_segments),
        "number_of_cities": number_of_cities(df),
    }


def grouped_summaries(df: pd.DataFrame, group_columns: list[str]) -> list[dict]:
    records = []

    for keys, group in df.groupby(group_columns, dropna=False, sort=True):
        if not isinstance(keys, tuple):
            keys = (keys,)

        record = {column: value for column, value in zip(group_columns, keys)}
        record.update(summarize(group))
        records.append(record)

    return sorted(
        records,
        key=lambda record: tuple(str(record[column]).lower() for column in group_columns),
    )


def main() -> None:
    if not INPUT_GPKG_PATH.exists():
        raise FileNotFoundError(
            f"Input GeoPackage not found: {INPUT_GPKG_PATH}. "
            "Run preprocessing/02_export_viewer_subset.py first."
        )

    df = gpd.read_file(
        INPUT_GPKG_PATH,
        columns=REQUIRED_COLUMNS,
        ignore_geometry=True,
        engine="pyogrio",
    )

    missing_columns = [column for column in REQUIRED_COLUMNS if column not in df.columns]
    if missing_columns:
        raise ValueError(f"Missing required columns: {', '.join(missing_columns)}")

    df = df[REQUIRED_COLUMNS].copy()
    df["population"] = pd.to_numeric(df["population"], errors="coerce").fillna(0).round()
    df["csmd_label"] = pd.to_numeric(df["csmd_label"], errors="coerce")

    summary = {
        "global": summarize(df),
        "regions": grouped_summaries(df, ["region"]),
        "subregions": grouped_summaries(df, ["region", "subregion"]),
        "countries": grouped_summaries(df, ["country", "region", "subregion"]),
        "cities": grouped_summaries(df, ["city", "country", "region", "subregion"]),
    }

    OUTPUT_JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_JSON_PATH.open("w", encoding="utf-8") as file:
        json.dump(summary, file, indent=2, ensure_ascii=False)
        file.write("\n")

    print(f"Global total population: {summary['global']['total_population']}")
    print(f"Global deprived population: {summary['global']['deprived_population']}")
    print(f"Regions: {len(summary['regions'])}")
    print(f"Subregions: {len(summary['subregions'])}")
    print(f"Countries: {len(summary['countries'])}")
    print(f"Cities: {len(summary['cities'])}")
    print(f"Output path: {OUTPUT_JSON_PATH}")


if __name__ == "__main__":
    main()
