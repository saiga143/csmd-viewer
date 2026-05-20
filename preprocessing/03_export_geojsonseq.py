from pathlib import Path

import geopandas as gpd


INPUT_GPKG_PATH = Path("outputs") / "csmd_viewer_segments_test.gpkg"
OUTPUT_DIR = Path("outputs")
OUTPUT_GEOJSONSEQ_PATH = OUTPUT_DIR / "csmd_viewer_segments.geojsonseq"


def main() -> None:
    if not INPUT_GPKG_PATH.exists():
        raise FileNotFoundError(
            f"Input GeoPackage not found: {INPUT_GPKG_PATH}. "
            "Run preprocessing/02_export_viewer_subset.py first."
        )

    gdf = gpd.read_file(INPUT_GPKG_PATH, engine="pyogrio")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    gdf.to_file(OUTPUT_GEOJSONSEQ_PATH, driver="GeoJSONSeq")

    output_size_mb = OUTPUT_GEOJSONSEQ_PATH.stat().st_size / (1024 * 1024)

    print(f"Input row count: {len(gdf)}")
    print(f"CRS: {gdf.crs}")
    print(f"Output path: {OUTPUT_GEOJSONSEQ_PATH}")
    print(f"Output file size: {output_size_mb:.2f} MB")


if __name__ == "__main__":
    main()
