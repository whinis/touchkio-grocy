const integration = require("./src/integration");
const hardware = require("./src/hardware");
const webview = require("./src/webview");
const { app } = require("electron");

/**
 * This promise resolves when the app has finished initializing,
 * allowing to safely create browser windows and perform other
 * initialization tasks.
 */
app.whenReady().then(() => {
  const args = parseArgs(process);
  webview.init(args) && hardware.init(args) && integration.init(args);
});

/**
 * Parses command-line arguments from the given process object.
 *
 * @param {Object} proc - The process object.
 * @returns {Object} An object mapping argument names to their corresponding values.
 */
const parseArgs = (proc) => {
  let argv = proc.argv.slice(1).join(" ").trim();
  if (argv.length && argv[0] == ".") {
    argv = argv.slice(1);
  }
  argv = argv.replace(/--|=/g, " ").replace(/\s+/g, " ");
  argv = argv.trim().split(" ");
  argv = argv.reduce(
    (args, k, i, v) =>
      i % 2 ? args : { ...args, [k.replace("-", "_")]: v[i + 1] },
    {}
  );
  return argv;
};
