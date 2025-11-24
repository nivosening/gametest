// 宗族之書：家族經營遊戲 - 單一 JS 檔（V3 修正版 - 修正新增身份、領養 UI、新增年齡輸入、新增人物編輯與離婚）
// 世界設定：星曆 387 年為起點

const INITIAL_YEAR = 387;

const DEFAULT_REGIONS = [
  { id: "north", name: "漠北邊境", desc: "多山多關隘，邊疆軍鎮與遊牧勢力並立之地。" },
  { id: "central", name: "天府王畿", desc: "朝廷所在，商旅雲集，權力與文化中心。" },
  { id: "south", name: "南域水鄉", desc: "水網縱橫，魚米之鄉，多江湖幫會盤踞。" },
  { id: "east", name: "東海沿岸", desc: "臨海諸城與商港，外族與海商往來頻繁。" },
  { id: "west", name: "西川雲嶺", desc: "高山峽谷與古道關城，易守難攻。" },
  { id: "desert", name: "塞外沙漠", desc: "風沙孤城，絲路商隊與異族部落的領域。" },
  { id: "islands", name: "南海群島", desc: "散落海上的諸島，有海盜、有隱世門派。" }
];

const DEFAULT_ORIGINS = ["皇室貴族" ,"名門望族", "商賈世家", "武林門派", "落魄寒門", "平民百姓"];

// 據點與區域為一對一對應（每個據點只屬於一個區域）
const DEFAULT_TERRITORIES = [
  { name: "京城王都", regionId: "central" },
  { name: "江南府城", regionId: "south" },
  { name: "關中城鎮", regionId: "central" },
  { name: "邊關要塞", regionId: "north" },
  { name: "東海港市", regionId: "east" },
  { name: "西川古鎮", regionId: "west" },
  { name: "水鄉集市", regionId: "south" }
];

const DEFAULT_OCCS = ["家主", "皇族", "軍師", "商人", "平民", "官員", "學生", "無業"];
const DEFAULT_RES = ["皇宮", "祖宅", "別莊", "工舍", "行腳在外"];

// [FIX 1] 增加 DEFAULT_ROLES
const DEFAULT_ROLES = ["家主（主君）","內眷（內郎）","嫡支子女", "庶出子女", "旁系宗親", "長老", "附庸"];

const STORAGE_KEY = "clanGame_star_v3";

const GIVEN_NAME_PARTS = [
  "清","海","季","秀","世","伊","雙","珊","玖","辰","嵐",
  "瑜","衡","蕙","岑","柏","霖","雪","庭","思","柳","琪",
  "琦","舞","綺","雲","澈","澄"
];

const SPOUSE_TYPES = ["平妻", "妾", "繼室", "入贅", "訂婚"];

const state = {
  regions: [...DEFAULT_REGIONS],
  families: [],
  persons: [],
  originOptions: [...DEFAULT_ORIGINS],
  territoryOptions: [...DEFAULT_TERRITORIES],
  occOptions: [...DEFAULT_OCCS],
  resOptions: [...DEFAULT_RES],
  roleOptions: [...DEFAULT_ROLES],
  nextFamilyId: 1,
  nextPersonId: 1,
  selectedFamilyId: null,
  selectedPersonId: null,
  childModeParentId: null,
  gameYear: INITIAL_YEAR
};

// ---------- 小工具 ----------
function $(id) {
  return document.getElementById(id);
}
function advisorSay(msg) {
  const log = $("advisorLog");
  const p = document.createElement("p");
  p.textContent = "【輔佐官】" + msg;
  log.appendChild(p);
  log.scrollTop = log.scrollHeight;
}
function userSay(msg) {
  const log = $("advisorLog");
  const p = document.createElement("p");
  p.textContent = "【家主】" + msg;
  log.appendChild(p);
  log.scrollTop = log.scrollHeight;
}
function pickRandom(arr) {
  if (!arr || !arr.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}
function randomInt(min, max) {
  const a = Number(min), b = Number(max);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  if (b < a) return null;
  return a + Math.floor(Math.random() * (b - a + 1));
}
function getRegionName(id) {
  if (!id) return "";
  const r = state.regions.find(r => r.id === id);
  return r ? r.name : "";
}
function getTerritoryObj(name) {
  if (!name) return null;
  return state.territoryOptions.find(t => t.name === name) || null;
}
function ensureTerritoryForRegion(territoryName, regionId) {
  const name = (territoryName || "").trim();
  if (!name) return "";
  const rId = regionId || "";
  let terr = getTerritoryObj(name);
  if (terr) {
    if (terr.regionId && rId && terr.regionId !== rId) {
      alert(`據點「${name}」已標記為「${getRegionName(terr.regionId) || terr.regionId}」，不可改屬其他區域。`);
      return null;
    }
    if (!terr.regionId && rId) terr.regionId = rId;
    return terr.name;
  } else {
    if (!rId) {
      alert("請先選擇區域，再指定據點。");
      return null;
    }
    terr = { name, regionId: rId };
    state.territoryOptions.push(terr);
    return terr.name;
  }
}

// ---------- 關係整理與父母規則 ----------
function normalizeRelations() {
  const byId = {};
  state.persons.forEach(p => {
    byId[p.id] = p;
    if (!Array.isArray(p.parentIds)) p.parentIds = [];
    if (!Array.isArray(p.childIds)) p.childIds = [];
    if (!Array.isArray(p.spouseIds)) p.spouseIds = [];
    if (!Array.isArray(p.spouseRelations)) p.spouseRelations = [];
  });

  state.persons.forEach(p => {
    p.parentIds = p.parentIds.filter(id => byId[id]);
    p.childIds = p.childIds.filter(id => byId[id]);
  });

  state.persons.forEach(p => {
    p.parentIds.forEach(pid => {
      const parent = byId[pid];
      if (parent && !parent.childIds.includes(p.id)) parent.childIds.push(p.id);
    });
    p.childIds.forEach(cid => {
      const child = byId[cid];
      if (child && !child.parentIds.includes(p.id)) child.parentIds.push(p.id);
    });
  });
}



function findPerson(id) {
    return state.persons.find(p => p.id === Number(id)) || null;
}




function linkParentChild(parent, child, opts) {
  const o = opts || {};
  if (!parent || !child) return false;

  const parents = (child.parentIds || []).map(id => state.persons.find(p => p.id === id)).filter(Boolean);
  const sameFam = parents.find(pp =>
    pp.id !== parent.id &&
    pp.familyId &&
    parent.familyId &&
    pp.familyId === parent.familyId
  );
  if (sameFam && !o.ignoreRule) {
    if (!o.silent) {
      advisorSay(`依家主規則，父母需來自不同家族。「${child.name}」已有一位來自「${getFamilyNameById(sameFam.familyId)}」的父母，此次連結未建立。`);
    }
    return false;
  }

  if (!child.parentIds.includes(parent.id)) child.parentIds.push(parent.id);
  if (!parent.childIds.includes(child.id)) parent.childIds.push(child.id);
  return true;
}

// ---------- 儲存與載入 ----------
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    state.regions = data.regions && data.regions.length ? data.regions : [...DEFAULT_REGIONS];
    state.families = data.families || [];
    state.persons = data.persons || [];
    state.originOptions = data.originOptions && data.originOptions.length ? data.originOptions : [...DEFAULT_ORIGINS];

    if (Array.isArray(data.territoryOptions) && data.territoryOptions.length) {
      if (typeof data.territoryOptions[0] === "string") {
        state.territoryOptions = data.territoryOptions.map(name => ({ name, regionId: "" }));
      } else {
        state.territoryOptions = data.territoryOptions.map(t => ({
          name: t.name,
          regionId: t.regionId || ""
        }));
      }
    } else {
      state.territoryOptions = [...DEFAULT_TERRITORIES];
    }

    state.roleOptions = data.roleOptions && data.roleOptions.length ? data.roleOptions : [...DEFAULT_ROLES];
    
    state.occOptions = data.occOptions && data.occOptions.length ? data.occOptions : [...DEFAULT_OCCS];
    state.resOptions = data.resOptions && data.resOptions.length ? data.resOptions : [...DEFAULT_RES];
    state.nextFamilyId = data.nextFamilyId || 1;
    state.nextPersonId = data.nextPersonId || 1;
    state.selectedFamilyId = data.selectedFamilyId || null;
    state.selectedPersonId = data.selectedPersonId || null;
    state.childModeParentId = null;
    state.gameYear = data.gameYear || INITIAL_YEAR;

    state.persons.forEach(p => {
      if (p.deceased == null) p.deceased = false;
      if (!Array.isArray(p.spouseRelations)) p.spouseRelations = [];
      if (!Array.isArray(p.spouseIds)) p.spouseIds = p.spouseIds || [];
      if (!Array.isArray(p.parentIds)) p.parentIds = p.parentIds || [];
      if (!Array.isArray(p.childIds)) p.childIds = p.childIds || [];
    });

    normalizeRelations();
  } catch (e) {
    console.warn("載入存檔失敗", e);
  }
}

// ---------- 年份 & 年齡 ----------
function updateYearViews() {
  $("worldYearDisplay").textContent = "星曆 " + state.gameYear + " 年";
  $("timelineYear").textContent = "星曆 " + state.gameYear + " 年";
}

function setGameYear(y) {
  let year = Number(y);
  if (Number.isNaN(year)) return;
  if (year < 1) year = 1;
  state.gameYear = year;
  checkDeathsAndNotify();
  saveState();
  updateYearViews();
  renderFamilies();
  renderFamilyDetail();
  renderPersonDetail();
  renderRegions();
  renderOptionOverview();
}

function getAge(person) {
  if (person.birthYear == null) return null;
  const ref = person.deceased && person.deathYear ? person.deathYear : state.gameYear;
  return ref - person.birthYear;
}

function checkDeathsAndNotify() {
  const newlyDead = [];
  state.persons.forEach(p => {
    if (!p.deceased && p.deathYear && p.deathYear <= state.gameYear) {
      p.deceased = true;
      const age = getAge(p);
      newlyDead.push({ name: p.name, year: p.deathYear, age });
    }
  });
  if (newlyDead.length) {
    let msg = `星曆 ${state.gameYear} 年，有 ${newlyDead.length} 位族人辭世：`;
    msg += newlyDead.map(d => {
      if (d.age != null) return `${d.name}（享年 ${d.age} 歲，卒於星曆 ${d.year} 年）`;
      return `${d.name}（卒於星曆 ${d.year} 年）`;
    }).join("、") + "。";
    advisorSay(msg);
  }
}

/**
 * 處理年齡或出生年份的輸入，轉換為出生年份。
 * @param {string} input - 來自 personAgeOrBirth 欄位的輸入值。
 * @returns {number | null} 出生年份 (birthYear)。
 */
function processAgeOrBirthInput(input) {
  if (!input) return null;

  const v = (input || "").trim();
  const num = Number(v);

  if (Number.isNaN(num) || num <= 0) return null;
  
  // 檢查輸入是否為年齡 (數字較小且與當前年份差距大)
  // 假設年齡輸入通常小於 100 且遠小於當前年份
  if (num < 150) { // 假設 150 以下為年齡，150 以上為出生年份 (基於 INITIAL_YEAR=387)
      const age = Math.round(num);
      return state.gameYear - age; // 轉換為出生年份
  } else {
      // 假設輸入是出生年份
      return Math.round(num);
  }
}

// ---------- 選項渲染 ----------
function renderRegionSelects() {
  const regionSelects = ["familyRegion","quickRegion","eventRegion"];
  regionSelects.forEach(id => {
    const sel = $(id);
    if (!sel) return;
    sel.innerHTML = "";
    const opt0 = document.createElement("option");
    if (id === "eventRegion") {
      opt0.value = "";
      opt0.textContent = "不限區域";
    } else {
      opt0.value = "";
      opt0.textContent = "未指定";
    }
    sel.appendChild(opt0);
    state.regions.forEach(r => {
      const opt = document.createElement("option");
      opt.value = r.id;
      opt.textContent = r.name;
      sel.appendChild(opt);
    });
  });
}

function renderOptionSelects(){

  // HYBRID: update datalists (keep for robustness, but prefer select updates below)
  const roleList = document.getElementById("roleList");
  if(roleList){
    roleList.innerHTML = state.roleOptions.map(o=>`<option value="${o}"></option>`).join("");
  }
  const occList = document.getElementById("occList");
  if(occList){
    occList.innerHTML = state.occOptions.map(o=>`<option value="${o}"></option>`).join("");
  }
  const resList = document.getElementById("resList");
  if(resList){
    resList.innerHTML = state.resOptions.map(o=>`<option value="${o}"></option>`).join("");
  }

  const originSel = $("familyOrigin");
  const quickOriginSel = $("quickOrigin");
  const terrSel = $("familyTerritory");
  const quickTerrSel = $("quickTerritory");
  const occSel = $("personOcc");
  const resSel = $("personRes");
  
  // Update the personRole select/input
  const roleSel = $("personRole");
  if(roleSel){
    roleSel.innerHTML = "";
    const ro0 = document.createElement("option");
    ro0.value = ""; ro0.textContent = "未標註";
    roleSel.appendChild(ro0);
    state.roleOptions.forEach(o => {
      const opt = document.createElement("option");
      opt.value = o; opt.textContent = o;
      roleSel.appendChild(opt);
    });
  }

  originSel.innerHTML = "";
  quickOriginSel.innerHTML = "";
  const o0 = document.createElement("option");
  o0.value = "";
  o0.textContent = "未指定";
  originSel.appendChild(o0);
  const o1 = document.createElement("option");
  o1.value = "";
  o1.textContent = "（留白）";
  quickOriginSel.appendChild(o1);
  state.originOptions.forEach(o => {
    const a = document.createElement("option");
    a.value = o; a.textContent = o;
    originSel.appendChild(a);
    const b = document.createElement("option");
    b.value = o; b.textContent = o;
    quickOriginSel.appendChild(b);
  });

  terrSel.innerHTML = "";
  quickTerrSel.innerHTML = "";
  const t0 = document.createElement("option");
  t0.value = "";
  t0.textContent = "未定";
  terrSel.appendChild(t0);
  const t1 = document.createElement("option");
  t1.value = "";
  t1.textContent = "（留白）";
  quickTerrSel.appendChild(t1);
  state.territoryOptions.forEach(t => {
    const a = document.createElement("option");
    a.value = t.name; a.textContent = `${t.name}（${getRegionName(t.regionId) || "區域未定"}）`;
    terrSel.appendChild(a);
    const b = document.createElement("option");
    b.value = t.name; b.textContent = `${t.name}（${getRegionName(t.regionId) || "區域未定"}）`;
    quickTerrSel.appendChild(b);
  });

  occSel.innerHTML = "";
  const oc0 = document.createElement("option");
  oc0.value = ""; oc0.textContent = "未記載";
  occSel.appendChild(oc0);
  state.occOptions.forEach(o => {
    const opt = document.createElement("option");
    opt.value = o; opt.textContent = o;
    occSel.appendChild(opt);
  });

  resSel.innerHTML = "";
  const r0 = document.createElement("option");
  r0.value = ""; r0.textContent = "未記載";
  resSel.appendChild(r0);
  state.resOptions.forEach(o => {
    const opt = document.createElement("option");
    opt.value = o; opt.textContent = o;
    resSel.appendChild(opt);
  });

  renderAdvisorLocationSelect();
  renderOptionOverview();
}

function addOrigin(value) {
  const v = (value || "").trim();
  if (!v) return;
  if (!state.originOptions.includes(v)) {
    state.originOptions.push(v);
    saveState();
    renderOptionSelects();
    advisorSay(`已將「${v}」加入家族出身選項。`);
  }
}

function addRole(value) {
  const v = (value || "").trim();
  if (!v) return;
  if (!state.roleOptions.includes(v)) {
    state.roleOptions.push(v);
    saveState();
    renderOptionSelects();
    advisorSay(`已將「${v}」加入人物身分選項。`);
  }
}

function addOcc(value) {
  const v = (value || "").trim();
  if (!v) return;
  if (!state.occOptions.includes(v)) {
    state.occOptions.push(v);
    saveState();
    renderOptionSelects();
    advisorSay(`已將「${v}」加入人物職業選項。`);
  }
}

function addRes(value) {
  const v = (value || "").trim();
  if (!v) return;
  if (!state.resOptions.includes(v)) {
    state.resOptions.push(v);
    saveState();
    renderOptionSelects();
    advisorSay(`已將「${v}」加入人物居所選項。`);
  }
}

function addTerritory(value, regionId) {
  const v = (value || "").trim();
  if (!v) return;
  const rId = regionId || "";
  if (!rId) {
    alert("請先選擇區域，再新增據點。");
    return;
  }
  const result = ensureTerritoryForRegion(v, rId);
  if (result === null) return;
  saveState();
  renderOptionSelects();
  advisorSay(`已在「${getRegionName(rId) || rId}」下新增據點「${v}」。`);
}

function renderAdvisorLocationSelect() {
  const sel = $("advisorLocation");
  sel.innerHTML = "";
  const def = document.createElement("option");
  def.value = "";
  def.textContent = "選擇地點／區域";
  sel.appendChild(def);
  const set = new Set();
  state.regions.forEach(r => set.add(r.name));
  state.territoryOptions.forEach(t => set.add(t.name));
  state.resOptions.forEach(r => set.add(r));
  state.families.forEach(f => {
    if (f.territory) set.add(f.territory);
    if (f.name) set.add(f.name);
  });
  state.persons.forEach(p => {
    if (p.residence) set.add(p.residence);
  });
  Array.from(set).forEach(loc => {
    const opt = document.createElement("option");
    opt.value = loc;
    opt.textContent = loc;
    sel.appendChild(opt);
  });
}

// ---------- 出身／區域／據點一覽 ----------
function renderOptionOverview() {
  const box = $("optionOverview");
  if (!box) return;
  let html = "";

  // 出身列表（可點擊修改）
  let originHtml = "";
  if (state.originOptions && state.originOptions.length) {
    originHtml = state.originOptions.map((name, idx) => 
      `<span class="option-edit" data-opt-type="origin" data-origin-index="${idx}">${name}</span>`
    ).join("、 ");
  } else {
    originHtml = "尚無出身紀錄。";
  }
  html += `<div class="detail-section">
    <div class="detail-label">家族出身列表</div>
    <div class="detail-value">${originHtml}</div>
  </div>`;

  // 區域列表（可點擊修改名稱）
  let regionHtml = "";
  if (state.regions && state.regions.length) {
    regionHtml = state.regions.map(r =>
      `<span class="option-edit" data-opt-type="region" data-region-id="${r.id}">${r.name}</span>`
    ).join("、 ");
  } else {
    regionHtml = "尚無區域資料。";
  }
  html += `<div class="detail-section">
    <div class="detail-label">世界區域列表</div>
    <div class="detail-value">${regionHtml}</div>
  </div>`;

  // 據點列表，依區域分組（可點擊修改名稱）
  const byRegion = {};
  (state.territoryOptions || []).forEach(t => {
    const key = t.regionId || "未指定區域";
    if (!byRegion[key]) byRegion[key] = [];
    byRegion[key].push(t);
  });

  html += `<div class="detail-section">
    <div class="detail-label">據點／領地列表</div>
  `;

  Object.keys(byRegion).forEach(key => {
    const rName = key === "未指定區域" ? key : (getRegionName(key) || key);
    const terrHtml = byRegion[key].map(t =>
      `<span class="option-edit" data-opt-type="territory" data-territory-name="${t.name}" data-region-id="${t.regionId || ""}">${t.name}</span>`
    ).join("、 ");
    html += `<div class="detail-value">${rName}：${terrHtml}</div>`;
  });

  html += `</div>`;
  box.innerHTML = html;
}

// 點擊出身／區域／據點文字以修改名稱
function handleOptionEditClick(target) {
  if (!target || !target.classList.contains("option-edit")) return;
  const type = target.dataset.optType;
  if (!type) return;
  const oldName = (target.textContent || "").trim();
  if (!oldName) return;

  const labelMap = {
    origin: "出身名稱",
    region: "區域名稱",
    territory: "據點／領地名稱"
  };
  const label = labelMap[type] || "名稱";
  const newName = prompt(`請輸入新的${label}：`, oldName);
  if (!newName) return;
  const trimmed = newName.trim();
  if (!trimmed || trimmed === oldName) return;

  if (type === "origin") {
    const idx = (state.originOptions || []).indexOf(oldName);
    if (idx >= 0) {
      state.originOptions[idx] = trimmed;
      (state.families || []).forEach(f => {
        if (f.origin === oldName) f.origin = trimmed;
      });
    }
  } else if (type === "region") {
    const id = target.dataset.regionId;
    const r = (state.regions || []).find(x => x.id === id);
    if (r) {
      r.name = trimmed;
    }
  } else if (type === "territory") {
    const terrName = target.dataset.territoryName || oldName;
    const terr = (state.territoryOptions || []).find(t => t.name === terrName);
    if (terr) {
      terr.name = trimmed;
      (state.families || []).forEach(f => {
        if (f.territory === terrName) f.territory = trimmed;
      });
      (state.persons || []).forEach(p => {
        if (p.residence === terrName) p.residence = trimmed;
      });
    }
  }

  // 重新整理相關下拉選單與畫面
  if (typeof renderOptionSelects === "function") renderOptionSelects();
  if (typeof renderOptionOverview === "function") renderOptionOverview();
  if (typeof renderFamilyList === "function") renderFamilyList();
  if (typeof renderPersonList === "function") renderPersonList();
  if (typeof renderRegions === "function") renderRegions();
  if (typeof saveState === "function") saveState();
  if (typeof advisorSay === "function") {
    advisorSay(`已更新${label}：「${oldName}」→「${trimmed}」。`);
  }
}
// ---------- 家族 & 人物 ----------
function getFamilyNameById(id) {
  if (!id) return "";
  const f = state.families.find(x => x.id === id);
  return f ? f.name : "";
}

function addFamily(data) {
  const terrName = ensureTerritoryForRegion(data.territory, data.regionId);
  if (terrName === null) return null;

  const f = {
    id: state.nextFamilyId++,
    name: data.name.trim(),
    origin: data.origin || "",
    regionId: data.regionId || "",
    territory: terrName || "",
    notes: data.notes || ""
  };
  state.families.push(f);
  saveState();
  renderFamilies();
  renderFamilyOptions();
  renderRegions();
  renderOptionOverview();
  renderAdvisorLocationSelect();
  advisorSay(`已將「${f.name}」記入宗族之書。`);
  return f;
}

function renderFamilyOptions() {
  const sel = $("personFamily");
  sel.innerHTML = "";
  const def = document.createElement("option");
  def.value = "";
  def.textContent = "未歸宗族";
  sel.appendChild(def);
  state.families.forEach(f => {
    const opt = document.createElement("option");
    opt.value = String(f.id);
    opt.textContent = f.name;
    sel.appendChild(opt);
  });
}

function addPerson(data) {
  // 使用新的處理函數來獲得 birthYear
  const birthYear = processAgeOrBirthInput(data.ageOrBirthInput);

  const p = {
    id: state.nextPersonId++,
    name: data.name.trim(),
    birthYear: birthYear, // 已處理的 birthYear
    gender: data.gender || "",
    role: data.role || "",
    familyId: data.familyId || null,
    occupation: data.occupation || "",
    residence: data.residence || "",
    notes: data.notes || "",
    spouseIds: [],
    spouseRelations: [],
    parentIds: [],
    childIds: [],
    deathYear: data.deathYear || null,
    deceased: false
  };

  // === 自動生成預期壽命（自然壽命模型） ===
function generateRandomLifespan() {
  const r = Math.random();

  if (r < 0.05) return Math.floor(30 + Math.random() * 20);  // 30–50 夭折/短壽
  if (r < 0.85) return Math.floor(55 + Math.random() * 30);  // 55–85 常見壽命
  return Math.floor(86 + Math.random() * 20);                 // 86–105 高壽
}

// 指定隨機壽命
p.lifespan = generateRandomLifespan();

// 若已知出生年，則計算死亡年份
if (p.birthYear && p.lifespan) {
  p.deathYear = p.birthYear + p.lifespan;

  // 若已過世（比遊戲年份還早），標記已逝
  if (p.deathYear <= state.gameYear) {
    p.deceased = true;
  }
}


  if (state.childModeParentId) {

  const parent = state.persons.find(x => x.id === state.childModeParentId);

  if (parent) {

    // 第一位父母連結
    linkParentChild(parent, p, { ignoreRule: false });

    // 取得可選的第二位父母（配偶）
    const spouseList = (parent.spouseIds || [])
      .map(id => state.persons.find(pp => pp.id === id))
      .filter(Boolean);

    // 立即彈出視窗
    openParentSelectDialog(p, parent, spouseList);
  }
}


  state.persons.push(p);
  state.childModeParentId = null;
  normalizeRelations();
  saveState();
  renderFamilies();
  renderFamilyDetail();
  state.selectedPersonId = p.id;
  renderPersonDetail();
  renderAdvisorLocationSelect();
  exitChildModeUI();
  const famName = p.familyId ? (state.families.find(f => f.id === p.familyId)?.name || "未知家族") : "未歸宗族";
  advisorSay(`已錄入新族人「${p.name}」，暫歸屬「${famName}」。`);
}

function exitChildModeUI() {
  state.childModeParentId = null;
  $("personParentId").value = "";
  $("cancelChildModeBtn").style.display = "none";
}

function enterChildMode(personId) {
  state.childModeParentId = personId;
  $("personParentId").value = String(personId);
  $("cancelChildModeBtn").style.display = "inline-block";
  const p = state.persons.find(x => x.id === personId);
  if (p) advisorSay(`已以「${p.name}」為父母建立子女。`);
}

function generateGivenName() {
  const a = pickRandom(GIVEN_NAME_PARTS) || "";
  const b = Math.random() < 0.6 ? "" : (pickRandom(GIVEN_NAME_PARTS) || "");
  const n = a + b;
  return n || "某";
}

function quickCreateFamily(data) {
  const surname = (data.surname || "").trim();
  if (!surname) {
    alert("請輸入家族姓氏。");
    return;
  }
  const count = Number(data.count);
  const minAge = Number(data.minAge);
  const maxAge = Number(data.maxAge);
  if (!count || count <= 0) {
    alert("人數需大於 0。");
    return;
  }
  if (Number.isNaN(minAge) || Number.isNaN(maxAge) || maxAge < minAge) {
    alert("請正確填寫年齡區間。");
    return;
  }

  const regionId = data.regionId || "";
  const terrName = data.territory ? ensureTerritoryForRegion(data.territory, regionId) : "";
  if (terrName === null) return;

  const familyName = surname + "氏家族";
  const family = addFamily({
    name: familyName,
    origin: data.origin || "",
    regionId,
    territory: terrName || "",
    notes: ""
  });
  if (!family) return;

  const usedNames = new Set(state.persons.map(p => p.name));
  const members = [];

  function uniqueName() {
    let n, safe = 0;
    do {
      n = surname + generateGivenName();
      safe++;
      if (safe > 200) break;
    } while (usedNames.has(n));
    usedNames.add(n);
    return n;
  }

  for (let i = 0; i < count; i++) {
    const age = randomInt(minAge, maxAge);
    const birthYear = age != null ? state.gameYear - age : null;
    const gender = Math.random() < 0.5 ? "男" : "女";
    let role = "";
    if (i === 0) role = "家主";
    else if (age != null && age <= 18) role = Math.random() < 0.5 ? "嫡支子女" : "庶出子女";
    else role = pickRandom(["旁系宗親", "庶出子女", ""]) || "";

    const occ = pickRandom(state.occOptions) || "";
    const res = pickRandom(state.resOptions) || "";
    let deathYear = null;
    if (birthYear != null) {
      let life = randomInt(45, 85);
      if (life == null) life = 60;
      deathYear = birthYear + life;
      if (deathYear <= state.gameYear) {
        // 為了快速建立時保證所有人物皆為在世狀態，將死亡年份推遲到未來
        deathYear = state.gameYear + randomInt(1, 30);
      }
    }
    members.push({
      id: state.nextPersonId++,
      name: uniqueName(),
      birthYear,
      gender,
      role,
      familyId: family.id,
      occupation: occ,
      residence: res,
      notes: "由快速建立功能生成，性格與命格尚待家主補完。",
      spouseIds: [],
      spouseRelations: [],
      parentIds: [],
      childIds: [],
      deathYear,
      deceased: false
    });
  }

  members.sort((a,b) => {
    const aa = a.birthYear != null ? a.birthYear : 0;
    const bb = b.birthYear != null ? b.birthYear : 0;
    return aa - bb;
  });
  const firstGenCount = Math.min(3, members.length);
  for (let i = firstGenCount; i < members.length; i++) {
    const child = members[i];
    if (child.birthYear == null) continue;
    const candidates = members.filter(p => p.id !== child.id && p.birthYear != null && p.birthYear <= child.birthYear - 16);
    if (!candidates.length) continue;
    const parent1 = pickRandom(candidates);
    linkParentChild(parent1, child, { ignoreRule: false, silent: true });
  }

  state.persons.push(...members);
  normalizeRelations();
  saveState();
  state.selectedFamilyId = family.id;
  state.selectedPersonId = null;
  renderFamilies();
  renderFamilyOptions();
  renderFamilyDetail();
  renderPersonDetail();
  renderAdvisorLocationSelect();
  renderRegions();
  renderOptionOverview();
  advisorSay(`已為「${family.name}」生成 ${count} 位成員，並安排父母子女關係（多為單親設定，婚配留待家主親自決斷）。`);
}

// ---------- 列表與詳情 ----------
function renderFamilies() {
  const list = $("familyList");
  list.innerHTML = "";

  // ============================
  // （1）新增：未歸宗族 顯示區塊
  // ============================
  const noFamMembers = state.persons.filter(p => !p.familyId);
  const divNoFam = document.createElement("div");
  divNoFam.className = "list-item" + (state.selectedFamilyId === "noFamily" ? " active" : "");
  
  divNoFam.innerHTML = `
    <div class="list-main">
      <div class="list-title">未歸宗族</div>
      <div class="list-sub">共 ${noFamMembers.length} 人</div>
    </div>
    <div class="badge">無隸屬家族</div>
  `;

  divNoFam.addEventListener("click", () => {
    state.selectedFamilyId = "noFamily";
    state.selectedPersonId = null;
    renderFamilies();
    renderFamilyDetail();
    renderPersonDetail();
    advisorSay("已開啟「未歸宗族」名錄。");
  });

  list.appendChild(divNoFam);

  // ============================
  // （2）正常家族列表
  // ============================
  if (!state.families.length) {
    const div = document.createElement("div");
    div.className = "list-item";
    div.innerHTML = `
      <div class="list-main">
        <div class="list-title">尚無正式家族</div>
        <div class="list-sub">請先建立家族。</div>
      </div>`;
    list.appendChild(div);
    return;
  }

  state.families.forEach(f => {
    const members = state.persons.filter(p => p.familyId === f.id);
    const alive = members.filter(p => !p.deceased).length;
    const dead = members.filter(p => p.deceased).length;

    const div = document.createElement("div");
    div.className = "list-item" + (state.selectedFamilyId === f.id ? " active" : "");

    const main = document.createElement("div");
    main.className = "list-main";

    const t = document.createElement("div");
    t.className = "list-title";
    t.textContent = f.name;

    const s = document.createElement("div");
    s.className = "list-sub";
    s.textContent = `${getRegionName(f.regionId) || "區域未定"}｜成員 ${members.length}（在世 ${alive}／已逝 ${dead}）`;

    main.appendChild(t);
    main.appendChild(s);

    const badge = document.createElement("div");
    badge.className = "badge";
    badge.textContent = f.territory || "據點未定";

    div.appendChild(main);
    div.appendChild(badge);

    div.addEventListener("click", () => {
      state.selectedFamilyId = f.id;
      state.selectedPersonId = null;
      renderFamilies();
      renderFamilyDetail();
      renderPersonDetail();
      advisorSay(`已開啟「${f.name}」族譜。`);
    });

    list.appendChild(div);
  });
}


function computeGeneration(id, memo = {}) {
  if (memo[id]) return memo[id];
  const p = state.persons.find(x => x.id === id);
  if (!p) {
    memo[id] = 1;
    return 1;
  }
  if (!p.parentIds || !p.parentIds.length) {
    memo[id] = 1;
    return 1;
  }
  let maxGen = 0;
  p.parentIds.forEach(pid => {
    const g = computeGeneration(pid, memo);
    if (g > maxGen) maxGen = g;
  });
  memo[id] = maxGen + 1;
  return memo[id];
}

function renderFamilyDetail() {
  const box = $("familyDetail");
  box.innerHTML = "";
   // ================
  // 未歸宗族顯示
  // ================
  if (state.selectedFamilyId === "noFamily") {
    const box = $("familyDetail");
    box.innerHTML = "";

    const title = document.createElement("h2");
    title.className = "detail-title";
    title.textContent = "未歸宗族人物";
    box.appendChild(title);

    const list = state.persons.filter(p => !p.familyId);

    if (!list.length) {
      box.innerHTML += `<p class="hint">目前沒有未歸宗族的人。</p>`;
      return;
    }

    const memBlock = document.createElement("div");
    memBlock.className = "detail-section";
    memBlock.innerHTML = `
      <div class="detail-label">成員（點擊姓名查看人物資訊）</div>
      <div id="familyMembersList" class="detail-value member-list"></div>
    `;
    box.appendChild(memBlock);

    const memberList = $("familyMembersList");

    list.forEach(p => {
      const div = document.createElement("div");
      div.className = "member-item" + (state.selectedPersonId === p.id ? " active" : "") + (p.deceased ? " deceased" : "");
      const age = getAge(p);
      const ageText = age != null ? age + " 歲" : "年齡未記";

      div.innerHTML = `
        <span class="member-name">${p.deceased ? "【已逝】" : ""}${p.name}</span>
        <span class="member-info">${ageText}</span>
      `;
      div.addEventListener("click", () => {
        state.selectedPersonId = p.id;
        renderPersonDetail();
        renderFamilyDetail();
      });

      memberList.appendChild(div);
    });

    return;
  }

  const f = state.families.find(x => x.id === state.selectedFamilyId);
  if (!f) {
    box.innerHTML = '<p class="hint">家族資料錯誤。</p>';
    return;
  }

  const title = document.createElement("h2");
  title.className = "detail-title";
  title.textContent = f.name;
  box.appendChild(title);

  const info = document.createElement("div");
  info.className = "detail-section";
  info.innerHTML = `
    <div class="detail-label">家族出身／區域／據點</div>
    <div class="detail-value">${f.origin || "出身未明"}｜${getRegionName(f.regionId) || "區域未定"}｜${f.territory || "據點未定"}</div>
  `;
  box.appendChild(info);

  // 編輯區域
  const edit = document.createElement("div");
  edit.className = "detail-section";
  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.gap = "5px";

  // 出身選項
  const originSel = document.createElement("select");
  originSel.id = "editOriginSel";
  state.originOptions.forEach(o => {
    const opt = document.createElement("option");
    opt.value = o; opt.textContent = o;
    originSel.appendChild(opt);
  });
  if (f.origin) originSel.value = f.origin;

  // 區域選項
  const regionSel = document.createElement("select");
  regionSel.id = "editRegionSel";
  const r0 = document.createElement("option");
  r0.value = ""; r0.textContent = "變更區域";
  regionSel.appendChild(r0);
  state.regions.forEach(r => {
    const opt = document.createElement("option");
    opt.value = r.id; opt.textContent = r.name;
    regionSel.appendChild(opt);
  });
  if (f.regionId) regionSel.value = f.regionId;

  // 據點選項
  const terrSel = document.createElement("select");
  terrSel.id = "editTerritorySel";
  const t0 = document.createElement("option");
  t0.value = ""; t0.textContent = "變更據點";
  terrSel.appendChild(t0);

  function populateTerritoryOptions() {
    terrSel.innerHTML = "";
    terrSel.appendChild(t0);
    const selectedRegion = regionSel.value;
    state.territoryOptions.forEach(t => {
      if (selectedRegion) {
        if (t.regionId !== selectedRegion) return;
        if (!t.regionId && t.name !== f.territory) return;
      }
      const opt = document.createElement("option");
      opt.value = t.name;
      opt.textContent = `${t.name}（${getRegionName(t.regionId) || "區域未定"}）`;
      terrSel.appendChild(opt);
    });
    if (f.territory) terrSel.value = f.territory;
  }
  populateTerritoryOptions();
  regionSel.addEventListener("change", populateTerritoryOptions);

  const saveBtn = document.createElement("button");
  saveBtn.className = "btn btn-small";
  saveBtn.textContent = "套用變更";
  saveBtn.addEventListener("click", () => {
    const newOrigin = originSel.value || "";
    const newRegionId = regionSel.value || "";
    const newTerrName = terrSel.value || "";
    if (newTerrName) {
      const terrResult = ensureTerritoryForRegion(newTerrName, newRegionId);
      if (terrResult === null) return;
      f.territory = terrResult;
    } else {
      f.territory = "";
    }
    f.origin = newOrigin;
    f.regionId = newRegionId;
    saveState();
    renderFamilies();
    renderFamilyDetail();
    renderRegions();
    renderOptionOverview();
    renderAdvisorLocationSelect();
    advisorSay(`已更新「${f.name}」的出身／區域／據點設定。`);
  });

  row.appendChild(originSel);
  row.appendChild(regionSel);
  row.appendChild(terrSel);
  row.appendChild(saveBtn);
  edit.appendChild(row);
  box.appendChild(edit);

  if (f.notes) {
    const notes = document.createElement("div");
    notes.className = "detail-section";
    notes.innerHTML = `
      <div class="detail-label">備註</div>
      <div class="detail-value">${f.notes}</div>
    `;
    box.appendChild(notes);
  }

  const memBlock = document.createElement("div");
  memBlock.className = "detail-section";
  memBlock.innerHTML = `
    <div class="detail-label">家族成員（點擊姓名以查看詳情）</div>
    <div id="familyMembersList" class="detail-value member-list"></div>
  `;
  box.appendChild(memBlock);

  const memberList = $("familyMembersList");
  const members = state.persons.filter(p => p.familyId === f.id);
  members.sort((a,b) => {
    const aG = computeGeneration(a.id);
    const bG = computeGeneration(b.id);
    if (aG !== bG) return aG - bG;
    const aY = a.birthYear || 0;
    const bY = b.birthYear || 0;
    return aY - bY;
  });

  if (!members.length) {
    memberList.innerHTML = '<p class="hint">本家族尚無成員記錄。</p>';
  } else {
    members.forEach(p => {
      const div = document.createElement("div");
      div.className = "member-item" + (state.selectedPersonId === p.id ? " active" : "") + (p.deceased ? " deceased" : "");
      const age = getAge(p);
      const ageText = age != null ? age + " 歲" : "年齡未記";
      const gen = computeGeneration(p.id);
      const deceasedText = p.deceased ? "【已逝】" : "";
      
      // 性別
const genderText = p.gender || "未記";

// 已婚狀態
const marriedText = p.spouseIds.length ? "已婚" : "未婚";

// 子女總數、兒子數、女兒數
const childrenList = p.childIds.map(id => state.persons.find(pp => pp.id === id)).filter(Boolean);
const sons = childrenList.filter(c => c.gender === "男").length;
const daughters = childrenList.filter(c => c.gender === "女").length;
const totalChildren = sons + daughters;

div.innerHTML = `
  <span class="member-name">${deceasedText}${p.name}</span>
  <span class="member-info">
    ${p.role || "未標註"}｜
    第 ${gen} 代｜
    ${ageText}｜
    ${genderText}｜
    ${marriedText}｜
    子女 ${totalChildren}（子：${sons}｜女：${daughters}）
  </span>
`;

      div.addEventListener("click", () => {
        state.selectedPersonId = p.id;
        state.selectedFamilyId = f.id;
        renderFamilyDetail();
        renderPersonDetail();
        advisorSay(`已開啟「${p.name}」的族人詳情。`);
      });
      memberList.appendChild(div);
    });
  }

  const actionBlock = document.createElement("div");
  actionBlock.className = "detail-section";
  actionBlock.innerHTML = `
    <div class="detail-label">快速行動</div>
    <div class="detail-value">
      <button class="btn btn-small" onclick="state.selectedFamilyId=null;renderFamilies();renderFamilyDetail();advisorSay('已關閉家族詳情。');">關閉詳情</button>
      <button class="btn btn-small btn-danger" onclick="deleteFamily(${f.id});">刪除家族記錄</button>
    </div>
  `;
  box.appendChild(actionBlock);
}

function renderPersonDetail() {
  const box = $("personDetail");
  box.innerHTML = "";
  if (!state.selectedPersonId) {
    box.innerHTML = '<p class="hint">請從家族詳情中的成員列表點選一人。</p>';
    return;
  }
  const p = state.persons.find(x => x.id === state.selectedPersonId);
  if (!p) {
    box.innerHTML = '<p class="hint">人物資料錯誤。</p>';
    return;
  }

  const fam = state.families.find(x => x.id === p.familyId);
  const title = document.createElement("h2");
  title.className = "detail-title";
  title.textContent = p.name + (p.deceased ? " 【已逝】" : "");
  box.appendChild(title);

  const info = document.createElement("div");
  info.className = "detail-section";
  const age = getAge(p);
  const ageText = age != null ? age + " 歲" : "年齡未記";
  const gen = computeGeneration(p.id);

  let expectedText = "";
  if (p.deathYear != null) {
    const lifeAge = p.birthYear != null ? (p.deathYear - p.birthYear) : null;
    expectedText = `預計卒於星曆 ${p.deathYear} 年`;
    if (lifeAge != null) expectedText += `（約享年 ${lifeAge} 歲）`;
    if (p.deceased) expectedText = `已於星曆 ${p.deathYear} 年辭世`;
  } else {
    expectedText = "未記載預期壽命";
  }

  info.innerHTML = `
    <div class="detail-label">身分／代數</div>
    <div class="detail-value">${p.role || "未標註"}｜${fam ? fam.name : "未歸宗族"}｜第 ${gen} 代成員</div>
    <div class="detail-label">出生年份／年齡</div>
    <div class="detail-value">${p.birthYear != null ? "星曆 " + p.birthYear + " 年" : "未記載"}｜${ageText}</div>
    <div class="detail-label">性別／身分／家族</div>
    <div class="detail-value">${p.gender || "未記載"}｜${p.role || "未標註"}｜${fam ? fam.name : "未歸宗族"}</div>
    <div class="detail-label">職業／住所</div>
    <div class="detail-value">${p.occupation || "未記載"}｜${p.residence || "未記載"}</div>
    <div class="detail-label">預期壽命</div>
    <div class="detail-value">${expectedText}</div>
  `;
  box.appendChild(info);

  if (p.notes) {
    const notes = document.createElement("div");
    notes.className = "detail-section";
    notes.innerHTML = `
      <div class="detail-label">備註</div>
      <div class="detail-value">${p.notes}</div>
    `;
    box.appendChild(notes);
  }

  const spouses = (p.spouseIds || []).map(id => state.persons.find(x => x.id === id)).filter(Boolean);
  const parents = (p.parentIds || []).map(id => state.persons.find(x => x.id === id)).filter(Boolean);
  const children = (p.childIds || []).map(id => state.persons.find(x => x.id === id)).filter(Boolean);

  const rel = document.createElement("div");
  rel.className = "detail-section";

  const spText = spouses.length ? spouses.map(sp => {
    const ag = getAge(sp);
    const genderText = sp.gender || "性別未記";
    let relType = "";
const sr = p.spouseRelations.find(r => r.id === sp.id);
if (sr) {
  relType = `（${sr.type}`;
  if (sr.year != null) relType += `｜星曆 ${sr.year} 年結婚`;
  relType += `）`;
}
let inner = `${sp.name}${relType}`;

    if (ag != null) inner += `，${ag} 歲`;
    if (sp.familyId) {
      const spFam = state.families.find(x => x.id === sp.familyId);
      if (spFam) inner += `，${spFam.name}氏`;
    }
    inner += sp.deceased ? "【已逝】" : "";
    return inner;
  }).join("； ") : "尚無婚配記錄。";

  const paText = parents.length ? parents.map(pa => {
  const ag = getAge(pa);
  const deceasedText = pa.deceased ? "【已逝】" : "";
  
  let label = pa.gender === "男" ? "父" : (pa.gender === "女" ? "母" : "父／母");
  let inner = `${label}：${pa.name}${deceasedText}`;

  // 父母目前的年齡
  if (ag != null) inner += `，${ag} 歲`;

  // ★ 新增：生育時年齡（你想要的功能）
  if (pa.birthYear != null && p.birthYear != null) {
    const ageAtBirth = p.birthYear - pa.birthYear;
    if (!isNaN(ageAtBirth)) {
      inner += `（於 ${ageAtBirth} 歲時生育）`;
    }
  }

  return inner;
}).join("； ") : "生父／母未記。";


  const chText = children.length ? children.map(ch => {
  const chAge = getAge(ch);
  const deceasedText = ch.deceased ? "【已逝】" : "";
  let inner = `${ch.gender === "男" ? "子" : "女"}：${ch.name}${deceasedText}`;

  if (chAge != null) inner += `，${chAge} 歲`;

  // 計算生育時年齡
  if (p.birthYear != null && ch.birthYear != null) {
    const ageAtBirth = ch.birthYear - p.birthYear;
    if (!isNaN(ageAtBirth)) {
      inner += `（ ${ageAtBirth} 歲時生育）`;
    }
  }

  return inner;
}).join("； ") : "尚無子女記錄。";


  rel.innerHTML = `
    <div class="detail-label">配偶（婚配）</div>
    <div class="detail-value">${spText}</div>
    <div class="detail-label">父母（血親／繼親／養親）</div>
    <div class="detail-value">${paText}</div>
    <div class="detail-label">子女（血親／繼親／養親）</div>
    <div class="detail-value">${chText}</div>
  `;
  box.appendChild(rel);

  // 動作區塊
  const actions = document.createElement("div");
  actions.className = "detail-section action-group";

  // --- 修改姓名按鈕
  const renameBtn = document.createElement("button");
  renameBtn.className = "btn btn-small";
  renameBtn.textContent = "修改姓名";
  renameBtn.addEventListener("click", () => {
    const newName = prompt("請輸入新的姓名：", p.name);
    if (newName && newName.trim() && newName.trim() !== p.name) {
      p.name = newName.trim();
      saveState();
      renderPersonDetail();
      renderFamilyDetail();
      advisorSay(`已將「${p.name}」改名為「${p.name}」。`);
    }
  });

  // --- 修改屬性按鈕 (新增功能)
  const editAttrBtn = document.createElement("button");
  editAttrBtn.className = "btn btn-small";
  editAttrBtn.textContent = "修改職業/住所/身分";
  editAttrBtn.addEventListener("click", () => {
    // 建立臨時修改 UI
    const promptBox = document.createElement("div");
    promptBox.style.padding = "10px";
    promptBox.style.border = "1px solid #ccc";
    promptBox.style.marginBottom = "10px";
    promptBox.innerHTML = `
      <p>修改人物屬性：</p>
      <label>職業：<select id="editOccSel" value="${p.occupation || ''}"></select></label><br>
      <label>居所：<select id="editResSel" value="${p.residence || ''}"></select></label><br>
      <label>身分：<select id="editRoleSel" value="${p.role || ''}"></select></label><br>
    `;
    
    // 填充下拉選單
    function populateSelect(id, options, currentValue) {
      const sel = promptBox.querySelector(`#${id}`);
      if (!sel) return;
      sel.innerHTML = "";
      const opt0 = document.createElement("option");
      opt0.value = ""; opt0.textContent = "未記載/未標註"; sel.appendChild(opt0);
      options.forEach(o => {
        const opt = document.createElement("option");
        opt.value = o; opt.textContent = o;
        sel.appendChild(opt);
      });
      sel.value = currentValue;
    }
    
    populateSelect("editOccSel", state.occOptions, p.occupation);
    populateSelect("editResSel", state.resOptions, p.residence);
    populateSelect("editRoleSel", state.roleOptions, p.role);

    const saveEditBtn = document.createElement("button");
    saveEditBtn.className = "btn btn-small";
    saveEditBtn.textContent = "確認修改";
    saveEditBtn.onclick = () => {
      const newOcc = promptBox.querySelector("#editOccSel").value;
      const newRes = promptBox.querySelector("#editResSel").value;
      const newRole = promptBox.querySelector("#editRoleSel").value;

      p.occupation = newOcc;
      p.residence = newRes;
      p.role = newRole;
      
      saveState();
      renderPersonDetail();
      renderFamilyDetail();
      advisorSay(`已更新「${p.name}」的職業/住所/身分。`);
      promptBox.remove();
    };

    const cancelEditBtn = document.createElement("button");
    cancelEditBtn.className = "btn btn-small";
    cancelEditBtn.textContent = "取消";
    cancelEditBtn.onclick = () => promptBox.remove();

    promptBox.appendChild(saveEditBtn);
    promptBox.appendChild(cancelEditBtn);
    
    actions.parentNode.insertBefore(promptBox, actions);
  });
  
  // --- 解除婚約按鈕 (新增功能)
  const divorceBtn = document.createElement("button");
  divorceBtn.className = "btn btn-small btn-warning";
  divorceBtn.textContent = "解除婚約";
  divorceBtn.addEventListener("click", () => {
      if (!spouses.length) {
          advisorSay(`「${p.name}」目前沒有婚配記錄，無法解除婚約。`);
          return;
      }
      
      const promptBox = document.createElement("div");
      promptBox.style.padding = "10px";
      promptBox.style.border = "1px solid #ccc";
      promptBox.style.marginBottom = "10px";
      promptBox.innerHTML = `
          <p>請選擇要解除婚約的配偶：</p>
          <label>配偶：<select id="divorceSpouseSel"></select></label><br>
      `;

      const sel = promptBox.querySelector("#divorceSpouseSel");
      spouses.forEach(sp => {
          const opt = document.createElement("option");
          opt.value = String(sp.id);
          const rel = p.spouseRelations.find(r => r.id === sp.id)?.type || '婚配';
          opt.textContent = `${sp.name}（${rel}）`;
          sel.appendChild(opt);
      });

      const confirmDivorceBtn = document.createElement("button");
      confirmDivorceBtn.className = "btn btn-small btn-danger";
      confirmDivorceBtn.textContent = "確認解除";
      confirmDivorceBtn.onclick = () => {
          const spouseId = Number(sel.value);
          const spouse = state.persons.find(x => x.id === spouseId);
          if (!spouse) return;

          // 從 p 移除 spouse
          p.spouseIds = p.spouseIds.filter(id => id !== spouseId);
          p.spouseRelations = p.spouseRelations.filter(r => r.id !== spouseId);
          
          // 從 spouse 移除 p
          spouse.spouseIds = spouse.spouseIds.filter(id => id !== p.id);
          spouse.spouseRelations = spouse.spouseRelations.filter(r => r.id !== p.id);
          
          saveState();
          renderPersonDetail();
          renderFamilyDetail();
          advisorSay(`已解除「${p.name}」與「${spouse.name}」的婚約。`);
          promptBox.remove();
      };

      const cancelDivorceBtn = document.createElement("button");
      cancelDivorceBtn.className = "btn btn-small";
      cancelDivorceBtn.textContent = "取消";
      cancelDivorceBtn.onclick = () => promptBox.remove();

      promptBox.appendChild(confirmDivorceBtn);
      promptBox.appendChild(cancelDivorceBtn);

      actions.parentNode.insertBefore(promptBox, actions);
  });
  
  // --- 其他原有按鈕

  const childBtn = document.createElement("button");
  childBtn.className = "btn btn-small";
  childBtn.textContent = "為其添加子女";
  childBtn.addEventListener("click", () => {
    enterChildMode(p.id);
    window.location.hash = "addPerson";
  });

  const famSel = document.createElement("select");
  const opt0 = document.createElement("option");
  opt0.value = ""; opt0.textContent = "變更隸屬家族"; famSel.appendChild(opt0);
  const optNone = document.createElement("option");
  optNone.value = "none"; optNone.textContent = "未歸宗族"; famSel.appendChild(optNone);
  state.families.forEach(f => {
    const opt = document.createElement("option");
    opt.value = String(f.id); opt.textContent = f.name; famSel.appendChild(opt);
  });

  const famBtn = document.createElement("button");
  famBtn.className = "btn btn-small";
  famBtn.textContent = "套用";
  famBtn.addEventListener("click", () => {
    const v = famSel.value;
    if (!v) return;
    if (v === "none") {
      p.familyId = null;
      advisorSay(`已將「${p.name}」設為未歸宗族。`);
    } else {
      p.familyId = Number(v);
      const ff = state.families.find(x => x.id === p.familyId);
      advisorSay(`已將「${p.name}」改隸屬於「${ff ? ff.name : "未知家族"}」。`);
    }
    saveState();
    renderFamilies();
    renderFamilyDetail();
    renderPersonDetail();
  });

  const spouseFamSel = document.createElement("select");
  const sf0 = document.createElement("option");
  sf0.value = ""; sf0.textContent = "配偶所屬家族"; spouseFamSel.appendChild(sf0);
  state.families.forEach(f => {
    const opt = document.createElement("option");
    opt.value = String(f.id); opt.textContent = f.name; spouseFamSel.appendChild(opt);
  });

  const spouseSel = document.createElement("select");
  const ss0 = document.createElement("option");
  ss0.value = ""; ss0.textContent = "選擇配偶"; spouseSel.appendChild(ss0);

  function populateSpouseOptions(familyId) {
    spouseSel.innerHTML = "";
    spouseSel.appendChild(ss0);
    const persons = state.persons.filter(p => {
      if (p.id === state.selectedPersonId) return false;
      if (p.spouseIds.includes(state.selectedPersonId)) return false; // 排除已婚
      if (familyId) {
        return p.familyId === Number(familyId);
      }
      return true; // 如果沒有選擇家族，顯示所有人
    });
    persons.forEach(sp => {
      const opt = document.createElement("option");
      opt.value = String(sp.id);
      opt.textContent = `${sp.name}（${sp.gender || "性別未記"}，${getAge(sp) != null ? getAge(sp) + '歲' : '年齡未記'}）`;
      spouseSel.appendChild(opt);
    });
  }

  spouseFamSel.addEventListener("change", () => {
    populateSpouseOptions(spouseFamSel.value);
  });
  populateSpouseOptions(null);

  const relSel = document.createElement("select");
  const rs0 = document.createElement("option");
  rs0.value = ""; rs0.textContent = "選擇關係"; relSel.appendChild(rs0);
  SPOUSE_TYPES.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t; opt.textContent = t; relSel.appendChild(opt);
  });

  const spouseBtn = document.createElement("button");
  spouseBtn.className = "btn btn-small";
  spouseBtn.textContent = "結為連理";
  spouseBtn.addEventListener("click", () => {
    const spId = Number(spouseSel.value);
    const relType = relSel.value || "婚配";
    if (!spId) { advisorSay("請選擇一位配偶。"); return; }
    if (!relType) { advisorSay("請選擇一種關係類型。"); return; }
    const sp = state.persons.find(x => x.id === spId);
if (!sp) return;

// 取得結婚年份
let yearInput = prompt(`請輸入「${p.name}」與「${sp.name}」的結婚年份（可留空）`, state.gameYear);
let marryYear = null;
if (yearInput && !isNaN(Number(yearInput))) {
  marryYear = Number(yearInput);
}

// 建立 spouseIds
if (!p.spouseIds.includes(spId)) p.spouseIds.push(spId);
if (!sp.spouseIds.includes(p.id)) sp.spouseIds.push(p.id);

// 更新 spouseRelations
let pRel = p.spouseRelations.find(r => r.id === spId);
if (!pRel) {
  pRel = { id: spId, type: relType, year: marryYear };
  p.spouseRelations.push(pRel);
} else {
  pRel.type = relType;
  pRel.year = marryYear;
}

let spRel = sp.spouseRelations.find(r => r.id === p.id);
if (!spRel) {
  spRel = { id: p.id, type: relType, year: marryYear };
  sp.spouseRelations.push(spRel);
} else {
  spRel.type = relType;
  spRel.year = marryYear;
}

saveState();
renderPersonDetail();
renderFamilyDetail();
advisorSay(`已為「${p.name}」與「${sp.name}」訂下婚約（${relType}），結婚年份：${marryYear ?? "未記載"}。`);


    saveState();
    renderPersonDetail();
    renderFamilyDetail();
    advisorSay(`已為「${p.name}」與「${sp.name}」訂下婚約（${relType}）。`);
  });

  actions.appendChild(renameBtn);
  actions.appendChild(editAttrBtn); // 新增屬性修改按鈕
  actions.appendChild(divorceBtn);  // 新增離婚按鈕
  actions.appendChild(childBtn);
  actions.appendChild(famSel);
  actions.appendChild(famBtn);
  actions.appendChild(spouseFamSel);
  actions.appendChild(spouseSel);
  actions.appendChild(relSel);
  actions.appendChild(spouseBtn);

  // 加入刪除按鈕
  const deleteBtn = document.createElement("button");
  deleteBtn.className = "btn btn-small btn-danger";
  deleteBtn.textContent = "刪除人物記錄";
  deleteBtn.addEventListener("click", () => {
    if (confirm(`確定要刪除人物「${p.name}」的記錄嗎？此操作不可逆。`)) {
        deletePerson(p.id);
    }
  });
  actions.appendChild(deleteBtn);
  
  box.appendChild(actions);
  
  // 領養子女 UI
  box.appendChild(renderAdoptChildUi(p));
}

function deleteFamily(familyId) {
    const f = state.families.find(x => x.id === familyId);
    if (!f) return;

    // 1. 移除所有成員對該家族的歸屬
    state.persons.forEach(p => {
        if (p.familyId === familyId) {
            p.familyId = null;
        }
    });

    // 2. 移除家族本身
    state.families = state.families.filter(x => x.id !== familyId);

    // 3. 更新選中的家族/人物
    if (state.selectedFamilyId === familyId) {
        state.selectedFamilyId = null;
    }
    if (state.persons.find(p => p.familyId === state.selectedFamilyId) === undefined) {
      state.selectedFamilyId = state.families.length ? state.families[0].id : null;
    }
    state.selectedPersonId = null;

    saveState();
    renderFamilies();
    renderFamilyDetail();
    renderPersonDetail();
    renderRegions();
    renderAdvisorLocationSelect();
    advisorSay(`已將「${f.name}」的家族記錄徹底刪除。`);
}

function deletePerson(personId) {
    const p = state.persons.find(x => x.id === personId);
    if (!p) return;

    // 1. 移除所有親屬關係
    state.persons.forEach(person => {
        // 移除父母關係
        person.parentIds = (person.parentIds || []).filter(id => id !== personId);
        // 移除子女關係
        person.childIds = (person.childIds || []).filter(id => id !== personId);
        // 移除配偶關係
        person.spouseIds = (person.spouseIds || []).filter(id => id !== personId);
        person.spouseRelations = (person.spouseRelations || []).filter(r => r.id !== personId);
    });

    // 2. 移除人物本身
    state.persons = state.persons.filter(x => x.id !== personId);

    // 3. 更新選中的人物
    const oldFamilyId = p.familyId;
    state.selectedPersonId = null;
    state.childModeParentId = null;
    
    // 如果舊家族仍有成員，保持家族選中
    const familyHasMembers = state.persons.some(mem => mem.familyId === oldFamilyId);
    if (!familyHasMembers) {
      state.selectedFamilyId = null;
    }

    saveState();
    renderFamilies();
    renderFamilyDetail();
    renderPersonDetail();
    renderAdvisorLocationSelect();
    advisorSay(`已將「${p.name}」的族人記錄徹底刪除。`);
}


function renderAdoptChildUi(person) {
  const box = document.createElement("div");
  box.className = "detail-section";

  let title = document.createElement("div");
  title.className = "detail-label";
  title.textContent = "領養子女";
  box.appendChild(title);

  // 1. 家族篩選 Select
  const famSel = document.createElement("select");
  const fam0 = document.createElement("option");
  fam0.value = ""; fam0.textContent = "選擇子女所屬家族（可不選）"; famSel.appendChild(fam0);
  state.families.forEach(f => {
      const opt = document.createElement("option");
      opt.value = String(f.id); opt.textContent = f.name; famSel.appendChild(opt);
  });
  box.appendChild(famSel);

  // 2. 子女選擇 Select
  let sel = document.createElement("select");
  sel.id = "adoptChildSelect";
  box.appendChild(sel);

  // 3. 填充子女選項的函數
  function populateChildOptions(familyId) {
      sel.innerHTML = "";
      const def = document.createElement("option");
      def.value = "";
      def.textContent = "選擇子女";
      sel.appendChild(def);

      const persons = state.persons.filter(p => {
          if (p.id === person.id) return false; // 排除自己
          if ((p.parentIds || []).includes(person.id)) return false; // 排除已是子女的
          
          let candidateFamilies = state.families.map(f => f.id);
          if (familyId) {
              candidateFamilies = [Number(familyId)]; // 依家族篩選
          }
          
          const isCandidate = candidateFamilies.includes(p.familyId) || (!familyId && p.familyId === null);
          
          return isCandidate;
      });

      persons.forEach(p => {
          let opt = document.createElement("option");
          opt.value = p.id;
          opt.textContent = `${p.name}（${p.gender || "性別未記"}，${getAge(p) != null ? getAge(p) + '歲' : '年齡未記'}）`;
          sel.appendChild(opt);
      });
  }

  // 4. 家族選擇變更事件
  famSel.addEventListener("change", () => {
      populateChildOptions(famSel.value);
  });

  // 初始填充
  populateChildOptions(null);

  let btn = document.createElement("button");
  btn.className = "btn btn-small";
  btn.textContent = "確認領養";

  btn.onclick = () => {
    let cid = Number(sel.value);
    if (!cid) { advisorSay("請選擇一位子女進行領養。"); return; }

    let child = state.persons.find(p => p.id === cid);
    if (!child) return;

    if (linkParentChild(person, child, {})) {
      saveState();
      renderPersonDetail();
      renderFamilyDetail();
      advisorSay(`「${person.name}」已領養「${child.name}」。`);
    }
  };

  box.appendChild(btn);
  return box;
}


// ---------- 區域總覽 ----------
function renderRegions() {
  const box = $("regionOverview");
  if (!box) return;
  box.innerHTML = "";
  state.regions.forEach(r => {
    const families = state.families.filter(f => f.regionId === r.id);
    const ids = families.map(f => f.id);
    const persons = state.persons.filter(p => ids.includes(p.familyId));
    const div = document.createElement("div");
    div.className = "region-block";
    div.innerHTML = `
      <div class="region-title">${r.name}</div>
      <div class="region-sub">${r.desc}</div>
      <div class="region-sub">家族數：${families.length}｜人口：約 ${persons.length} 人</div>
    `;
    box.appendChild(div);
  });
}

// ---------- 匯出 / 匯入 / 重置 ----------
function exportGame() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "clan_game_save_" + Date.now() + ".json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  advisorSay("已為家主匯出一份宗族存檔。");
}

function importGame(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      loadStateFromData(data);
      init();
      advisorSay("已成功讀取宗族存檔。");
    } catch (err) {
      alert("讀取存檔失敗：" + err.message);
      console.error(err);
    }
  };
  reader.readAsText(file);
}

function loadStateFromData(data) {

  // 直接覆蓋 state
  state.regions = data.regions || [...DEFAULT_REGIONS];
  state.families = data.families || [];
  state.persons = data.persons || [];
  state.originOptions = data.originOptions || [...DEFAULT_ORIGINS];
  state.territoryOptions = data.territoryOptions || [...DEFAULT_TERRITORIES];
  state.occOptions = data.occOptions || [...DEFAULT_OCCS];
  state.resOptions = data.resOptions || [...DEFAULT_RES];
  state.roleOptions = data.roleOptions || [...DEFAULT_ROLES];

  state.nextFamilyId = data.nextFamilyId || 1;
  state.nextPersonId = data.nextPersonId || 1;
  state.selectedFamilyId = data.selectedFamilyId || null;
  state.selectedPersonId = data.selectedPersonId || null;
  state.childModeParentId = null;
  state.gameYear = data.gameYear || INITIAL_YEAR;

  // 人物關係補修（避免 parentIds, spouseIds 不存在）
  state.persons.forEach(p => {
    if (!Array.isArray(p.spouseIds)) p.spouseIds = [];
    if (!Array.isArray(p.spouseRelations)) p.spouseRelations = [];
    if (!Array.isArray(p.parentIds)) p.parentIds = [];
    if (!Array.isArray(p.childIds)) p.childIds = [];
    if (p.deceased == null) p.deceased = false;
  });

  normalizeRelations();
  saveState(); // 儲存到 localStorage


  // === 修復 spouseRelations 結構，補上結婚年份 year ===
state.persons.forEach(p => {
  p.spouseRelations = p.spouseRelations.map(r => {
    if (r.year === undefined) r.year = null;
    return r;
  });
});

}



function resetGame() {
  if (!confirm("確定要重置所有遊戲資料嗎？此操作不可逆。")) return;
  localStorage.removeItem(STORAGE_KEY);
  state.regions = [...DEFAULT_REGIONS];
  state.families = [];
  state.persons = [];
  state.originOptions = [...DEFAULT_ORIGINS];
  state.territoryOptions = [...DEFAULT_TERRITORIES];
  state.occOptions = [...DEFAULT_OCCS];
  state.resOptions = [...DEFAULT_RES];
  state.roleOptions = [...DEFAULT_ROLES];
  state.nextFamilyId = 1;
  state.nextPersonId = 1;
  state.selectedFamilyId = null;
  state.selectedPersonId = null;
  state.childModeParentId = null;
  state.gameYear = INITIAL_YEAR;

  saveState();
  updateYearViews();
  renderOptionSelects();
  renderRegionSelects();
  renderFamilyOptions();
  renderFamilies();
  renderFamilyDetail();
  renderPersonDetail();
  renderRegions();
  renderOptionOverview();
  advisorSay("舊帳已清空，家主可重新書寫宗族史。");
}

// ---------- 事件系統 (省略未修改的事件系統相關函數) ----------

function buildDecisionOptions(kind) {
  switch(kind) {
    case "marriage": return ["同意婚事，正式提親","暫緩觀望，先觀察局勢","婉拒此事，以免牽扯過深"];
    case "birth": return ["記錄此兆，準備迎接新生","視為流言，不予理會"];
    case "conflict": return ["出面調停，化解內鬥","袖手旁觀，任由矛盾發酵","暗中偏袒一方，藉機布局"];
    case "alliance": return ["主動推動結盟，互通有無","保持距離，維持友好但不深交"];
    case "disaster": return ["派遣族人與物資前往馳援","交由地方自理，不介入","趁亂整頓地方勢力"];
    case "inheritance": return ["指派明確繼承人，穩定局勢","任其自行角力，觀察勝負","分家處理，減少集中權力"];
    default: return ["記錄於宗族之書","暫不處理"];
  }
}

function pickFamilyByRegion(regionId) {
  let fams = state.families;
  if (regionId) {
    const inR = state.families.filter(f => f.regionId === regionId);
    if (inR.length) fams = inR;
  }
  return pickRandom(fams);
}

function pickPersonByRegion(regionId) {
  if (!state.persons.length) return null;
  if (!regionId) return pickRandom(state.persons);
  const fam = pickFamilyByRegion(regionId);
  if (!fam) return pickRandom(state.persons);
  const members = state.persons.filter(p => p.familyId === fam.id);
  return members.length ? pickRandom(members) : pickRandom(state.persons);
}

function genMarriageEvent(regionId) {
  const p1 = pickPersonByRegion(regionId);
  if (!p1) return "宗族尚無族人，談不上婚嫁。";
  const p1Fam = p1.familyId ? getFamilyNameById(p1.familyId) : "未歸宗族";
  const regionName = p1.familyId ? (getRegionName(state.families.find(f => f.id === p1.familyId)?.regionId) || "某地") : "某地";
  return `${regionName}的「${p1Fam}」族人「${p1.name}」近來頗受注目，有外界勢力透過媒人向家主提親，欲結秦晉之好，增進兩家關係。`;
}

function genBirthEvent(regionId) {
  const p1 = pickPersonByRegion(regionId);
  if (!p1) return "宗族尚無族人，談不上添丁之喜。";
  const p1Fam = p1.familyId ? getFamilyNameById(p1.familyId) : "未歸宗族";
  const regionName = p1.familyId ? (getRegionName(state.families.find(f => f.id === p1.familyId)?.regionId) || "某地") : "某地";
  return `${regionName}的「${p1Fam}」族人「${p1.name}」傳出誕下麟兒的傳聞，更有人言其有非凡之相，可能影響家族未來。`;
}

function genConflictEvent(regionId) {
  const fam = pickFamilyByRegion(regionId);
  if (!fam) return "民間傳聞有衝突發生，但與宗族無直接關聯。";
  const regionName = fam ? (getRegionName(fam.regionId) || "某地") : "某地";
  const members = state.persons.filter(p => p.familyId === fam.id);
  if (members.length < 2) return `${regionName}的「${fam.name}」成員過少，傳聞有內鬥，但應屬虛言。`;
  const p1 = pickRandom(members);
  const p2 = pickRandom(members.filter(p => p.id !== p1.id));
  if (!p2) return `${regionName}的「${fam.name}」成員過少，傳聞有內鬥，但應屬虛言。`;
  return `${regionName}的「${fam.name}」族人「${p1.name}」與「${p2.name}」間爆發了嚴重的利益或權力衝突，可能引發家族內鬥甚至分裂。`;
}

function genAllianceEvent(regionId) {
  const fam = pickFamilyByRegion(regionId);
  if (!fam) return "天下間有結盟之議，但與宗族無直接關聯。";
  const regionName = fam ? (getRegionName(fam.regionId) || "某地") : "某地";
  return `${regionName}附近，與「${fam.name}」實力相當的另一個世家大族或地方勢力，正探詢結盟的可能性。此舉將鞏固或動搖您家族的影響力。`;
}

function genDisasterEvent(regionId) {
  const fam = pickFamilyByRegion(regionId);
  if (!fam) return "有關災異的流言在民間蔓延，但尚無具體指向任何家族。";
  const regionName = fam ? (getRegionName(fam.regionId) || "某地") : "某地";
  return `${regionName}一帶忽有災異傳聞，${fam.territory || "其領地附近"}可能遭逢水患、瘟疫或盜匪四起。家主可考慮調派族人前往處理，或藉此重整地方勢力。`;
}

function genInheritanceEvent(regionId) {
  if (!state.families.length) return "宗族尚小，談不上繼承與分家。";
  const fam = pickFamilyByRegion(regionId);
  const regionName = fam ? (getRegionName(fam.regionId) || "某地") : "某地";
  const members = state.persons.filter(p => p.familyId === (fam ? fam.id : null));
  if (!members.length) return `${regionName}的「${fam.name}」只有名號無後人，繼承問題懸而未決。`;
  const elder = pickRandom(members);
  return `${regionName}的「${fam.name}」中，「${elder.name}」近來健康每況愈下，關於家主之位與家產繼承的議題悄然浮上檯面。家主可為此族安排繼承人，或讓局勢發展成多方角力。`;
}

function triggerEvent(kindRaw) {
  let kind = kindRaw;
  if (kind === "random") {
    const arr = ["marriage","birth","conflict","alliance","disaster","inheritance"];
    kind = pickRandom(arr);
  }
  const regionId = $("eventRegion").value || "";
  let text = "";
  switch(kind) {
    case "marriage": text = genMarriageEvent(regionId); break;
    case "birth": text = genBirthEvent(regionId); break;
    case "conflict": text = genConflictEvent(regionId); break;
    case "alliance": text = genAllianceEvent(regionId); break;
    case "disaster": text = genDisasterEvent(regionId); break;
    case "inheritance": text = genInheritanceEvent(regionId); break;
    default: text = "未知事件發生。";
  }

  // 顯示 Modal
  pendingEvent = { kind, text, options: buildDecisionOptions(kind) };
  pendingEventKind = kind;
  const modal = $("eventModal");
  const eventText = $("eventText");
  const decisionSel = $("eventDecision");
  
  eventText.textContent = text;
  decisionSel.innerHTML = "";
  pendingEvent.options.forEach((opt, idx) => {
    const option = document.createElement("option");
    option.value = String(idx);
    option.textContent = opt;
    decisionSel.appendChild(option);
  });
  modal.classList.remove("hidden");
}

function resolveEvent() {
  const modal = $("eventModal");
  const decision = $("eventDecision").value;
  if (!decision) {
    alert("請家主做出決定。");
    return;
  }
  const optionText = pendingEvent.options[Number(decision)];
  const msg = `家主決斷：「${optionText}」。`;
  advisorSay(msg);
  // 這裡應加入根據事件種類和決策執行對應邏輯的代碼，目前僅記錄決策
  
  // 清空並隱藏 Modal
  pendingEvent = null;
  pendingEventKind = null;
  modal.classList.add("hidden");
}

// 依照 ID 找人物
function findPerson(id) {
  return state.persons.find(p => p.id === Number(id)) || null;
}


// ---------- 輔佐官指令集 ----------

function findPersonsByName(name) {
  const k = (name || "").toLowerCase();
  return state.persons.filter(p => (p.name || "").includes(k));
}
function findFamiliesByName(name) {
  const k = (name || "").toLowerCase();
  return state.families.filter(f => (f.name || "").includes(k));
}
function findRegionsByName(name) {
  const k = (name || "").toLowerCase();
  return state.regions.filter(r => (r.name || "").includes(k) || (r.id || "").includes(k));
}
function findTerritoriesByName(name) {
  const k = (name || "").toLowerCase();
  return state.territoryOptions.filter(t => (t.name || "").includes(k));
}

function advisorWorldSummary() {
  const famCount = state.families.length;
  const totalPop = state.persons.length;
  const alivePop = state.persons.filter(p => !p.deceased).length;
  const regionCount = state.regions.length;
  const terrCount = state.territoryOptions.length;
  const year = state.gameYear;
  advisorSay(`目前是星曆 ${year} 年。宗族之書記載了 ${famCount} 個家族，共 ${totalPop} 位族人（在世 ${alivePop} 人）。天下劃分 ${regionCount} 個區域，共有 ${terrCount} 個據點。`);
}

function advisorSearchName(name) {
  const k = (name || "").trim();
  if (!k) { advisorSay("請指定人物姓名。"); return; }
  const list = findPersonsByName(k);
  if (!list.length) { advisorSay(`未找到名為「${k}」之人。`); return; }

  let msg = `名為「${k}」的人物共有 ${list.length} 位：`;
  msg += list.map(p => {
    const age = getAge(p);
    const famName = p.familyId ? (state.families.find(f => f.id === p.familyId)?.name || "未知家族") : "未歸宗族";
    let deceasedText = p.deceased ? "【已逝】" : "";
    return `${p.name}${deceasedText}（${famName}，${age != null ? age + '歲' : '年齡未記'}）`;
  }).join("、") + "。";
  advisorSay(msg);

  state.selectedPersonId = list[0].id;
  state.selectedFamilyId = list[0].familyId || null;
  renderFamilies();
  renderFamilyDetail();
  renderPersonDetail();
}

function advisorSearchFamily(name) {
  const k = (name || "").trim();
  if (!k) { advisorSay("請指定家族名稱。"); return; }
  const list = findFamiliesByName(k);
  if (!list.length) { advisorSay(`未找到名為「${k}」的家族。`); return; }

  let msg = `名為「${k}」或相關的家族共有 ${list.length} 個：`;
  msg += list.map(f => f.name).join("、") + "。";
  advisorSay(msg);

  state.selectedFamilyId = list[0].id;
  state.selectedPersonId = null;
  renderFamilies();
  renderFamilyDetail();
  renderPersonDetail();
}

function advisorSearchLocation(keyword) {
  const k = (keyword || "").trim();
  if (!k) { advisorSay("請指定區域或據點名稱。"); return; }

  const regions = findRegionsByName(k);
  const territories = findTerritoriesByName(k);

  // ====== ① 若搜尋的是「區域」 ======
  if (regions.length) {
    const r = regions[0];
    const families = state.families.filter(f => f.regionId === r.id);

    // 每個家族的人數統計
    let detail = "";
    if (families.length) {
      detail = families
        .map(f => {
          const count = state.persons.filter(p => p.familyId === f.id).length;
          return `「${f.name}」：${count} 人`;
        })
        .join("； ");
    } else {
      detail = "尚無家族在此區域活動。";
    }

    advisorSay(
      `區域「${r.name}」：${r.desc}\n` +
      `共有 ${families.length} 個家族活動。\n` +
      detail
    );

    if (families.length) {
      state.selectedFamilyId = families[0].id;
      state.selectedPersonId = null;
      renderFamilies();
      renderFamilyDetail();
    }
    return;
  }

  // ====== ② 若搜尋的是「據點」 ======
  if (territories.length) {
    const t = territories[0];
    const families = state.families.filter(f => f.territory === t.name);

    // 每家族人數
    let detail = "";
    if (families.length) {
      detail = families
        .map(f => {
          const count = state.persons.filter(p => p.familyId === f.id).length;
          return `「${f.name}」：${count} 人`;
        })
        .join("； ");
    } else {
      detail = "尚無家族在此據點活動。";
    }

    advisorSay(
      `據點「${t.name}」（位於 ${getRegionName(t.regionId) || "區域未定"}）\n` +
      `共有 ${families.length} 個家族在此據點。\n` +
      detail
    );

    if (families.length) {
      state.selectedFamilyId = families[0].id;
      state.selectedPersonId = null;
      renderFamilies();
      renderFamilyDetail();
    }
    return;
  }

  // ====== ③ 若不是區域也不是據點 → 嘗試搜尋包含名稱的家族或人物 ======
  const families = state.families.filter(
    f => f.name.includes(k) || (f.territory && f.territory.includes(k))
  );

  if (families.length) {
    const detail = families
      .map(f => {
        const count = state.persons.filter(p => p.familyId === f.id).length;
        return `「${f.name}」：${count} 人`;
      })
      .join("； ");

    advisorSay(`找到相關家族 ${families.length} 個：${detail}`);

    state.selectedFamilyId = families[0].id;
    state.selectedPersonId = null;
    renderFamilies();
    renderFamilyDetail();
    return;
  }

  advisorSay(`在宗族記錄中找不到與「${k}」相關的地點。`);
}


function advisorSearchAge(minAge, maxAge) {
  const a = Number(minAge), b = Number(maxAge);
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) { advisorSay("請正確填寫年齡區間。"); return; }

  const hits = state.persons.filter(p => {
    const age = getAge(p);
    if (age == null) return false;
    return age >= a && age <= b;
  });

  if (!hits.length) {
    advisorSay(`未找到年齡介於 ${a} 至 ${b} 歲的族人。`);
    return;
  }

  let msg = `年齡介於 ${a} 至 ${b} 歲的族人有 ${hits.length} 位：`;
  msg += hits.map(p => {
    const age = getAge(p);
    let deceasedText = p.deceased ? "【已逝】" : "";
    return `${p.name}${deceasedText}（${age}歲）`;
  }).join("、") + "。";
  advisorSay(msg);

  state.selectedPersonId = hits[0].id;
  state.selectedFamilyId = hits[0].familyId || null;
  renderFamilies();
  renderFamilyDetail();
  renderPersonDetail();
}

function advisorCheckLifespan(name) {
  const list = findPersonsByName(name);
  if (!list.length) { advisorSay(`未找到名為「${name}」之人，無法評估壽命。`); return; }
  const p = list[0];
  
  if (!p.deathYear) {
    advisorSay(`「${p.name}」尚未標記預期死亡年份，可透過指令「改人物死亡年份 姓名 年份」設定。`);
    state.selectedPersonId = p.id;
    state.selectedFamilyId = p.familyId || null;
    renderFamilies();
    renderFamilyDetail();
    renderPersonDetail();
    return;
  }
  
  const age = p.birthYear != null ? (p.deathYear - p.birthYear) : null;
  if (age != null) advisorSay(`依目前記錄，「${p.name}」預計卒於星曆 ${p.deathYear} 年，約享年 ${age} 歲。`);
  else advisorSay(`依目前記錄，「${p.name}」預計卒於星曆 ${p.deathYear} 年，具體享年尚不可知。`);
  
  state.selectedPersonId = p.id;
  state.selectedFamilyId = p.familyId || null;
  renderFamilies();
  renderFamilyDetail();
  renderPersonDetail();
}

function handleAdvisorCommand(cmd) {
  const text = (cmd || "").trim();
  const input = $("advisorCommand");
  if (!text) {
    advisorSay("家主若有吩咐，請直接在此處說明。");
    return;
  }
  userSay(text);

  let m;

  if (text === "總覽" || text === "天下總覽") {
    advisorWorldSummary();
    input.value = "";
    return;
  }

  m = text.match(/^查人\s+(.+)$/);
  if (m) {
    advisorSearchName(m[1]);
    input.value = "";
    return;
  }

  m = text.match(/^查地\s+(.+)$/);
  if (m) {
    advisorSearchLocation(m[1]);
    input.value = "";
    return;
  }
  
  m = text.match(/^查家族\s+(.+)$/);
  if (m) {
    advisorSearchFamily(m[1]);
    input.value = "";
    return;
  }

  m = text.match(/^查年齡\s+(\d+)\s+到\s+(\d+)$/);
  if (m) {
    advisorSearchAge(m[1], m[2]);
    input.value = "";
    return;
  }

  m = text.match(/^查壽命\s+(.+)$/);
  if (m) {
    advisorCheckLifespan(m[1]);
    input.value = "";
    return;
  }

    // 查詢未歸宗族
  if (text === "查未歸宗族") {
    const list = state.persons.filter(p => !p.familyId);

    if (!list.length) {
      advisorSay("目前沒有未歸宗族的人物。");
      input.value = "";
      return;
    }

    let msg = `共有 ${list.length} 位族人尚未隸屬任何家族：`;
    msg += list.map(p => {
      const age = getAge(p);
      const deceased = p.deceased ? "【已逝】" : "";
      return `${p.name}${deceased}（${age != null ? age + '歲' : '年齡未記'}）`;
    }).join("、") + "。";

    advisorSay(msg);

    // 自動選中第一位
    const p = list[0];
    state.selectedPersonId = p.id;
    state.selectedFamilyId = null;
    renderFamilies();
    renderPersonDetail();

    input.value = "";
    return;
  }


  m = text.match(/^改家族據點\s+(\S+)\s+(\S+)$/);
  if (m) {
    const famName = m[1];
    const terrName = m[2];
    const families = findFamiliesByName(famName);
    if (!families.length) advisorSay(`未找到名為「${famName}」的家族。`);
    else {
      const fam = families[0];
      const terrObj = getTerritoryObj(terrName);
      let newRegionId = terrObj ? terrObj.regionId : fam.regionId;

      const terrResult = ensureTerritoryForRegion(terrName, newRegionId);
      if (terrResult === null) return;
      fam.territory = terrResult;
      if (terrObj && terrObj.regionId) fam.regionId = terrObj.regionId; // 同步區域

      saveState();
      renderFamilies();
      renderFamilyDetail();
      renderPersonDetail();
      renderRegions();
      renderOptionOverview();
      renderAdvisorLocationSelect();
      advisorSay(`已將「${fam.name}」據點改為「${terrName}」。`);
    }
    input.value = "";
    return;
  }

  m = text.match(/^改人物家族\s+(\S+)\s+(\S+)$/);
  if (m) {
    const name = m[1];
    const famName = m[2];
    const persons = findPersonsByName(name);
    if (!persons.length) advisorSay(`未找到名為「${name}」之人。`);
    else {
      const p = persons[0];
      if (famName === "無") {
        p.familyId = null;
        advisorSay(`已將「${p.name}」設為未歸宗族。`);
      } else {
        const fam = state.families.find(f => f.name === famName || f.name.includes(famName));
        if (!fam) advisorSay(`未找到名為「${famName}」的家族。`);
        else {
          p.familyId = fam.id;
          advisorSay(`已將「${p.name}」改隸屬於「${fam.name}」。`);
        }
      }
      saveState();
      state.selectedPersonId = p.id;
      state.selectedFamilyId = p.familyId || null;
      renderFamilies();
      renderFamilyDetail();
      renderPersonDetail();
    }
    input.value = "";
    return;
  }

  m = text.match(/^改人物死亡年份\s+(\S+)\s+(\d+)$/);
  if (m) {
      const name = m[1];
      const deathYear = Number(m[2]);
      const persons = findPersonsByName(name);
      if (!persons.length) {
          advisorSay(`未找到名為「${name}」之人。`);
      } else {
          const p = persons[0];
          const oldYear = p.deathYear;
          const oldDeceased = p.deceased;
          p.deathYear = deathYear;

          // 立即更新生死狀態
          if (!p.deceased && p.deathYear && p.deathYear <= state.gameYear) {
            p.deceased = true;
          } else if (p.deceased && p.deathYear && p.deathYear > state.gameYear) {
            p.deceased = false;
          }

          saveState();
          state.selectedPersonId = p.id;
          state.selectedFamilyId = p.familyId || null;
          renderFamilies();
          renderFamilyDetail();
          renderPersonDetail();

          let msg = `已將「${p.name}」的死亡年份從「${oldYear || '未定'}」改為「星曆 ${deathYear} 年」。`;
          if (oldDeceased !== p.deceased) {
              msg += p.deceased ? `該人物現已標記為「已逝」。` : `該人物現已標記為「在世」。`;
          }

          advisorSay(msg);
      }
      input.value = "";
      return;
  }

  m = text.match(/^加父母\s+(\S+)\s+(\S+)$/);
  if (m) {
    const childName = m[1];
    const parentName = m[2];
    const childs = findPersonsByName(childName);
    const parents = findPersonsByName(parentName);
    if (!childs.length) advisorSay(`未找到名為「${childName}」之子女。`);
    else if (!parents.length) advisorSay(`未找到名為「${parentName}」之父母候選。`);
    else {
      const child = childs[0];
      const parent = parents[0];
      if (linkParentChild(parent, child, { ignoreRule: false })) {
        saveState();
        advisorSay(`已將「${parent.name}」標記為「${child.name}」的父母之一。`);
        state.selectedPersonId = child.id;
        renderPersonDetail();
        renderFamilyDetail();
      }
    }
    input.value = "";
    return;
  }

  m = text.match(/^加子女\s+(\S+)\s+(\S+)$/);
  if (m) {
    const parentName = m[1];
    const childName = m[2];
    const parents = findPersonsByName(parentName);
    const childs = findPersonsByName(childName);
    if (!parents.length) advisorSay(`未找到名為「${parentName}」之父母。`);
    else if (!childs.length) advisorSay(`未找到名為「${childName}」之子女候選。`);
    else {
      const parent = parents[0];
      const child = childs[0];
      if (linkParentChild(parent, child, { ignoreRule: false })) {
        saveState();
        advisorSay(`已將「${parent.name}」標記為「${child.name}」的父母之一。`);
        state.selectedPersonId = parent.id;
        renderPersonDetail();
        renderFamilyDetail();
      }
    }
    input.value = "";
    return;
  }

  m = text.match(/^結為連理\s+(\S+)\s+(\S+)(?:\s+(.+))?$/);
  if (m) {
    const name1 = m[1];
    const name2 = m[2];
    const relType = m[3] || "婚配";
    const p1List = findPersonsByName(name1);
    const p2List = findPersonsByName(name2);

    if (!p1List.length) advisorSay(`未找到名為「${name1}」之人。`);
    else if (!p2List.length) advisorSay(`未找到名為「${name2}」之人。`);
    else {
      const p1 = p1List[0];
      const p2 = p2List[0];
      
      if (p1.id === p2.id) { advisorSay("不可與自己結為連理。"); input.value = ""; return; }
      if (p1.spouseIds.includes(p2.id)) { advisorSay("兩人已結為連理。"); input.value = ""; return; }

      if (!p1.spouseIds.includes(p2.id)) p1.spouseIds.push(p2.id);
      if (!p2.spouseIds.includes(p1.id)) p2.spouseIds.push(p1.id);

      let p1Rel = p1.spouseRelations.find(r => r.id === p2.id);
      if (!p1Rel) { p1Rel = { id: p2.id, type: relType }; p1.spouseRelations.push(p1Rel); }
      else p1Rel.type = relType;
      let p2Rel = p2.spouseRelations.find(r => r.id === p1.id);
      if (!p2Rel) { p2Rel = { id: p1.id, type: relType }; p2.spouseRelations.push(p2Rel); }
      else p2Rel.type = relType;

      saveState();
      state.selectedPersonId = p1.id;
      renderPersonDetail();
      renderFamilyDetail();
      advisorSay(`已為「${p1.name}」與「${p2.name}」訂下婚約（${relType}）。`);
    }
    input.value = "";
    return;
  }
  
  advisorSay("家主所言甚是，但此處並無對應的指令。請參考指令集。");
  input.value = "";
}

// ---------- 初始化與事件綁定 ----------

function init() {
  loadState();
  updateYearViews();
  renderRegionSelects();
  renderOptionSelects();
  renderFamilyOptions();
  renderFamilies();
  renderFamilyDetail();
  renderPersonDetail();
  renderRegions();
  renderOptionOverview();
}

document.addEventListener("DOMContentLoaded", () => {
  init();

  const optBox = $("optionOverview");
  if (optBox) {
    optBox.addEventListener("click", e => {
      const t = e.target;
      if (!t) return;
      handleOptionEditClick(t);
    });
  }

  $("familyForm").addEventListener("submit", e => {
    e.preventDefault();
    const name = $("familyName").value;
    if (!name.trim()) {
      alert("請輸入家族名稱。");
      return;
    }
    const data = {
      name,
      origin: $("familyOrigin").value,
      regionId: $("familyRegion").value,
      territory: $("familyTerritory").value,
      notes: $("familyNotes").value.trim()
    };
    addFamily(data);
    $("familyForm").reset();
  });

  $("addOriginBtn").addEventListener("click", () => {
    addOrigin($("newOrigin").value);
    $("newOrigin").value = "";
  });
  
  const rBtn = document.getElementById("addRoleBtn");
  if(rBtn) rBtn.onclick = () => addRole(document.getElementById("newRole").value);
  const oBtn = document.getElementById("addOccBtn");
  if(oBtn) oBtn.onclick = () => addOcc(document.getElementById("newOcc").value);
  const resBtn = document.getElementById("addResBtn");
  if(resBtn) resBtn.onclick = () => addRes(document.getElementById("newRes").value);

  $("addTerritoryBtn").addEventListener("click", () => {
    const v = $("newTerritory").value;
    const regionId = $("familyRegion").value || $("quickRegion").value;
    addTerritory(v, regionId);
    $("newTerritory").value = "";
  });

  $("quickFamilyForm").addEventListener("submit", e => {
    e.preventDefault();
    quickCreateFamily({
      surname: $("quickSurname").value,
      count: $("quickCount").value,
      minAge: $("quickAgeMin").value,
      maxAge: $("quickAgeMax").value,
      origin: $("quickOrigin").value,
      regionId: $("quickRegion").value,
      territory: $("quickTerritory").value
    });
    $("quickFamilyForm").reset();
  });

  $("personForm").addEventListener("submit", e => {
    e.preventDefault();
    const name = $("personName").value;
    if (!name.trim()) {
      alert("請輸入姓名。");
      return;
    }
    
    // 處理新的年齡/出生年份輸入欄位
    const ageOrBirthInput = $("personAgeOrBirth").value;

    const familyId = $("personFamily").value ? Number($("personFamily").value) : null;
    addPerson({
      name,
      ageOrBirthInput, // 使用新的輸入欄位
      gender: $("personGender").value,
      role: $("personRole").value,
      familyId,
      occupation: $("personOcc").value,
      residence: $("personRes").value,
      notes: $("personNotes").value.trim()
    });
    $("personForm").reset();
  });

  $("cancelChildModeBtn").addEventListener("click", () => {
    exitChildModeUI();
    advisorSay("已取消以特定人物為父母建立子女。");
  });

  $("yearMinusBtn").addEventListener("click", () => setGameYear(state.gameYear - 1));
  $("yearPlusBtn").addEventListener("click", () => setGameYear(state.gameYear + 1));

  $("exportBtn").addEventListener("click", exportGame);
  $("importBtn").addEventListener("click", () => $("importFile").click());
  $("importFile").addEventListener("change", (e) => importGame(e.target.files[0]));
  $("resetBtn").addEventListener("click", resetGame);

  $("triggerEventBtn").addEventListener("click", () => {
    triggerEvent($("eventType").value);
  });
  $("resolveEventBtn").addEventListener("click", resolveEvent);
  $("cancelEventBtn").addEventListener("click", () => {
    $("eventModal").classList.add("hidden");
    advisorSay("家主決定暫時擱置此事件。");
    pendingEvent = null;
    pendingEventKind = null;
  });

  $("advisorCommandForm").addEventListener("submit", e => {
    e.preventDefault();
    handleAdvisorCommand($("advisorCommand").value);
  });
});

  // ======== 輔佐官搜尋按鈕功能補綁定 ========

  // 查人按鈕
  $("advisorSearchBtn").addEventListener("click", () => {
    const name = $("advisorSearchName").value.trim();
    if (!name) { advisorSay("請家主輸入姓名。"); return; }
    advisorSearchName(name);
  });

  // 查地點按鈕
  $("advisorLocationBtn").addEventListener("click", () => {
    const loc = $("advisorLocation").value.trim();
    if (!loc) { advisorSay("請家主選擇地點。"); return; }
    advisorSearchLocation(loc);
  });

  // 查年齡按鈕
  $("advisorAgeBtn").addEventListener("click", () => {
    const a = $("ageMin").value;
    const b = $("ageMax").value;
    advisorSearchAge(a, b);
  });

  // 天下總覽按鈕
  $("worldSummaryBtn").addEventListener("click", () => {
    advisorWorldSummary();
  });

  // 指令送出按鈕
  $("advisorCommandBtn")?.addEventListener("click", () => {
    handleAdvisorCommand($("advisorCommand").value);
  });


// === 小型第二父母選擇視窗 ===

function openParentSelectDialog(child, parent, spouseList) {
  const box = document.getElementById("parentSelectDialog");
  const txt = document.getElementById("parentSelectText");
  const btns = document.getElementById("parentSelectButtons");

  if (!box) return;

  txt.innerText = `為「${child.name}」選擇另一位父母：`;

  btns.innerHTML = "";

  // 建立配偶按鈕
  spouseList.forEach(sp => {
    const b = document.createElement("button");
    b.innerText = sp.name;
    b.style.padding = "6px 10px";
    b.style.border = "1px solid #444";
    b.style.borderRadius = "6px";
    b.onclick = () => confirmSecondParent(child.id, parent.id, sp.id);
    btns.appendChild(b);
  });

  // 無（不詳）按鈕
  const none = document.createElement("button");
  none.innerText = "無（不詳）";
  none.style.padding = "6px 10px";
  none.style.border = "1px solid #444";
  none.style.borderRadius = "6px";
  none.onclick = () => confirmSecondParent(child.id, parent.id, null);
  btns.appendChild(none);

  box.style.display = "block";
}

function closeParentSelectDialog() {
  const box = document.getElementById("parentSelectDialog");
  if (box) box.style.display = "none";
}

function confirmSecondParent(childId, parentId, secondId) {
  const child = findPerson(childId);
  const p1 = findPerson(parentId);

  if (!child || !p1) return;

  if (secondId !== null) {
    const sp = findPerson(secondId);
    if (sp) {
      if (!child.parentIds.includes(sp.id)) child.parentIds.push(sp.id);
      if (!sp.childIds.includes(child.id)) sp.childIds.push(child.id);

      advisorSay(`已為「${child.name}」設定父母：${p1.name} 與 ${sp.name}`);
    }
  } else {
    advisorSay(`已為「${child.name}」設定單一父母（${p1.name}）`);
  }

  closeParentSelectDialog();
  normalizeRelations();
  saveState();
  renderFamilies();
  renderFamilyDetail();
  renderPersonDetail();
}
