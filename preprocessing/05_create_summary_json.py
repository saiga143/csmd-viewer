import json
from pathlib import Path

import geopandas as gpd
import pandas as pd


INPUT_GPKG_PATH = Path("outputs") / "csmd_viewer_segments_v2.gpkg"
OUTPUT_JSON_PATH = Path("website") / "data" / "summary.json"
REQUIRED_COLUMNS = [
    "city",
    "country",
    "region",
    "subregion",
    "population",
    "city_size_code",
    "city_size_label",
    "csmd_label",
]

CITY_SIZE_LABELS = {
    1: "Small (<500,000 residents)",
    2: "Medium (500,000–<1 million residents)",
    3: "Large (1–<5 million residents)",
    4: "Very large (5–<10 million residents)",
    5: "Megacity (≥10 million residents)",
}

CITY_SIZE_BREAKDOWN_METADATA = [
    (1, "Small", "<500,000 residents"),
    (2, "Medium", "500,000–<1 million residents"),
    (3, "Large", "1–<5 million residents"),
    (4, "Very large", "5–<10 million residents"),
    (5, "Megacity", "≥10 million residents"),
]


def percent(numerator: int, denominator: int) -> float:
    if denominator == 0:
        return 0.0
    return round((numerator / denominator) * 100, 1)


def number_of_cities(df: pd.DataFrame) -> int:
    return int(df[["city", "country"]].drop_duplicates().shape[0])


def create_city_size_breakdown(
    df: pd.DataFrame,
    geography_deprived_population: int,
) -> list[dict]:
    breakdown = []

    for code, label, threshold in CITY_SIZE_BREAKDOWN_METADATA:
        city_size = df["city_size_code"] == code
        deprived = city_size & (df["csmd_label"] == 1)
        non_deprived = city_size & (df["csmd_label"] == 0)

        total_population = int(df.loc[city_size, "population"].sum())
        deprived_population = int(df.loc[deprived, "population"].sum())
        non_deprived_population = int(df.loc[non_deprived, "population"].sum())

        breakdown.append(
            {
                "city_size_code": code,
                "city_size_label": label,
                "city_size_threshold": threshold,
                "total_population": total_population,
                "deprived_population": deprived_population,
                "non_deprived_population": non_deprived_population,
                "deprived_population_share": percent(
                    deprived_population,
                    total_population,
                ),
                "deprived_contribution_share": percent(
                    deprived_population,
                    geography_deprived_population,
                ),
            }
        )

    return breakdown


def summarize(
    df: pd.DataFrame,
    include_small_medium: bool = True,
    include_city_size_breakdown: bool = False,
) -> dict:
    deprived = df["csmd_label"] == 1
    non_deprived = df["csmd_label"] == 0

    total_segments = int(len(df))
    deprived_segments = int(deprived.sum())
    non_deprived_segments = int(non_deprived.sum())
    total_population = int(df["population"].sum())
    deprived_population = int(df.loc[deprived, "population"].sum())
    non_deprived_population = int(df.loc[non_deprived, "population"].sum())

    summary = {
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

    if include_small_medium:
        small_medium_deprived = deprived & df["city_size_code"].isin([1, 2])
        small_medium_deprived_population = int(
            df.loc[small_medium_deprived, "population"].sum()
        )
        summary.update(
            {
                "small_medium_deprived_population": small_medium_deprived_population,
                "small_medium_deprived_share": percent(
                    small_medium_deprived_population,
                    deprived_population,
                ),
            }
        )

    if include_city_size_breakdown:
        summary["city_size_breakdown"] = create_city_size_breakdown(
            df,
            deprived_population,
        )

    return summary


def city_size_summary(df: pd.DataFrame) -> dict:
    codes = df["city_size_code"].dropna().astype(int)
    if codes.empty:
        raise ValueError("A city summary has no city_size_code value.")

    # Preserve the established city-country grouping when names cover multiple city IDs.
    code = int(codes.max())
    return {
        "city_size_code": code,
        "city_size_label": CITY_SIZE_LABELS[code],
    }


def grouped_summaries(
    df: pd.DataFrame,
    group_columns: list[str],
    *,
    include_small_medium: bool = True,
    include_city_size: bool = False,
    include_city_size_breakdown: bool = False,
) -> list[dict]:
    records = []

    for keys, group in df.groupby(group_columns, dropna=False, sort=True):
        if not isinstance(keys, tuple):
            keys = (keys,)

        record = {column: value for column, value in zip(group_columns, keys)}
        record.update(
            summarize(
                group,
                include_small_medium=include_small_medium,
                include_city_size_breakdown=include_city_size_breakdown,
            )
        )
        if include_city_size:
            record.update(city_size_summary(group))
        records.append(record)

    return sorted(
        records,
        key=lambda record: tuple(str(record[column]).lower() for column in group_columns),
    )


def print_city_size_breakdown_qa(name: str, geography: dict) -> None:
    print(f"\n{name} city-size breakdown")
    breakdown = geography["city_size_breakdown"]

    for city_size in breakdown:
        print(
            f"  {city_size['city_size_label']}: "
            f"total={city_size['total_population']}, "
            f"deprived={city_size['deprived_population']}, "
            f"non_deprived={city_size['non_deprived_population']}, "
            f"deprived_share={city_size['deprived_population_share']}%, "
            f"deprived_contribution={city_size['deprived_contribution_share']}%"
        )

    class_total_population = sum(item["total_population"] for item in breakdown)
    class_deprived_population = sum(
        item["deprived_population"] for item in breakdown
    )
    class_non_deprived_population = sum(
        item["non_deprived_population"] for item in breakdown
    )
    totals_match = (
        class_total_population == geography["total_population"]
        and class_deprived_population == geography["deprived_population"]
        and class_non_deprived_population == geography["non_deprived_population"]
    )

    small_medium_deprived_population = sum(
        item["deprived_population"] for item in breakdown[:2]
    )
    small_medium_deprived_share = percent(
        small_medium_deprived_population,
        geography["deprived_population"],
    )
    small_medium_matches = (
        small_medium_deprived_population
        == geography["small_medium_deprived_population"]
        and small_medium_deprived_share == geography["small_medium_deprived_share"]
    )

    print(f"  Class totals match geography totals: {totals_match}")
    print(
        "  Small + Medium match sidebar insight: "
        f"{small_medium_matches} "
        f"({small_medium_deprived_population}, {small_medium_deprived_share}%)"
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
    df["city_size_code"] = pd.to_numeric(
        df["city_size_code"], errors="coerce"
    ).astype("Int64")
    df["csmd_label"] = pd.to_numeric(df["csmd_label"], errors="coerce")

    expected_city_size_labels = df["city_size_code"].map(CITY_SIZE_LABELS)
    invalid_city_sizes = (
        df["city_size_code"].isna()
        | expected_city_size_labels.isna()
        | df["city_size_label"].ne(expected_city_size_labels)
    )
    if invalid_city_sizes.any():
        raise ValueError(
            f"Found {int(invalid_city_sizes.sum())} invalid city-size code/label pairs."
        )

    summary = {
        "global": summarize(df, include_city_size_breakdown=True),
        "regions": grouped_summaries(
            df,
            ["region"],
            include_city_size_breakdown=True,
        ),
        "subregions": grouped_summaries(df, ["region", "subregion"]),
        "countries": grouped_summaries(df, ["country", "region", "subregion"]),
        "cities": grouped_summaries(
            df,
            ["city", "country", "region", "subregion"],
            include_small_medium=False,
            include_city_size=True,
        ),
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

    print("\nSmall/medium deprived population QA")
    global_summary = summary["global"]
    print(
        "Global: "
        f"{global_summary['small_medium_deprived_population']} "
        f"({global_summary['small_medium_deprived_share']}%)"
    )
    for region_summary in summary["regions"]:
        print(
            f"{region_summary['region']}: "
            f"{region_summary['small_medium_deprived_population']} "
            f"({region_summary['small_medium_deprived_share']}%)"
        )

    example_country = summary["countries"][0]
    print(
        f"Example country ({example_country['country']}): "
        f"{example_country['small_medium_deprived_population']} "
        f"({example_country['small_medium_deprived_share']}%)"
    )
    example_city = summary["cities"][0]
    print(
        f"Example city ({example_city['city']}, {example_city['country']}): "
        f"{example_city['city_size_label']}"
    )

    print_city_size_breakdown_qa("Global", summary["global"])
    for region_summary in summary["regions"]:
        print_city_size_breakdown_qa(region_summary["region"], region_summary)


if __name__ == "__main__":
    main()
