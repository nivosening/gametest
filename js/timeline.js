// js/timeline.js - wrapper around original game.js year controls
(function(){
  if (typeof window.state === "undefined") {
    console.warn("Game state not found; make sure game.js is loaded first.");
    return;
  }

  window.TimelineModule = {
    getYear() {
      return state.gameYear;
    },
    setYear(y) {
      if (typeof setGameYear === "function") {
        setGameYear(y);
      } else {
        state.gameYear = Number(y) || state.gameYear;
      }
    },
    addYear(delta) {
      const y = (state.gameYear || 0) + Number(delta || 0);
      this.setYear(y);
    },
    resetYear() {
      if (typeof INITIAL_YEAR !== "undefined") {
        this.setYear(INITIAL_YEAR);
      }
    }
  };
})();
