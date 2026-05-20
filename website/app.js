const PMTILES_URL = "https://pub-1eed28d124134a23a63504e74634d29b.r2.dev/csmd_viewer_segments.pmtiles";
const SOURCE_LAYER = "csmd_segments";

const protocol = new pmtiles.Protocol();
maplibregl.addProtocol("pmtiles", protocol.tile);

const map = new maplibregl.Map({
  container: "map",
  style: "https://tiles.openfreemap.org/styles/liberty",
  center: [0, 20],
  zoom: 1.5
});

map.addControl(new maplibregl.NavigationControl(), "top-left");

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    setupPlacesSearch();
  });
} else {
  setupPlacesSearch();
}

map.on("load", () => {
  map.addSource("csmd-segments", {
    type: "vector",
    url: `pmtiles://${PMTILES_URL}`
  });

  map.addLayer({
    id: "csmd-segments-fill",
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
    id: "csmd-segments-outline",
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

  map.on("click", "csmd-segments-fill", (event) => {
    const feature = event.features && event.features[0];
    if (!feature) return;

    new maplibregl.Popup()
      .setLngLat(event.lngLat)
      .setHTML(renderPopup(feature.properties || {}))
      .addTo(map);
  });

  map.on("mouseenter", "csmd-segments-fill", () => {
    map.getCanvas().style.cursor = "pointer";
  });

  map.on("mouseleave", "csmd-segments-fill", () => {
    map.getCanvas().style.cursor = "";
  });
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

async function setupPlacesSearch() {
  const countrySelect = document.getElementById("country-select");
  const citySelect = document.getElementById("city-select");
  if (!countrySelect || !citySelect) return;

  try {
    const response = await fetch("./data/places.json");
    if (!response.ok) {
      throw new Error("Could not load ./data/places.json");
    }

    const places = await response.json();
    console.log("Loaded places index", places.countries.length, places.cities.length);

    const countries = places.countries || [];
    const citiesByCountry = groupCitiesByCountry(places.cities || []);
    let currentCities = [];

    populateSelect(countrySelect, "Select country", countries, (country) => country.country);
    resetCitySelect(citySelect);

    countrySelect.addEventListener("change", () => {
      const country = countries.find((item) => item.country === countrySelect.value);
      resetCitySelect(citySelect);
      currentCities = [];

      if (!country) return;

      currentCities = citiesByCountry.get(country.country) || [];
      populateSelect(citySelect, "Select city", currentCities, (city) => city.city);
      citySelect.disabled = currentCities.length === 0;
      fitToBbox(country.bbox);
    });

    citySelect.addEventListener("change", () => {
      if (citySelect.value === "") return;
      const city = currentCities[Number(citySelect.value)];
      if (city) fitToBbox(city.bbox);
    });
  } catch (error) {
    console.error(error);
  }
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

function populateSelect(select, placeholder, records, labelForRecord) {
  select.replaceChildren(createOption("", placeholder));

  records.forEach((record, index) => {
    const value = record.city ? String(index) : record.country;
    select.appendChild(createOption(value, labelForRecord(record)));
  });
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
