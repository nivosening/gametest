// js/advisor.js - wrapper around original game.js advisor command handler
(function(){
  window.AdvisorModule = {
    process(text) {
      if (typeof handleAdvisorCommand === "function") {
        handleAdvisorCommand(text);
      } else {
        console.warn("handleAdvisorCommand not found.");
      }
    }
  };
})();
