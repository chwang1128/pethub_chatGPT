
const state = {
  places: [],
  activeCategory: "全部",
  favorites: new Set(JSON.parse(localStorage.getItem("pethub-favorites") || "[]")),
  markers: new Map()
};

const categories = ["全部","動物醫療","美容洗護","住宿安親","寵物友善","戶外活動","用品購物","其他服務"];

const els = {
  search: document.getElementById("searchInput"),
  city: document.getElementById("citySelect"),
  open: document.getElementById("openOnly"),
  h24: document.getElementById("hour24"),
  verified: document.getElementById("verifiedOnly"),
  chips: document.getElementById("categoryChips"),
  results: document.getElementById("results"),
  resultCount: document.getElementById("resultCount"),
  count24: document.getElementById("count24"),
  countVerified: document.getElementById("countVerified"),
  favoriteCount: document.getElementById("favoriteCount"),
  clearBtn: document.getElementById("clearBtn"),
  locateBtn: document.getElementById("locateBtn"),
  dialog: document.getElementById("detailDialog"),
  dialogContent: document.getElementById("dialogContent"),
  template: document.getElementById("placeCardTemplate")
};

const map = L.map("map", { zoomControl: true }).setView([23.75, 120.95], 7);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

function text(v) {
  return (v ?? "").toString();
}

function placeSearchText(place) {
  return [
    place.name, place.category, place.city, place.district, place.address,
    place.note, ...(place.tags || [])
  ].map(text).join(" ").toLowerCase();
}

function filteredPlaces() {
  const q = els.search.value.trim().toLowerCase();
  return state.places.filter(place => {
    if (q && !placeSearchText(place).includes(q)) return false;
    if (els.city.value && place.city !== els.city.value) return false;
    if (state.activeCategory !== "全部" && place.category !== state.activeCategory) return false;
    if (els.open.checked && !place.open) return false;
    if (els.h24.checked && !place.h24) return false;
    if (els.verified.checked && !place.verified) return false;
    return true;
  });
}

function saveFavorites() {
  localStorage.setItem("pethub-favorites", JSON.stringify([...state.favorites]));
}

function toggleFavorite(id) {
  state.favorites.has(id) ? state.favorites.delete(id) : state.favorites.add(id);
  saveFavorites();
  render();
}

function directionsUrl(place) {
  const dest = encodeURIComponent(place.address || `${place.lat},${place.lng}`);
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
}

function renderCities() {
  const cities = [...new Set(state.places.map(p => p.city).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"zh-Hant"));
  els.city.innerHTML = '<option value="">全台灣</option>' + cities.map(c => `<option>${c}</option>`).join("");
}

function renderChips() {
  els.chips.innerHTML = "";
  categories.forEach(category => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chip" + (category === state.activeCategory ? " active" : "");
    button.textContent = category;
    button.addEventListener("click", () => {
      state.activeCategory = category;
      renderChips();
      render();
    });
    els.chips.appendChild(button);
  });
}

function badge(label, className="") {
  const span = document.createElement("span");
  span.className = `badge ${className}`;
  span.textContent = label;
  return span;
}

function renderResults(data) {
  els.results.innerHTML = "";

  if (!data.length) {
    els.results.innerHTML = '<div class="empty">找不到符合條件的地點，請調整搜尋或篩選條件。</div>';
    return;
  }

  data.forEach(place => {
    const card = els.template.content.firstElementChild.cloneNode(true);
    const badgeRow = card.querySelector(".badge-row");
    const tagRow = card.querySelector(".tag-row");
    const favBtn = card.querySelector(".favorite-btn");

    badgeRow.appendChild(badge(place.category));
    if (place.h24) badgeRow.appendChild(badge("24H"));
    if (place.verified) badgeRow.appendChild(badge("✓ 已驗證", "verified"));

    card.querySelector(".place-name").textContent = place.name;
    card.querySelector(".place-meta").textContent =
      [place.city, place.district, place.open ? "營業中" : "目前未營業／待確認"].filter(Boolean).join(" · ");
    card.querySelector(".place-note").textContent = place.note || "";

    (place.tags || []).forEach(tagText => {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = `#${tagText}`;
      tagRow.appendChild(tag);
    });

    favBtn.textContent = state.favorites.has(place.id) ? "★" : "☆";
    favBtn.addEventListener("click", () => toggleFavorite(place.id));
    card.querySelector(".detail-btn").addEventListener("click", () => openDetail(place));
    card.querySelector(".nav-btn").addEventListener("click", () => {
      window.open(directionsUrl(place), "_blank", "noopener,noreferrer");
    });

    els.results.appendChild(card);
  });
}

function renderMarkers(data) {
  state.markers.forEach(marker => marker.remove());
  state.markers.clear();

  const bounds = [];

  data.forEach(place => {
    if (!Number.isFinite(place.lat) || !Number.isFinite(place.lng)) return;

    const marker = L.marker([place.lat, place.lng]).addTo(map);
    marker.bindPopup(`
      <div class="popup-title">${escapeHtml(place.name)}</div>
      <div class="popup-meta">${escapeHtml([place.city, place.district, place.category].filter(Boolean).join(" · "))}</div>
    `);
    marker.on("click", () => {});
    state.markers.set(place.id, marker);
    bounds.push([place.lat, place.lng]);
  });

  if (bounds.length > 1) {
    map.fitBounds(bounds, { padding: [42,42], maxZoom: 13 });
  } else if (bounds.length === 1) {
    map.setView(bounds[0], 14);
  }
}

function escapeHtml(str) {
  return text(str).replace(/[&<>"']/g, ch => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  })[ch]);
}

function openDetail(place) {
  const favorite = state.favorites.has(place.id);
  els.dialogContent.innerHTML = `
    <div class="dialog-body">
      <div class="dialog-head">
        <div>
          <div class="badge-row">
            <span class="badge">${escapeHtml(place.category)}</span>
            ${place.h24 ? '<span class="badge">24H</span>' : ''}
            ${place.verified ? '<span class="badge verified">✓ 已驗證</span>' : ''}
          </div>
          <h2 style="margin:12px 0 4px">${escapeHtml(place.name)}</h2>
          <div style="color:var(--muted)">${escapeHtml([place.city, place.district].filter(Boolean).join(" · "))}</div>
        </div>
        <button id="closeDialogBtn" class="ghost-btn" type="button">關閉</button>
      </div>

      <div class="dialog-grid">
        <div><strong>地址：</strong>${escapeHtml(place.address || "待補充")}</div>
        <div><strong>電話：</strong>${escapeHtml(place.phone || "待補充")}</div>
        <div><strong>服務：</strong>${escapeHtml(place.note || "待補充")}</div>
        <div><strong>狀態：</strong>${place.open ? "目前營業" : "目前未營業／待確認"}${place.h24 ? " · 24H" : ""}</div>
        <div><strong>資料狀態：</strong>${place.verified ? "✓ 已驗證" : "待進一步驗證"}</div>
        <div><strong>資料來源：</strong>${escapeHtml(place.source || "待補充")}</div>
      </div>

      <div class="card-actions" style="margin-top:20px">
        <button id="dialogFavoriteBtn" class="secondary-btn" type="button">${favorite ? "★ 已收藏" : "☆ 收藏"}</button>
        <button id="dialogNavBtn" class="primary-btn" type="button">導航</button>
      </div>
    </div>
  `;

  els.dialog.showModal();

  document.getElementById("closeDialogBtn").addEventListener("click", () => els.dialog.close());
  document.getElementById("dialogFavoriteBtn").addEventListener("click", () => {
    toggleFavorite(place.id);
    els.dialog.close();
    openDetail(place);
  });
  document.getElementById("dialogNavBtn").addEventListener("click", () => {
    window.open(directionsUrl(place), "_blank", "noopener,noreferrer");
  });
}

function render() {
  const data = filteredPlaces();
  els.resultCount.textContent = data.length;
  els.count24.textContent = data.filter(p => p.h24).length;
  els.countVerified.textContent = data.filter(p => p.verified).length;
  els.favoriteCount.textContent = state.favorites.size;
  renderResults(data);
  renderMarkers(data);
}

function clearFilters() {
  els.search.value = "";
  els.city.value = "";
  els.open.checked = false;
  els.h24.checked = false;
  els.verified.checked = false;
  state.activeCategory = "全部";
  renderChips();
  render();
}

function locateUser() {
  if (!navigator.geolocation) {
    alert("此瀏覽器不支援定位功能。");
    return;
  }
  els.locateBtn.disabled = true;
  els.locateBtn.textContent = "定位中…";
  navigator.geolocation.getCurrentPosition(
    pos => {
      const here = [pos.coords.latitude, pos.coords.longitude];
      map.setView(here, 14);
      L.circleMarker(here, { radius: 8 }).addTo(map).bindPopup("你目前的位置").openPopup();
      els.locateBtn.disabled = false;
      els.locateBtn.textContent = "⌖ 我的附近";
    },
    () => {
      alert("無法取得定位。請確認瀏覽器已允許位置權限。");
      els.locateBtn.disabled = false;
      els.locateBtn.textContent = "⌖ 我的附近";
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

async function init() {
  try {
    const response = await fetch("./data/places.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.places = await response.json();

    renderCities();
    renderChips();
    render();

    ["input", "change"].forEach(evt => els.search.addEventListener(evt, render));
    els.city.addEventListener("change", render);
    els.open.addEventListener("change", render);
    els.h24.addEventListener("change", render);
    els.verified.addEventListener("change", render);
    els.clearBtn.addEventListener("click", clearFilters);
    els.locateBtn.addEventListener("click", locateUser);
    els.dialog.addEventListener("click", event => {
      if (event.target === els.dialog) els.dialog.close();
    });
  } catch (error) {
    console.error(error);
    els.results.innerHTML = '<div class="empty">資料載入失敗。若你是直接雙擊 index.html，請改用本機 HTTP Server 或部署到 GitHub Pages。</div>';
  }
}

init();
