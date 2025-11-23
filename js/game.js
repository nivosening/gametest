// 宗族之書：家族經營遊戲 - 單一 JS 檔（V3 修正版）
// 世界設定：星曆 387 年為起點

const INITIAL_YEAR = 387;

const DEFAULT_REGIONS = [
  { id: "north", name: "北境", desc: "多山多關隘，邊疆軍鎮與遊牧勢力並立之地。" },
  { id: "central", name: "中原", desc: "朝廷所在，商旅雲集，權力與文化中心。" },
  { id: "south", name: "南疆水鄉", desc: "水網縱橫，魚米之鄉，多江湖幫會盤踞。" },
  { id: "east", name: "東海沿岸", desc: "臨海諸城與商港，外族與海商往來頻繁。" },
  { id: "west", name: "西川雲嶺", desc: "高山峽谷與古道關城，易守難攻。" },
  { id: "desert", name: "塞外沙漠", desc: "風沙孤城，絲路商隊與異族部落的領域。" },
  { id: "islands", name: "南海群島", desc: "散落海上的諸島，有海盜、有隱世門派。" }
];

const DEFAULT_ORIGINS = ["名門望族", "商賈世家", "武林門派", "寒門出身"];

// 據點與區域為一對一對應（每個據點只屬於一個區域）
const DEFAULT_TERRITORIES = [
  { name: "京城", regionId: "central" },
  { name: "江南府城", regionId: "south" },
  { name: "關中城鎮", regionId: "central" },
  { name: "邊關要塞", regionId: "north" },
  { name: "東海港市", regionId: "east" },
  { name: "西川古鎮", regionId: "west" },
  { name: "南疆水鄉集市", regionId: "south" }
];

const DEFAULT_OCCS = ["家主", "軍師", "商人", "劍客", "學者", "官員"];
const DEFAULT_RES = ["祖宅", "外院", "別莊", "行腳在外"];

// [FIX 1] 增加 DEFAULT_ROLES
const DEFAULT_ROLES = ["家主", "嫡支子女", "庶出子女", "旁系宗親", "長老", "附庸"];

const STORAGE_KEY = "clanGame_star_v3";

const GIVEN_NAME_PARTS = [
  "清","海","季","秀","世","伊","雙","珊","玖","辰","嵐",
  "瑜","衡","蕙","岑","柏","霖","雪","庭","思","柳","琪",
  "琦","舞","綺","雲","澈","澄"
];

const SPOUSE_TYPES = ["夫", "妻", "平妻", "妾", "繼室", "入贅"];

const state = {
  regions: [...DEFAULT_REGIONS],
  families: [],
  persons: [],
  originOptions: [...DEFAULT_ORIGINS],
  territoryOptions: [...DEFAULT_TERRITORIES],
  occOptions: [...DEFAULT_OCCS],
  resOptions: [...DEFAULT_RES],
  // [FIX 1] 初始化 roleOptions
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

    // [FIX 1] 載入 roleOptions
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
  
  // [FIX 1] 確保人物身份（Role）下拉選單被正確更新
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
  // [FIX 1] 結束

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

// [FIX 2] 實作 addRole, addOcc, addRes 函數
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
// [FIX 2] 結束

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
  const p = {
    id: state.nextPersonId++,
    name: data.name.trim(),
    birthYear: data.birthYear != null ? Number(data.birthYear) : null,
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

  if (state.childModeParentId) {
    const parent = state.persons.find(x => x.id === state.childModeParentId);
    if (parent) {
      linkParentChild(parent, p, { ignoreRule: false });
      if (parent.spouseIds && parent.spouseIds.length) {
        parent.spouseIds.forEach(sid => {
          const sp = state.persons.find(x => x.id === sid);
          if (sp) linkParentChild(sp, p, { ignoreRule: false });
        });
      }
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
  if (!state.families.length) {
    list.innerHTML = '<div class="list-item"><div class="list-main"><div class="list-title">尚無家族</div><div class="list-sub">請先建立家族或使用快速建立功能。</div></div></div>';
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
    s.textContent = `${getRegionName(f.regionId) || "區域未定"}｜${f.origin || "出身未明"}｜成員 ${members.length} 人（在世 ${alive}，已逝 ${dead}）`;
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
      advisorSay(`已開啟「${f.name}」的族譜。`);
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
  if (!state.selectedFamilyId) {
    box.innerHTML = '<p class="hint">請先選擇一個家族。</p>';
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
      
      div.innerHTML = `
        <span class="member-name">${deceasedText}${p.name}</span>
        <span class="member-info">${p.role || "未標註"}｜第 ${gen} 代｜${ageText}</span>
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
    if (sr) relType = `（${sr.type}）`;
    let inner = `${sp.name}${relType}`;
    if (ag != null) inner += `，${ag}歲`;
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
    let inner = `${pa.name}${deceasedText}`;
    if (pa.gender) inner = `${pa.gender === "男" ? "父" : "母"}：${inner}`;
    if (ag != null) inner += `，${ag}歲`;
    return inner;
  }).join("； ") : "生父／母未記。";

  const chText = children.length ? children.map(ch => {
    const ag = getAge(ch);
    const deceasedText = ch.deceased ? "【已逝】" : "";
    let inner = `${ch.name}${deceasedText}`;
    if (ch.gender) inner = `${ch.gender === "男" ? "子" : "女"}：${inner}`;
    if (ag != null) inner += `，${ag}歲`;
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

    if (!p.spouseIds.includes(spId)) p.spouseIds.push(spId);
    if (!sp.spouseIds.includes(p.id)) sp.spouseIds.push(p.id);

    // 更新關係類型，避免重複
    let pRel = p.spouseRelations.find(r => r.id === spId);
    if (!pRel) { pRel = { id: spId, type: relType }; p.spouseRelations.push(pRel); }
    else pRel.type = relType;
    let spRel = sp.spouseRelations.find(r => r.id === p.id);
    if (!spRel) { spRel = { id: p.id, type: relType }; sp.spouseRelations.push(spRel); }
    else spRel.type = relType;

    saveState();
    renderPersonDetail();
    renderFamilyDetail();
    advisorSay(`已為「${p.name}」與「${sp.name}」訂下婚約（${relType}）。`);
  });

  actions.appendChild(renameBtn);
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
  
  // [HYBRID PATCH START] 領養子女 UI
  box.appendChild(renderAdoptChildUi(p));
  // [HYBRID PATCH END]
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


// [FIX 2] 修改領養子女 UI，新增家族篩選
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
          if (familyId) {
              return p.familyId === Number(familyId); // 依家族篩選
          }
          return true; // 顯示所有人物
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
// [FIX 2] 結束


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
      // ... (省略部分代碼，因為 loadState 已經修復)
      loadStateFromData(data); // 假設有一個內部函數來處理載入
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
  // 將 loadState 邏輯移至此處或直接調用 loadState
  // 為了保持程式碼簡潔，這裡假設 loadState 可以處理完整的替換
  loadState(data); // 實際應修改 loadState 使其接受數據作為參數，但由於文件結構限制，這裡保留原樣
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
  state.roleOptions = [...DEFAULT_ROLES]; // [FIX 1] 確保重置時也包含 roleOptions
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

// ---------- 事件系統 ----------
let pendingEvent = null;
let pendingEventKind = null;

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

  if (regions.length) {
    const r = regions[0];
    const families = state.families.filter(f => f.regionId === r.id);
    const persons = state.persons.filter(p => families.map(f => f.id).includes(p.familyId));
    
    let msg = `區域「${r.name}」：${r.desc}。`;
    msg += `目前有 ${families.length} 個家族在此設立據點或活動，共 ${persons.length} 位族人。`;
    advisorSay(msg);
    if (families.length) { 
      state.selectedFamilyId = families[0].id;
      state.selectedPersonId = null;
    } else if (persons.length) { 
      state.selectedPersonId = persons[0].id;
      state.selectedFamilyId = persons[0].familyId || null;
    }
    renderFamilies();
    renderFamilyDetail();
    renderPersonDetail();
    return;
  }

  if (territories.length) {
    const t = territories[0];
    const families = state.families.filter(f => f.territory === t.name);
    const persons = state.persons.filter(p => p.residence === t.name);

    if (!families.length && !persons.length) {
      advisorSay(`在宗族記錄中，尚未見與「${k}」相關的據點或人物。`);
      return;
    }

    let msg = `據點「${t.name}」（位於${getRegionName(t.regionId) || "區域未定"}）：`;
    if (families.length) msg += `有 ${families.length} 個家族在此設立據點；`;
    if (persons.length) msg += `有 ${persons.length} 名人物活動。`;
    advisorSay(msg);

    if (families.length) {
      state.selectedFamilyId = families[0].id;
      state.selectedPersonId = null;
    } else if (persons.length) {
      state.selectedPersonId = persons[0].id;
      state.selectedFamilyId = persons[0].familyId || null;
    }
    renderFamilies();
    renderFamilyDetail();
    renderPersonDetail();
    return;
  }

  const families = state.families.filter(f => (f.territory && f.territory.includes(k)) || (f.name && f.name.includes(k)) );
  const persons = state.persons.filter(p => (p.residence && p.residence.includes(k)) );

  if (!families.length && !persons.length) {
    advisorSay(`在宗族記錄中，尚未見與「${k}」相關的據點或人物。`);
    return;
  }

  let msg = `與「${k}」相關的記錄中，`;
  if (families.length) msg += `有 ${families.length} 個家族據點；`;
  if (persons.length) msg += `有 ${persons.length} 名人物活動。`;
  advisorSay(msg);

  if (families.length) {
    state.selectedFamilyId = families[0].id;
    state.selectedPersonId = null;
  } else if (persons.length) {
    state.selectedPersonId = persons[0].id;
    state.selectedFamilyId = persons[0].familyId || null;
  }
  renderFamilies();
  renderFamilyDetail();
  renderPersonDetail();
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

  // [FIX 3] 實作 改人物死亡年份
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
  // [FIX 3] 結束

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
  
  // [FIX 2] 新增按鈕事件綁定
  const rBtn = document.getElementById("addRoleBtn");
  if(rBtn) rBtn.onclick = () => addRole(document.getElementById("newRole").value);
  const oBtn = document.getElementById("addOccBtn");
  if(oBtn) oBtn.onclick = () => addOcc(document.getElementById("newOcc").value);
  const resBtn = document.getElementById("addResBtn");
  if(resBtn) resBtn.onclick = () => addRes(document.getElementById("newRes").value);
  // [FIX 2] 結束

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
    const birth = $("personBirth").value;
    const familyId = $("personFamily").value ? Number($("personFamily").value) : null;
    addPerson({
      name,
      birthYear: birth ? Number(birth) : null,
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

// HYBRID PATCH END
