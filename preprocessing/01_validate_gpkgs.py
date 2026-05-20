from pathlib import Path

import geopandas as gpd
import pandas as pd
import pyogrio


RAW_DATA_DIR = Path(r"C:\Users\saiga\Desktop\PhD\CSMD_APP\data_raw")
OUTPUT_DIR = Path("outputs")
REPORT_PATH = OUTPUT_DIR / "gpkg_validation_report.csv"

REQUIRED_COLUMNS = [
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

ALLOWED_REG1_GHSL = {
    "Asia",
    "Africa",
    "Latin America and the Caribbean",
}


def list_layer_names(gpkg_path: Path) -> list[str]:
    layers = pyogrio.list_layers(gpkg_path)
    return [str(layer[0]) for layer in layers]


def validate_gpkg(gpkg_path: Path) -> dict:
    report = {
        "file": gpkg_path.name,
        "path": str(gpkg_path),
        "layers": "",
        "first_layer": "",
        "row_count": None,
        "crs": "",
        "geometry_types": "",
        "unique_REG1_GHSL_values": "",
        "missing_columns": "",
        "valid_for_viewer": False,
        "error": "",
    }

    try:
        layer_names = list_layer_names(gpkg_path)
        report["layers"] = "; ".join(layer_names)

        if not layer_names:
            report["error"] = "No layers found"
            report["missing_columns"] = "; ".join(REQUIRED_COLUMNS)
            return report

        first_layer = layer_names[0]
        report["first_layer"] = first_layer

        gdf = gpd.read_file(gpkg_path, layer=first_layer, engine="pyogrio")
        columns = set(gdf.columns)
        missing_columns = [
            column for column in REQUIRED_COLUMNS if column not in columns
        ]

        report["row_count"] = len(gdf)
        report["crs"] = str(gdf.crs) if gdf.crs is not None else ""
        report["geometry_types"] = "; ".join(
            sorted(gdf.geometry.geom_type.dropna().unique())
        )
        report["missing_columns"] = "; ".join(missing_columns)

        reg1_values_are_allowed = False
        if "REG1_GHSL" in columns:
            unique_reg1_values = sorted(gdf["REG1_GHSL"].dropna().unique())
            report["unique_REG1_GHSL_values"] = "; ".join(
                str(value) for value in unique_reg1_values
            )
            reg1_values_are_allowed = all(
                value in ALLOWED_REG1_GHSL for value in unique_reg1_values
            )

        report["valid_for_viewer"] = (
            not missing_columns and reg1_values_are_allowed
        )
    except Exception as exc:
        report["error"] = str(exc)

    return report


def main() -> None:
    gpkg_files = sorted(RAW_DATA_DIR.glob("*.gpkg"))
    reports = [validate_gpkg(gpkg_path) for gpkg_path in gpkg_files]

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(reports).to_csv(REPORT_PATH, index=False)

    files_scanned = len(reports)
    valid_files = sum(report["valid_for_viewer"] for report in reports)
    invalid_files = files_scanned - valid_files

    print(f"Files scanned: {files_scanned}")
    print(f"Valid files: {valid_files}")
    print(f"Invalid files: {invalid_files}")
    print(f"Report saved to: {REPORT_PATH}")


if __name__ == "__main__":
    main()
