from pathlib import Path

import geopandas as gpd
import pandas as pd
import pyogrio


VALIDATION_REPORT_PATH = Path("outputs") / "gpkg_validation_report.csv"
OUTPUT_DIR = Path("outputs")
OUTPUT_GPKG_PATH = OUTPUT_DIR / "csmd_viewer_segments_test.gpkg"
OUTPUT_LAYER = "csmd_viewer_segments_test"

SOURCE_COLUMNS = [
    "UC_NM_MN",
    "CTR_MN_NM",
    "REG1_GHSL",
    "REG2_GHSL",
    "POP_SEG",
    "SIZE_U",
    "rf_prob",
    "rf_label",
    "geometry",
]

COLUMN_RENAMES = {
    "UC_NM_MN": "city",
    "CTR_MN_NM": "country",
    "REG1_GHSL": "region",
    "REG2_GHSL": "subregion",
    "POP_SEG": "population",
    "SIZE_U": "city_size",
    "rf_prob": "csmd_prob",
    "rf_label": "csmd_label",
}

OUTPUT_COLUMNS = [
    "segment_id",
    "city",
    "country",
    "region",
    "subregion",
    "population",
    "city_size",
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


def clean_gpkg(gpkg_path: Path) -> gpd.GeoDataFrame:
    layer_name = first_layer_name(gpkg_path)
    gdf = gpd.read_file(gpkg_path, layer=layer_name, engine="pyogrio")

    gdf = gdf[SOURCE_COLUMNS].copy()

    if gdf.crs is None:
        raise ValueError(f"Cannot reproject {gpkg_path.name}: source CRS is missing")
    if gdf.crs.to_epsg() != 4326:
        gdf = gdf.to_crs(epsg=4326)

    gdf["POP_SEG"] = pd.to_numeric(gdf["POP_SEG"], errors="coerce").round().astype("Int64")
    gdf["rf_prob"] = pd.to_numeric(gdf["rf_prob"], errors="coerce").round(3)
    gdf["rf_label"] = pd.to_numeric(gdf["rf_label"], errors="coerce").astype("Int64")
    gdf.insert(
        0,
        "segment_id",
        [f"{gpkg_path.stem}_{index + 1:06d}" for index in range(len(gdf))],
    )

    gdf = gdf.rename(columns=COLUMN_RENAMES)
    return gdf[OUTPUT_COLUMNS]


def print_qa_summary(output_gdf: gpd.GeoDataFrame) -> None:
    print("\nQA summary")
    print(f"Total rows: {len(output_gdf)}")
    print(f"CRS: {output_gdf.crs}")

    print("\nGeometry type counts:")
    print(output_gdf.geometry.geom_type.value_counts(dropna=False).to_string())

    print("\nCountry counts:")
    print(output_gdf["country"].value_counts(dropna=False).to_string())

    print("\nRegion counts:")
    print(output_gdf["region"].value_counts(dropna=False).to_string())

    print("\nCSMD label counts:")
    print(output_gdf["csmd_label"].value_counts(dropna=False).to_string())

    print("\nPopulation min/max/sum:")
    print(f"min: {output_gdf['population'].min()}")
    print(f"max: {output_gdf['population'].max()}")
    print(f"sum: {output_gdf['population'].sum()}")

    print("\nCSMD probability min/max/mean:")
    print(f"min: {output_gdf['csmd_prob'].min()}")
    print(f"max: {output_gdf['csmd_prob'].max()}")
    print(f"mean: {output_gdf['csmd_prob'].mean()}")

    print("\nNulls per column:")
    print(output_gdf.isna().sum().to_string())


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
