import json
from pathlib import Path

import geopandas as gpd


INPUT_GPKG_PATH = Path("outputs") / "csmd_viewer_segments_test.gpkg"
OUTPUT_JSON_PATH = Path("website") / "data" / "places.json"
REQUIRED_COLUMNS = ["city", "country", "region", "subregion", "geometry"]


def bounds_for_group(group: gpd.GeoDataFrame) -> list[float]:
    minx, miny, maxx, maxy = group.total_bounds
    return [float(minx), float(miny), float(maxx), float(maxy)]


def first_value(group: gpd.GeoDataFrame, column: str):
    values = group[column].dropna()
    if values.empty:
        return None
    return values.iloc[0]


def create_countries(gdf: gpd.GeoDataFrame) -> list[dict]:
    countries = []

    for country, group in gdf.groupby("country", dropna=False, sort=False):
        countries.append(
            {
                "country": country,
                "region": first_value(group, "region"),
                "subregion": first_value(group, "subregion"),
                "bbox": bounds_for_group(group),
            }
        )

    return sorted(countries, key=lambda item: str(item["country"]).lower())


def create_cities(gdf: gpd.GeoDataFrame) -> list[dict]:
    cities = []

    for (country, city), group in gdf.groupby(["country", "city"], dropna=False, sort=False):
        cities.append(
            {
                "city": city,
                "country": country,
                "region": first_value(group, "region"),
                "subregion": first_value(group, "subregion"),
                "bbox": bounds_for_group(group),
            }
        )

    return sorted(
        cities,
        key=lambda item: (str(item["country"]).lower(), str(item["city"]).lower()),
    )


def main() -> None:
    if not INPUT_GPKG_PATH.exists():
        raise FileNotFoundError(
            f"Input GeoPackage not found: {INPUT_GPKG_PATH}. "
            "Run preprocessing/02_export_viewer_subset.py first."
        )

    gdf = gpd.read_file(INPUT_GPKG_PATH, columns=REQUIRED_COLUMNS, engine="pyogrio")
    missing_columns = [column for column in REQUIRED_COLUMNS if column not in gdf.columns]
    if missing_columns:
        raise ValueError(f"Missing required columns: {', '.join(missing_columns)}")

    if gdf.crs is None:
        raise ValueError(f"Input GeoPackage has no CRS: {INPUT_GPKG_PATH}")
    if gdf.crs.to_epsg() != 4326:
        gdf = gdf.to_crs(epsg=4326)

    gdf = gdf.dropna(subset=["geometry"])
    gdf = gdf[~gdf.geometry.is_empty].copy()

    places = {
        "countries": create_countries(gdf),
        "cities": create_cities(gdf),
    }

    OUTPUT_JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_JSON_PATH.open("w", encoding="utf-8") as file:
        json.dump(places, file, indent=2, ensure_ascii=False)
        file.write("\n")

    print(f"Countries: {len(places['countries'])}")
    print(f"Cities: {len(places['cities'])}")
    print(f"Output path: {OUTPUT_JSON_PATH}")


if __name__ == "__main__":
    main()
