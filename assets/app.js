// Map + camera viewer for the US Cams static site.
//
// Loads cameras.json, renders clustered markers on a Leaflet map, and opens a
// side panel with either a refreshing still image, an HLS live stream,
// a YouTube embed, an MJPEG stream, or a plain iframe — depending on the
// `view` field of the camera record.

const MAP_EL = document.getElementById("map");
const COUNT_EL = document.getElementById("count");
const SEARCH_EL = document.getElementById("search");
const CATEGORY_EL = document.getElementById("category-filter");
const VIEWER = document.getElementById("viewer");
const VIEWER_TITLE = document.getElementById("viewer-title");
const VIEWER_SUB = document.getElementById("viewer-sub");
const VIEWER_MEDIA = document.getElementById("viewer-media");
const VIEWER_META = document.getElementById("viewer-meta");
const VIEWER_CLOSE = document.querySelector(".viewer-close");
const DATA_STATUS = document.getElementById("data-status");

const CATEGORY_COLORS = {
  traffic: "#4f8cff",
  weather: "#6ad1ff",
  park: "#4cc27a",
  beach: "#ffc34f",
  ski: "#c9d6ff",
  airport: "#b07aff",
  city: "#ff9f4f",
  other: "#8b95a7",
};

const map = L.map(MAP_EL, {
  zoomControl: true,
  worldCopyJump: true,
  preferCanvas: true,
}).setView([39.5, -98.35], 4);

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

const cluster = L.markerClusterGroup({
  chunkedLoading: true,
  spiderfyOnMaxZoom: true,
  showCoverageOnHover: false,
  maxClusterRadius: 55,
  disableClusteringAtZoom: 13,
});
map.addLayer(cluster);

let ALL_CAMS = [];
let refreshTimer = null;
let hls = null;

function dotIcon(color) {
  return L.divIcon({
    className: "cam-marker",
    html:
      `<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'>` +
      `<circle cx='8' cy='8' r='6' fill='${color}' stroke='#fff' stroke-width='1.5'/>` +
      `</svg>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

const ICONS = Object.fromEntries(
  Object.entries(CATEGORY_COLORS).map(([k, v]) => [k, dotIcon(v)]),
);

async function loadCameras() {
  COUNT_EL.textContent = "Loading…";
  try {
    const res = await fetch("assets/cameras.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const cameras = Array.isArray(data) ? data : data.cameras || [];
    ALL_CAMS = cameras;
    if (data.generated) {
      const when = new Date(data.generated).toLocaleString();
      DATA_STATUS.textContent = `Updated ${when}`;
    }
    render();
  } catch (err) {
    COUNT_EL.textContent = "Failed to load";
    console.error("Failed to load cameras.json:", err);
    VIEWER.hidden = false;
    VIEWER_TITLE.textContent = "Unable to load cameras";
    VIEWER_SUB.textContent = "";
    VIEWER_MEDIA.innerHTML =
      `<div class="error">Could not fetch <code>assets/cameras.json</code>.<br>` +
      `Run the scraper (<code>cd scraper && npm start</code>) to generate it.</div>`;
    VIEWER_META.textContent = "";
  }
}

function passesFilters(c, q, category) {
  if (category && c.category !== category) return false;
  if (!q) return true;
  const hay = [
    c.name,
    c.state,
    c.region,
    c.route,
    c.sourceName,
    c.description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

function render() {
  const q = SEARCH_EL.value.trim().toLowerCase();
  const category = CATEGORY_EL.value;
  cluster.clearLayers();

  const batch = [];
  let shown = 0;
  for (const c of ALL_CAMS) {
    if (!passesFilters(c, q, category)) continue;
    shown++;
    const icon = ICONS[c.category] || ICONS.other;
    const m = L.marker([c.lat, c.lon], {
      icon,
      title: c.name,
    });
    m.on("click", () => openCamera(c));
    batch.push(m);
  }
  cluster.addLayers(batch);
  COUNT_EL.textContent = `${shown.toLocaleString()} cameras`;
}

SEARCH_EL.addEventListener("input", debounce(render, 180));
CATEGORY_EL.addEventListener("change", render);
VIEWER_CLOSE.addEventListener("click", closeViewer);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeViewer();
});

function closeViewer() {
  stopMedia();
  VIEWER.hidden = true;
}

function stopMedia() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
  if (hls) {
    try { hls.destroy(); } catch {}
    hls = null;
  }
  VIEWER_MEDIA.innerHTML = "";
}

function openCamera(c) {
  stopMedia();
  VIEWER.hidden = false;
  VIEWER_TITLE.textContent = c.name;
  VIEWER_SUB.textContent = [c.region, c.state, c.route].filter(Boolean).join(" · ");

  const meta = [];
  const badges = [];
  if (c.view) badges.push(`<span class="badge">${escapeHtml(viewLabel(c.view))}</span>`);
  if (c.category) badges.push(`<span class="badge">${escapeHtml(c.category)}</span>`);
  meta.push(badges.join(""));
  if (c.sourceName) {
    if (c.sourceUrl) {
      meta.push(
        `Source: <a href="${encodeURI(c.sourceUrl)}" target="_blank" rel="noopener">${escapeHtml(c.sourceName)}</a>`,
      );
    } else {
      meta.push(`Source: ${escapeHtml(c.sourceName)}`);
    }
  }
  if (c.url) {
    meta.push(
      `<a href="${encodeURI(c.url)}" target="_blank" rel="noopener">Open original</a>`,
    );
  }
  VIEWER_META.innerHTML = meta.filter(Boolean).join(" · ");

  VIEWER_MEDIA.innerHTML = `<div class="loading">Loading camera…</div>`;

  try {
    if (c.view === "hls") {
      mountHls(c);
    } else if (c.view === "youtube") {
      mountYouTube(c);
    } else if (c.view === "iframe") {
      mountIframe(c);
    } else if (c.view === "mjpeg") {
      mountImage(c, /*isMjpeg*/ true);
    } else if (c.view === "image") {
      mountImage(c, false);
    } else {
      mountLink(c);
    }
  } catch (err) {
    VIEWER_MEDIA.innerHTML = `<div class="error">Could not play this camera: ${escapeHtml(String(err.message || err))}</div>`;
  }

  map.panTo([c.lat, c.lon], { animate: true });
}

function viewLabel(view) {
  switch (view) {
    case "hls": return "live stream";
    case "mjpeg": return "live (MJPEG)";
    case "youtube": return "YouTube live";
    case "iframe": return "embedded";
    case "image": return "still image";
    case "page": return "link";
    default: return view;
  }
}

function mountImage(c, isMjpeg) {
  const img = document.createElement("img");
  img.alt = c.name;
  img.referrerPolicy = "no-referrer";
  img.loading = "eager";
  img.decoding = "async";
  const base = c.url;
  const bust = () => `${base}${base.includes("?") ? "&" : "?"}_=${Date.now()}`;
  img.src = isMjpeg ? base : bust();
  img.onerror = () => {
    VIEWER_MEDIA.innerHTML =
      `<div class="error">The image for this camera could not be loaded.<br>` +
      `<a href="${encodeURI(c.url)}" target="_blank" rel="noopener">Open the original source</a></div>`;
  };
  VIEWER_MEDIA.innerHTML = "";
  VIEWER_MEDIA.appendChild(img);

  if (!isMjpeg) {
    const period = (c.refresh || 8) * 1000;
    refreshTimer = setInterval(() => {
      if (document.hidden) return;
      img.src = bust();
    }, period);
  }
}

function mountHls(c) {
  const video = document.createElement("video");
  video.controls = true;
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;

  VIEWER_MEDIA.innerHTML = "";
  VIEWER_MEDIA.appendChild(video);

  if (window.Hls && window.Hls.isSupported()) {
    hls = new window.Hls({ lowLatencyMode: true });
    hls.loadSource(c.url);
    hls.attachMedia(video);
    hls.on(window.Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) {
        VIEWER_MEDIA.innerHTML =
          `<div class="error">Live stream error. <a href="${encodeURI(c.url)}" target="_blank" rel="noopener">Open original</a></div>`;
      }
    });
  } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
    video.src = c.url;
  } else {
    VIEWER_MEDIA.innerHTML =
      `<div class="error">HLS playback isn't supported in this browser. <a href="${encodeURI(c.url)}" target="_blank" rel="noopener">Open original</a></div>`;
  }
}

function mountYouTube(c) {
  // Accept either a video id, a youtube URL, or a full embed URL.
  let src = c.url;
  const idMatch = src.match(/(?:youtube\.com\/(?:watch\?v=|live\/|embed\/)|youtu\.be\/)([A-Za-z0-9_\-]+)/);
  const videoId = idMatch ? idMatch[1] : (/^[A-Za-z0-9_\-]{11}$/.test(src) ? src : null);
  if (videoId) {
    src = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1`;
  }
  const iframe = document.createElement("iframe");
  iframe.src = src;
  iframe.allow = "autoplay; encrypted-media; picture-in-picture";
  iframe.allowFullscreen = true;
  iframe.referrerPolicy = "no-referrer";
  VIEWER_MEDIA.innerHTML = "";
  VIEWER_MEDIA.appendChild(iframe);
}

function mountIframe(c) {
  const iframe = document.createElement("iframe");
  iframe.src = c.url;
  iframe.allow = "autoplay; encrypted-media; picture-in-picture";
  iframe.allowFullscreen = true;
  iframe.referrerPolicy = "no-referrer";
  VIEWER_MEDIA.innerHTML = "";
  VIEWER_MEDIA.appendChild(iframe);
}

function mountLink(c) {
  VIEWER_MEDIA.innerHTML =
    `<div class="error">This source doesn't expose an embeddable image or stream.<br>` +
    `<a href="${encodeURI(c.url)}" target="_blank" rel="noopener">Open the camera page</a></div>`;
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[c],
  );
}

loadCameras();
