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

function renderOptionSelects() {
  const originSel = $("familyOrigin");
  const quickOriginSel = $("quickOrigin");
  const terrSel = $("familyTerritory");
  const quickTerrSel = $("quickTerritory");
  const occSel = $("personOcc");
  const resSel = $("personRes");

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
    memo[id] = 1; return 1;
  }
  if (!p.parentIds || !p.parentIds.length) {
    memo[id] = 1; return 1;
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
    box.innerHTML = '<p class="hint">家族資料不存在。</p>';
    return;
  }
  const members = state.persons.filter(p => p.familyId === f.id);
  const alive = members.filter(p => !p.deceased).length;
  const dead = members.filter(p => p.deceased).length;
  const regionName = getRegionName(f.regionId) || "未定";

  const info = document.createElement("div");
  info.className = "detail-section";
  info.innerHTML = `
    <div class="detail-label">家族名稱</div>
    <div class="detail-value">${f.name}</div>
    <div class="detail-label">出身／區域／據點</div>
    <div class="detail-value">${f.origin || "未記載"}｜${regionName}｜${f.territory || "未定"}</div>
    <div class="detail-label">成員數</div>
    <div class="detail-value">${members.length} 人（在世 ${alive}，已逝 ${dead}）</div>
  `;
  box.appendChild(info);

  // 可在此處修改 出身／區域／據點
  const edit = document.createElement("div");
  edit.className = "detail-section";
  const lbl = document.createElement("div");
  lbl.className = "detail-label";
  lbl.textContent = "修改出身／區域／據點";
  edit.appendChild(lbl);

  const row = document.createElement("div");
  row.className = "button-row";

  const originSel = document.createElement("select");
  const o0 = document.createElement("option");
  o0.value = "";
  o0.textContent = "未指定";
  originSel.appendChild(o0);
  state.originOptions.forEach(o => {
    const opt = document.createElement("option");
    opt.value = o;
    opt.textContent = o;
    originSel.appendChild(opt);
  });
  originSel.value = f.origin || "";

  const regionSel = document.createElement("select");
  const r0 = document.createElement("option");
  r0.value = "";
  r0.textContent = "未指定區域";
  regionSel.appendChild(r0);
  state.regions.forEach(r => {
    const opt = document.createElement("option");
    opt.value = r.id;
    opt.textContent = r.name;
    regionSel.appendChild(opt);
  });
  regionSel.value = f.regionId || "";

  const terrSel = document.createElement("select");
  const t0 = document.createElement("option");
  t0.value = "";
  t0.textContent = "未定據點";
  terrSel.appendChild(t0);

  function populateTerritoryOptions() {
    const selectedRegion = regionSel.value || "";
    terrSel.innerHTML = "";
    const t00 = document.createElement("option");
    t00.value = "";
    t00.textContent = "未定據點";
    terrSel.appendChild(t00);
    state.territoryOptions.forEach(t => {
      if (selectedRegion) {
        if (t.regionId && t.regionId !== selectedRegion) return;
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
  memBlock.innerHTML = `<div class="detail-label">成員列表</div>`;
  if (!members.length) {
    memBlock.innerHTML += `<div class="detail-value">尚無成員。</div>`;
  } else {
    const pills = document.createElement("div");
    pills.className = "pills";
    members.forEach(p => {
      const age = getAge(p);
      const genderText = p.gender || "性別未記";
      let inner = p.name + "（" + genderText;
      if (age != null) {
        if (p.deceased) inner += `，享年 ${age}`;
        else inner += `，${age} 歲`;
      }
      if (p.deceased) inner += "，已逝";
      inner += "）";
      const pill = document.createElement("button");
      pill.type = "button";
      pill.className = "pill";
      pill.textContent = inner;
      pill.addEventListener("click", () => {
        state.selectedPersonId = p.id;
        renderPersonDetail();
        advisorSay(`已為家主呈上「${p.name}」的個人檔案。`);
      });
      pills.appendChild(pill);
    });
    memBlock.appendChild(pills);
  }
  box.appendChild(memBlock);
}

function renderPersonDetail() {
  const box = $("personDetail");
  box.innerHTML = "";
  if (!state.selectedPersonId) {
    box.innerHTML = '<p class="hint">尚未選擇人物。</p>';
    return;
  }
  const p = state.persons.find(x => x.id === state.selectedPersonId);
  if (!p) {
    box.innerHTML = '<p class="hint">人物資料不存在。</p>';
    return;
  }
  const fam = p.familyId ? state.families.find(f => f.id === p.familyId) : null;
  const gen = computeGeneration(p.id, {});
  const age = getAge(p);
  const ageText = (() => {
    if (age == null) return "無法推算";
    if (p.deceased && p.deathYear) return `享年 ${age} 歲（卒於星曆 ${p.deathYear} 年）`;
    return `${age} 歲`;
  })();
  const expected = p.deathYear;
  const expectedText = expected ? (
    p.birthYear != null
      ? `預計卒於星曆 ${expected} 年（約 ${expected - p.birthYear} 歲）`
      : `預計卒於星曆 ${expected} 年`
  ) : "尚未標記";

  const info = document.createElement("div");
  info.className = "detail-section";
  info.innerHTML = `
    <div class="detail-label">姓名／世代</div>
    <div class="detail-value">${p.name}${p.deceased ? "（已逝）" : ""}｜第 ${gen} 代成員</div>
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
  const spText = spouses.length
    ? spouses.map(sp => {
        const ag = getAge(sp);
        const genderText = sp.gender || "性別未記";
        let inner = `${sp.name}（${genderText}`;
        if (ag != null) inner += `，${sp.deceased ? "享年 " + ag : ag + " 歲"}`;
        else if (sp.deceased) inner += "，已逝";
        if (sp.deceased && ag == null) inner += "，已逝";
        inner += "）";
        const relInfo = (p.spouseRelations || []).find(r => r.spouseId === sp.id);
        const relTxt = relInfo ? `（關係：${relInfo.type}）` : "";
        return inner + relTxt;
      }).join("、")
    : "目前未登記配偶。";
  const parentText = parents.length ? parents.map(pp => pp.name).join("、") : "父母資料尚未登記。";
  const childText = children.length ? children.map(cc => cc.name).join("、") : "尚未登記子女。";

  rel.innerHTML = `
    <div class="detail-label">親屬關係</div>
    <div class="detail-value">配偶：${spText}</div>
    <div class="detail-value">父母：${parentText}</div>
    <div class="detail-value">子女：${childText}</div>
  `;
  box.appendChild(rel);

  const actions = document.createElement("div");
  actions.className = "button-row";

  const renameBtn = document.createElement("button");
  renameBtn.className = "btn btn-small";
  renameBtn.textContent = "修改姓名";
  renameBtn.addEventListener("click", () => {
    const nv = prompt("請輸入新的姓名：", p.name);
    if (!nv) return;
    p.name = nv.trim();
    saveState();
    renderFamilies();
    renderFamilyDetail();
    renderPersonDetail();
    advisorSay(`已將此人姓名更改為「${p.name}」。`);
  });

  const childBtn = document.createElement("button");
  childBtn.className = "btn btn-small";
  childBtn.textContent = "以此人為父母建立子女";
  childBtn.addEventListener("click", () => {
    enterChildMode(p.id);
  });

  const famSel = document.createElement("select");
  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = "變更隸屬家族";
  famSel.appendChild(opt0);
  const optNone = document.createElement("option");
  optNone.value = "none";
  optNone.textContent = "未歸宗族";
  famSel.appendChild(optNone);
  state.families.forEach(f => {
    const opt = document.createElement("option");
    opt.value = String(f.id);
    opt.textContent = f.name;
    famSel.appendChild(opt);
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
  sf0.value = "";
  sf0.textContent = "配偶所屬家族";
  spouseFamSel.appendChild(sf0);
  state.families.forEach(f => {
    const opt = document.createElement("option");
    opt.value = String(f.id);
    opt.textContent = f.name;
    spouseFamSel.appendChild(opt);
  });

  const spouseSel = document.createElement("select");
  const ss0 = document.createElement("option");
  ss0.value = "";
  ss0.textContent = "選擇配偶";
  spouseSel.appendChild(ss0);

  const relSel = document.createElement("select");
  const rl0 = document.createElement("option");
  rl0.value = "";
  rl0.textContent = "關係類型";
  relSel.appendChild(rl0);
  SPOUSE_TYPES.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t; opt.textContent = t;
    relSel.appendChild(opt);
  });

  spouseFamSel.addEventListener("change", () => {
    spouseSel.innerHTML = "";
    const s0 = document.createElement("option");
    s0.value = "";
    s0.textContent = "選擇配偶";
    spouseSel.appendChild(s0);
    const fid = Number(spouseFamSel.value);
    if (!fid) return;
    const cands = state.persons.filter(x => x.familyId === fid && x.id !== p.id);
    cands.forEach(c => {
      const ag = getAge(c);
      const genderText = c.gender || "性別未記";
      let txt = `${c.name}（${genderText}`;
      if (ag != null) txt += `，${ag} 歲${c.deceased ? "，已逝" : ""}`;
      else if (c.deceased) txt += "，已逝";
      txt += "）";
      const opt = document.createElement("option");
      opt.value = String(c.id);
      opt.textContent = txt;
      spouseSel.appendChild(opt);
    });
  });

  const spouseBtn = document.createElement("button");
  spouseBtn.className = "btn btn-small";
  spouseBtn.textContent = "訂立婚約";
  spouseBtn.addEventListener("click", () => {
    const fid = spouseFamSel.value;
    const pid = spouseSel.value;
    const relType = relSel.value;
    if (!fid) { alert("請先選擇配偶所屬家族。"); return; }
    if (!pid) { alert("請選擇配偶成員。"); return; }
    if (!relType) { alert("請選擇關係類型。"); return; }
    const sp = state.persons.find(x => x.id === Number(pid));
    if (!sp) return;
    if (!p.spouseIds.includes(sp.id)) p.spouseIds.push(sp.id);
    if (!sp.spouseIds.includes(p.id)) sp.spouseIds.push(p.id);
    const r1 = p.spouseRelations.find(r => r.spouseId === sp.id);
    if (r1) r1.type = relType;
    else p.spouseRelations.push({ spouseId: sp.id, type: relType });
    const r2 = sp.spouseRelations.find(r => r.spouseId === p.id);
    if (r2) r2.type = relType;
    else sp.spouseRelations.push({ spouseId: p.id, type: relType });
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
  box.appendChild(actions);
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

      state.occOptions = data.occOptions && data.occOptions.length ? data.occOptions : [...DEFAULT_OCCS];
      state.resOptions = data.resOptions && data.resOptions.length ? data.resOptions : [...DEFAULT_RES];
      state.nextFamilyId = data.nextFamilyId || 1;
      state.nextPersonId = data.nextPersonId || 1;
      state.selectedFamilyId = null;
      state.selectedPersonId = null;
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
      saveState();
      updateYearViews();
      renderOptionSelects();
      renderRegionSelects();
      renderFamilyOptions();
      renderFamilies();
      renderFamilyDetail();
      renderPersonDetail();
      renderRegions();
      advisorSay("已成功讀取存檔。");
    } catch(err) {
      alert("讀取檔案失敗。");
    }
  };
  reader.readAsText(file, "utf-8");
}

function resetGame() {
  if (!confirm("確定要重置所有資料？此操作無法復原。")) return;
  state.regions = [...DEFAULT_REGIONS];
  state.families = [];
  state.persons = [];
  state.originOptions = [...DEFAULT_ORIGINS];
  state.territoryOptions = [...DEFAULT_TERRITORIES];
  state.occOptions = [...DEFAULT_OCCS];
  state.resOptions = [...DEFAULT_RES];
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
  if (state.persons.length < 2) return "宗族中尚無足夠成員可安排婚事。";
  const p1 = pickPersonByRegion(regionId);
  let others = state.persons.filter(p => p.id !== p1.id);
  const p2 = pickRandom(others);
  if (!p2) return "宗族中成員尚少，婚事難以成局。";
  const f1 = p1.familyId && state.families.find(f => f.id === p1.familyId);
  const f2 = p2.familyId && state.families.find(f => f.id === p2.familyId);
  const regionName = regionId ? (getRegionName(regionId) || "某地") : "各地";
  return `${regionName}傳來婚事：有媒人上門，提議讓「${p1.name}${f1 ? "（" + f1.name + "）" : ""}」與「${p2.name}${f2 ? "（" + f2.name + "）" : ""}」結親。家主可視情況在人物詳情中正式訂下婚約。`;
}

function genBirthEvent(regionId) {
  if (!state.persons.length) return "尚無適齡族人，子嗣誕生只停留在傳說之中。";
  const parent = pickPersonByRegion(regionId);
  const f = parent.familyId && state.families.find(f => f.id === parent.familyId);
  const regionName = regionId ? (getRegionName(regionId) || "某地") : "某地";
  return `${regionName}夜裡星象異動，似有新生之兆。占星師推算，與「${parent.name}${f ? "（" + f.name + "）" : ""}」血脈相連的子嗣將在不久後降臨。家主可考慮以此人為父母，建立新一代族人。`;
}

function genConflictEvent(regionId) {
  if (!state.families.length) return "尚未有家族立足天下，暫無內鬥可言。";
  const fam = pickFamilyByRegion(regionId);
  const regionName = fam ? (getRegionName(fam.regionId) || "某地") : "某地";
  const members = state.persons.filter(p => p.familyId === (fam ? fam.id : null));
  if (members.length < 2) return `${regionName}的「${fam.name}」成員尚少，紛爭多半被壓在暗處。`;
  const a = pickRandom(members);
  const others = members.filter(x => x.id !== a.id);
  const b = pickRandom(others);
  return `${regionName}的「${fam.name}」近來暗潮洶湧，「${a.name}」與「${b.name}」因家產、職權或婚事產生嫌隙。家主可在兩人間安排職責或聯姻，以化解或加劇這場糾紛。`;
}

function genAllianceEvent(regionId) {
  if (state.families.length < 2) return "目前記載家族仍少，尚難談論結盟。";
  let fams = state.families;
  if (regionId) {
    const inR = state.families.filter(f => f.regionId === regionId);
    if (inR.length >= 2) fams = inR;
  }
  const f1 = pickRandom(fams);
  let f2 = pickRandom(fams.filter(f => f.id !== f1.id));
  if (!f2) f2 = f1;
  const regionName = regionId ? (getRegionName(regionId) || "各地") : "各地";
  return `${regionName}之間出現合作契機：「${f1.name}」與「${f2.name}」或因商路相連，或因邊境同守，若家主以聯姻或職務任命強化往來，此二家族或可結成堅實盟友。`;
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
    default: text = "命運似乎在猶豫，暫時沒有明顯的事件降臨。";
  }
  const fullText = `【星曆 ${state.gameYear} 年事件】${text}`;
  pendingEvent = fullText;
  pendingEventKind = kind;
  const modal = $("eventModal");
  const body = $("eventText");
  const sel = $("eventDecision");
  body.textContent = fullText;
  sel.innerHTML = "";
  const options = buildDecisionOptions(kind);
  options.forEach((d, idx) => {
    const opt = document.createElement("option");
    opt.value = String(idx);
    opt.textContent = d;
    sel.appendChild(opt);
  });
  modal.classList.remove("hidden");
}

function closeEventModal() {
  $("eventModal").classList.add("hidden");
  pendingEvent = null;
  pendingEventKind = null;
}

// ---------- 輔佐官 ----------
function findPersonsByName(name) {
  const k = (name || "").trim();
  if (!k) return [];
  const exact = state.persons.filter(p => p.name === k);
  if (exact.length) return exact;
  return state.persons.filter(p => p.name.includes(k));
}

function advisorSearchName(name) {
  const k = (name || "").trim();
  if (!k) {
    advisorSay("請先輸入要查詢的姓名。");
    return;
  }
  const list = findPersonsByName(k);
  if (!list.length) {
    advisorSay(`未在宗族之書中查得名為「${k}」之人。`);
    return;
  }
  const p = list[0];
  state.selectedPersonId = p.id;
  state.selectedFamilyId = p.familyId || null;
  renderFamilies();
  renderFamilyDetail();
  renderPersonDetail();
  if (list.length === 1) {
    advisorSay(`已為家主調出「${p.name}」的詳細資料。`);
  } else {
    advisorSay(`已優先為家主調出「${p.name}」，另有同名或相近姓名者共 ${list.length - 1} 人。`);
  }
}

function advisorSearchLocation(loc) {
  const k = (loc || "").trim();
  if (!k) {
    advisorSay("請先選擇地點或區域。");
    return;
  }
  const region = state.regions.find(r => r.name === k);
  if (region) {
    const families = state.families.filter(f => f.regionId === region.id);
    const ids = families.map(f => f.id);
    const persons = state.persons.filter(p => ids.includes(p.familyId));
    if (!families.length && !persons.length) {
      advisorSay(`「${region.name}」目前尚無明確登記的家族與人物。`);
      return;
    }
    let msg = `在區域「${region.name}」中，已登記家族 ${families.length} 戶、族人 ${persons.length} 人。`;
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
  const families = state.families.filter(f =>
    (f.territory && f.territory.includes(k)) || (f.name && f.name.includes(k))
  );
  const persons = state.persons.filter(p =>
    (p.residence && p.residence.includes(k))
  );
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
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) {
    advisorSay("請正確填寫年齡區間。");
    return;
  }
  const hits = state.persons.filter(p => {
    const age = getAge(p);
    if (age == null) return false;
    return age >= a && age <= b;
  });
  if (!hits.length) {
    advisorSay(`在 ${a}～${b} 歲之間，尚未找到符合條件的族人（或未登記出生年份）。`);
    return;
  }
  const sample = hits.slice(0, 6).map(p => {
    const age = getAge(p);
    const fam = p.familyId && state.families.find(f => f.id === p.familyId);
    return `${p.name}（${p.gender || "性別未記"}，${age} 歲${p.deceased ? "，已逝" : ""}${fam ? "｜" + fam.name : ""}）`;
  }).join("、");
  advisorSay(`目前星曆 ${state.gameYear} 年，在 ${a}～${b} 歲區間共 ${hits.length} 位族人，例如：${sample}。`);
  state.selectedPersonId = hits[0].id;
  state.selectedFamilyId = hits[0].familyId || null;
  renderFamilies();
  renderFamilyDetail();
  renderPersonDetail();
}

function advisorWorldSummary() {
  const fCount = state.families.length;
  const pCount = state.persons.length;
  if (!fCount && !pCount) {
    advisorSay("宗族之書尚屬白紙。家主只要建立第一個家族與族人，一切故事便會展開。");
    return;
  }
  const parts = [];
  parts.push(`目前世界年份為星曆 ${state.gameYear} 年，記載家族 ${fCount} 戶，族人 ${pCount} 人。`);
  if (fCount) {
    const top = state.families
      .map(f => ({ f, c: state.persons.filter(p => p.familyId === f.id).length }))
      .sort((a,b) => b.c - a.c)[0];
    if (top) parts.push(`其中以「${top.f.name}」人丁最為興旺，登記成員 ${top.c} 人。`);
  }
  const married = state.persons.filter(p => p.spouseIds && p.spouseIds.length).length;
  if (married) parts.push(`目前已有 ${married} 名族人締結婚約，宗族之間的關係網逐漸成形。`);
  else parts.push("尚未有正式婚配紀錄，若家主安排幾樁聯姻，局勢將更為有趣。");
  const dead = state.persons.filter(p => p.deceased).length;
  if (dead) parts.push(`歷年累計已有 ${dead} 位族人於此時間線中謝世，成為族史的一部份。`);
  const activeRegions = state.regions
    .map(r => {
      const fams = state.families.filter(f => f.regionId === r.id);
      const ids = fams.map(f => f.id);
      const persons = state.persons.filter(p => ids.includes(p.familyId));
      return { r, fams, persons };
    })
    .filter(x => x.fams.length);
  if (activeRegions.length) {
    const topR = activeRegions.sort((a,b) => b.persons.length - a.persons.length)[0];
    parts.push(`從版圖來看，以「${topR.r.name}」最為熱鬧，已有 ${topR.fams.length} 戶家族、約 ${topR.persons.length} 名族人活動其間。`);
  }
  advisorSay(parts.join(""));
}

function advisorLife(name) {
  const list = findPersonsByName(name);
  if (!list.length) {
    advisorSay(`未找到名為「${name}」之人，無法評估壽命。`);
    return;
  }
  const p = list[0];
  if (!p.deathYear) {
    advisorSay(`「${p.name}」尚未標記預期死亡年份，可透過指令「改人物死亡年份 姓名 年份」設定。`);
    state.selectedPersonId = p.id;
    state.selectedFamilyId = p.familyId || null;
    renderFamilies(); renderFamilyDetail(); renderPersonDetail();
    return;
  }
  const age = p.birthYear != null ? (p.deathYear - p.birthYear) : null;
  if (age != null) advisorSay(`依目前記錄，「${p.name}」預計卒於星曆 ${p.deathYear} 年，約享年 ${age} 歲。`);
  else advisorSay(`依目前記錄，「${p.name}」預計卒於星曆 ${p.deathYear} 年，具體享年尚不可知。`);
  state.selectedPersonId = p.id;
  state.selectedFamilyId = p.familyId || null;
  renderFamilies(); renderFamilyDetail(); renderPersonDetail();
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
  m = text.match(/^查齡\s+(\d+)\s*-\s*(\d+)$/);
  if (m) {
    advisorSearchAge(m[1], m[2]);
    input.value = "";
    return;
  }
  m = text.match(/^壽命\s+(.+)$/);
  if (m) {
    advisorLife(m[1]);
    input.value = "";
    return;
  }
  m = text.match(/^預期壽命\s+(.+)$/);
  if (m) {
    advisorLife(m[1]);
    input.value = "";
    return;
  }
  m = text.match(/^(年\+|year\+)\s*(\d+)$/i);
  if (m) {
    const d = Number(m[2]);
    setGameYear(state.gameYear + d);
    advisorSay(`時光向前推進 ${d} 年，來到星曆 ${state.gameYear} 年。`);
    input.value = "";
    return;
  }
  m = text.match(/^(年\-|year\-)\s*(\d+)$/i);
  if (m) {
    const d = Number(m[2]);
    setGameYear(state.gameYear - d);
    advisorSay(`時光倒退 ${d} 年，回到星曆 ${state.gameYear} 年。`);
    input.value = "";
    return;
  }
  m = text.match(/^(年份|year)\s+(\d{1,4})$/i);
  if (m) {
    const y = Number(m[2]);
    setGameYear(y);
    advisorSay(`已將世界年份調整為星曆 ${state.gameYear} 年。`);
    input.value = "";
    return;
  }
  m = text.match(/^改家族區域\s+(\S+)\s+(\S+)$/);
  if (m) {
    const famName = m[1];
    const regionName = m[2];
    const fam = state.families.find(f => f.name === famName || f.name.includes(famName));
    if (!fam) {
      advisorSay(`未找到名為「${famName}」的家族。`);
    } else {
      const region = state.regions.find(r => r.name === regionName);
      if (!region) advisorSay(`未找到名稱為「${regionName}」的區域。`);
      else {
        fam.regionId = region.id;
        if (fam.territory) {
          const terr = getTerritoryObj(fam.territory);
          if (terr && terr.regionId && terr.regionId !== fam.regionId) {
            fam.territory = "";
          }
        }
        saveState();
        renderFamilies(); renderFamilyDetail(); renderRegions(); renderOptionOverview();
        advisorSay(`已將「${fam.name}」所屬區域改為「${region.name}」。`);
      }
    }
    input.value = "";
    return;
  }
  m = text.match(/^改家族據點\s+(\S+)\s+(.+)$/);
  if (m) {
    const famName = m[1];
    const terrName = m[2].trim();
    const fam = state.families.find(f => f.name === famName || f.name.includes(famName));
    if (!fam) advisorSay(`未找到名為「${famName}」的家族。`);
    else {
      const result = ensureTerritoryForRegion(terrName, fam.regionId);
      if (result !== null) {
        fam.territory = result;
        saveState();
        renderOptionSelects(); renderFamilies(); renderFamilyDetail(); renderRegions(); renderOptionOverview();
        advisorSay(`已將「${fam.name}」據點改為「${terrName}」。`);
      }
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
      renderFamilies(); renderFamilyDetail(); renderPersonDetail();
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
        renderPersonDetail(); renderFamilyDetail();
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
    if (!parents.length) advisorSay(`未找到名為「${parentName}」之父母候選。`);
    else if (!childs.length) advisorSay(`未找到名為「${childName}」之子女。`);
    else {
      const parent = parents[0];
      const child = childs[0];
      if (linkParentChild(parent, child, { ignoreRule: false })) {
        saveState();
        advisorSay(`已將「${child.name}」標記為「${parent.name}」的子女之一。`);
        state.selectedPersonId = child.id;
        renderPersonDetail(); renderFamilyDetail();
      }
    }
    input.value = "";
    return;
  }
  m = text.match(/^改人物死亡年份\s+(\S+)\s+(\d{1,4})$/);
  if (m) {
    const name = m[1];
    const year = Number(m[2]);
    const persons = findPersonsByName(name);
    if (!persons.length) advisorSay(`未找到名為「${name}」之人。`);
    else {
      const p = persons[0];
      p.deathYear = year;
      if (year <= state.gameYear) p.deceased = true;
      saveState();
      advisorSay(`已為「${p.name}」標記死亡年份為星曆 ${year} 年。`);
      state.selectedPersonId = p.id;
      state.selectedFamilyId = p.familyId || null;
      renderPersonDetail(); renderFamilyDetail();
    }
    input.value = "";
    return;
  }
  m = text.match(/^事件\s*(.+)?$/);
  if (m) {
    let kindRaw = (m[1] || "").trim();
    let kind = "random";
    if (!kindRaw || kindRaw === "隨機") kind = "random";
    else if (/聯姻|婚/.test(kindRaw)) kind = "marriage";
    else if (/子嗣|誕生|出生/.test(kindRaw)) kind = "birth";
    else if (/內鬥|紛爭|衝突/.test(kindRaw)) kind = "conflict";
    else if (/結盟|合作/.test(kindRaw)) kind = "alliance";
    else if (/災|災異|災害/.test(kindRaw)) kind = "disaster";
    else if (/繼承|分家/.test(kindRaw)) kind = "inheritance";
    advisorSay("已開始推演此一事件，請在彈出視窗中決定處置方式。");
    triggerEvent(kind);
    input.value = "";
    return;
  }

  advisorSay("此指令格式我一時難以解讀，家主可改用：查人／查地／查齡／年+N／年份 Y／事件 …… 等格式。");
}

// ---------- 初始化 ----------
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

  renderRegions();

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
    if (!name.trim()) { alert("請輸入家族名稱。"); return; }
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
    if (!name.trim()) { alert("請輸入姓名。"); return; }
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
  $("yearPlus10Btn").addEventListener("click", () => setGameYear(state.gameYear + 10));
  $("yearResetBtn").addEventListener("click", () => setGameYear(INITIAL_YEAR));

  $("exportBtn").addEventListener("click", exportGame);
  $("importBtn").addEventListener("click", () => $("importFile").click());
  $("importFile").addEventListener("change", e => {
    const file = e.target.files[0];
    if (file) importGame(file);
    e.target.value = "";
  });
  $("resetBtn").addEventListener("click", resetGame);

  $("advisorSearchBtn").addEventListener("click", () => advisorSearchName($("advisorSearchName").value));
  $("advisorLocationBtn").addEventListener("click", () => advisorSearchLocation($("advisorLocation").value));
  $("advisorAgeBtn").addEventListener("click", () => advisorSearchAge($("ageMin").value, $("ageMax").value));
  $("advisorCommandBtn").addEventListener("click", () => handleAdvisorCommand($("advisorCommand").value));
  $("worldSummaryBtn").addEventListener("click", advisorWorldSummary);

  $("triggerEventBtn").addEventListener("click", () => {
    const type = $("eventType").value || "random";
    triggerEvent(type);
  });
  $("eventCancel").addEventListener("click", () => {
    advisorSay("此次事件暫不處理，僅記錄於心。");
    closeEventModal();
  });
  $("eventConfirm").addEventListener("click", () => {
    if (!pendingEvent) { closeEventModal(); return; }
    const decisionIdx = Number($("eventDecision").value || 0);
    const options = buildDecisionOptions(pendingEventKind || "other");
    const decision = options[decisionIdx] || options[0] || "記錄於宗族之書";
    advisorSay(`【事件紀錄】${pendingEvent} 家主決定：「${decision}」。`);
    closeEventModal();
  });
}

document.addEventListener("DOMContentLoaded", init);
