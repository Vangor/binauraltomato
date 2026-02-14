const { ipcRenderer } = require('electron')

ipcRenderer.on('session-end-signal', () => {
  window.dispatchEvent(new Event('session-end-signal'))
})
