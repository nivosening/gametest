// js/ui.js - minimal shim; original UI is handled entirely in game.js (init)
(function(){
  window.UIModule = {
    init() {
      // 原本的 init() 已由 game.js 在 DOMContentLoaded 綁定執行
      // 這裡保留接口給未來需要的人使用。
      console.log("UIModule.init() called - original UI 由 game.js 控制。");
    }
  };
})();
