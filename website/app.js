const PMTILES_URL = "https://pub-1eed28d124134a23a63504e74634d29b.r2.dev/csmd_viewer_segments.pmtiles";
const SOURCE_LAYER = "csmd_segments";
const SATELLITE_SOURCE_ID = "esri-world-imagery";
const SATELLITE_LAYER_ID = "esri-world-imagery";
const CSMD_FILL_LAYER_ID = "csmd-segments-fill";
const CSMD_OUTLINE_LAYER_ID = "csmd-segments-outline";

let currentBasemap = "streets";
let currentCsmdVisibility = "on";

const protocol = new pmtiles.Protocol();
maplibregl.addProtocol("pmtiles", protocol.tile);

const map = new maplibregl.Map({
  container: "map",
  style: "https://tiles.openfreemap.org/styles/liberty",
  center: [0, 20],
  zoom: 1.5
});

map.addControl(new maplibregl.NavigationControl(), "bottom-left");

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    setupSidebarData();
    setupMapControls();
  });
} else {
  setupSidebarData();
  setupMapControls();
}

map.on("load", () => {
  map.addSource(SATELLITE_SOURCE_ID, {
    type: "raster",
    tiles: [
      "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
    ],
    tileSize: 256
  });

  map.addLayer({
    id: SATELLITE_LAYER_ID,
    type: "raster",
    source: SATELLITE_SOURCE_ID,
    layout: {
      visibility: "none"
    }
  });

  map.addSource("csmd-segments", {
    type: "vector",
    url: `pmtiles://${PMTILES_URL}`
  });

  map.addLayer({
    id: CSMD_FILL_LAYER_ID,
    type: "fill",
    source: "csmd-segments",
    "source-layer": SOURCE_LAYER,
    paint: {
      "fill-color": [
        "match",
        ["to-number", ["get", "csmd_label"]],
        1,
        "#b24846",
        0,
        "#d9d9d9",
        "#c8c8c8"
      ],
      "fill-opacity": [
        "case",
        ["==", ["to-number", ["get", "csmd_label"]], 1],
        0.66,
        0.36
      ]
    }
  });

  map.addLayer({
    id: CSMD_OUTLINE_LAYER_ID,
    type: "line",
    source: "csmd-segments",
    "source-layer": SOURCE_LAYER,
    paint: {
      "line-color": [
        "case",
        ["==", ["to-number", ["get", "csmd_label"]], 1],
        "#7f2928",
        "#666666"
      ],
      "line-width": ["interpolate", ["linear"], ["zoom"], 0, 1.1, 6, 0.95, 10, 0.85, 14, 0.85],
      "line-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.72, 8, 0.66, 12, 0.62]
    }
  });

  map.on("click", CSMD_FILL_LAYER_ID, (event) => {
    const feature = event.features && event.features[0];
    if (!feature) return;

    new maplibregl.Popup()
      .setLngLat(event.lngLat)
      .setHTML(renderPopup(feature.properties || {}))
      .addTo(map);
  });

  map.on("mouseenter", CSMD_FILL_LAYER_ID, () => {
    map.getCanvas().style.cursor = "pointer";
  });

  map.on("mouseleave", CSMD_FILL_LAYER_ID, () => {
    map.getCanvas().style.cursor = "";
  });

  setBasemap(currentBasemap);
  setCsmdVisibility(currentCsmdVisibility);
});

function renderPopup(properties) {
  const fields = [
    ["city", "City"],
    ["country", "Country"],
    ["region", "Region"],
    ["subregion", "Subregion"],
    ["population", "Population in segment"],
    ["city_size", "City size class"],
    ["csmd_prob", "CSMD probability"],
    ["csmd_label", "Classification"]
  ];

  const rows = fields
    .map(([field, label]) => {
      const value = formatValue(field, properties[field]);
      return `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`;
    })
    .join("");

  return `<table class="popup-table">${rows}</table>`;
}

function formatValue(field, value) {
  if (value == null || value === "") return "";

  if (field === "csmd_label") {
    const label = Number(value);
    if (label === 1) return "Morphologically Deprived";
    if (label === 0) return "Morphologically Non-deprived";
  }

  return value;
}

function setupMapControls() {
  const basemapInputs = document.querySelectorAll("input[name='basemap']");
  basemapInputs.forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) {
        setBasemap(input.value);
      }
    });
  });

  const csmdInputs = document.querySelectorAll("input[name='csmd-layer']");
  csmdInputs.forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) {
        setCsmdVisibility(input.value);
      }
    });
  });
}

function setBasemap(basemap) {
  currentBasemap = basemap;
  const showSatellite = basemap === "satellite";
  const satelliteAttribution = document.getElementById("satellite-attribution");
  const satelliteTemporalNote = document.getElementById("satellite-temporal-note");

  if (map.getLayer(SATELLITE_LAYER_ID)) {
    map.setLayoutProperty(
      SATELLITE_LAYER_ID,
      "visibility",
      showSatellite ? "visible" : "none"
    );
  }

  if (satelliteAttribution) {
    satelliteAttribution.hidden = !showSatellite;
  }
  if (satelliteTemporalNote) {
    satelliteTemporalNote.hidden = !showSatellite;
  }
}

function setCsmdVisibility(visibility) {
  currentCsmdVisibility = visibility;
  const layerVisibility = visibility === "on" ? "visible" : "none";

  [CSMD_FILL_LAYER_ID, CSMD_OUTLINE_LAYER_ID].forEach((layerId) => {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, "visibility", layerVisibility);
    }
  });
}

async function setupSidebarData() {
  const regionSelect = document.getElementById("region-select");
  const subregionSelect = document.getElementById("subregion-select");
  const countrySelect = document.getElementById("country-select");
  const citySelect = document.getElementById("city-select");
  if (!regionSelect || !subregionSelect || !countrySelect || !citySelect) return;

  const [places, summary] = await Promise.all([
    loadPlacesIndex(),
    loadSummaryIndex()
  ]);

  if (summary) {
    updateSummary(summary.global, summary.countries.length, summary.global.number_of_cities);
  }

  if (places) {
    setupPlacesSearch(regionSelect, subregionSelect, countrySelect, citySelect, places, summary);
  }
}

async function loadPlacesIndex() {
  try {
    const response = await fetch("./data/places.json");
    if (!response.ok) {
      throw new Error("Could not load ./data/places.json");
    }

    const places = await response.json();
    const countries = places.countries || [];
    const cities = places.cities || [];
    console.log("Loaded places index", countries.length, cities.length);
    return { ...places, countries, cities };
  } catch (error) {
    console.error(error);
    return null;
  }
}

async function loadSummaryIndex() {
  try {
    const response = await fetch("./data/summary.json");
    if (!response.ok) {
      throw new Error("Could not load ./data/summary.json");
    }

    const summary = await response.json();
    const countries = summary.countries || [];
    const cities = summary.cities || [];
    console.log("Loaded summary index");
    return { ...summary, countries, cities };
  } catch (error) {
    console.error(error);
    return null;
  }
}

function setupPlacesSearch(regionSelect, subregionSelect, countrySelect, citySelect, places, summary) {
  const countries = places.countries || [];
  const citiesByCountry = groupCitiesByCountry(places.cities || []);
  const regionSummaries = groupRegionSummaries((summary && summary.regions) || []);
  const subregionSummaries = groupSubregionSummaries((summary && summary.subregions) || []);
  const countrySummaries = groupCountrySummaries((summary && summary.countries) || []);
  const citySummaries = groupCitySummaries((summary && summary.cities) || []);
  const regions = uniqueSorted(countries.map((country) => country.region));
  let currentCities = [];
  let currentCountry = null;
  let currentRegionCountries = [];
  let currentSubregionCountries = [];

  populateSelect(regionSelect, "Select region", regions, (region) => region);
  resetSubregionSelect(subregionSelect);
  resetCountrySelect(countrySelect);
  resetCitySelect(citySelect);

  regionSelect.addEventListener("change", () => {
    const region = regionSelect.value;
    resetSubregionSelect(subregionSelect);
    resetCountrySelect(countrySelect);
    resetCitySelect(citySelect);
    currentCities = [];
    currentCountry = null;
    currentRegionCountries = [];
    currentSubregionCountries = [];

    if (!region) {
      if (summary) {
        updateSummary(summary.global, summary.countries.length, summary.global.number_of_cities);
      }
      return;
    }

    currentRegionCountries = countries.filter((country) => country.region === region);
    const subregions = uniqueSorted(
      currentRegionCountries.map((country) => country.subregion)
    );

    populateSelect(subregionSelect, "Select subregion", subregions, (subregion) => subregion);
    subregionSelect.disabled = subregions.length === 0;
    populateSelect(countrySelect, "Select country", currentRegionCountries, (country) => country.country);
    countrySelect.disabled = currentRegionCountries.length === 0;

    if (summary) {
      updateSummary(
        regionSummaries.get(region),
        currentRegionCountries.length,
        regionSummaries.get(region)?.number_of_cities || 0
      );
    }
    fitToBbox(combineBboxes(currentRegionCountries.map((country) => country.bbox)));
  });

  subregionSelect.addEventListener("change", () => {
    const region = regionSelect.value;
    const subregion = subregionSelect.value;
    resetCountrySelect(countrySelect);
    resetCitySelect(citySelect);
    currentCities = [];
    currentCountry = null;

    if (!region) return;

    if (!subregion) {
      currentSubregionCountries = [];
      populateSelect(countrySelect, "Select country", currentRegionCountries, (country) => country.country);
      countrySelect.disabled = currentRegionCountries.length === 0;

      if (summary) {
        updateSummary(
          regionSummaries.get(region),
          currentRegionCountries.length,
          regionSummaries.get(region)?.number_of_cities || 0
        );
      }
      fitToBbox(combineBboxes(currentRegionCountries.map((country) => country.bbox)));
      return;
    }

    currentSubregionCountries = currentRegionCountries.filter(
      (country) => country.subregion === subregion
    );
    populateSelect(countrySelect, "Select country", currentSubregionCountries, (country) => country.country);
    countrySelect.disabled = currentSubregionCountries.length === 0;

    if (summary) {
      const summaryRecord = subregionSummaries.get(`${region}||${subregion}`);
      updateSummary(
        summaryRecord,
        currentSubregionCountries.length,
        summaryRecord?.number_of_cities || 0
      );
    }
    fitToBbox(combineBboxes(currentSubregionCountries.map((country) => country.bbox)));
  });

  countrySelect.addEventListener("change", () => {
    const countryOptions = subregionSelect.value
      ? currentSubregionCountries
      : currentRegionCountries;
    const country = countryOptions.find((item) => item.country === countrySelect.value);
    resetCitySelect(citySelect);
    currentCities = [];
    currentCountry = country || null;

    if (!country) {
      if (summary) {
        const region = regionSelect.value;
        const subregion = subregionSelect.value;
        if (subregion) {
          const summaryRecord = subregionSummaries.get(`${region}||${subregion}`);
          updateSummary(
            summaryRecord,
            currentSubregionCountries.length,
            summaryRecord?.number_of_cities || 0
          );
        } else if (region) {
          updateSummary(
            regionSummaries.get(region),
            currentRegionCountries.length,
            regionSummaries.get(region)?.number_of_cities || 0
          );
        }
      }
      return;
    }

    currentCities = citiesByCountry.get(country.country) || [];
    populateSelect(
      citySelect,
      "Select city",
      currentCities,
      (city) => city.city,
      (_city, index) => String(index)
    );
    citySelect.disabled = currentCities.length === 0;

    if (summary) {
      updateSummary(countrySummaries.get(country.country), 1, currentCities.length);
    }
    fitToBbox(country.bbox);
  });

  citySelect.addEventListener("change", () => {
    if (citySelect.value === "") {
      if (summary && currentCountry) {
        updateSummary(
          countrySummaries.get(currentCountry.country),
          1,
          currentCities.length
        );
      }
      return;
    }

    const city = currentCities[Number(citySelect.value)];
    if (!city) return;

    if (summary) {
      updateSummary(citySummaries.get(`${city.country}||${city.city}`), 1, 1);
    }
    fitToBbox(city.bbox);
  });
}

function groupCitiesByCountry(cities) {
  const grouped = new Map();

  for (const city of cities) {
    if (!grouped.has(city.country)) {
      grouped.set(city.country, []);
    }
    grouped.get(city.country).push(city);
  }

  return grouped;
}

function groupRegionSummaries(regions) {
  const grouped = new Map();

  for (const region of regions) {
    grouped.set(region.region, region);
  }

  return grouped;
}

function groupSubregionSummaries(subregions) {
  const grouped = new Map();

  for (const subregion of subregions) {
    grouped.set(`${subregion.region}||${subregion.subregion}`, subregion);
  }

  return grouped;
}

function groupCountrySummaries(countries) {
  const grouped = new Map();

  for (const country of countries) {
    grouped.set(country.country, country);
  }

  return grouped;
}

function groupCitySummaries(cities) {
  const grouped = new Map();

  for (const city of cities) {
    grouped.set(`${city.country}||${city.city}`, city);
  }

  return grouped;
}

function populateSelect(select, placeholder, records, labelForRecord, valueForRecord) {
  select.replaceChildren(createOption("", placeholder));

  records.forEach((record, index) => {
    const value = valueForRecord ? valueForRecord(record, index) : labelForRecord(record);
    select.appendChild(createOption(value, labelForRecord(record)));
  });
}

function resetSubregionSelect(subregionSelect) {
  subregionSelect.replaceChildren(createOption("", "Select subregion"));
  subregionSelect.disabled = true;
}

function resetCountrySelect(countrySelect) {
  countrySelect.replaceChildren(createOption("", "Select country"));
  countrySelect.disabled = true;
}

function resetCitySelect(citySelect) {
  citySelect.replaceChildren(createOption("", "Select city"));
  citySelect.disabled = true;
}

function createOption(value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  return option;
}

function uniqueSorted(values) {
  return Array.from(
    new Set(values.filter((value) => value != null && String(value).trim() !== ""))
  ).sort((a, b) => String(a).localeCompare(String(b)));
}

function combineBboxes(bboxes) {
  const validBboxes = bboxes.filter((bbox) => Array.isArray(bbox) && bbox.length === 4);
  if (validBboxes.length === 0) return null;

  return validBboxes.reduce(
    (combined, bbox) => [
      Math.min(combined[0], bbox[0]),
      Math.min(combined[1], bbox[1]),
      Math.max(combined[2], bbox[2]),
      Math.max(combined[3], bbox[3])
    ],
    [Infinity, Infinity, -Infinity, -Infinity]
  );
}

function fitToBbox(bbox) {
  if (!Array.isArray(bbox) || bbox.length !== 4) return;

  map.fitBounds(
    [
      [bbox[0], bbox[1]],
      [bbox[2], bbox[3]]
    ],
    {
      padding: fitBoundsPadding(),
      duration: 900,
      maxZoom: 12
    }
  );
}

function fitBoundsPadding() {
  if (window.matchMedia("(max-width: 720px)").matches) {
    return {
      top: Math.round(window.innerHeight * 0.52),
      right: 32,
      bottom: 32,
      left: 32
    };
  }

  return {
    top: 48,
    right: 48,
    bottom: 48,
    left: 376
  };
}

function updateSummary(record, countryCount, cityCount) {
  if (!record) return;

  setSummaryText("summary-total-population", formatPopulation(record.total_population));
  setSummaryText(
    "summary-deprived-population",
    formatPopulation(record.deprived_population)
  );
  setSummaryText(
    "summary-deprived-population-share",
    formatPercent(record.deprived_population_share)
  );
  setSummaryText("summary-total-segments", formatCount(record.total_segments));
  setSummaryText("summary-deprived-segments", formatCount(record.deprived_segments));
  setSummaryText("summary-countries", formatCount(countryCount));
  setSummaryText("summary-cities", formatCount(cityCount));
}

function setSummaryText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function formatPopulation(value) {
  const number = Number(value) || 0;
  if (number >= 1000000000) {
    return `${trimTrailingZeros((number / 1000000000).toFixed(2))}B`;
  }
  if (number >= 1000000) {
    return `${Math.round(number / 1000000)}M`;
  }
  return formatCount(number);
}

function trimTrailingZeros(value) {
  return value.replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
}

function formatPercent(value) {
  return `${(Number(value) || 0).toFixed(1)}%`;
}

function formatCount(value) {
  return new Intl.NumberFormat("en-US").format(Number(value) || 0);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
