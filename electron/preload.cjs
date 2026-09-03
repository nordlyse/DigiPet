const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("digipet", {
  desktop: true,
  getConfig: () => ipcRenderer.invoke("get-config"),
  completeOnboarding: (species) => ipcRenderer.invoke("complete-onboarding", species),
  setSpecies: (species) => ipcRenderer.invoke("set-species", species),
  setVolume: (volume) => ipcRenderer.invoke("set-volume", volume),
  openPicker: () => ipcRenderer.invoke("open-picker"),
  readyOverlay: () => ipcRenderer.invoke("ready-overlay"),
  updateHitRegions: (regions) => ipcRenderer.send("hit-regions", regions),
  openChat: () => ipcRenderer.invoke("open-chat"),
  closeChat: () => ipcRenderer.invoke("close-chat"),
  petSay: (text) => ipcRenderer.send("pet-say", text),
  onPetSay: (cb) => {
    const fn = (_e, text) => cb(text);
    ipcRenderer.on("pet-say", fn);
    return () => ipcRenderer.removeListener("pet-say", fn);
  },
  onDesktop: (cb) => {
    const fn = (_e, data) => cb(data);
    ipcRenderer.on("desktop-state", fn);
    return () => ipcRenderer.removeListener("desktop-state", fn);
  },
  onSpecies: (cb) => {
    const fn = (_e, id) => cb(id);
    ipcRenderer.on("species-changed", fn);
    return () => ipcRenderer.removeListener("species-changed", fn);
  },
  onVolume: (cb) => {
    const fn = (_e, v) => cb(v);
    ipcRenderer.on("volume-changed", fn);
    return () => ipcRenderer.removeListener("volume-changed", fn);
  },
});
