from pathlib import Path

import geopandas as gpd


INPUT_GPKG_PATH = Path("outputs") / "csmd_viewer_segments_v2.gpkg"
OUTPUT_DIR = Path("outputs")
OUTPUT_GEOJSONSEQ_PATH = OUTPUT_DIR / "csmd_viewer_segments_v2.geojsonseq"


def format_file_size(size_bytes: int) -> str:
    size_gb = size_bytes / (1024**3)
    if size_gb >= 1:
        return f"{size_gb:.2f} GB"
    return f"{size_bytes / (1024**2):.2f} MB"


def main() -> None:
    if not INPUT_GPKG_PATH.exists():
        raise FileNotFoundError(
            f"Input GeoPackage not found: {INPUT_GPKG_PATH}. "
            "Run preprocessing/02_export_viewer_subset.py first."
        )

    gdf = gpd.read_file(INPUT_GPKG_PATH, engine="pyogrio")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    if OUTPUT_GEOJSONSEQ_PATH.exists():
        OUTPUT_GEOJSONSEQ_PATH.unlink()
    gdf.to_file(OUTPUT_GEOJSONSEQ_PATH, driver="GeoJSONSeq")

    print(f"Input row count: {len(gdf)}")
    print(f"CRS: {gdf.crs}")
    print(f"Output path: {OUTPUT_GEOJSONSEQ_PATH}")
    print(f"Output file size: {format_file_size(OUTPUT_GEOJSONSEQ_PATH.stat().st_size)}")


if __name__ == "__main__":
    main()
