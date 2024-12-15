const fs = require("fs");
const path = require("path");
const readline = require("readline/promises");
const integration = require("./src/integration");
const hardware = require("./src/hardware");
const webview = require("./src/webview");
const { app } = require("electron");

/**
 * This promise resolves when the app has finished initializing,
 * allowing to safely create browser windows and perform other
 * initialization tasks.
 */
app.whenReady().then(async () => {
  let args = parseArgs(process);
  let argsProvided = !!Object.keys(args).length;

  let argsFilePath = path.join(app.getPath("userData"), "Arguments.json");
  let argsFileExists = fs.existsSync(argsFilePath);

  // Setup arguments from file path
  if ("setup" in args || (!argsProvided && !argsFileExists)) {
    await sleep(3000);
    do {
      args = await promptArgs(process);
    } while (!Object.keys(args).length);
    fs.writeFileSync(argsFilePath, JSON.stringify(args, null, 2));
  } else if (!argsProvided && argsFileExists) {
    args = JSON.parse(fs.readFileSync(argsFilePath));
  }

  // Show used arguments
  const json = JSON.stringify(args, null, 2);
  console.log(`Arguments: ${json}`);

  // Chained init functions
  const chained = [webview.init, hardware.init, integration.init];
  for (const init of chained) {
    if (!(await init(args))) {
      break;
    }
  }
});

/**
 * Parses command-line arguments from the given process object.
 *
 * @param {Object} proc - The process object.
 * @returns {Object} An object mapping argument names to their corresponding values.
 */
const parseArgs = (proc) => {
  let args = {};
  proc.argv.slice(1).forEach((arg) => {
    if (arg !== ".") {
      const [key, value] = arg.split("=");
      args[key.replace("--", "").replace("-", "_")] = value;
    }
  });
  return args;
};

/**
 * Prompts argument values on the command-line.
 *
 * @param {Object} proc - The process object.
 * @returns {Object} An object mapping argument names to their corresponding values.
 */
const promptArgs = async (proc) => {
  const read = readline.createInterface({
    input: proc.stdin,
    output: proc.stdout,
  });

  // Array of arguments
  const arguments = [
    {
      key: "web_url",
      question: "\nEnter WEB url",
      fallback: "http://192.168.1.42:8123",
    },
    {
      key: "web_theme",
      question: "Enter WEB theme",
      fallback: "dark",
    },
    {
      key: "web_zoom",
      question: "Enter WEB zoom level",
      fallback: "1.25",
    },
    {
      key: "mqtt_url",
      question: "\nEnter MQTT url",
      fallback: "mqtt://192.168.1.42:1883",
    },
    {
      key: "mqtt_user",
      question: "Enter MQTT username",
      fallback: "kiosk",
    },
    {
      key: "mqtt_password",
      question: "Enter MQTT password",
      fallback: "password",
    },
    {
      key: "mqtt_discovery",
      question: "Enter MQTT discovery prefix",
      fallback: "homeassistant",
    },
    {
      key: "check",
      question: "\nEverything looks good?",
      fallback: "yes",
    },
  ];

  // Prompt each argument and wait for the answer
  let args = {};
  for (const { key, question, fallback } of arguments) {
    if (key === "check") {
      const json = JSON.stringify(args, null, 2);
      const prompt = `${question}\n${json}\n(${fallback}): `;
      const answer = (await read.question(prompt)).trim() || fallback;
      if (!["y", "yes"].includes(answer)) {
        args = {};
      }
    } else {
      const prompt = `${question} (${fallback}): `;
      const answer = (await read.question(prompt)).trim() || fallback;
      args[key] = answer;
    }
  }
  read.close();

  return args;
};

/**
 * Helper function for asynchronous sleep.
 *
 * @param {number} ms - Sleep time in milliseconds.
 * @returns {Promise} A promise resolving after the timeout.
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
