/* ============================================================
   SKYLINE — Weather Dashboard
   Get a free API key at https://openweathermap.org/api
   ============================================================ */

const API_KEY = (typeof CONFIG !== "undefined" && CONFIG.API_KEY) ? CONFIG.API_KEY : "25cebd4800447a8fb7d0ebabf06048ac";
let UNITS = localStorage.getItem("skyline_units") || "metric"; // metric = °C, imperial = °F

const BASE = "https://api.openweathermap.org";
const HISTORY_KEY = "skyline_weather_history";
const FAVORITES_KEY = "skyline_favorites";
const CACHE_KEY = "skyline_last_bundle";
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// ---------- DOM refs ----------
const el = {
  skyBg: document.getElementById("skyBg"),
  apiBanner: document.getElementById("apiBanner"),
  retryBtn: document.getElementById("retryBtn"),
  alertBanner: document.getElementById("weatherAlert"),
  searchForm: document.getElementById("searchForm"),
  cityInput: document.getElementById("cityInput"),
  autocompleteList: document.getElementById("autocompleteList"),
  geoBtn: document.getElementById("geoBtn"),
  unitToggle: document.getElementById("unitToggle"),
  themeToggle: document.getElementById("themeToggle"),
  favChips: document.getElementById("favChips"),
  favAddBtn: document.getElementById("favAddBtn"),
  locationName: document.getElementById("locationName"),
  localTime: document.getElementById("localTime"),
  tempNow: document.getElementById("tempNow"),
  iconNow: document.getElementById("iconNow"),
  conditionNow: document.getElementById("conditionNow"),
  feelsLike: document.getElementById("feelsLike"),
  offlineNote: document.getElementById("offlineNote"),
  humidity: document.getElementById("humidity"),
  wind: document.getElementById("wind"),
  pressure: document.getElementById("pressure"),
  visibility: document.getElementById("visibility"),
  sunrise: document.getElementById("sunrise"),
  sunset: document.getElementById("sunset"),
  aqiDot: document.getElementById("aqiDot"),
  aqiText: document.getElementById("aqiText"),
  summaryGrid: document.getElementById("summaryGrid"),
  comparePanel: document.getElementById("comparePanel"),
  compareGrid: document.getElementById("compareGrid"),
  mapLayers: document.getElementById("mapLayers"),
  hourlyStrip: document.getElementById("hourlyStrip"),
  forecastGrid: document.getElementById("forecastGrid"),
};

let tempChart, historyChart, map, precipLayer, marker;
let lastLoad = null; // { type: "coords"|"city", lat, lon, name, query }
let activeMapLayer = "precipitation_new";

// ---------- Helpers ----------
const fmtTime = (unixSec, tzOffsetSec = 0) => {
  const d = new Date((unixSec + tzOffsetSec) * 1000);
  return d.toUTCString().slice(17, 22);
};
const fmtDay = (unixSec, tzOffsetSec = 0) => {
  const d = new Date((unixSec + tzOffsetSec) * 1000);
  return d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
};
const fmtDate = (unixSec, tzOffsetSec = 0) => {
  const d = new Date((unixSec + tzOffsetSec) * 1000);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
};
const iconUrl = (icon, size = "2x") => `https://openweathermap.org/img/wn/${icon}@${size}.png`;
const unitSymbol = () => (UNITS === "metric" ? "°C" : "°F");
const windUnit = () => (UNITS === "metric" ? "km/h" : "mph");
const debounce = (fn, ms) => {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
};

function setSkyCondition(mainWeather, icon) {
  const isNight = icon.endsWith("n");
  let cls = "cond-clouds";
  switch (mainWeather) {
    case "Clear": cls = isNight ? "cond-clear-night" : "cond-clear-day"; break;
    case "Clouds": cls = "cond-clouds"; break;
    case "Rain":
    case "Drizzle": cls = "cond-rain"; break;
    case "Thunderstorm": cls = "cond-thunder"; break;
    case "Snow": cls = "cond-snow"; break;
    case "Mist": case "Fog": case "Haze": case "Smoke": cls = "cond-mist"; break;
    default: cls = isNight ? "cond-clear-night" : "cond-clouds";
  }
  el.skyBg.className = "sky-bg " + cls;
}

function showBanner(msg, isError = false, showRetry = false) {
  el.apiBanner.childNodes[0].textContent = msg;
  el.apiBanner.style.display = "flex";
  el.apiBanner.style.color = isError ? "#ff8080" : "";
  el.retryBtn.style.display = showRetry ? "inline-block" : "none";
}
function hideBanner() {
  el.apiBanner.style.display = "none";
}

// ---------- Simple cache (reduces repeat calls, powers offline fallback) ----------
const memCache = new Map();
function cacheGet(key) {
  const hit = memCache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL) return hit.data;
  return null;
}
function cacheSet(key, data) {
  memCache.set(key, { data, ts: Date.now() });
}
function saveLastBundle(bundle) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ...bundle, ts: Date.now() })); } catch {}
}
function loadLastBundle() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch { return null; }
}

async function cachedFetch(url, cacheKey) {
  const hit = cacheGet(cacheKey);
  if (hit) return hit;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Request failed");
  const data = await res.json();
  cacheSet(cacheKey, data);
  return data;
}

// ---------- API calls ----------
async function geocodeCity(query, limit = 1) {
  const url = `${BASE}/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=${limit}&appid=${API_KEY}`;
  const data = await cachedFetch(url, `geo_${query}_${limit}`);
  if (!data.length) throw new Error(`No location found for "${query}"`);
  return data.map(d => ({ lat: d.lat, lon: d.lon, name: d.name, country: d.country, state: d.state }));
}

async function fetchCurrent(lat, lon) {
  const url = `${BASE}/data/2.5/weather?lat=${lat}&lon=${lon}&units=${UNITS}&appid=${API_KEY}`;
  return cachedFetch(url, `current_${lat}_${lon}_${UNITS}`);
}

async function fetchForecast(lat, lon) {
  const url = `${BASE}/data/2.5/forecast?lat=${lat}&lon=${lon}&units=${UNITS}&appid=${API_KEY}`;
  return cachedFetch(url, `forecast_${lat}_${lon}_${UNITS}`);
}

async function fetchAQI(lat, lon) {
  const url = `${BASE}/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`;
  return cachedFetch(url, `aqi_${lat}_${lon}`);
}

// ---------- Rendering ----------
function renderCurrent(data, displayName) {
  const tz = data.timezone || 0;
  el.locationName.textContent = displayName || `${data.name}, ${data.sys.country}`;
  el.localTime.textContent = fmtTime(data.dt, tz);
  el.tempNow.textContent = `${Math.round(data.main.temp)}°`;
  el.iconNow.src = iconUrl(data.weather[0].icon);
  el.iconNow.alt = data.weather[0].description;
  el.conditionNow.textContent = data.weather[0].description.replace(/\b\w/g, c => c.toUpperCase());
  el.feelsLike.textContent = `${Math.round(data.main.feels_like)}°`;
  el.humidity.textContent = `${data.main.humidity}%`;
  el.wind.textContent = `${UNITS === "metric" ? Math.round(data.wind.speed * 3.6) : Math.round(data.wind.speed)} ${windUnit()}`;
  el.pressure.textContent = `${data.main.pressure} hPa`;
  el.visibility.textContent = `${(data.visibility / 1000).toFixed(1)} km`;
  el.sunrise.textContent = fmtTime(data.sys.sunrise, tz);
  el.sunset.textContent = fmtTime(data.sys.sunset, tz);

  setSkyCondition(data.weather[0].main, data.weather[0].icon);
  el.hero_ready = true;
  document.getElementById("hero").classList.add("fade-in");

  checkSmartAlerts(data);
}

function checkSmartAlerts(data) {
  const alerts = [];
  const tempC = UNITS === "metric" ? data.main.temp : (data.main.temp - 32) * 5 / 9;
  const windKmh = UNITS === "metric" ? data.wind.speed * 3.6 : data.wind.speed * 1.609;
  const main = data.weather[0].main;

  if (main === "Thunderstorm") alerts.push("⚡ Thunderstorm activity in the area — stay indoors if possible.");
  if (tempC >= 40) alerts.push("🌡️ Extreme heat — stay hydrated and avoid direct sun.");
  if (tempC <= 4) alerts.push("❄️ Very cold conditions — dress warmly.");
  if (windKmh >= 40) alerts.push("💨 Strong winds — secure loose outdoor items.");
  if (data.rain && data.rain["1h"] && data.rain["1h"] > 7.6) alerts.push("🌧️ Heavy rainfall detected — watch for waterlogging.");

  if (alerts.length) {
    el.alertBanner.textContent = alerts.join("  ·  ");
    el.alertBanner.style.display = "block";
  } else {
    el.alertBanner.style.display = "none";
  }
}

function renderAQI(aqiData) {
  if (!aqiData || !aqiData.list || !aqiData.list.length) return;
  const idx = aqiData.list[0].main.aqi; // 1-5
  const labels = { 1: ["Good", "aqi-good"], 2: ["Fair", "aqi-fair"], 3: ["Moderate", "aqi-moderate"], 4: ["Poor", "aqi-poor"], 5: ["Very Poor", "aqi-verypoor"] };
  const [text, cls] = labels[idx] || ["--", ""];
  el.aqiText.textContent = text;
  el.aqiDot.className = "aqi-dot " + cls;
}

function renderHourly(forecast) {
  const tz = forecast.city.timezone || 0;
  const next8 = forecast.list.slice(0, 8);
  el.hourlyStrip.innerHTML = next8.map(item => `
    <div class="hour-chip fade-in">
      <p class="h-time mono">${fmtTime(item.dt, tz)}</p>
      <img src="${iconUrl(item.weather[0].icon)}" alt="${item.weather[0].description}" />
      <p class="h-temp">${Math.round(item.main.temp)}°</p>
    </div>
  `).join("");
}

function renderDailyForecast(forecast) {
  const tz = forecast.city.timezone || 0;
  const byDay = {};
  forecast.list.forEach(item => {
    const dayKey = fmtDay(item.dt, tz) + fmtDate(item.dt, tz);
    if (!byDay[dayKey]) byDay[dayKey] = { temps: [], items: [] };
    byDay[dayKey].temps.push(item.main.temp);
    byDay[dayKey].items.push(item);
  });

  const days = Object.values(byDay).slice(0, 5);
  el.forecastGrid.innerHTML = days.map(day => {
    const mid = day.items[Math.floor(day.items.length / 2)];
    const hi = Math.round(Math.max(...day.temps));
    const lo = Math.round(Math.min(...day.temps));
    return `
      <div class="day-card fade-in">
        <p class="d-name">${fmtDay(mid.dt, tz)}</p>
        <p class="d-date">${fmtDate(mid.dt, tz)}</p>
        <img src="${iconUrl(mid.weather[0].icon)}" alt="${mid.weather[0].description}" />
        <p class="d-range"><span class="hi">${hi}°</span> / <span class="lo">${lo}°</span></p>
      </div>
    `;
  }).join("");

  renderWeeklySummary(days);
}

function renderWeeklySummary(days) {
  if (!days.length) return;
  const allTemps = days.flatMap(d => d.temps);
  const avg = Math.round(allTemps.reduce((a, b) => a + b, 0) / allTemps.length);
  const hi = Math.round(Math.max(...allTemps));
  const lo = Math.round(Math.min(...allTemps));

  const conditionCounts = {};
  days.forEach(d => d.items.forEach(i => {
    const m = i.weather[0].main;
    conditionCounts[m] = (conditionCounts[m] || 0) + 1;
  }));
  const dominant = Object.entries(conditionCounts).sort((a, b) => b[1] - a[1])[0][0];

  el.summaryGrid.innerHTML = `
    <div class="summary-item"><span class="s-label">Avg temp</span><div class="s-value">${avg}°</div></div>
    <div class="summary-item"><span class="s-label">Highest</span><div class="s-value">${hi}°</div></div>
    <div class="summary-item"><span class="s-label">Lowest</span><div class="s-value">${lo}°</div></div>
    <div class="summary-item"><span class="s-label">Mostly</span><div class="s-value">${dominant}</div></div>
  `;
}

function renderTempChart(forecast) {
  if (typeof Chart === "undefined") { console.warn("Chart.js didn't load — skipping temperature chart."); return; }
  const tz = forecast.city.timezone || 0;
  const labels = forecast.list.slice(0, 12).map(i => fmtTime(i.dt, tz));
  const temps = forecast.list.slice(0, 12).map(i => Math.round(i.main.temp));

  if (tempChart) tempChart.destroy();
  tempChart = new Chart(document.getElementById("tempChart"), {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: `Temperature (${unitSymbol()})`,
        data: temps,
        borderColor: "#f4a93b",
        backgroundColor: "rgba(244,169,59,0.15)",
        fill: true,
        tension: 0.35,
        pointRadius: 3,
      }],
    },
    options: chartOptions(),
  });
}

function chartOptions() {
  const textColor = getComputedStyle(document.body).getPropertyValue("--slate") || "#8b96ad";
  return {
    responsive: true,
    plugins: { legend: { labels: { color: textColor, font: { family: "Inter" } } } },
    scales: {
      x: { ticks: { color: textColor, font: { family: "JetBrains Mono", size: 10 } }, grid: { color: "rgba(241,244,249,0.06)" } },
      y: { ticks: { color: textColor, font: { family: "JetBrains Mono", size: 10 } }, grid: { color: "rgba(241,244,249,0.06)" } },
    },
  };
}

function renderMap(lat, lon) {
  if (typeof L === "undefined") { console.warn("Leaflet didn't load — skipping map."); return; }
  if (!map) {
    map = L.map("weatherMap", { zoomControl: true }).setView([lat, lon], 8);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
  } else {
    map.setView([lat, lon], 8);
  }

  if (marker) marker.remove();
  marker = L.marker([lat, lon]).addTo(map);

  if (precipLayer) map.removeLayer(precipLayer);
  if (API_KEY && API_KEY !== "YOUR_OPENWEATHER_API_KEY") {
    precipLayer = L.tileLayer(
      `https://tile.openweathermap.org/map/${activeMapLayer}/{z}/{x}/{y}.png?appid=${API_KEY}`,
      { opacity: 0.6 }
    ).addTo(map);
  }
}

el.mapLayers.addEventListener("click", (e) => {
  const btn = e.target.closest(".layer-btn");
  if (!btn) return;
  activeMapLayer = btn.dataset.layer;
  el.mapLayers.querySelectorAll(".layer-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  if (map && precipLayer) {
    map.removeLayer(precipLayer);
    precipLayer = L.tileLayer(
      `https://tile.openweathermap.org/map/${activeMapLayer}/{z}/{x}/{y}.png?appid=${API_KEY}`,
      { opacity: 0.6 }
    ).addTo(map);
  }
});

// ---------- Local history logging ----------
function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch { return []; }
}

function logToday(data) {
  const history = loadHistory();
  const todayKey = new Date().toISOString().slice(0, 10);
  const entry = { date: todayKey, temp: Math.round(data.main.temp), humidity: data.main.humidity, condition: data.weather[0].main, city: data.name };
  const idx = history.findIndex(h => h.date === todayKey && h.city === data.name);
  if (idx >= 0) history[idx] = entry; else history.push(entry);
  const trimmed = history.slice(-60);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  return trimmed;
}

function renderHistoryChart(history, cityFilter) {
  if (typeof Chart === "undefined") { console.warn("Chart.js didn't load — skipping history chart."); return; }
  const filtered = cityFilter ? history.filter(h => h.city === cityFilter) : history;
  const labels = filtered.map(h => h.date.slice(5));
  const temps = filtered.map(h => h.temp);

  if (historyChart) historyChart.destroy();
  historyChart = new Chart(document.getElementById("historyChart"), {
    type: "line",
    data: {
      labels: labels.length ? labels : ["No data yet"],
      datasets: [{
        label: `Logged temperature (${unitSymbol()})`,
        data: temps.length ? temps : [0],
        borderColor: "#4fd1e8",
        backgroundColor: "rgba(79,209,232,0.18)",
        fill: true,
        tension: 0.3,
        pointRadius: 3,
      }],
    },
    options: chartOptions(),
  });
}

// ---------- Favorites ----------
function loadFavorites() {
  try { return JSON.parse(localStorage.getItem(FAVORITES_KEY)) || []; } catch { return []; }
}
function saveFavorites(favs) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
}
function renderFavorites() {
  const favs = loadFavorites();
  el.favChips.innerHTML = favs.map((f, i) => `
    <span class="fav-chip" data-idx="${i}">
      <span class="fav-name">${f.name}</span>
      <span class="fav-remove" data-remove="${i}">×</span>
    </span>
  `).join("");

  el.favChips.querySelectorAll(".fav-chip").forEach(chip => {
    chip.addEventListener("click", (e) => {
      if (e.target.dataset.remove !== undefined && e.target.hasAttribute("data-remove")) return;
      const idx = Number(chip.dataset.idx);
      const f = favs[idx];
      loadWeatherForCoords(f.lat, f.lon, f.name);
    });
  });
  el.favChips.querySelectorAll(".fav-remove").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = Number(btn.dataset.remove);
      const updated = favs.filter((_, i) => i !== idx);
      saveFavorites(updated);
      renderFavorites();
    });
  });

  renderCompare(favs);
}

async function renderCompare(favs) {
  if (!favs.length || !API_KEY || API_KEY === "YOUR_OPENWEATHER_API_KEY") {
    el.comparePanel.style.display = "none";
    return;
  }
  el.comparePanel.style.display = "block";
  el.compareGrid.innerHTML = favs.map(() => `<span class="skeleton skel-card"></span>`).join("");

  try {
    const results = await Promise.all(favs.map(f => fetchCurrent(f.lat, f.lon).catch(() => null)));
    el.compareGrid.innerHTML = favs.map((f, i) => {
      const d = results[i];
      if (!d) return `<div class="compare-card"><p class="cc-name">${f.name}</p><p class="cc-cond">Unavailable</p></div>`;
      return `
        <div class="compare-card fade-in" data-lat="${f.lat}" data-lon="${f.lon}" data-name="${f.name}">
          <p class="cc-name">${f.name}</p>
          <img src="${iconUrl(d.weather[0].icon)}" alt="${d.weather[0].description}" />
          <p class="cc-temp">${Math.round(d.main.temp)}°</p>
          <p class="cc-cond">${d.weather[0].main}</p>
        </div>
      `;
    }).join("");
    el.compareGrid.querySelectorAll(".compare-card[data-lat]").forEach(card => {
      card.addEventListener("click", () => {
        loadWeatherForCoords(Number(card.dataset.lat), Number(card.dataset.lon), card.dataset.name);
      });
    });
  } catch (err) {
    console.error(err);
  }
}

// ---------- Orchestration ----------
async function loadWeatherForCoords(lat, lon, displayName) {
  lastLoad = { type: "coords", lat, lon, name: displayName };
  try {
    hideBanner();
    el.offlineNote.style.display = "none";
    const [current, forecast, aqiData] = await Promise.all([fetchCurrent(lat, lon), fetchForecast(lat, lon), fetchAQI(lat, lon).catch(() => null)]);
    renderCurrent(current, displayName);
    renderHourly(forecast);
    renderDailyForecast(forecast);
    renderTempChart(forecast);
    renderMap(lat, lon);
    if (aqiData) renderAQI(aqiData);
    const history = logToday(current);
    renderHistoryChart(history, current.name);
    saveLastBundle({ current, forecast, aqiData, displayName, lat, lon });
  } catch (err) {
    console.error(err);
    handleLoadFailure(err);
  }
}

async function loadWeatherForCity(cityQuery) {
  lastLoad = { type: "city", query: cityQuery };
  try {
    hideBanner();
    const [loc] = await geocodeCity(cityQuery);
    const displayName = [loc.name, loc.state, loc.country].filter(Boolean).join(", ");
    await loadWeatherForCoords(loc.lat, loc.lon, displayName);
  } catch (err) {
    console.error(err);
    handleLoadFailure(err);
  }
}

function handleLoadFailure(err) {
  const cached = loadLastBundle();
  if (cached) {
    renderCurrent(cached.current, cached.displayName);
    renderHourly(cached.forecast);
    renderDailyForecast(cached.forecast);
    renderTempChart(cached.forecast);
    if (cached.aqiData) renderAQI(cached.aqiData);
    renderMap(cached.lat, cached.lon);
    el.offlineNote.style.display = "block";
    showBanner(`Couldn't refresh (${err.message}) — showing last saved data.`, true, true);
  } else {
    showBanner(`Couldn't load weather: ${err.message}`, true, true);
  }
}

function retryLastLoad() {
  if (!lastLoad) return;
  if (lastLoad.type === "coords") loadWeatherForCoords(lastLoad.lat, lastLoad.lon, lastLoad.name);
  else if (lastLoad.type === "city") loadWeatherForCity(lastLoad.query);
}

// ---------- Autocomplete ----------
const runAutocomplete = debounce(async (query) => {
  if (!query || query.length < 2 || !API_KEY || API_KEY === "YOUR_OPENWEATHER_API_KEY") {
    el.autocompleteList.classList.remove("open");
    return;
  }
  try {
    const matches = await geocodeCity(query, 5);
    if (!matches.length) { el.autocompleteList.classList.remove("open"); return; }
    el.autocompleteList.innerHTML = matches.map(m => {
      const label = [m.name, m.state, m.country].filter(Boolean).join(", ");
      return `<div class="ac-item" data-lat="${m.lat}" data-lon="${m.lon}" data-label="${label}">${label}</div>`;
    }).join("");
    el.autocompleteList.classList.add("open");
    el.autocompleteList.querySelectorAll(".ac-item").forEach(item => {
      item.addEventListener("click", () => {
        el.cityInput.value = item.dataset.label;
        el.autocompleteList.classList.remove("open");
        loadWeatherForCoords(Number(item.dataset.lat), Number(item.dataset.lon), item.dataset.label);
      });
    });
  } catch {
    el.autocompleteList.classList.remove("open");
  }
}, 400);

// ---------- Events ----------
el.searchForm.addEventListener("submit", (e) => {
  e.preventDefault();
  el.autocompleteList.classList.remove("open");
  const query = el.cityInput.value.trim();
  if (query) loadWeatherForCity(query);
});

el.cityInput.addEventListener("input", (e) => runAutocomplete(e.target.value.trim()));
document.addEventListener("click", (e) => {
  if (!el.autocompleteList.contains(e.target) && e.target !== el.cityInput) {
    el.autocompleteList.classList.remove("open");
  }
});

el.geoBtn.addEventListener("click", () => {
  if (!navigator.geolocation) { showBanner("Geolocation isn't supported in this browser.", true); return; }
  navigator.geolocation.getCurrentPosition(
    (pos) => loadWeatherForCoords(pos.coords.latitude, pos.coords.longitude),
    () => showBanner("Location permission denied — search a city instead.", true)
  );
});

el.retryBtn.addEventListener("click", retryLastLoad);

el.unitToggle.addEventListener("click", () => {
  UNITS = UNITS === "metric" ? "imperial" : "metric";
  localStorage.setItem("skyline_units", UNITS);
  el.unitToggle.textContent = unitSymbol();
  memCache.clear();
  retryLastLoad();
});

el.themeToggle.addEventListener("click", () => {
  const isLight = document.body.getAttribute("data-theme") === "light";
  const next = isLight ? "dark" : "light";
  if (next === "light") document.body.setAttribute("data-theme", "light");
  else document.body.removeAttribute("data-theme");
  el.themeToggle.textContent = next === "light" ? "☀️" : "🌙";
  localStorage.setItem("skyline_theme", next);
  if (tempChart) tempChart.options = chartOptions(), tempChart.update();
  if (historyChart) historyChart.options = chartOptions(), historyChart.update();
});

el.favAddBtn.addEventListener("click", () => {
  if (!lastLoad) return;
  const favs = loadFavorites();
  const name = el.locationName.textContent;
  const bundle = loadLastBundle();
  if (!bundle) return;
  if (favs.some(f => f.name === name)) return;
  favs.push({ name, lat: bundle.lat, lon: bundle.lon });
  saveFavorites(favs);
  renderFavorites();
});

// ---------- Init ----------
(function init() {
  const savedTheme = localStorage.getItem("skyline_theme");
  if (savedTheme === "light") {
    document.body.setAttribute("data-theme", "light");
    el.themeToggle.textContent = "☀️";
  }
  el.unitToggle.textContent = unitSymbol();

  if (!API_KEY || API_KEY === "YOUR_OPENWEATHER_API_KEY") {
    showBanner("Add your free OpenWeather API key in config.js (look for API_KEY) to activate live data.", true);
  } else {
    hideBanner();
    loadWeatherForCity("Hazaribagh, IN");
  }

  renderFavorites();
  const history = loadHistory();
  renderHistoryChart(history);
})();