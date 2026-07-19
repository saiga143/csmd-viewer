const SUMMARY_URL = "./data/summary.json";
let subregionalPopulationChart;
let subregionalShareChart;
let countryContributionChart;
let countryDeprivedShareChart;
let citySizePopulationChart;
let citySizeDeprivedShareChart;

document.addEventListener("DOMContentLoaded", () => {
  loadSummary();
  setupAboutModal();
});

async function loadSummary() {
  try {
    const response = await fetch(SUMMARY_URL);
    if (!response.ok) {
      throw new Error(`Could not load ${SUMMARY_URL}`);
    }

    const data = await response.json();
    renderGlobalSummary(data);
    renderPopulationClassificationChart(data.global);
    setupCitySizeAnalysis(data.global, data.regions || []);
    renderRegionalComparisonCharts(data.regions || []);
    setupSubregionalBreakdown(data.subregions || []);
    setupCountryContribution(data.countries || [], data.subregions || []);
  } catch (error) {
    console.error(error);
  }
}

function renderGlobalSummary(data) {
  const global = data.global;
  const cards = [
    ["Countries", formatCount(data.countries.length)],
    ["Cities", formatCount(global.number_of_cities)],
    ["Total population covered", formatPopulation(global.total_population)],
    [
      "Population in morphologically deprived segments",
      formatPopulation(global.deprived_population)
    ],
    ["Deprived population share", formatPercent(global.deprived_population_share)],
    ["Total segments", formatCount(global.total_segments)],
    ["Deprived segments", formatCount(global.deprived_segments)]
  ];

  const container = document.getElementById("global-summary");
  if (!container) return;

  container.replaceChildren(
    ...cards.map(([label, value]) => {
      const card = document.createElement("article");
      card.className = "summary-card";

      const labelElement = document.createElement("span");
      labelElement.textContent = label;

      const valueElement = document.createElement("strong");
      valueElement.textContent = value;

      card.append(labelElement, valueElement);
      return card;
    })
  );
}

function renderPopulationClassificationChart(global) {
  const canvas = document.getElementById("population-classification-chart");
  if (!canvas || !window.Chart) return;

  new Chart(canvas, {
    type: "bar",
    data: {
      labels: ["Population"],
      datasets: [
        {
          label: "Morphologically Deprived",
          data: [global.deprived_population],
          backgroundColor: "rgba(178, 72, 70, 0.74)",
          borderColor: "#7f2928",
          borderWidth: 1
        },
        {
          label: "Morphologically Non-deprived",
          data: [global.non_deprived_population],
          backgroundColor: "rgba(212, 212, 212, 0.76)",
          borderColor: "#9a9a9a",
          borderWidth: 1
        }
      ]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 500
      },
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            boxWidth: 14,
            color: "#333",
            font: {
              size: 12
            }
          }
        },
        tooltip: {
          callbacks: {
            label(context) {
              return `${context.dataset.label}: ${formatPopulation(context.raw)}`;
            }
          }
        }
      },
      scales: {
        x: {
          stacked: true,
          ticks: {
            color: "#555",
            callback(value) {
              return formatPopulation(value);
            }
          },
          grid: {
            color: "rgba(0, 0, 0, 0.08)"
          }
        },
        y: {
          stacked: true,
          ticks: {
            display: false
          },
          grid: {
            display: false
          }
        }
      }
    }
  });
}

function setupCitySizeAnalysis(globalSummary, regions) {
  const tabs = document.querySelectorAll(".city-size-tab");
  if (tabs.length === 0) return;

  function selectGeography(geography) {
    const summary = geography === "global"
      ? globalSummary
      : regions.find((region) => region.region === geography);
    if (!summary) return;

    tabs.forEach((tab) => {
      const isActive = tab.dataset.geography === geography;
      tab.classList.toggle("active", isActive);
      tab.setAttribute("aria-selected", String(isActive));
    });

    updateCitySizeAnalysis(summary);
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      selectGeography(tab.dataset.geography);
    });
  });

  selectGeography("global");
}

function updateCitySizeAnalysis(summary) {
  const breakdown = summary.city_size_breakdown || [];
  renderCitySizeFinding(summary);
  renderCitySizePopulationChart(breakdown);
  renderCitySizeDeprivedShareChart(breakdown);
}

function renderCitySizeFinding(summary) {
  const value = document.getElementById("city-size-finding-value");
  const share = document.getElementById("city-size-finding-share");

  if (value) {
    value.textContent = formatCitySizePopulation(
      summary.small_medium_deprived_population
    );
  }
  if (share) {
    share.textContent = formatPercent(summary.small_medium_deprived_share);
  }
}

function renderCitySizePopulationChart(breakdown) {
  const canvas = document.getElementById("city-size-population-chart");
  if (!canvas || !window.Chart) return;

  if (citySizePopulationChart) {
    citySizePopulationChart.destroy();
  }

  citySizePopulationChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: breakdown.map((citySize) => citySize.city_size_label),
      datasets: [
        {
          label: "Morphologically Deprived",
          data: breakdown.map((citySize) => citySize.deprived_population),
          backgroundColor: "rgba(178, 72, 70, 0.74)",
          borderColor: "#7f2928",
          borderWidth: 1
        },
        {
          label: "Morphologically Non-deprived",
          data: breakdown.map((citySize) => citySize.non_deprived_population),
          backgroundColor: "rgba(212, 212, 212, 0.76)",
          borderColor: "#9a9a9a",
          borderWidth: 1
        }
      ]
    },
    options: citySizePopulationOptions()
  });
}

function citySizePopulationOptions() {
  return {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 500
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          title(items) {
            return items[0].label;
          },
          label(context) {
            return `${context.dataset.label}: ${formatCitySizePopulation(context.raw)}`;
          }
        }
      }
    },
    scales: {
      x: {
        stacked: true,
        beginAtZero: true,
        ticks: {
          color: "#555",
          callback(value) {
            return formatCitySizePopulation(value);
          }
        },
        grid: {
          color: "rgba(0, 0, 0, 0.08)"
        }
      },
      y: {
        stacked: true,
        ticks: {
          color: "#555",
          font: {
            size: 12
          }
        },
        grid: {
          display: false
        }
      }
    }
  };
}

function renderCitySizeDeprivedShareChart(breakdown) {
  const canvas = document.getElementById("city-size-deprived-share-chart");
  if (!canvas || !window.Chart) return;

  if (citySizeDeprivedShareChart) {
    citySizeDeprivedShareChart.destroy();
  }

  citySizeDeprivedShareChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: breakdown.map((citySize) => citySize.city_size_label),
      datasets: [
        {
          label: "Deprived population share",
          data: breakdown.map((citySize) => citySize.deprived_population_share),
          backgroundColor: "rgba(178, 72, 70, 0.74)",
          borderColor: "#7f2928",
          borderWidth: 1
        }
      ]
    },
    options: citySizeDeprivedShareOptions(),
    plugins: [horizontalValueLabelsPlugin(formatPercent)]
  });
}

function citySizeDeprivedShareOptions() {
  return {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 500
    },
    layout: {
      padding: {
        right: 62,
        bottom: 8
      }
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          title(items) {
            return items[0].label;
          },
          label(context) {
            return `${context.dataset.label}: ${formatPercent(context.raw)}`;
          }
        }
      }
    },
    scales: {
      x: {
        beginAtZero: true,
        max: 100,
        ticks: {
          color: "#555",
          callback(value) {
            return formatPercent(value);
          }
        },
        grid: {
          color: "rgba(0, 0, 0, 0.08)"
        }
      },
      y: {
        ticks: {
          color: "#555",
          font: {
            size: 12
          }
        },
        grid: {
          display: false
        }
      }
    }
  };
}

function renderRegionalComparisonCharts(regions) {
  const orderedRegions = ["Africa", "Asia", "Latin America and the Caribbean"]
    .map((regionName) => regions.find((region) => region.region === regionName))
    .filter(Boolean);

  renderRegionalDeprivedPopulationChart(orderedRegions);
  renderRegionalDeprivedShareChart(orderedRegions);
}

function renderRegionalDeprivedPopulationChart(regions) {
  const canvas = document.getElementById("regional-deprived-population-chart");
  if (!canvas || !window.Chart) return;

  new Chart(canvas, {
    type: "bar",
    data: {
      labels: regions.map((region) => shortRegionLabel(region.region)),
      datasets: [
        {
          label: "Morphologically Deprived population",
          data: regions.map((region) => Math.round(region.deprived_population / 1000000)),
          fullRegionNames: regions.map((region) => region.region),
          backgroundColor: "rgba(178, 72, 70, 0.74)",
          borderColor: "#7f2928",
          borderWidth: 1
        }
      ]
    },
    options: regionalBarOptions({
      tooltipFormatter: (value) => `${formatCount(value)}M`,
      tickFormatter: (value) => `${value}M`,
      yTitle: "Population (millions)"
    }),
    plugins: [regionalValueLabelsPlugin((value) => `${formatCount(value)}M`)]
  });
}

function renderRegionalDeprivedShareChart(regions) {
  const canvas = document.getElementById("regional-deprived-share-chart");
  if (!canvas || !window.Chart) return;

  new Chart(canvas, {
    type: "bar",
    data: {
      labels: regions.map((region) => shortRegionLabel(region.region)),
      datasets: [
        {
          label: "Deprived population share",
          data: regions.map((region) => region.deprived_population_share),
          fullRegionNames: regions.map((region) => region.region),
          backgroundColor: "rgba(178, 72, 70, 0.74)",
          borderColor: "#7f2928",
          borderWidth: 1
        }
      ]
    },
    options: regionalBarOptions({
      tooltipFormatter: formatPercent,
      tickFormatter: formatPercent,
      yTitle: "Share (%)"
    }),
    plugins: [regionalValueLabelsPlugin(formatPercent)]
  });
}

function regionalBarOptions({ tooltipFormatter, tickFormatter, yTitle }) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 500
    },
    layout: {
      padding: {
        top: 20,
        bottom: 18
      }
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          title(items) {
            const item = items[0];
            return item.dataset.fullRegionNames?.[item.dataIndex] || item.label;
          },
          label(context) {
            return `${context.dataset.label}: ${tooltipFormatter(context.raw)}`;
          }
        }
      }
    },
    scales: {
      x: {
        ticks: {
          color: "#555",
          maxRotation: 0,
          autoSkip: false,
          font: {
            size: 12
          }
        },
        grid: {
          display: false
        }
      },
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: yTitle,
          color: "#555",
          font: {
            size: 12
          }
        },
        ticks: {
          color: "#555",
          callback(value) {
            return tickFormatter(value);
          }
        },
        grid: {
          color: "rgba(0, 0, 0, 0.08)"
        }
      }
    }
  };
}

function shortRegionLabel(region) {
  if (region === "Latin America and the Caribbean") return "LAC";
  return region;
}

function setupSubregionalBreakdown(subregions) {
  const tabs = document.querySelectorAll(".region-tab");
  if (tabs.length === 0) return;

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((item) => item.classList.remove("active"));
      tab.classList.add("active");
      updateSubregionalCharts(tab.dataset.region, subregions);
    });
  });

  updateSubregionalCharts("Africa", subregions);
}

function updateSubregionalCharts(region, subregions) {
  const filteredSubregions = subregions
    .filter((subregion) => subregion.region === region)
    .sort((a, b) => a.subregion.localeCompare(b.subregion));

  renderSubregionalDeprivedPopulationChart(filteredSubregions);
  renderSubregionalDeprivedShareChart(filteredSubregions);
}

function renderSubregionalDeprivedPopulationChart(subregions) {
  const canvas = document.getElementById("subregional-deprived-population-chart");
  if (!canvas || !window.Chart) return;

  if (subregionalPopulationChart) {
    subregionalPopulationChart.destroy();
  }

  resizeSubregionalChart(canvas, subregions.length);
  subregionalPopulationChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: subregions.map((subregion) => subregion.subregion),
      datasets: [
        {
          label: "Morphologically Deprived population",
          data: subregions.map((subregion) => subregion.deprived_population),
          backgroundColor: "rgba(178, 72, 70, 0.74)",
          borderColor: "#7f2928",
          borderWidth: 1
        }
      ]
    },
    options: subregionalBarOptions({
      tooltipFormatter: formatCompactPopulation,
      tickFormatter: formatCompactPopulation,
      xTitle: "Population (millions)"
    }),
    plugins: [horizontalValueLabelsPlugin(formatCompactPopulation)]
  });
}

function renderSubregionalDeprivedShareChart(subregions) {
  const canvas = document.getElementById("subregional-deprived-share-chart");
  if (!canvas || !window.Chart) return;

  if (subregionalShareChart) {
    subregionalShareChart.destroy();
  }

  resizeSubregionalChart(canvas, subregions.length);
  subregionalShareChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: subregions.map((subregion) => subregion.subregion),
      datasets: [
        {
          label: "Deprived population share",
          data: subregions.map((subregion) => subregion.deprived_population_share),
          backgroundColor: "rgba(178, 72, 70, 0.74)",
          borderColor: "#7f2928",
          borderWidth: 1
        }
      ]
    },
    options: subregionalBarOptions({
      tooltipFormatter: formatPercent,
      tickFormatter: formatPercent,
      xTitle: "Share (%)"
    }),
    plugins: [horizontalValueLabelsPlugin(formatPercent)]
  });
}

function subregionalBarOptions({ tooltipFormatter, tickFormatter, xTitle }) {
  return {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 500
    },
    layout: {
      padding: {
        right: 76,
        bottom: 20
      }
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label(context) {
            return `${context.dataset.label}: ${tooltipFormatter(context.raw)}`;
          }
        }
      }
    },
    scales: {
      x: {
        beginAtZero: true,
        title: {
          display: true,
          text: xTitle,
          color: "#555",
          font: {
            size: 12
          }
        },
        ticks: {
          color: "#555",
          callback(value) {
            return tickFormatter(value);
          }
        },
        grid: {
          color: "rgba(0, 0, 0, 0.08)"
        }
      },
      y: {
        ticks: {
          color: "#555",
          font: {
            size: 12
          }
        },
        grid: {
          display: false
        }
      }
    }
  };
}

function resizeSubregionalChart(canvas, rowCount) {
  const height = Math.max(230, rowCount * 42 + 90);
  const card = canvas.closest(".subregional-chart-card");
  if (card) {
    card.style.height = `${height + 70}px`;
  }
  canvas.style.height = `${height}px`;
}

function regionalValueLabelsPlugin(formatter) {
  return {
    id: `regional-value-labels-${Math.random().toString(36).slice(2)}`,
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      const dataset = chart.data.datasets[0];
      const meta = chart.getDatasetMeta(0);

      ctx.save();
      ctx.fillStyle = "#333";
      ctx.font = "12px Arial, Helvetica, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";

      meta.data.forEach((bar, index) => {
        const value = dataset.data[index];
        ctx.fillText(formatter(value), bar.x, bar.y - 6);
      });

      ctx.restore();
    }
  };
}

function horizontalValueLabelsPlugin(formatter) {
  return {
    id: `horizontal-value-labels-${Math.random().toString(36).slice(2)}`,
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      const dataset = chart.data.datasets[0];
      const meta = chart.getDatasetMeta(0);

      ctx.save();
      ctx.fillStyle = "#333";
      ctx.font = "12px Arial, Helvetica, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";

      meta.data.forEach((bar, index) => {
        const value = dataset.data[index];
        ctx.fillText(formatter(value), bar.x + 6, bar.y);
      });

      ctx.restore();
    }
  };
}

function setupCountryContribution(countries, subregions) {
  const regionSelect = document.getElementById("country-contribution-region");
  const subregionSelect = document.getElementById("country-contribution-subregion");
  if (!regionSelect || !subregionSelect) return;

  function updateSubregionOptions() {
    const selectedRegion = regionSelect.value;
    const subregionOptions = subregions
      .filter((subregion) => subregion.region === selectedRegion)
      .sort((a, b) => a.subregion.localeCompare(b.subregion));

    subregionSelect.replaceChildren(
      ...subregionOptions.map((subregion) => {
        const option = document.createElement("option");
        option.value = subregion.subregion;
        option.textContent = subregion.subregion;
        return option;
      })
    );

    if (selectedRegion === "Asia") {
      subregionSelect.value = "South-Central Asia";
    }
  }

  function updateChart() {
    renderCountryContributionCharts(
      countries,
      subregions,
      regionSelect.value,
      subregionSelect.value
    );
  }

  regionSelect.addEventListener("change", () => {
    updateSubregionOptions();
    updateChart();
  });
  subregionSelect.addEventListener("change", updateChart);

  updateSubregionOptions();
  updateChart();
}

function renderCountryContributionCharts(countries, subregions, region, subregion) {
  renderCountryContributionChart(countries, subregions, region, subregion);
  renderCountryDeprivedShareChart(countries, region, subregion);
}

function renderCountryContributionChart(countries, subregions, region, subregion) {
  const canvas = document.getElementById("country-contribution-chart");
  if (!canvas || !window.Chart) return;

  const subregionSummary = subregions.find(
    (item) => item.region === region && item.subregion === subregion
  );
  const subregionDeprivedPopulation = subregionSummary?.deprived_population || 0;
  const countryRows = countries
    .filter((country) => country.region === region && country.subregion === subregion)
    .sort((a, b) => b.deprived_population - a.deprived_population);

  if (countryContributionChart) {
    countryContributionChart.destroy();
  }

  resizeCountryContributionChart(canvas, countryRows.length);
  countryContributionChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: countryRows.map((country) => country.country),
      datasets: [
        {
          label: "Morphologically Deprived population",
          data: countryRows.map((country) => country.deprived_population / 1000000),
          backgroundColor: "rgba(178, 72, 70, 0.74)",
          borderColor: "#7f2928",
          borderWidth: 1,
          countries: countryRows,
          subregionDeprivedPopulation
        }
      ]
    },
    options: countryContributionOptions(),
    plugins: [countryContributionLabelsPlugin()]
  });
}

function renderCountryDeprivedShareChart(countries, region, subregion) {
  const canvas = document.getElementById("country-deprived-share-chart");
  if (!canvas || !window.Chart) return;

  const countryRows = countries
    .filter((country) => country.region === region && country.subregion === subregion)
    .sort((a, b) => b.deprived_population_share - a.deprived_population_share);

  if (countryDeprivedShareChart) {
    countryDeprivedShareChart.destroy();
  }

  resizeCountryContributionChart(canvas, countryRows.length);
  countryDeprivedShareChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: countryRows.map((country) => country.country),
      datasets: [
        {
          label: "Deprived population share",
          data: countryRows.map((country) => country.deprived_population_share),
          backgroundColor: "rgba(178, 72, 70, 0.74)",
          borderColor: "#7f2928",
          borderWidth: 1,
          countries: countryRows
        }
      ]
    },
    options: countryDeprivedShareOptions(),
    plugins: [countryDeprivedShareLabelsPlugin()]
  });
}

function countryContributionOptions() {
  return {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 500
    },
    layout: {
      padding: {
        right: 100,
        bottom: 20
      }
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          title(items) {
            return items[0].label;
          },
          label(context) {
            const country = context.dataset.countries[context.dataIndex];
            const contribution = contributionShare(
              country.deprived_population,
              context.dataset.subregionDeprivedPopulation
            );
            return [
              `Deprived population: ${formatCompactPopulation(country.deprived_population)}`,
              `Total population: ${formatCompactPopulation(country.total_population)}`,
              `Country deprived population share: ${formatPercent(country.deprived_population_share)}`,
              `Contribution to selected subregion: ${formatPercent(contribution)}`
            ];
          }
        }
      }
    },
    scales: {
      x: {
        beginAtZero: true,
        title: {
          display: true,
          text: "Deprived population (millions)",
          color: "#555",
          font: {
            size: 12
          }
        },
        ticks: {
          color: "#555",
          callback(value) {
            return `${formatCount(Math.round(value))}M`;
          }
        },
        grid: {
          color: "rgba(0, 0, 0, 0.08)"
        }
      },
      y: {
        ticks: {
          color: "#555",
          font: {
            size: 12
          }
        },
        grid: {
          display: false
        }
      }
    }
  };
}

function countryDeprivedShareOptions() {
  return {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 500
    },
    layout: {
      padding: {
        right: 76,
        bottom: 20
      }
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          title(items) {
            return items[0].label;
          },
          label(context) {
            const country = context.dataset.countries[context.dataIndex];
            return [
              `Total population: ${formatCompactPopulation(country.total_population)}`,
              `Deprived population: ${formatCompactPopulation(country.deprived_population)}`,
              `Deprived population share: ${formatPercent(country.deprived_population_share)}`,
              `Deprived segments: ${formatCount(country.deprived_segments)}`
            ];
          }
        }
      }
    },
    scales: {
      x: {
        beginAtZero: true,
        title: {
          display: true,
          text: "Deprived population share (%)",
          color: "#555",
          font: {
            size: 12
          }
        },
        ticks: {
          color: "#555",
          callback(value) {
            return formatPercent(value);
          }
        },
        grid: {
          color: "rgba(0, 0, 0, 0.08)"
        }
      },
      y: {
        ticks: {
          color: "#555",
          font: {
            size: 12
          }
        },
        grid: {
          display: false
        }
      }
    }
  };
}

function countryContributionLabelsPlugin() {
  return {
    id: "country-contribution-labels",
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      const dataset = chart.data.datasets[0];
      const meta = chart.getDatasetMeta(0);

      ctx.save();
      ctx.fillStyle = "#333";
      ctx.font = "12px Arial, Helvetica, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";

      meta.data.forEach((bar, index) => {
        const country = dataset.countries[index];
        const contribution = contributionShare(
          country.deprived_population,
          dataset.subregionDeprivedPopulation
        );
        const label = `${formatCompactPopulation(country.deprived_population)} - ${formatPercent(contribution)}`;
        ctx.fillText(label, bar.x + 6, bar.y);
      });

      ctx.restore();
    }
  };
}

function countryDeprivedShareLabelsPlugin() {
  return {
    id: "country-deprived-share-labels",
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      const dataset = chart.data.datasets[0];
      const meta = chart.getDatasetMeta(0);

      ctx.save();
      ctx.fillStyle = "#333";
      ctx.font = "12px Arial, Helvetica, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";

      meta.data.forEach((bar, index) => {
        ctx.fillText(formatPercent(dataset.data[index]), bar.x + 6, bar.y);
      });

      ctx.restore();
    }
  };
}

function resizeCountryContributionChart(canvas, rowCount) {
  const height = Math.max(300, rowCount * 32 + 90);
  const card = canvas.closest(".country-contribution-card");
  if (card) {
    card.style.height = `${height + 70}px`;
  }
  canvas.style.height = `${height}px`;
}

function contributionShare(part, total) {
  if (!total) return 0;
  return (part / total) * 100;
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

function formatCompactPopulation(value) {
  const number = Number(value) || 0;
  if (number >= 1000000000) {
    return `${trimTrailingZeros((number / 1000000000).toFixed(1))}B`;
  }
  if (number >= 1000000) {
    return `${Math.round(number / 1000000)}M`;
  }
  if (number > 0) {
    return `${Math.round(number / 1000)}k`;
  }
  return "0";
}

function formatCitySizePopulation(value) {
  const parsed = Number(value);
  const number = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  if (number >= 1000000000) {
    return `${trimTrailingZeros((number / 1000000000).toFixed(2))}B`;
  }
  if (number >= 1000000) {
    return `${trimTrailingZeros((number / 1000000).toFixed(1))}M`;
  }
  if (number >= 1000) {
    return `${trimTrailingZeros((number / 1000).toFixed(1))}k`;
  }
  return formatCount(Math.round(number));
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

function setupAboutModal() {
  const modal = document.getElementById("about-modal");
  const openButton = document.querySelector("[data-about-open]");
  const closeButton = document.querySelector("[data-about-close]");
  if (!modal || !openButton || !closeButton) return;

  function openModal() {
    modal.hidden = false;
    closeButton.focus();
  }

  function closeModal() {
    modal.hidden = true;
    openButton.focus();
  }

  openButton.addEventListener("click", openModal);
  closeButton.addEventListener("click", closeModal);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeModal();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) {
      closeModal();
    }
  });
}
