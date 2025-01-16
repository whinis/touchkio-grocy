const path = require("path");
const hardware = require("./hardware");
const integration = require("./integration");
const { app, screen, nativeTheme, BaseWindow, WebContentsView,protocol,net } = require("electron");
let fs = require("fs")

global.WEBVIEW = global.WEBVIEW || {
  initialized: false,
  status: "offline",
  locked: false,
  pointer: {
    position: {},
    time: new Date(),
  },
};

//register an IPC to allow tab to be swtiched between "tabs"
const electron = require('electron');
const url = require("node:url");
electron.ipcMain.on("switch_tab", () => {
  if(WEBVIEW.currentWindow === "ha"){
    WEBVIEW.window.contentView.removeChildView(WEBVIEW.HA);
    WEBVIEW.window.contentView.addChildView(WEBVIEW.GR);
    WEBVIEW.currentWindow = "gr"
  }else{
    WEBVIEW.window.contentView.removeChildView(WEBVIEW.GR);
    WEBVIEW.window.contentView.addChildView(WEBVIEW.HA);
    WEBVIEW.currentWindow = "ha"
  }
})

//register an IPC to allow the keyboard to be toggled
electron.ipcMain.on("keyboard", () => {
  console.log("Switching Keyboard")
  console.log(hardware.getKeyboardVisibility())
  if (hardware.getKeyboardVisibility() === "OFF") {
    hardware.setKeyboardVisibility("ON")
  }else{
    hardware.setKeyboardVisibility("OFF")
  }
  switch (hardware.getKeyboardVisibility()) {
    case "OFF":
      WEBVIEW.window.restore();
      WEBVIEW.window.unmaximize();
      WEBVIEW.window.setFullScreen(true);
      break;
    case "ON":
      WEBVIEW.window.restore();
      WEBVIEW.window.setFullScreen(false);
      WEBVIEW.window.maximize();
      break;
  }
})


/**
 * First, you need to register your scheme before the app starts.
 */
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: {
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true
    }
  },
  {
    scheme: 'screensaver',
    privileges: {
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true
    }
  }
]);


/**
 * This promise resolves when the app has finished initializing,
 * allowing to safely create browser windows and perform other
 * initialization tasks.
 */
app.whenReady().then(async () => {
  const url = require('node:url')
  /**
   * If a request is made over the media protocol, you can hook it here.
   * In my case, I'm creating a new request by switching to the file protocol to call a local file.
   */
  protocol.handle('media', (req) => {
    let filePath = req.url.slice('media://'.length)
    if(filePath.includes("/")){
      filePath = filePath.substring(filePath.lastIndexOf("/") + 1)
    }
    console.log(`[${filePath}] ${req.url}`);
    return net.fetch(url.pathToFileURL(path.join(__dirname,"..","img", filePath)).toString())
  });
  //returns random image from directory
  protocol.handle('screensaver', (req) => {
    let files = []
    let dir = WEBVIEW.screensaver.directory
    //if directory exists use it, otherwise go to img directory
    if(fs.existsSync(WEBVIEW.screensaver.directory)){
      files = fs.readdirSync(WEBVIEW.screensaver.directory)
    }else{
      dir=path.join(__dirname,"..","img")
    }

    //if we had no screen saver images just use the default image
    if(files.length ===0){
      dir=path.join(__dirname,"..","img")
      files = ['default-ss.png']
    }
    files.sort()
    files = files.filter(x => /\.(png|jpg|jpeg|gif)/i.test(x)).map(x => path.join(dir, x))
    return net.fetch(url.pathToFileURL(files[Math.floor(Math.random()*files.length)]).toString())
  });
});

/**
 * Initializes the webview with the provided arguments.
 *
 * @param {Object} args - The command-line arguments to customize the initialization process.
 * @returns {boolean} Returns true if the initialization was successful.
 */
const init = async (args) => {
  if (!args.web_url) {
    console.error("Please provide the '--web-url' parameter");
    return app.quit();
  }
  const url = new URL(args.web_url);

  if (!args.web_url2) {
    console.error("Please provide the '--web-url2' parameter");
    return app.quit();
  }
  const url2 = new URL(args.web_url2);
  console.log(args)
  const theme = args.web_theme ? args.web_theme : "dark";
  const zoom = args.web_zoom ? parseFloat(args.web_zoom) : 1.25;
  const screensaver_time = args.screensaver_time ? parseInt(args.screensaver_time) : 0;
  const screensaver_directory = args.screensaver_directory ? args.screensaver_directory : "/home/pi/pictures";

  // Init global root window
  nativeTheme.themeSource = theme;
  WEBVIEW.window = new BaseWindow({
    title: `TouchKio - ${url.host}`,
    icon: path.join(__dirname, "..", "img", "icon.png"),
  });
  WEBVIEW.window.setMenuBarVisibility(false);
  WEBVIEW.window.setFullScreen(true);

  // Init global main webview
  WEBVIEW.HA = new WebContentsView();
  WEBVIEW.HA.webContents.loadURL(url.toString());

  WEBVIEW.GR = new WebContentsView();
  WEBVIEW.GR.webContents.loadURL(url2.toString());

  WEBVIEW.sidebar = new WebContentsView({
      webPreferences: {
        nodeIntegration: false, // is default value after Electron v5
        contextIsolation: true, // protect against prototype pollution
        enableRemoteModule: false, // turn off remote
        preload: path.join(__dirname, 'preload.js')
      }
  });
  WEBVIEW.sidebar.webContents.loadFile( path.join(__dirname,"side-bar.html"));
  //WEBVIEW.sidebar.webContents.openDevTools();

  WEBVIEW.screensaver = new WebContentsView({
    webPreferences: {
      nodeIntegration: false, // is default value after Electron v5
      contextIsolation: true, // protect against prototype pollution
      enableRemoteModule: false, // turn off remote
      preload: path.join(__dirname, 'preload.js')
    }
  });
  WEBVIEW.screensaver.directory = screensaver_directory
  WEBVIEW.screensaver.screensaver_time = screensaver_time
  WEBVIEW.screensaver.screensaver_active = false
  WEBVIEW.screensaver.webContents.loadFile( path.join(__dirname,"screensaver.html"));

  WEBVIEW.window.contentView.addChildView(WEBVIEW.HA);
  WEBVIEW.window.contentView.addChildView(WEBVIEW.sidebar);
  WEBVIEW.currentWindow="ha"

  // Register events
  windowEvents(WEBVIEW.window, zoom);
  touchEvents(WEBVIEW.window);
  viewEvents(WEBVIEW.HA);
  viewEvents(WEBVIEW.GR,false);
  viewEvents(WEBVIEW.sidebar,false);

  return true;
};

/**
 * Updates the shared webview properties.
 */
const update = () => {
  if (!WEBVIEW.initialized) {
    return;
  }

  // Update window status
  if (WEBVIEW.window.isFullScreen()) {
    WEBVIEW.status = "Fullscreen";
  } else if (WEBVIEW.window.isMinimized()) {
    WEBVIEW.status = "Minimized";
  } else if (WEBVIEW.window.isMaximized()) {
    WEBVIEW.status = "Maximized";
  } else {
    WEBVIEW.status = "Framed";
  }

  // Update integration sensor
  console.log("Update Kiosk Status:", WEBVIEW.status);
  integration.update();
};

/**
 * Register window events and handler.
 *
 * @param {Object} window - The root window object.
 * @param {number} zoom - Zoom level used for the webview.
 */
const windowEvents = (window, zoom) => {
  // Handle window resize for webview bounds
  const resize = () => {
    const { width, height } = window.getBounds();
    WEBVIEW.sidebar.setBounds({ x: width -80, y: 0, width: 80, height: height })
    WEBVIEW.HA.setBounds({ x: 0, y: 0, width: width -80, height: height })
    WEBVIEW.HA.webContents.setZoomFactor(zoom);
    WEBVIEW.GR.setBounds({ x: 0, y: 0, width: width -80, height: height })
    WEBVIEW.GR.webContents.setZoomFactor(zoom);
    WEBVIEW.screensaver.setBounds({ x: 0, y: 0, width: width, height: height })
  };
  console.log("Resizing...");
  window.on("ready-to-show", resize);
  window.on("resize", resize);
  resize();

  // Handle window status updates
  window.on("minimize", update);
  window.on("restore", update);
  window.on("maximize", update);
  window.on("unmaximize", update);
  window.on("enter-full-screen", update);
  window.on("leave-full-screen", update);

  // Handle signal and exit events
  process.on("SIGINT", app.quit);
  app.on("before-quit", () => {
    WEBVIEW.status = "Terminated";
    integration.update();
  });

  // Handle multiple instances
  app.on("second-instance", () => {
    if (window.isMinimized()) {
      window.restore();
    }
    window.focus();
  });
};

/**
 * Register touch events and handler.
 *
 * @param {Object} window - The root window object.
 */
const touchEvents = (window) => {
  // Handle focus change for webview lock
  window.on("focus", () => {
    if (WEBVIEW.locked) {
      hardware.setDisplayStatus("ON");
      window.blur();
    }
    WEBVIEW.locked = false;
  });
  HARDWARE.display.notifiers.push(() => {
    WEBVIEW.locked = hardware.getDisplayStatus() === "OFF";
    if (WEBVIEW.locked) {
      window.blur();
    }
  });

  // Handle touch events for activity tracking
  setInterval(() => {
    const posOld = WEBVIEW.pointer.position;
    const posNew = screen.getCursorScreenPoint();
    const now = new Date();
    const then = WEBVIEW.pointer.time;
    //activate screen saver if enabled
    if (WEBVIEW.screensaver.screensaver_time > 0 && Math.abs(now - then) / 1000 > WEBVIEW.screensaver.screensaver_time && !WEBVIEW.screensaver.screensaver_active){
      if(WEBVIEW.currentWindow === "ha"){
        WEBVIEW.window.contentView.removeChildView(WEBVIEW.HA);
      }else{
        WEBVIEW.window.contentView.removeChildView(WEBVIEW.GR);
      }
      WEBVIEW.window.contentView.removeChildView(WEBVIEW.sidebar);
      WEBVIEW.window.contentView.addChildView(WEBVIEW.screensaver);
      WEBVIEW.screensaver.screensaver_active = true
    }
    if (posOld.x !== posNew.x || posOld.y !== posNew.y) {
      // Update integration sensor
      WEBVIEW.pointer.time = now;
      if (Math.abs(now - then) / 1000 > 30) {
        console.log("Update Last Active");
        integration.update();
      }
      WEBVIEW.screensaver.screensaver_active = false
      if(WEBVIEW.currentWindow === "ha"){
        WEBVIEW.window.contentView.addChildView(WEBVIEW.HA);
      }else{
        WEBVIEW.window.contentView.addChildView(WEBVIEW.GR);
      }
      WEBVIEW.window.contentView.addChildView(WEBVIEW.sidebar);
      WEBVIEW.window.contentView.removeChildView(WEBVIEW.screensaver);
    }
    WEBVIEW.pointer.position = posNew;
  }, 1 * 1000);
};

/**
 * Register webview events and handler.
 *
 * @param {Object} view - The main webview object.
 * @param initialize
 */
const viewEvents = (view,initialize=true) => {
  // Enable webview touch emulation

  view.webContents.debugger.attach("1.1");
  view.webContents.debugger.sendCommand("Emulation.setEmitTouchEventsForMouse", {
    configuration: "mobile",
    enabled: true,
  });

  // Disable webview hyperlinks
  view.webContents.setWindowOpenHandler(() => {
    return { action: "deny" };
  });

  // Remove webview scrollbar
  view.webContents.on("dom-ready", () => {
    view.webContents.insertCSS("::-webkit-scrollbar { display: none; }");
  });

  if(!WEBVIEW.initialized && initialize) {
    // Webview fully loaded
    view.webContents.on("did-finish-load", () => {
      WEBVIEW.initialized = true;
      update();
    });
  }
};

module.exports = {
  init,
  update,
};
