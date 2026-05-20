const PMTILES_URL = "https://pub-1eed28d124134a23a63504e74634d29b.r2.dev/csmd_viewer_segments.pmtiles";
const SOURCE_LAYER = "csmd_segments";

const protocol = new pmtiles.Protocol();
maplibregl.addProtocol("pmtiles", protocol.tile);

const map = new maplibregl.Map({
  container: "map",
  style: {
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: [
          "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
          "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
          "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png"
        ],
        tileSize: 256,
        attribution: "&copy; OpenStreetMap contributors"
      }
    },
    layers: [
      {
        id: "osm",
        type: "raster",
        source: "osm"
      }
    ]
  },
  center: [0, 20],
  zoom: 1.5
});

map.addControl(new maplibregl.NavigationControl(), "top-left");

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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
