from pathlib import Path

import geopandas as gpd
import pandas as pd


VALIDATION_REPORT_PATH = Path("outputs") / "gpkg_validation_report.csv"
RAW_DATA_DIR = Path(r"C:\Users\saiga\Desktop\PhD\CSMD_APP\data_raw")
OUTPUT_PATH = Path("outputs") / "city_size_validation.csv"

REQUIRED_COLUMNS = ["UC_NM_MN", "CTR_MN_NM", "POP25_U", "SIZE_U"]
ALLOWED_SIZE_VALUES = {1, 2, 3, 4, 5}


def valid_for_viewer_mask(series: pd.Series) -> pd.Series:
    return (
        series.fillna(False)
        .astype(str)
        .str.strip()
        .str.lower()
        .isin({"true", "1", "yes"})
    )


def normalized_values(series: pd.Series) -> set[float | None]:
    return {
        None if pd.isna(value) else float(value)
        for value in pd.unique(series)
    }


def representative_value(values: set[float | None]):
    numeric_values = sorted(value for value in values if value is not None)
    if numeric_values:
        return numeric_values[0]
    return pd.NA


def expected_size(population):
    if pd.isna(population):
        return pd.NA
    if population < 500_000:
        return 1
    if population < 1_000_000:
        return 2
    if population < 5_000_000:
        return 3
    if population < 10_000_000:
        return 4
    return 5


def city_key(country, city) -> tuple[str | None, str | None]:
    normalized_country = None if pd.isna(country) else str(country)
    normalized_city = None if pd.isna(city) else str(city)
    return normalized_country, normalized_city


def collect_city_values(valid_files: pd.DataFrame) -> tuple[dict, set[str]]:
    cities = {}
    invalid_size_values = set()

    for report_row in valid_files.itertuples(index=False):
        gpkg_path = RAW_DATA_DIR / Path(str(report_row.file)).name
        if not gpkg_path.exists():
            raise FileNotFoundError(f"GeoPackage not found: {gpkg_path}")

        layer = str(report_row.first_layer).strip()
        layer = layer if layer and layer.lower() != "nan" else None

        df = gpd.read_file(
            gpkg_path,
            layer=layer,
            columns=REQUIRED_COLUMNS,
            ignore_geometry=True,
            engine="pyogrio",
        )
        missing_columns = [
            column for column in REQUIRED_COLUMNS if column not in df.columns
        ]
        if missing_columns:
            raise ValueError(
                f"{gpkg_path.name} is missing required columns: "
                f"{', '.join(missing_columns)}"
            )

        population_numeric = pd.to_numeric(df["POP25_U"], errors="coerce")
        size_numeric = pd.to_numeric(df["SIZE_U"], errors="coerce")

        invalid_size_mask = size_numeric.isna() | ~size_numeric.isin(
            ALLOWED_SIZE_VALUES
        )
        for raw_value in df.loc[invalid_size_mask, "SIZE_U"].unique():
            if pd.isna(raw_value):
                invalid_size_values.add("<missing>")
            else:
                invalid_size_values.add(str(raw_value))

        working = df[["CTR_MN_NM", "UC_NM_MN"]].copy()
        working["POP25_U"] = population_numeric
        working["SIZE_U"] = size_numeric

        for (country, city), group in working.groupby(
            ["CTR_MN_NM", "UC_NM_MN"],
            dropna=False,
            sort=False,
        ):
            key = city_key(country, city)
            record = cities.setdefault(
                key,
                {
                    "country": country,
                    "city": city,
                    "population_values": set(),
                    "size_values": set(),
                    "number_of_segments": 0,
                },
            )
            record["population_values"].update(
                normalized_values(group["POP25_U"])
            )
            record["size_values"].update(normalized_values(group["SIZE_U"]))
            record["number_of_segments"] += len(group)

    return cities, invalid_size_values


def create_validation_table(cities: dict) -> pd.DataFrame:
    records = []

    for city_record in cities.values():
        population_values = city_record["population_values"]
        size_values = city_record["size_values"]
        population = representative_value(population_values)
        size = representative_value(size_values)
        derived_size = expected_size(population)
        inconsistent_population = len(population_values) != 1
        inconsistent_size = len(size_values) != 1
        size_is_allowed = not pd.isna(size) and size in ALLOWED_SIZE_VALUES
        matches_expected = (
            not inconsistent_population
            and not inconsistent_size
            and size_is_allowed
            and not pd.isna(derived_size)
            and int(size) == int(derived_size)
        )

        records.append(
            {
                "country": city_record["country"],
                "city": city_record["city"],
                "POP25_U": population,
                "SIZE_U": size,
                "expected_size": derived_size,
                "matches_expected": bool(matches_expected),
                "number_of_segments": int(city_record["number_of_segments"]),
                "inconsistent_population_values": inconsistent_population,
                "inconsistent_size_values": inconsistent_size,
            }
        )

    result = pd.DataFrame(records)
    result["POP25_U"] = pd.to_numeric(result["POP25_U"], errors="coerce")
    integer_columns = ["SIZE_U", "expected_size"]
    for column in integer_columns:
        result[column] = pd.to_numeric(result[column], errors="coerce").astype(
            "Int64"
        )

    return result.sort_values(
        ["country", "city"],
        key=lambda column: column.astype(str).str.lower(),
        kind="stable",
    ).reset_index(drop=True)


def print_summary(result: pd.DataFrame, invalid_size_values: set[str]) -> None:
    mismatches = result[~result["matches_expected"]]
    inconsistent = result[
        result["inconsistent_population_values"]
        | result["inconsistent_size_values"]
    ]

    print(f"Cities checked: {len(result)}")
    for size_value in sorted(ALLOWED_SIZE_VALUES):
        count = int((result["SIZE_U"] == size_value).sum())
        print(f"SIZE_U {size_value}: {count}")
    print(f"Mismatches: {len(mismatches)}")
    print(f"Cities with inconsistent values: {len(inconsistent)}")
    print(
        "SIZE_U contains only values 1-5: "
        f"{'Yes' if not invalid_size_values else 'No'}"
    )
    if invalid_size_values:
        print(
            "Invalid SIZE_U values: "
            + ", ".join(sorted(invalid_size_values))
        )

    if not mismatches.empty:
        print("First 20 mismatches:")
        columns = [
            "country",
            "city",
            "POP25_U",
            "SIZE_U",
            "expected_size",
            "inconsistent_population_values",
            "inconsistent_size_values",
        ]
        print(mismatches[columns].head(20).to_string(index=False))


def main() -> None:
    if not VALIDATION_REPORT_PATH.exists():
        raise FileNotFoundError(
            f"Validation report not found: {VALIDATION_REPORT_PATH}. "
            "Run preprocessing/01_validate_gpkgs.py first."
        )
    if not RAW_DATA_DIR.exists():
        raise FileNotFoundError(f"Raw data directory not found: {RAW_DATA_DIR}")

    report = pd.read_csv(VALIDATION_REPORT_PATH)
    required_report_columns = {"file", "first_layer", "valid_for_viewer"}
    missing_report_columns = sorted(required_report_columns - set(report.columns))
    if missing_report_columns:
        raise ValueError(
            "Validation report is missing required columns: "
            + ", ".join(missing_report_columns)
        )

    valid_files = report[valid_for_viewer_mask(report["valid_for_viewer"])].copy()
    if valid_files.empty:
        raise ValueError("No GeoPackages are marked valid_for_viewer in the report.")

    cities, invalid_size_values = collect_city_values(valid_files)
    result = create_validation_table(cities)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    result.to_csv(OUTPUT_PATH, index=False)

    print_summary(result, invalid_size_values)
    print(f"Output path: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
