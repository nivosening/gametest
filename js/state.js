// js/state.js - wrapper around original game.js state
(function(){
  if (typeof window.state === "undefined") {
    console.warn("Game state not found; make sure game.js is loaded first.");
    return;
  }

  window.GameState = {
    get raw() { return state; },
    get families() { return state.families || []; },
    get persons() { return state.persons || []; },
    get regions() { return state.regions || []; },
    get origins() { return state.originOptions || []; },
    get territories() { return state.territoryOptions || []; },
    get occupations() { return state.occOptions || []; },
    get residences() { return state.resOptions || []; },
    get worldYear() { return state.gameYear; },
    set worldYear(v) {
      if (typeof setGameYear === "function") {
        setGameYear(v);
      } else {
        state.gameYear = v;
      }
    },
    loadFromLocal() {
      if (typeof loadState === "function") loadState();
    },
    saveToLocal() {
      if (typeof saveState === "function") saveState();
    },
    resetAll() {
      if (typeof resetGame === "function") resetGame();
    }
  };
})();
