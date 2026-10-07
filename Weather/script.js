const apiKey = "13955c1577bac1d210bfb7863d36c2ce";

// THEME
document.getElementById("themeToggle").onclick = () => {
  document.body.classList.toggle("dark");
};

// TIME
setInterval(() => {
  const d = new Date();
  document.getElementById("time").innerText =
    d.toLocaleTimeString();
}, 1000);

// WEATHER
async function getWeather(cityName) {
  const cityInput = document.getElementById("city").value.trim();
const city = cityName || cityInput;

if (!city) {
  alert("City likho 😄");
  return;
}
  const res = await fetch(
    `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric`
  );
  const data = await res.json();

  // TEMP + DESC
  document.getElementById("temp").innerText = data.main.temp + "°C";
  document.getElementById("desc").innerText = data.weather[0].description;

  // ICON
  const iconCode = data.weather[0].icon;
  document.getElementById("icon").src =
    `https://openweathermap.org/img/wn/${iconCode}@2x.png`;

  // DETAILS
  document.getElementById("humidity").innerText =
    "💧 " + data.main.humidity + "%";
  document.getElementById("wind").innerText =
    "🌬 " + data.wind.speed + " km/h";

  // RAIN EFFECT
  if (data.weather[0].main.includes("Rain")) {
    document.getElementById("rain").innerHTML = "🌧🌧🌧";
  } else {
    document.getElementById("rain").innerHTML = "";
  }

document.getElementById("greetIcon").src =
  `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
document.getElementById("mainWeatherDesc").innerText = data.weather[0].main;
document.getElementById("subDesc").innerText = data.weather[0].description;
document.getElementById("locationName").innerText = "📍"+ data.name + "," + data.sys.country;

  // CALL EXTRA FEATURES
  getForecast(city);
  getHourly(city);
  loadMap(data.coord.lat, data.coord.lon);
}

// FORECAST
async function getForecast(city) {
  const res = await fetch(
    `https://api.openweathermap.org/data/2.5/forecast?q=${city}&appid=${apiKey}&units=metric`
  );
  const data = await res.json();

  const forecastDiv = document.getElementById("forecast");
  forecastDiv.innerHTML = "<h3 style='margin:0 0 10px'>Weather Forecast</h3>";

  const days = {};

  data.list.forEach(item => {
    const date = item.dt_txt.split(" ")[0];
    if (!days[date]) days[date] = item;
  });

  Object.keys(days).slice(0,5).forEach(day => {
    const d = days[day];
    const dateObj = new Date(day);
    const dayName = dateObj.toLocaleDateString('en-US', {weekday:'long', month:'short', day:'numeric'});
    const icon = d.weather[0].icon;
    const desc = d.weather[0].description;

    forecastDiv.innerHTML += `<div><img src="https://openweathermap.org/img/wn/${icon}.png" width="35">
        <span style="flex:1; text-align:left">${dayName}<br>
          <small style="opacity:0.7">${desc}</small>
        </span>
        <strong>${d.main.temp}°C</strong></div>`;
  });
}

// CHART
let chart;

async function getHourly(city) {
  const res = await fetch(
    `https://api.openweathermap.org/data/2.5/forecast?q=${city}&appid=${apiKey}&units=metric`
  );
  const data = await res.json();

  const labels = data.list.slice(0,6).map(i => i.dt_txt.split(" ")[1]);
  const temps = data.list.slice(0,6).map(i => i.main.temp);

  if (chart) chart.destroy();

  chart = new Chart(document.getElementById("chart"), {
    type: "line",
    data: {
      labels,
      datasets: [{
        data: temps,
        borderWidth: 2
      }]
    }
  });
}

// MAP
let map;

function loadMap(lat, lon) {

  if (map !== undefined) {
    map.remove();
  }

  map = L.map('map').setView([lat, lon], 10);

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

  L.marker([lat, lon]).addTo(map);

  setTimeout(() => {
    map.invalidateSize();
  }, 100);
}

document.getElementById("city").addEventListener("keypress", function(e) {
  if (e.key === "Enter") {
    getWeather();
  }
});

// LOAD DEFAULT
window.onload = () => {
  getWeather();
};

function getLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(success, error);
  } else {
    alert("Location support nahi hai browser me");
  }
}

function success(position) {
  const lat = position.coords.latitude;
  const lon = position.coords.longitude;

  getWeatherByCoords(lat, lon);
}

function error() {
  alert("Location allow karo 😄");
}

async function getWeatherByCoords(lat, lon) {
  const res = await fetch(
    `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`
  );
  const data = await res.json();

  document.getElementById("temp").innerText = data.main.temp + "°C";
  document.getElementById("desc").innerText = data.weather[0].description;

  const iconCode = data.weather[0].icon;
  document.getElementById("icon").src =
    `https://openweathermap.org/img/wn/${iconCode}@2x.png`;

  document.getElementById("humidity").innerText =
    "💧 " + data.main.humidity + "%";
  document.getElementById("wind").innerText =
    "🌬 " + data.wind.speed + " km/h";

  // extra features
  getForecast(data.name);
  getHourly(data.name);
  loadMap(lat, lon);
}

// GREETING
function setGreeting() {
  const h = new Date().getHours();
  let g = h < 12 ? "Good Morning" : h < 17 ? "Good Afternoon" : "Good Evening";
  document.getElementById("greet").innerText = g + ", John";
}
setGreeting();

// DATE
function setDate() {
  const d = new Date();
  document.getElementById("dateStr").innerText =
    d.toLocaleDateString('en-US', {weekday:'long', month:'long', day:'numeric'}) +
    " | " + d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
}
setDate();

// RAINFALL CHART (monthly static data)
new Chart(document.getElementById("rainfallChart"), {
  type: "bar",
  data: {
    labels: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    datasets: [{
      data: [30,20,40,60,90,120,150,130,100,70,40,25],
      backgroundColor: "rgba(100,180,255,0.7)",
      borderRadius: 4
    }]
  },
  options: {
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: '#aaa', font: {size: 9} } },
      y: { ticks: { color: '#aaa', font: {size: 9} } }
    }
  }
});

