# CSMD Explorer: City Segment Morphological Deprivation Viewer

[![Live Viewer](https://img.shields.io/badge/Live%20viewer-GitHub%20Pages-222222)](https://saiga143.github.io/csmd-viewer/)
![MapLibre GL JS](https://img.shields.io/badge/MapLibre%20GL%20JS-map%20rendering-396cb2)
![PMTiles](https://img.shields.io/badge/PMTiles-vector%20tiles-5a5a5a)
![Cloudflare R2](https://img.shields.io/badge/Cloudflare%20R2-tile%20hosting-f38020)
![License: MIT](https://img.shields.io/badge/License-MIT-green)

## Live Viewer

https://saiga143.github.io/csmd-viewer/

## About

CSMD Explorer is an interactive web viewer for the City Segment Morphological Deprivation (CSMD) dataset. It allows users to explore morphologically deprived and morphologically non-deprived city segments across Africa, Asia, and Latin America and the Caribbean.

## Dataset Scope

- 103 countries
- 5,132 cities
- Approximately 1.96 billion covered urban population
- Approximately 395 million people in morphologically deprived segments
- Segment-level polygons with population, CSMD probability, and CSMD class

## Viewer Features

- Interactive map
- Country, region, subregion, and city search
- Segment click popups
- Global, regional, subregional, country, and city summaries
- PMTiles-based vector tile rendering

## Technical Stack

- Python/GeoPandas for preprocessing
- Tippecanoe for PMTiles generation
- Cloudflare R2 for PMTiles hosting
- GitHub Pages for static website hosting
- MapLibre GL JS for map rendering
- OpenFreeMap basemap

## Interpretation Note

CSMD is a morphology-based screening layer. It identifies city segments with built-form patterns associated with deprivation and should not be interpreted as a household-level poverty measure or an official slum census.

## Repository Structure

- `preprocessing/`: Python scripts for preparing viewer-ready data, places indexes, and summary JSON files.
- `website/`: Static web viewer files.
- `website/data/`: Static JSON files used by the viewer sidebar search and summaries.
- `scripts/`: Utility scripts for data export and tile generation workflows.
- `outputs/`: Local-only generated outputs; this directory is not tracked by Git.

## Developer

Designed and developed by Sai Ganesh Veeravalli  
Website: https://www.sgveeravalli.com
