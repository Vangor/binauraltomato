const { app, BrowserWindow, protocol, net } = require('electron')
const path = require('path')
const fs = require('fs')
const { pathToFileURL } = require('url')

const isDev = process.env.NODE_ENV === 'development'
const distDir = path.join(__dirname, '..', 'dist')
const distIndexPath = path.join(distDir, 'index.html')

function log(...args) {
  console.log('[electron]', ...args)
}

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, supportFetchAPI: true, secure: true } },
])

function createWindow() {
  log('createWindow', { isDev, distIndexPath, distExists: fs.existsSync(distIndexPath) })

  const win = new BrowserWindow({
    title: 'FocusForge',
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true,
    },
    backgroundColor: '#0f172a',
    titleBarStyle: 'hiddenInset',
  })

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    log('did-fail-load', { errorCode, errorDescription, validatedURL })
  })

  win.webContents.on('render-process-gone', (_event, details) => {
    log('render-process-gone', details)
  })

  win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    if (level >= 3) log('renderer', message, sourceId, line)
  })

  if (isDev) {
    log('loading dev URL http://localhost:5173')
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    log('loading app://./index.html')
    win.loadURL('app://./index.html').catch((err) => {
      log('loadURL error:', err.message)
    })
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.whenReady().then(() => {
  if (!isDev) {
    protocol.handle('app', (request) => {
      const u = new URL(request.url)
      let p = u.pathname.replace(/^\/+/, '').replace(/^\.\//, '') || 'index.html'
      if (p === 'registerSW.js' || p === 'sw.js') {
        return new Response('/* Service worker disabled in Electron */', {
          headers: { 'Content-Type': 'application/javascript' },
        })
      }
      const filePath = path.resolve(distDir, p)
      if (!filePath.startsWith(distDir)) {
        log('protocol block path escape', p)
        return new Response('', { status: 403 })
      }
      if (!fs.existsSync(filePath)) {
        log('protocol file not found', filePath)
        return new Response('', { status: 404 })
      }
      return net.fetch(pathToFileURL(filePath).toString())
    })
  }
  log('app ready')
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
}).catch((err) => {
  log('app.whenReady failed:', err)
})

process.on('uncaughtException', (err) => {
  log('uncaughtException:', err)
})
process.on('unhandledRejection', (reason, promise) => {
  log('unhandledRejection:', reason)
})
