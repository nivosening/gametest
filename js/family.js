// js/family.js - wrapper around original game.js family helpers
(function(){
  if (typeof window.state === "undefined") {
    console.warn("Game state not found; make sure game.js is loaded first.");
    return;
  }

  function getFamilyById(id) {
    return (state.families || []).find(f => f.id === id) || null;
  }

  function getFamilyMembers(familyId) {
    return (state.persons || []).filter(p => p.familyId === familyId);
  }

  window.FamilyModule = {
    createFamily(data) {
      if (typeof addFamily === "function") {
        return addFamily(data);
      }
      console.warn("addFamily not found.");
      return null;
    },
    quickCreateFamily(data) {
      if (typeof quickCreateFamily === "function") {
        return quickCreateFamily(data);
      }
      console.warn("quickCreateFamily not found.");
      return null;
    },
    getFamily(id) {
      return getFamilyById(id);
    },
    getAllFamilies() {
      return (state.families || []).slice();
    },
    getFamilyMembers(familyId) {
      return getFamilyMembers(familyId);
    }
  };
})();
