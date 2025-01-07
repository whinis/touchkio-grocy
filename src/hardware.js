const os = require("os");
const fs = require("fs");
const path = require("path");
const process = require("child_process");

global.HARDWARE = global.HARDWARE || {
  initialized: false,
  status: "invalid",
  display: {
    name: null,
    status: {
      path: null,
      value: null,
    },
    brightness: {
      path: null,
      value: null,
      max: null,
    },
    notifiers: [],
  },
};

/**
 * Initializes the hardware with the provided arguments.
 *
 * @param {Object} args - The command-line arguments to customize the initialization process.
 * @returns {boolean} Returns true if the initialization was successful.
 */
const init = async (args) => {
  if (!args.mqtt_url) {
    return false;
  }

  // Check device support
  if (!compatibleDevice()) {
    console.warn("Device not supported");
    return false;
  }

  // Check model support
  const model = getModel();
  if (!model || !model.includes("Raspberry Pi")) {
    console.warn(`${model} not supported`);
    return false;
  }

  // Init globals
  HARDWARE.display.name = getDisplayName();
  HARDWARE.display.status.path = getDisplayStatusPath(HARDWARE.display.name);
  HARDWARE.display.brightness.path = getDisplayBrightnessPath(HARDWARE.display.name);
  HARDWARE.display.brightness.max = getDisplayBrightnessMax();
  HARDWARE.initialized = true;
  HARDWARE.status = "valid";

  // Show device infos
  console.log("\nModel:", model);
  console.log("Serial Number:", getSerialNumber());
  console.log("Host Name:", getHostName());
  console.log("Up Time:", getUpTime());
  console.log("Memory Size:", getMemorySize());
  console.log("Memory Usage:", getMemoryUsage());
  console.log("Processor Usage:", getProcessorUsage());
  console.log("Processor Temperature:", getProcessorTemperature());

  // Show display infos
  console.log("\nDisplay Name:", HARDWARE.display.name);
  console.log(`Display Status [${HARDWARE.display.status.path}]:`, getDisplayStatus());
  console.log(`Display Brightness [${HARDWARE.display.brightness.path}]:`, getDisplayBrightness(), "\n");

  // Check for display changes
  setInterval(update, 500);

  return true;
};

/**
 * Updates the shared hardware properties.
 */
const update = () => {
  if (!HARDWARE.initialized) {
    return;
  }

  // Display status has changed
  if (HARDWARE.display.status.path !== null) {
    const status = fs.readFileSync(`${HARDWARE.display.status.path}/enabled`, "utf8").trim();
    if (status !== HARDWARE.display.status.value) {
      console.log("Update Display Status:", getDisplayStatus());
      HARDWARE.display.status.value = status;
      HARDWARE.display.notifiers.forEach((notifier) => {
        notifier();
      });
    }
  }

  // Display brightness has changed
  if (HARDWARE.display.brightness.path !== null) {
    const brightness = fs.readFileSync(`${HARDWARE.display.brightness.path}/brightness`, "utf8").trim();
    if (brightness !== HARDWARE.display.brightness.value) {
      console.log("Update Display Brightness:", getDisplayBrightness());
      HARDWARE.display.brightness.value = brightness;
      HARDWARE.display.notifiers.forEach((notifier) => {
        notifier();
      });
    }
  }
};

/**
 * Verifies device compatibility by checking the presence of necessary sys files.
 *
 * @returns {bool} Returns true if all files exists.
 */
const compatibleDevice = () => {
  const files = [
    "/sys/class/drm",
    "/sys/class/backlight",
    "/sys/firmware/devicetree/base/model",
    "/sys/firmware/devicetree/base/serial-number",
  ];
  return files.every((file) => fs.existsSync(file));
};

/**
 * Gets the Raspberry Pi model name using `/sys/firmware/devicetree/base/model`.
 *
 * @returns {string|null} The model of the Raspberry Pi or null if an error occurs.
 */
const getModel = () => {
  return execSyncCommand("cat", ["/sys/firmware/devicetree/base/model"]);
};

/**
 * Gets the Raspberry Pi serial number using `/sys/firmware/devicetree/base/serial-number`.
 *
 * @returns {string|null} The serial number of the Raspberry Pi or null if an error occurs.
 */
const getSerialNumber = () => {
  return execSyncCommand("cat", ["/sys/firmware/devicetree/base/serial-number"]);
};

/**
 * Gets the host machine id using `/etc/machine-id`.
 *
 * @returns {string|null} The machine id of the system.
 */
const getMachineId = () => {
  return execSyncCommand("cat", ["/etc/machine-id"]);
};

/**
 * Gets the host name of the current system using `os.hostname()`.
 *
 * @returns {string} The host name of the system.
 */
const getHostName = () => {
  return os.hostname();
};

/**
 * Gets the up time of the system in minutes using `os.uptime()`.
 *
 * @returns {number} The up time of the system in minutes.
 */
const getUpTime = () => {
  return os.uptime() / 60;
};

/**
 * Gets the total available memory in gibibytes using `os.totalmem()`.
 *
 * @returns {number} The total available memory in GiB.
 */
const getMemorySize = () => {
  return os.totalmem() / 1024 ** 3;
};

/**
 * Gets the current memory usage as a percentage using `os.totalmem()` and `os.freemem()`.
 *
 * @returns {number} The percentage of used memory.
 */
const getMemoryUsage = () => {
  return ((os.totalmem() - os.freemem()) / os.totalmem()) * 100;
};

/**
 * Gets the CPU load average over the last 5 minutes as a percentage using `os.loadavg()` and `os.cpus()`.
 *
 * @returns {number} The CPU load average percentage over the last 5 minutes.
 */
const getProcessorUsage = () => {
  return (os.loadavg()[1] / os.cpus().length) * 100;
};

/**
 * Gets the current CPU temperature using `vcgencmd measure_temp`.
 *
 * @returns {number|null} The CPU temperature in degrees Celsius or null if an error occurs.
 */
const getProcessorTemperature = () => {
  const output = execSyncCommand("vcgencmd", ["measure_temp"]);
  if (output !== null) {
    const temp = output.match(/temp=(\d+\.\d+)/);
    if (temp && temp[1]) {
      return parseFloat(temp[1]);
    }
  }
  return null;
};

/**
 * Gets the primary display name using `wlopm`.
 *
 * @returns {string|null} The output of the command or null if an error occurs.
 */
const getDisplayName = () => {
  const status = execSyncCommand("wlopm", []);
  if (status !== null) {
    const out = status.split("\n")[0].split(" ");
    return out.shift();
  }
  return null;
};

/**
 * Gets the current display status path using `/sys/class/drm`.
 *
 * @param {string} name - Primary display name.
 * @returns {string|null} The display status path or null if nothing was found.
 */
const getDisplayStatusPath = (name) => {
  const drm = "/sys/class/drm";
  for (const card of fs.readdirSync(drm)) {
    const statusFile = path.join(drm, card, "status");
    if (!fs.existsSync(statusFile)) {
      continue;
    }
    const content = fs.readFileSync(statusFile, "utf8").trim();
    if (card.includes(name) && content === "connected") {
      return path.join(drm, card);
    }
  }
  return null;
};

/**
 * Gets the current display power status using `wlopm`.
 *
 * @returns {string|null} The output of the command or null if an error occurs.
 */
const getDisplayStatus = () => {
  const status = execSyncCommand("wlopm", []);
  if (status !== null) {
    const out = status.split("\n")[0].split(" ");
    return out.pop().toUpperCase();
  }
  return null;
};

/**
 * Sets the display power status using `wlopm`.
 *
 * This function takes a desired status ('ON' or 'OFF') and executes
 * the appropriate command to set the display status.
 *
 * @param {string} status - The desired status ('ON' or 'OFF').
 * @param {function} callback - A callback function that receives the output or error.
 */
const setDisplayStatus = (status, callback = null) => {
  if (status !== "ON" && status !== "OFF") {
    console.error("Status must be 'ON' or 'OFF'");
    if (typeof callback === "function") callback(null, "Invalid status");
    return;
  }
  const args = [`--${status.toLowerCase()}`, HARDWARE.display.name];
  execAsyncCommand("wlopm", args, callback);
};

/**
 * Gets the current display brightness path using `/sys/class/backlight`.
 *
 * @param {string} name - Primary display name.
 * @returns {string|null} The display brightness path or null if nothing was found.
 */
const getDisplayBrightnessPath = (name) => {
  const backlight = "/sys/class/backlight";
  for (const address of fs.readdirSync(backlight)) {
    const nameFile = path.join(backlight, address, "display_name");
    if (!fs.existsSync(nameFile)) {
      continue;
    }
    const content = fs.readFileSync(nameFile, "utf8").trim();
    if (content.includes(name)) {
      return path.join(backlight, address);
    }
  }
  return null;
};

/**
 * Gets the maximum display brightness value using `/sys/class/backlight/.../max_brightness`.
 *
 * @returns {number|null} The brightness maximum value or null if an error occurs.
 */
const getDisplayBrightnessMax = () => {
  if (!HARDWARE.display.brightness.path) {
    return null;
  }
  const max = execSyncCommand("cat", [`${HARDWARE.display.brightness.path}/max_brightness`]);
  if (max !== null) {
    return parseInt(max, 10);
  }
  return null;
};

/**
 * Gets the current display brightness level using `/sys/class/backlight/.../brightness`.
 *
 * @returns {number|null} The brightness level as a percentage or null if an error occurs.
 */
const getDisplayBrightness = () => {
  if (!HARDWARE.display.brightness.path) {
    return null;
  }
  const brightness = execSyncCommand("cat", [`${HARDWARE.display.brightness.path}/brightness`]);
  if (brightness !== null) {
    const max = HARDWARE.display.brightness.max;
    return Math.round((parseInt(brightness, 10) / max) * 100);
  }
  return null;
};

/**
 * Sets the display brightness level using `/sys/class/backlight/.../brightness`.
 *
 * This function takes a brightness value between 1 to 100 percent,
 * maps it to the proper range and writes it to the system.
 *
 * @param {number} brightness - The desired brightness level (1-100).
 * @param {function} callback - A callback function that receives the output or error.
 */
const setDisplayBrightness = (brightness, callback = null) => {
  if (!HARDWARE.display.brightness.path) {
    return;
  }
  if (typeof brightness !== "number" || brightness < 1 || brightness > 100) {
    console.error("Brightness must be a number between 1 and 100");
    if (typeof callback === "function") callback(null, "Invalid brightness");
    return;
  }
  const max = HARDWARE.display.brightness.max;
  const value = Math.max(1, Math.min(Math.round((brightness / 100) * max), max));
  const proc = execAsyncCommand("tee", [`${HARDWARE.display.brightness.path}/brightness`], callback);
  proc.stdin.write(value.toString());
  proc.stdin.end();
};

/**
 * Shuts down the system using `sudo shutdown -h now`.
 *
 * This function executes the command asynchronously.
 * The output of the command will be provided through the callback function.
 *
 * @param {function} callback - A callback function that receives the output or error.
 */
const shutdownSystem = (callback = null) => {
  execAsyncCommand("sudo", ["shutdown", "-h", "now"], callback);
};

/**
 * Reboots the system using `sudo reboot`.
 *
 * This function executes the command asynchronously.
 * The output of the command will be provided through the callback function.
 *
 * @param {function} callback - A callback function that receives the output or error.
 */
const rebootSystem = (callback = null) => {
  execAsyncCommand("sudo", ["reboot"], callback);
};

/**
 * Executes a command synchronously and returns the output.
 *
 * @param {string} cmd - The command to execute.
 * @param {Array<string>} args - The arguments for the command.
 * @returns {string|null} The output of the command or null if an error occurs.
 */
const execSyncCommand = (cmd, args = []) => {
  try {
    const output = process.execSync([cmd, ...args].join(" "), { encoding: "utf8" });
    return output.trim().replace(/\0/g, "");
  } catch (error) {
    console.error("Execute Sync:", error.message);
  }
  return null;
};

/**
 * Executes a command asynchronously.
 *
 * @param {string} cmd - The command to execute.
 * @param {Array<string>} args - The arguments for the command.
 * @param {function} callback - A callback function that receives the output or error.
 * @returns {object} The spawned process object.
 */
const execAsyncCommand = (cmd, args = [], callback = null) => {
  let errorOutput = "";
  let successOutput = "";
  let proc = process.spawn(cmd, args);
  proc.stderr.on("data", (data) => {
    if (data) {
      errorOutput += data.toString();
    }
  });
  proc.stdout.on("data", (data) => {
    if (data) {
      successOutput += data.toString();
    }
  });
  proc.on("close", (code) => {
    try {
      if (typeof callback === "function") {
        if (code === 0) {
          callback(successOutput.trim().replace(/\0/g, ""), null);
        } else {
          callback(null, errorOutput.trim().replace(/\0/g, ""));
        }
      }
    } catch (error) {
      console.error("Execute Async:", error.message);
    }
  });
  return proc;
};

module.exports = {
  init,
  update,
  getModel,
  getSerialNumber,
  getMachineId,
  getHostName,
  getUpTime,
  getMemorySize,
  getMemoryUsage,
  getProcessorUsage,
  getProcessorTemperature,
  getDisplayName,
  getDisplayStatusPath,
  getDisplayStatus,
  setDisplayStatus,
  getDisplayBrightnessPath,
  getDisplayBrightnessMax,
  getDisplayBrightness,
  setDisplayBrightness,
  shutdownSystem,
  rebootSystem,
};
