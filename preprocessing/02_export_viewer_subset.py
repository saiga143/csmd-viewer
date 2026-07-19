from pathlib import Path

import geopandas as gpd
import pandas as pd
import pyogrio


VALIDATION_REPORT_PATH = Path("outputs") / "gpkg_validation_report.csv"
OUTPUT_DIR = Path("outputs")
OUTPUT_GPKG_PATH = OUTPUT_DIR / "csmd_viewer_segments_v2.gpkg"
OUTPUT_LAYER = "csmd_viewer_segments_v2"

SOURCE_COLUMNS = [
    "ID_HDC_G0",
    "UC_NM_MN",
    "CTR_MN_NM",
    "REG1_GHSL",
    "REG2_GHSL",
    "POP_SEG",
    "POP25_U",
    "rf_prob",
    "rf_label",
    "geometry",
]

COLUMN_RENAMES = {
    "ID_HDC_G0": "segment_id",
    "UC_NM_MN": "city",
    "CTR_MN_NM": "country",
    "REG1_GHSL": "region",
    "REG2_GHSL": "subregion",
    "POP_SEG": "population",
    "rf_prob": "csmd_prob",
    "rf_label": "csmd_label",
}

CITY_SIZE_LABELS = {
    1: "Small (<500,000 residents)",
    2: "Medium (500,000–<1 million residents)",
    3: "Large (1–<5 million residents)",
    4: "Very large (5–<10 million residents)",
    5: "Megacity (≥10 million residents)",
}

OUTPUT_COLUMNS = [
    "segment_id",
    "city",
    "country",
    "region",
    "subregion",
    "population",
    "city_size_code",
    "city_size_label",
    "csmd_prob",
    "csmd_label",
    "geometry",
]


def valid_report_rows(report: pd.DataFrame) -> pd.DataFrame:
    valid_values = report["valid_for_viewer"].astype(str).str.lower()
    return report[valid_values == "true"]


def first_layer_name(gpkg_path: Path) -> str:
    layers = pyogrio.list_layers(gpkg_path)
    if len(layers) == 0:
        raise ValueError(f"No layers found in {gpkg_path}")
    return str(layers[0][0])


def derive_city_size_code(population: pd.Series) -> pd.Series:
    return pd.cut(
        population,
        bins=[float("-inf"), 500_000, 1_000_000, 5_000_000, 10_000_000, float("inf")],
        labels=[1, 2, 3, 4, 5],
        right=False,
    ).astype("Int64")


def clean_gpkg(gpkg_path: Path) -> gpd.GeoDataFrame:
    layer_name = first_layer_name(gpkg_path)
    gdf = gpd.read_file(gpkg_path, layer=layer_name, engine="pyogrio")

    gdf = gdf[SOURCE_COLUMNS].copy()

    if gdf.crs is None:
        raise ValueError(f"Cannot reproject {gpkg_path.name}: source CRS is missing")
    if gdf.crs.to_epsg() != 4326:
        gdf = gdf.to_crs(epsg=4326)

    gdf["ID_HDC_G0"] = pd.to_numeric(gdf["ID_HDC_G0"], errors="coerce")
    if (gdf["ID_HDC_G0"].dropna() % 1 == 0).all():
        gdf["ID_HDC_G0"] = gdf["ID_HDC_G0"].astype("Int64")
    gdf["POP25_U"] = pd.to_numeric(gdf["POP25_U"], errors="coerce")
    gdf["POP_SEG"] = pd.to_numeric(gdf["POP_SEG"], errors="coerce").round().astype("Int64")
    gdf["rf_prob"] = pd.to_numeric(gdf["rf_prob"], errors="coerce").round(3)
    gdf["rf_label"] = pd.to_numeric(gdf["rf_label"], errors="coerce").astype("Int64")
    gdf["city_size_code"] = derive_city_size_code(gdf["POP25_U"])
    gdf["city_size_label"] = gdf["city_size_code"].map(CITY_SIZE_LABELS)

    gdf = gdf.rename(columns=COLUMN_RENAMES)
    return gdf[OUTPUT_COLUMNS]


def print_qa_summary(output_gdf: gpd.GeoDataFrame) -> None:
    print("\nQA summary")
    print(f"Total rows: {len(output_gdf)}")

    print("\nCity size code counts:")
    city_size_counts = (
        output_gdf["city_size_code"]
        .value_counts()
        .reindex(range(1, 6), fill_value=0)
        .sort_index()
    )
    for code, count in city_size_counts.items():
        print(f"{code}: {count}")

    print("\nNull counts:")
    print(output_gdf.isna().sum().to_string())

    print("\nCSMD probability range:")
    print(f"min: {output_gdf['csmd_prob'].min()}")
    print(f"max: {output_gdf['csmd_prob'].max()}")

    print(f"\nCountry count: {output_gdf['country'].nunique(dropna=True)}")


def main() -> None:
    if not VALIDATION_REPORT_PATH.exists():
        raise FileNotFoundError(
            f"Validation report not found: {VALIDATION_REPORT_PATH}. "
            "Run preprocessing/01_validate_gpkgs.py first."
        )

    report = pd.read_csv(VALIDATION_REPORT_PATH)
    rows = valid_report_rows(report)

    cleaned_gdfs = []
    for file_number, row in enumerate(rows.itertuples(index=False), start=1):
        gpkg_path = Path(row.path)
        print(f"[{file_number}/{len(rows)}] Reading {gpkg_path.name}")

        cleaned_gdf = clean_gpkg(gpkg_path)
        cleaned_gdfs.append(cleaned_gdf)

        print(f"  Added {len(cleaned_gdf)} rows")

    if cleaned_gdfs:
        output_gdf = gpd.GeoDataFrame(
            pd.concat(cleaned_gdfs, ignore_index=True),
            geometry="geometry",
            crs="EPSG:4326",
        )
    else:
        output_gdf = gpd.GeoDataFrame(columns=OUTPUT_COLUMNS, geometry="geometry", crs="EPSG:4326")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    if OUTPUT_GPKG_PATH.exists():
        OUTPUT_GPKG_PATH.unlink()

    output_gdf.to_file(OUTPUT_GPKG_PATH, layer=OUTPUT_LAYER, driver="GPKG")
    print(f"Final row count: {len(output_gdf)}")
    print(f"Export saved to: {OUTPUT_GPKG_PATH}")
    print_qa_summary(output_gdf)


if __name__ == "__main__":
    main()
