const { contextBridge, ipcRenderer } = require("electron")

contextBridge.exposeInMainWorld("tabs", {
  switch_tab: () => ipcRenderer.send("switch_tab", ""),
  toggle_keyboard: () => ipcRenderer.send("keyboard", ""),
  screensaver_off: () => ipcRenderer.send("screensaver_off", ""),
})