const path = require("path");
const hardware = require("./hardware");
const integration = require("./integration");
const { app, screen, nativeTheme, BaseWindow, WebContentsView } = require("electron");

global.WEBVIEW = global.WEBVIEW || {
  initialized: false,
  status: "offline",
  locked: false,
  pointer: {
    position: {},
    time: new Date(),
  },
};

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
  const theme = args.web_theme ? args.web_theme : "dark";
  const zoom = args.web_zoom ? parseFloat(args.web_zoom) : 1.25;

  // Init global root window
  nativeTheme.themeSource = theme;
  WEBVIEW.window = new BaseWindow({
    title: `TouchKio - ${url.host}`,
    icon: path.join(__dirname, "..", "img", "icon.png"),
  });
  WEBVIEW.window.setMenuBarVisibility(false);
  WEBVIEW.window.setFullScreen(true);

  // Init global main webview
  WEBVIEW.view = new WebContentsView();
  WEBVIEW.window.contentView.addChildView(WEBVIEW.view);
  WEBVIEW.view.webContents.loadURL(url.toString());

  // Register events
  windowEvents(WEBVIEW.window, zoom);
  touchEvents(WEBVIEW.window);
  viewEvents(WEBVIEW.view);

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
    WEBVIEW.view.setBounds({ x: 0, y: 0, width: width, height: height });
    WEBVIEW.view.webContents.setZoomFactor(zoom);
  };
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
    if (posOld.x !== posNew.x || posOld.y !== posNew.y) {
      const now = new Date();
      const then = WEBVIEW.pointer.time;

      // Update integration sensor
      WEBVIEW.pointer.time = now;
      if (Math.abs(now - then) / 1000 > 30) {
        console.log("Update Last Active");
        integration.update();
      }
    }
    WEBVIEW.pointer.position = posNew;
  }, 1 * 1000);
};

/**
 * Register webview events and handler.
 *
 * @param {Object} view - The main webview object.
 */
const viewEvents = (view) => {
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

  // Webview fully loaded
  view.webContents.on("did-finish-load", () => {
    WEBVIEW.initialized = true;
    update();
  });
};

module.exports = {
  init,
  update,
};
