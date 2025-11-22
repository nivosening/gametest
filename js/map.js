import { GameState } from "./state.js";

const regionListEl = document.getElementById("regionList");
const editorPanel = document.getElementById("editorPanel");
const regionNameEl = document.getElementById("regionName");
const regionDescEl = document.getElementById("regionDesc");

let editingId = null;

function renderList() {
  regionListEl.innerHTML = "";
  const regions = GameState.regions;
  regions.forEach(region => {
    const el = document.createElement("div");
    el.classList.add("item-block");
    el.innerHTML = `
      <h3>${region.name}</h3>
      <p>${region.desc || ""}</p>
      <button data-id="${region.id}" class="edit-btn">編輯</button>
    `;
    regionListEl.appendChild(el);
  });
  document.querySelectorAll(".edit-btn").forEach(btn => {
    btn.addEventListener("click", e => startEdit(e.target.dataset.id));
  });
}

function startEdit(id) {
  editingId = id;
  const r = GameState.regions.find(r => r.id === id);
  if (!r) return;
  regionNameEl.value = r.name;
  regionDescEl.value = r.desc || "";
  editorPanel.style.display = "block";
}

function saveRegion() {
  const name = regionNameEl.value.trim();
  const desc = regionDescEl.value.trim();
  if (!name) return alert("地名不能為空");
  if (editingId) {
    const r = GameState.regions.find(r => r.id === editingId);
    r.name = name;
    r.desc = desc;
  } else {
    GameState.raw.regions.push({
      id: "r" + Date.now(),
      name,
      desc
    });
  }
  GameState.saveToLocal();
  editorPanel.style.display = "none";
  renderList();
}

document.getElementById("addRegionBtn").addEventListener("click", () => {
  editingId = null;
  regionNameEl.value = "";
  regionDescEl.value = "";
  editorPanel.style.display = "block";
});
document.getElementById("saveRegionBtn").addEventListener("click", saveRegion);
document.getElementById("cancelEditBtn").addEventListener("click", () => {
  editorPanel.style.display = "none";
});

GameState.loadFromLocal();
renderList();
