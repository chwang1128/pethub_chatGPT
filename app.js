
const state = {
  places: [],
  filtered: [],
  markers: new Map(),
  favorites: new Set(JSON.parse(localStorage.getItem("pethub-favorites") || "[]")),
  mapMoved: false,
  activeCategory: "全部"
};

const els = {
  heroSearch: document.getElementById("heroSearch"),
  heroSearchBtn: document.getElementById("heroSearchBtn"),
  heroLocateBtn: document.getElementById("heroLocateBtn"),
  filterToggle: document.getElementById("filterToggle"),
  filterPanel: document.getElementById("filterPanel"),
  searchInput: document.getElementById("searchInput"),
  citySelect: document.getElementById("citySelect"),
  categorySelect: document.getElementById("categorySelect"),
  sortSelect: document.getElementById("sortSelect"),
  openOnly: document.getElementById("openOnly"),
  hour24: document.getElementById("hour24"),
  verifiedOnly: document.getElementById("verifiedOnly"),
  clearFilters: document.getElementById("clearFilters"),
  mapLocateBtn: document.getElementById("mapLocateBtn"),
  results: document.getElementById("results"),
  resultCount: document.getElementById("resultCount"),
  resultSummary: document.getElementById("resultSummary"),
  searchAreaBtn: document.getElementById("searchAreaBtn"),
  detailDialog: document.getElementById("detailDialog"),
  dialogContent: document.getElementById("dialogContent")
};

const TAIWAN_BOUNDS = L.latLngBounds([21.75,119.30],[25.45,122.20]);
const map = L.map("map",{zoomControl:false,preferCanvas:true}).setView([23.72,120.95],7);
L.control.zoom({position:"bottomright"}).addTo(map);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
  maxZoom:19,minZoom:6,
  attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);
map.setMaxBounds(TAIWAN_BOUNDS.pad(.55));

function ensureMapSize(){
  requestAnimationFrame(()=>map.invalidateSize({animate:false}));
}
window.addEventListener("resize", ensureMapSize);
window.addEventListener("load", ()=>{ensureMapSize(); setTimeout(ensureMapSize, 200);});
if("ResizeObserver" in window){
  new ResizeObserver(()=>ensureMapSize()).observe(document.querySelector(".map-panel"));
}

function escapeHtml(v){
  return String(v ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[ch]));
}
function saveFavorites(){
  localStorage.setItem("pethub-favorites", JSON.stringify([...state.favorites]));
}
function toggleFavorite(id){
  state.favorites.has(id) ? state.favorites.delete(id) : state.favorites.add(id);
  saveFavorites();
  renderResults();
}
function directionsUrl(place){
  const dest = encodeURIComponent(place.address || `${place.lat},${place.lng}`);
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
}
function categorySymbol(category){
  return {"動物醫療":"✚","美容洗護":"✂","住宿安親":"🏠","寵物友善":"♥"}[category] || "•";
}
function markerIcon(place){
  return L.divIcon({
    className:"pethub-marker-wrap",
    html:`<div class="pethub-pin${place.h24 ? " is-24" : ""}" data-category="${escapeHtml(place.category)}"><span>${categorySymbol(place.category)}</span></div>`,
    iconSize:[40,46],
    iconAnchor:[20,42],
    popupAnchor:[0,-38]
  });
}
function renderCities(){
  const cities = [...new Set(state.places.map(p=>p.city).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"zh-Hant"));
  els.citySelect.innerHTML = '<option value="">全台灣</option>' + cities.map(c=>`<option>${escapeHtml(c)}</option>`).join("");
}
function syncCategoryButtons(){
  document.querySelectorAll(".service-pill").forEach(btn=>{
    btn.classList.toggle("active", btn.dataset.category === state.activeCategory);
  });
  els.categorySelect.value = state.activeCategory;
}
function scoreForRecommended(p){
  return (p.h24 ? .35 : 0) - ((p.distance || 0) / 50) + (p.dataStatus === "已核驗" ? .5 : 0);
}
function filterPlaces({withinBounds=false}={}){
  const q = els.searchInput.value.trim().toLowerCase();
  const city = els.citySelect.value;
  const category = state.activeCategory;
  const bounds = withinBounds ? map.getBounds() : null;

  let data = state.places.filter(place=>{
    const hay = [place.name, place.category, place.subCategory, place.city, place.district, place.address, place.note, ...(place.tags||[])].join(" ").toLowerCase();
    if(q && !hay.includes(q)) return false;
    if(city && place.city !== city) return false;
    if(category !== "全部" && place.category !== category) return false;
    if(els.openOnly.checked && !place.open) return false;
    if(els.hour24.checked && !place.h24) return false;
    if(els.verifiedOnly.checked && !place.verified) return false;
    if(bounds && !bounds.contains([place.lat, place.lng])) return false;
    return true;
  });

  const mode = els.sortSelect.value;
  if(mode === "distance") data.sort((a,b)=>(a.distance ?? 999) - (b.distance ?? 999));
  if(mode === "rating") data.sort((a,b)=>String(a.name).localeCompare(String(b.name),"zh-Hant"));
  if(mode === "recommended") data.sort((a,b)=>scoreForRecommended(b)-scoreForRecommended(a));

  state.filtered = data;
  renderResults();
  renderMarkers();
  updateSummary();
}
function updateSummary(){
  els.resultCount.textContent = state.filtered.length;
  const city = els.citySelect.value || "全台灣";
  const cat = state.activeCategory === "全部" ? "毛孩服務" : state.activeCategory;
  els.resultSummary.textContent = `${city} · ${cat} · ${state.filtered.length} 個結果`;
}
function renderResults(){
  els.results.innerHTML = "";
  if(!state.filtered.length){
    els.results.innerHTML = '<div class="empty-state"><strong>沒有符合條件的地點</strong><span>可調整篩選或移動地圖後重新搜尋。</span></div>';
    return;
  }
  state.filtered.forEach(place=>{
    const card = document.createElement("article");
    card.className = "place-card";
    card.dataset.id = place.id;
    card.innerHTML = `
      <div class="place-card-head">
        <div>
          <div class="badges">
            <span class="badge">${escapeHtml(place.subCategory || place.category)}</span>
            ${place.h24 ? '<span class="badge">24H</span>' : ''}
            ${place.verified ? '<span class="badge verified">✓ 已驗證</span>' : ''}
          </div>
          <h3>${escapeHtml(place.name)}</h3>
          <div class="place-meta">${escapeHtml([place.city, place.district, place.open ? "營業中" : "目前休息"].filter(Boolean).join(" · "))}</div>
        </div>
        <button class="favorite-small" type="button">${state.favorites.has(place.id) ? "♥" : "♡"}</button>
      </div>
      <div class="place-rating"><span class="data-status">${escapeHtml(place.dataStatus || "待核驗")}</span><span class="rating-count">最後查核 ${escapeHtml(place.lastChecked || "—")}</span>${place.distance != null ? `<span class="rating-count">· ${place.distance} km</span>` : ""}</div>
      <p class="place-note">${escapeHtml(place.note || "")}</p>
      <div class="place-tags">${(place.highlights || place.tags || []).slice(0,3).map(x=>`<span>${escapeHtml(x)}</span>`).join("")}</div>
      <div class="place-actions">
        <button class="detail-btn" type="button">查看詳情</button>
        <button class="nav-btn" type="button">導航</button>
      </div>
    `;
    card.querySelector(".favorite-small").addEventListener("click",e=>{e.stopPropagation();toggleFavorite(place.id);});
    card.querySelector(".detail-btn").addEventListener("click",e=>{e.stopPropagation();openDetail(place);});
    card.querySelector(".nav-btn").addEventListener("click",e=>{e.stopPropagation();window.open(directionsUrl(place),"_blank","noopener,noreferrer");});
    card.addEventListener("mouseenter",()=>highlightPlace(place.id,true));
    card.addEventListener("mouseleave",()=>highlightPlace(place.id,false));
    card.addEventListener("click",()=>focusPlace(place));
    els.results.appendChild(card);
  });
}
function renderMarkers(){
  state.markers.forEach(marker=>marker.remove());
  state.markers.clear();
  const bounds = [];

  state.filtered.forEach(place=>{
    if(!Number.isFinite(place.lat) || !Number.isFinite(place.lng)) return;
    const marker = L.marker([place.lat, place.lng], {icon: markerIcon(place), riseOnHover:true}).addTo(map);
    marker.bindPopup(`<strong>${escapeHtml(place.name)}</strong><br><span style="color:#6d778b;font-size:12px">${escapeHtml(place.subCategory || place.category)} · ${escapeHtml(place.dataStatus || "待核驗")}</span>`);
    marker.on("click", ()=>focusCard(place.id));
    state.markers.set(place.id, marker);
    bounds.push([place.lat, place.lng]);
  });

  ensureMapSize();
  if(!state.mapMoved){
    if(bounds.length > 1) map.fitBounds(bounds, {padding:[50,50], maxZoom:11, animate:false});
    else if(bounds.length === 1) map.setView(bounds[0], 14, {animate:false});
    else map.fitBounds(TAIWAN_BOUNDS, {padding:[30,30], animate:false});
  }
}
function focusPlace(place){
  if(Number.isFinite(place.lat) && Number.isFinite(place.lng)){
    map.flyTo([place.lat, place.lng], 15, {duration:.45});
    const marker = state.markers.get(place.id);
    if(marker) marker.openPopup();
  }
  focusCard(place.id);
}
function focusCard(id){
  document.querySelectorAll(".place-card").forEach(card=>{
    card.classList.toggle("active", card.dataset.id === id);
  });
}
function highlightPlace(id,on){
  const marker = state.markers.get(id);
  if(!marker) return;
  const el = marker.getElement();
  if(el) el.style.transform = on ? "scale(1.10)" : "";
}
function openDetail(place){
  els.dialogContent.innerHTML = `
    <div class="detail-dialog-body">
      <div class="dialog-top">
        <div>
          <div class="dialog-service-label">${escapeHtml(place.subCategory || place.category)}</div>
          <h3>${escapeHtml(place.name)}</h3>
          <div class="dialog-address">${escapeHtml([place.city, place.district, place.address].filter(Boolean).join(" · "))}</div>
        </div>
        <button class="dialog-close" id="detailClose">×</button>
      </div>

      <div class="place-rating"><span class="data-status">${escapeHtml(place.dataStatus || "待核驗")}</span><span class="rating-count">最後查核 ${escapeHtml(place.lastChecked || "—")}</span></div>

      <div class="dialog-highlights">
        ${(place.highlights || []).slice(0,3).map(x=>`<span>${escapeHtml(x)}</span>`).join("")}
      </div>

      <div class="dialog-info">
        <div><span>營業狀態</span><strong>${place.h24 ? "24H" : (place.open === true ? "營業中" : (place.open === false ? "目前休息" : "營業狀態待確認"))}</strong></div>
        <div><span>電話</span><strong>${escapeHtml(place.phone || "待補充")}</strong></div>
        <div><span>資料來源</span><strong>${escapeHtml(place.source || "待補充")}</strong></div>
        <div><span>資料狀態</span><strong>${escapeHtml(place.dataStatus || "待核驗")}</strong></div>
      </div>

      <div class="dialog-actions">
        <button class="detail-btn" id="dialogFav">${state.favorites.has(place.id) ? "♥ 已收藏" : "♡ 收藏"}</button>
        <button class="nav-btn" id="dialogNav">開始導航</button>
      </div>
    </div>
  `;
  els.detailDialog.showModal();
  document.getElementById("detailClose").onclick = ()=>els.detailDialog.close();
  document.getElementById("dialogFav").onclick = ()=>{toggleFavorite(place.id); els.detailDialog.close(); openDetail(place);};
  document.getElementById("dialogNav").onclick = ()=>window.open(directionsUrl(place), "_blank", "noopener,noreferrer");
}
function locateUser(){
  if(!navigator.geolocation){ alert("此瀏覽器不支援定位功能。"); return; }
  navigator.geolocation.getCurrentPosition(pos=>{
    const userLocation = [pos.coords.latitude, pos.coords.longitude];
    map.setView(userLocation, 14);
    L.circleMarker(userLocation,{radius:8,color:"#2f72ff",fillColor:"#fff",fillOpacity:1,weight:4}).addTo(map).bindPopup("你目前的位置").openPopup();
  },()=>alert("無法取得定位，請確認瀏覽器位置權限。"),{enableHighAccuracy:true,timeout:10000});
}
function clearFilters(){
  els.searchInput.value = "";
  els.heroSearch.value = "";
  els.citySelect.value = "";
  state.activeCategory = "全部";
  els.sortSelect.value = "recommended";
  els.openOnly.checked = false;
  els.hour24.checked = false;
  els.verifiedOnly.checked = false;
  state.mapMoved = false;
  syncCategoryButtons();
  filterPlaces();
}

document.querySelectorAll(".service-pill").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    state.activeCategory = btn.dataset.category;
    syncCategoryButtons();
    state.mapMoved = false;
    filterPlaces();
    document.getElementById("map-section").scrollIntoView({behavior:"smooth", block:"start"});
  });
});
document.querySelectorAll(".hero-shortcuts button[data-query]").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    els.heroSearch.value = btn.dataset.query;
    els.searchInput.value = btn.dataset.query;
    filterPlaces();
    document.getElementById("map-section").scrollIntoView({behavior:"smooth", block:"start"});
  });
});

els.heroSearchBtn.addEventListener("click", ()=>{
  els.searchInput.value = els.heroSearch.value;
  state.mapMoved = false;
  filterPlaces();
  document.getElementById("map-section").scrollIntoView({behavior:"smooth", block:"start"});
});
els.heroSearch.addEventListener("keydown", e=>{if(e.key === "Enter") els.heroSearchBtn.click();});
els.heroLocateBtn.addEventListener("click", locateUser);
els.mapLocateBtn.addEventListener("click", locateUser);
els.filterToggle.addEventListener("click", ()=>els.filterPanel.classList.toggle("show"));
els.clearFilters.addEventListener("click", clearFilters);
[els.searchInput, els.citySelect, els.sortSelect, els.openOnly, els.hour24, els.verifiedOnly].forEach(el=>{
  el.addEventListener(el.type === "search" ? "input" : "change", ()=>{
    state.mapMoved = false;
    filterPlaces();
  });
});
els.categorySelect.addEventListener("change", ()=>{
  state.activeCategory = els.categorySelect.value;
  syncCategoryButtons();
  state.mapMoved = false;
  filterPlaces();
});
map.on("movestart", ()=>{state.mapMoved = true;});
map.on("moveend", ()=>{if(state.mapMoved) els.searchAreaBtn.classList.add("show");});
els.searchAreaBtn.addEventListener("click", ()=>{
  filterPlaces({withinBounds:true});
  els.searchAreaBtn.classList.remove("show");
});
els.detailDialog.addEventListener("click", e=>{if(e.target === els.detailDialog) els.detailDialog.close();});


let deferredInstallPrompt = null;
const installBtn = document.getElementById("installAppBtn");
const networkBanner = document.getElementById("networkBanner");

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  if (installBtn) installBtn.hidden = false;
});

if (installBtn) {
  installBtn.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installBtn.hidden = true;
  });
}

function updateNetworkState() {
  if (!networkBanner) return;
  networkBanner.hidden = navigator.onLine;
}
window.addEventListener("online", updateNetworkState);
window.addEventListener("offline", updateNetworkState);
updateNetworkState();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(console.error);
  });
}

const merchantJumpBtn = document.getElementById("merchantJumpBtn");
if (merchantJumpBtn) {
  merchantJumpBtn.addEventListener("click", () => {
    document.getElementById("merchant")?.scrollIntoView({ behavior:"smooth", block:"start" });
  });
}

async function init(){
  try{
    const res = await fetch("./data/places.json", {cache:"no-store"});
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    state.places = await res.json();
    renderCities();
    syncCategoryButtons();
    filterPlaces();
    ensureMapSize();
  }catch(err){
    console.error(err);
    els.results.innerHTML = '<div class="empty-state"><strong>資料載入失敗</strong><span>請確認網站已透過 HTTP/HTTPS 開啟。</span></div>';
  }
}
init();
