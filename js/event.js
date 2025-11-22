// js/event.js - wrapper around original game.js event system
(function(){
  window.EventModule = {
    trigger(type) {
      const t = type || "random";
      if (typeof triggerEvent === "function") {
        triggerEvent(t);
      } else {
        console.warn("triggerEvent not found.");
      }
    }
  };
})();
