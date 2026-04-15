// Static frontend for the US Public Cameras map.
//
// Responsibilities:
//   1. Load cameras.json and build a Leaflet + markercluster map.
//   2. Filter by text / source / state / category.
//   3. Render the appropriate player for each feed: jpeg (polled),
//      mjpeg (native <img>), hls (hls.js / native Safari), iframe, youtube.
//   4. Auto-fall-back to the next feed if one fails.
//   5. Persist map view + selected camera in the URL hash for sharing.

/* globals L, Hls */

const STATE = {
  all: [],             // all cameras from cameras.json
  filtered: [],        // current filter result
  markers: null,       // L.markerClusterGroup
  map: null,
  markerById: new Map(),
  activeCamera: null,
  activeFeed: null,
  activePoll: null,
  activeHls: null
};

const els = {
  stats: document.getElementById('stats'),
  search: document.getElementById('search'),
  fSource: document.getElementById('filter-source'),
  fRegion: document.getElementById('filter-region'),
  fTag: document.getElementById('filter-tag'),
  reset: document.getElementById('reset'),
  viewer: document.getElementById('viewer'),
  viewerClose: document.getElementById('viewer-close'),
  viewerTitle: document.getElementById('viewer-title'),
  viewerMeta: document.getElementById('viewer-meta'),
  viewerTabs: document.getElementById('viewer-tabs'),
  viewerPlayer: document.getElementById('viewer-player'),
  viewerLinks: document.getElementById('viewer-links'),
  genAt: document.getElementById('gen-at')
};

async function boot() {
  initMap();
  try {
    const res = await fetch('./assets/cameras.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const data = await res.json();
    STATE.all = Array.isArray(data.cameras) ? data.cameras : [];
    if (data.generatedAt) {
      const d = new Date(data.generatedAt);
      els.genAt.textContent = isNaN(d) ? data.generatedAt : d.toISOString().slice(0, 16).replace('T', ' ') + 'Z';
    }
  } catch (e) {
    els.stats.textContent = `failed to load cameras.json: ${e.message}`;
    console.error(e);
    return;
  }
  buildFilterOptions();
  wireControls();
  applyFilters();
  restoreFromHash();
}

function initMap() {
  STATE.map = L.map('map', { preferCanvas: true, worldCopyJump: true }).setView([39.8, -98.5], 4);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    crossOrigin: true
  }).addTo(STATE.map);
  STATE.markers = L.markerClusterGroup({
    chunkedLoading: true,
    maxClusterRadius: 60,
    spiderfyOnMaxZoom: true,
    disableClusteringAtZoom: 14
  });
  STATE.map.addLayer(STATE.markers);
  STATE.map.on('moveend', persistHash);
  STATE.map.on('zoomend', persistHash);
}

function buildFilterOptions() {
  const sources = new Set();
  const regions = new Set();
  const tags = new Set();
  for (const c of STATE.all) {
    if (c.source) sources.add(c.source);
    if (c.region) regions.add(c.region);
    for (const t of (c.tags || [])) tags.add(t);
  }
  fillSelect(els.fSource, [...sources].sort());
  fillSelect(els.fRegion, [...regions].sort());
  fillSelect(els.fTag, [...tags].sort());
}

function fillSelect(sel, vals) {
  const first = sel.firstElementChild;
  sel.innerHTML = '';
  sel.appendChild(first);
  for (const v of vals) {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = v;
    sel.appendChild(o);
  }
}

function wireControls() {
  let searchTimer;
  els.search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(applyFilters, 160);
  });
  els.fSource.addEventListener('change', applyFilters);
  els.fRegion.addEventListener('change', applyFilters);
  els.fTag.addEventListener('change', applyFilters);
  els.reset.addEventListener('click', () => {
    els.search.value = '';
    els.fSource.value = '';
    els.fRegion.value = '';
    els.fTag.value = '';
    applyFilters();
  });
  els.viewerClose.addEventListener('click', closeViewer);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeViewer();
  });
  window.addEventListener('hashchange', restoreFromHash);
}

function applyFilters() {
  const q = els.search.value.trim().toLowerCase();
  const src = els.fSource.value;
  const reg = els.fRegion.value;
  const tag = els.fTag.value;
  const filtered = STATE.all.filter((c) => {
    if (src && c.source !== src) return false;
    if (reg && c.region !== reg) return false;
    if (tag && !(c.tags || []).includes(tag)) return false;
    if (q) {
      const hay = `${c.name || ''} ${c.roadway || ''} ${c.locality || ''} ${c.direction || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  STATE.filtered = filtered;
  rerenderMarkers();
  els.stats.textContent =
    filtered.length === STATE.all.length
      ? `${STATE.all.length.toLocaleString()} cameras`
      : `${filtered.length.toLocaleString()} of ${STATE.all.length.toLocaleString()} cameras`;
}

function rerenderMarkers() {
  STATE.markers.clearLayers();
  STATE.markerById.clear();
  const batch = [];
  for (const c of STATE.filtered) {
    const m = L.marker([c.lat, c.lon], { title: c.name || c.id });
    m.bindTooltip(tooltipHtml(c), { direction: 'top', offset: [0, -8] });
    m.on('click', () => openViewer(c));
    STATE.markerById.set(c.id, m);
    batch.push(m);
  }
  STATE.markers.addLayers(batch);
}

function tooltipHtml(c) {
  const badges = [];
  if (c.source) badges.push(escape(c.source));
  if (c.region) badges.push(escape(c.region));
  return `<div><b>${escape(c.name || 'Camera')}</b></div>` +
         (badges.length ? `<div style="font-size:11px;opacity:0.7">${badges.join(' · ')}</div>` : '');
}

function openViewer(c) {
  STATE.activeCamera = c;
  els.viewer.hidden = false;
  els.viewer.setAttribute('aria-hidden', 'false');
  els.viewerTitle.textContent = c.name || 'Camera';
  els.viewerMeta.innerHTML = metaHtml(c);
  els.viewerLinks.innerHTML = '';
  const feeds = c.feeds || [];
  els.viewerTabs.innerHTML = '';
  feeds.forEach((f, i) => {
    const b = document.createElement('button');
    b.textContent = f.type.toUpperCase();
    b.addEventListener('click', () => playFeed(c, f, i));
    els.viewerTabs.appendChild(b);
  });
  if (feeds.length) playFeed(c, feeds[0], 0);
  else renderError('no feeds available');
  persistHash();
}

function playFeed(cam, feed, index) {
  stopPlayback();
  STATE.activeFeed = feed;
  Array.from(els.viewerTabs.children).forEach((b, i) => {
    b.classList.toggle('active', i === index);
  });
  els.viewerPlayer.innerHTML = '';

  // Mixed-content pre-flight: if we're on HTTPS and the feed is HTTP, the
  // browser will silently block the request. Show an explicit warning so the
  // user understands what's happening.
  if (location.protocol === 'https:' && /^http:\/\//i.test(feed.url)) {
    renderError(
      'this feed is served over HTTP; your browser blocks insecure requests on HTTPS pages. open it in a new tab:'
    );
    addLink('open feed (HTTP)', feed.url);
    return;
  }

  switch (feed.type) {
    case 'jpeg': return renderJpeg(cam, feed);
    case 'mjpeg': return renderMjpeg(cam, feed);
    case 'hls': return renderHls(cam, feed);
    case 'youtube': return renderYouTube(cam, feed);
    case 'iframe':
    default: return renderIframe(cam, feed);
  }
}

function renderJpeg(cam, feed) {
  const img = document.createElement('img');
  img.alt = cam.name || 'camera image';
  els.viewerPlayer.appendChild(img);
  const base = feed.url;
  const refreshSec = Math.max(1, Number(feed.refreshSec) || 10);
  const tick = () => {
    img.src = base + (base.includes('?') ? '&' : '?') + '_=' + Date.now();
  };
  img.addEventListener('error', () => tryFallback(cam, feed, 'image error'));
  tick();
  STATE.activePoll = setInterval(tick, refreshSec * 1000);
  addLink('direct image', base);
}

function renderMjpeg(cam, feed) {
  const img = document.createElement('img');
  img.alt = cam.name || 'camera stream';
  img.src = feed.url;
  img.addEventListener('error', () => tryFallback(cam, feed, 'stream error'));
  els.viewerPlayer.appendChild(img);
  addLink('stream', feed.url);
}

function renderHls(cam, feed) {
  const video = document.createElement('video');
  video.controls = true;
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;
  els.viewerPlayer.appendChild(video);

  const onFail = (msg) => tryFallback(cam, feed, msg || 'hls error');

  // Native HLS (Safari, iOS)
  if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = feed.url;
    video.addEventListener('error', () => onFail('native hls error'));
  } else if (typeof Hls !== 'undefined' && Hls.isSupported()) {
    const hls = new Hls({ enableWorker: true });
    hls.loadSource(feed.url);
    hls.attachMedia(video);
    hls.on(Hls.Events.ERROR, (_, data) => {
      if (data.fatal) {
        try { hls.destroy(); } catch {}
        STATE.activeHls = null;
        onFail(`hls ${data.type}`);
      }
    });
    STATE.activeHls = hls;
  } else {
    onFail('hls not supported in this browser');
  }
  addLink('stream (.m3u8)', feed.url);
}

function renderYouTube(cam, feed) {
  const frame = document.createElement('iframe');
  frame.src = feed.url;
  frame.allow = 'autoplay; encrypted-media';
  frame.allowFullscreen = true;
  frame.referrerPolicy = 'no-referrer';
  els.viewerPlayer.appendChild(frame);
  addLink('YouTube', feed.url);
}

function renderIframe(cam, feed) {
  const frame = document.createElement('iframe');
  frame.src = feed.url;
  frame.referrerPolicy = 'no-referrer';
  frame.sandbox = 'allow-scripts allow-same-origin allow-popups';
  els.viewerPlayer.appendChild(frame);
  addLink('open', feed.url);
}

function addLink(label, url) {
  const a = document.createElement('a');
  a.href = url; a.textContent = label;
  a.target = '_blank'; a.rel = 'noreferrer noopener';
  els.viewerLinks.appendChild(a);
}

function renderError(msg) {
  const d = document.createElement('div');
  d.style.cssText = 'padding:12px;font-size:13px;color:var(--fg-muted);';
  d.textContent = msg;
  els.viewerPlayer.innerHTML = '';
  els.viewerPlayer.appendChild(d);
}

function tryFallback(cam, currentFeed, reason) {
  const feeds = cam.feeds || [];
  const nextIdx = feeds.findIndex((f) => f === currentFeed) + 1;
  if (nextIdx > 0 && nextIdx < feeds.length) {
    playFeed(cam, feeds[nextIdx], nextIdx);
  } else {
    renderError(`feed unavailable (${reason})`);
  }
}

function stopPlayback() {
  if (STATE.activePoll) { clearInterval(STATE.activePoll); STATE.activePoll = null; }
  if (STATE.activeHls) { try { STATE.activeHls.destroy(); } catch {} STATE.activeHls = null; }
  els.viewerPlayer.innerHTML = '';
}

function closeViewer() {
  stopPlayback();
  STATE.activeCamera = null;
  els.viewer.hidden = true;
  els.viewer.setAttribute('aria-hidden', 'true');
  persistHash();
}

function metaHtml(c) {
  const parts = [];
  if (c.source) parts.push(`<span class="badge">${escape(c.source)}</span>`);
  if (c.region) parts.push(`<span class="badge">${escape(c.region)}</span>`);
  if (c.roadway) parts.push(`<span class="badge">${escape(c.roadway)}</span>`);
  if (c.direction) parts.push(`<span class="badge">${escape(c.direction)}</span>`);
  if (c.locality) parts.push(`<span class="badge">${escape(c.locality)}</span>`);
  parts.push(`<span class="badge">${c.lat.toFixed(3)}, ${c.lon.toFixed(3)}</span>`);
  return parts.join('');
}

function escape(s) {
  return String(s).replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

// ---------- URL hash sync ----------

function persistHash() {
  if (!STATE.map) return;
  const c = STATE.map.getCenter();
  const z = STATE.map.getZoom();
  const parts = [`@${c.lat.toFixed(4)},${c.lng.toFixed(4)},${z}z`];
  if (STATE.activeCamera) parts.push(`cam=${encodeURIComponent(STATE.activeCamera.id)}`);
  const hash = '#' + parts.join('&');
  if (hash !== location.hash) {
    history.replaceState(null, '', hash);
  }
}

function restoreFromHash() {
  const h = location.hash || '';
  const view = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(\d+)z/.exec(h);
  if (view) {
    STATE.map.setView([Number(view[1]), Number(view[2])], Number(view[3]));
  }
  const cam = /cam=([^&]+)/.exec(h);
  if (cam) {
    const id = decodeURIComponent(cam[1]);
    const c = STATE.all.find((x) => x.id === id);
    if (c) {
      STATE.map.setView([c.lat, c.lon], Math.max(STATE.map.getZoom(), 12));
      openViewer(c);
    }
  }
}

document.addEventListener('DOMContentLoaded', boot);
