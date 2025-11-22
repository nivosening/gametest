// js/person.js - wrapper around original game.js person helpers
(function(){
  if (typeof window.state === "undefined") {
    console.warn("Game state not found; make sure game.js is loaded first.");
    return;
  }

  function getPersonById(id) {
    return (state.persons || []).find(p => p.id === id) || null;
  }

  window.PersonModule = {
    addPerson(data) {
      if (typeof addPerson === "function") {
        return addPerson(data);
      }
      console.warn("addPerson not found.");
      return null;
    },
    getPerson(id) {
      return getPersonById(id);
    },
    getAllPersons() {
      return (state.persons || []).slice();
    },
    searchByName(keyword) {
      const key = (keyword || "").trim();
      if (!key) return [];
      return (state.persons || []).filter(p => (p.name || "").includes(key));
    }
  };
})();
