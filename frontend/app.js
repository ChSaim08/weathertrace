
const $ = (id) => document.getElementById(id);

const locationButton = $("locationButton");
const statusText = $("statusText");

function setStatus(message, type = "neutral") {
    statusText.textContent = message;
    const pill = $("connectionStatus");
    const labels = {
        neutral: "Ready",
        loading: "Working",
        success: "Connected",
        error: "Needs attention",
    };
    pill.innerHTML = `<span class="dot"></span> ${labels[type] || labels.neutral}`;
    pill.className = `status-pill ${type}`;
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function weatherDescription(code) {
    const map = {
        0: ["Clear sky", "☀️"],
        1: ["Mainly clear", "🌤️"],
        2: ["Partly cloudy", "⛅"],
        3: ["Overcast", "☁️"],
        45: ["Fog", "🌫️"],
        48: ["Depositing rime fog", "🌫️"],
        51: ["Light drizzle", "🌦️"],
        53: ["Drizzle", "🌦️"],
        55: ["Dense drizzle", "🌧️"],
        56: ["Freezing drizzle", "🌧️"],
        57: ["Dense freezing drizzle", "🌧️"],
        61: ["Slight rain", "🌦️"],
        63: ["Rain", "🌧️"],
        65: ["Heavy rain", "🌧️"],
        66: ["Freezing rain", "🌧️"],
        67: ["Heavy freezing rain", "🌧️"],
        71: ["Slight snow", "🌨️"],
        73: ["Snow", "🌨️"],
        75: ["Heavy snow", "❄️"],
        77: ["Snow grains", "❄️"],
        80: ["Rain showers", "🌦️"],
        81: ["Rain showers", "🌧️"],
        82: ["Heavy rain showers", "⛈️"],
        85: ["Snow showers", "🌨️"],
        86: ["Heavy snow showers", "❄️"],
        95: ["Thunderstorm", "⛈️"],
        96: ["Thunderstorm with hail", "⛈️"],
        99: ["Thunderstorm with heavy hail", "⛈️"],
    };
    return map[code] || ["Unknown conditions", "🌡️"];
}

function formatDay(dateString) {
    const date = new Date(`${dateString}T12:00:00`);
    return date.toLocaleDateString(undefined, { weekday: "short" });
}

function formatDate(dateString) {
    const date = new Date(`${dateString}T12:00:00`);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatTime(dateTime) {
    if (!dateTime) return "—";
    return new Date(dateTime).toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
    });
}

async function sendLocation(position) {
    const c = position.coords;
    const response = await fetch("/api/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            latitude: c.latitude,
            longitude: c.longitude,
            accuracy: c.accuracy,
            altitude: c.altitude,
            speed: c.speed,
            heading: c.heading,
            timestamp: position.timestamp,
        }),
    });

    if (!response.ok) throw new Error("The server could not save the location.");
    return response.json();
}

async function getWeather(latitude, longitude) {
    const query = new URLSearchParams({ latitude, longitude });
    const response = await fetch(`/api/weather?${query.toString()}`);
    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.detail || "Weather request failed.");
    }
    return response.json();
}

function renderLocation(location) {
    $("latitude").textContent = location.latitude.toFixed(6);
    $("longitude").textContent = location.longitude.toFixed(6);
    $("accuracyBadge").textContent =
        typeof location.accuracy_m === "number"
            ? `±${Math.round(location.accuracy_m)} m`
            : "Accuracy unknown";

    $("coordsDetail").textContent =
        `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`;

    $("locationMeta").textContent =
        `Received ${new Date(location.received_at).toLocaleString()}`;
}

function renderCurrent(weather) {
    const current = weather.current;
    const [description, icon] = weatherDescription(current.weather_code);

    $("currentGrid").innerHTML = `
        <div class="current-main">
            <div class="weather-icon">${icon}</div>
            <div>
                <div class="temperature">${Math.round(current.temperature_2m)}°</div>
                <div class="condition">${escapeHtml(description)}</div>
                <div class="feels">
                    Feels like ${Math.round(current.apparent_temperature)}°C
                </div>
            </div>
        </div>

        <div class="metric-card">
            <span>💧 Humidity</span>
            <strong>${Math.round(current.relative_humidity_2m)}%</strong>
        </div>
        <div class="metric-card">
            <span>💨 Wind</span>
            <strong>${Math.round(current.wind_speed_10m)} km/h</strong>
        </div>
        <div class="metric-card">
            <span>☁️ Clouds</span>
            <strong>${Math.round(current.cloud_cover)}%</strong>
        </div>
        <div class="metric-card">
            <span>🌧️ Precipitation</span>
            <strong>${Number(current.precipitation).toFixed(1)} mm</strong>
        </div>
    `;

    $("updatedAt").textContent = `Updated ${formatTime(current.time)}`;
    $("timezone").textContent = weather.timezone || "Local time";
}

function renderTimeline(weather) {
    const d = weather.daily;
    const cards = [];

    for (let i = 0; i < d.time.length; i++) {
        const date = d.time[i];
        const [description, icon] = weatherDescription(d.weather_code[i]);

        let type = "future";
        if (i < 5) type = "past";
        if (i === 5) type = "today";

        cards.push(`
            <article class="day-card ${type}">
                <div class="day-top">
                    <div>
                        <span class="day-name">${i === 5 ? "Today" : formatDay(date)}</span>
                        <span class="day-date">${formatDate(date)}</span>
                    </div>
                    <span class="day-type">${type}</span>
                </div>

                <div class="day-icon">${icon}</div>
                <div class="day-condition">${escapeHtml(description)}</div>

                <div class="temps">
                    <strong>${Math.round(d.temperature_2m_max[i])}°</strong>
                    <span>${Math.round(d.temperature_2m_min[i])}°</span>
                </div>

                <div class="day-stats">
                    <span>💧 ${d.precipitation_probability_max[i] ?? 0}%</span>
                    <span>🌧️ ${Number(d.precipitation_sum[i] ?? 0).toFixed(1)} mm</span>
                    <span>💨 ${Math.round(d.wind_speed_10m_max[i] ?? 0)} km/h</span>
                </div>
            </article>
        `);
    }

    $("timeline").innerHTML = cards.join("");
}

async function useLocation() {
    if (!navigator.geolocation) {
        setStatus("Geolocation is not supported by this browser.", "error");
        return;
    }

    locationButton.disabled = true;
    locationButton.innerHTML = "<span>⌁</span> Getting location…";
    setStatus("Waiting for your location permission…", "loading");

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            try {
                setStatus("Location received. Loading weather…", "loading");

                const saved = await sendLocation(position);
                renderLocation(saved.location);

                const weather = await getWeather(
                    saved.location.latitude,
                    saved.location.longitude
                );

                renderCurrent(weather);
                renderTimeline(weather);
                $("savedPoints").textContent = "Available";

                setStatus("Location + weather loaded", "success");
                locationButton.innerHTML = "<span>✓</span> Refresh My Location";
            } catch (error) {
                console.error(error);
                setStatus(error.message, "error");
                locationButton.innerHTML = "<span>⌁</span> Try Again";
            } finally {
                locationButton.disabled = false;
            }
        },
        (error) => {
            let message = "We couldn't get your location.";
            if (error.code === error.PERMISSION_DENIED) {
                message = "Location permission was denied. Allow it and try again.";
            } else if (error.code === error.POSITION_UNAVAILABLE) {
                message = "Your device could not determine a location.";
            } else if (error.code === error.TIMEOUT) {
                message = "Location request timed out. Try again.";
            }

            setStatus(message, "error");
            locationButton.disabled = false;
            locationButton.innerHTML = "<span>⌁</span> Try Again";
        },
        {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0,
        }
    );
}

locationButton.addEventListener("click", useLocation);
