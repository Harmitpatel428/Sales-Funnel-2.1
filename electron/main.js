const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const url = require('url');
const express = require('express');

// Global variables
let mainWindow;
let server;
let port = 3000;

// Express server setup for production
function createServer() {
  const expressApp = express();
  
  // Serve static files from the packaged app
  const staticPath = path.join(process.resourcesPath, 'app');
  expressApp.use(express.static(staticPath));
  
  // Fallback route for client-side routing
  expressApp.get('*', (req, res) => {
    res.sendFile(path.join(staticPath, 'index.html'));
  });
  
  // Start server
  server = expressApp.listen(port, () => {
    console.log(`Express server running on port ${port}`);
  });
  
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} is in use, trying port ${port + 1}...`);
      port = port + 1;
      server = expressApp.listen(port, () => {
        console.log(`Express server running on port ${port}`);
      });
    } else {
      console.error('Server error:', err);
    }
  });
}

// Create the main window
function createWindow() {
  // Create the browser window
  const windowOptions = {
    width: 1280,
    height: 800,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      spellcheck: false // Performance optimization for low-end systems
    },
    title: 'Enterprise Lead Management System',
    show: false // Don't show until ready
  };

  // Only set icon in development mode
  if (!app.isPackaged) {
    windowOptions.icon = path.join(__dirname, '../build/icon.ico');
  }

  mainWindow = new BrowserWindow(windowOptions);

  // Load the app
  if (app.isPackaged) {
    // Production: Start Express server first, then load
    createServer();
    setTimeout(() => {
      mainWindow.loadURL(`http://localhost:${port}`);
      mainWindow.show();
    }, 500);
  } else {
    // Development: Load from Next.js dev server
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.show();
    // Open DevTools in development
    mainWindow.webContents.openDevTools();
  }

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle window ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
}

// Create application menu
function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: 'Copy', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: 'Paste', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { label: 'Select All', accelerator: 'CmdOrCtrl+A', role: 'selectall' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: 'Force Reload', accelerator: 'CmdOrCtrl+Shift+R', role: 'forceReload' },
        { type: 'separator' },
        { label: 'Actual Size', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
        { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { type: 'separator' },
        { label: 'Toggle Fullscreen', accelerator: 'F11', role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About Enterprise Lead Management System',
          click: () => {
            const { dialog } = require('electron');
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About',
              message: 'Enterprise Lead Management System',
              detail: 'Version 2.0.0\nProfessional CRM and Lead Management Solution\n\n© 2025 V4U Technologies'
            });
          }
        }
      ]
    }
  ];

  // Add DevTools menu item in development
  if (!app.isPackaged) {
    template[2].submenu.push(
      { type: 'separator' },
      { label: 'Toggle Developer Tools', accelerator: 'F12', role: 'toggleDevTools' }
    );
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// App event handlers
app.whenReady().then(() => {
  createWindow();
  createMenu();

  app.on('activate', () => {
    // On macOS, re-create window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  // On macOS, keep app running even when all windows are closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle app quit
app.on('before-quit', () => {
  if (server) {
    server.close();
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
  });
});
