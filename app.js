"use strict";

const express = require("express");
const path = require("path");
const Database = require("./lib/database");
const packageInfo = require("./package.json");
const baseLogger = require("./lib/logger");

const highscores = require("./routes/highscores");
const user = require("./routes/user");
const loc = require("./routes/location");

const app = express();
const logger = baseLogger.child({ module: "app" });

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.get("/js/splunk-rum-loader.js", function (req, res) {
  const rumConfig = {
    realm: process.env.SPLUNK_REALM || "",
    rumAccessToken: process.env.SPLUNK_RUM_ACCESS_TOKEN || "",
    applicationName: process.env.SPLUNK_APPLICATION_NAME || "pacman",
    version:
      process.env.SPLUNK_APPLICATION_VERSION || packageInfo.version || "0.0.1",
    deploymentEnvironment:
      process.env.SPLUNK_DEPLOYMENT_ENVIRONMENT ||
      process.env.NODE_ENV ||
      "production",
  };

  const sessionRecorderConfig = {
    realm: rumConfig.realm,
    rumAccessToken: rumConfig.rumAccessToken,
    recorder: process.env.SPLUNK_SESSION_RECORDER || "",
  };

  const scriptSource =
    `// Dynamically generated Splunk RUM loader\n` +
    `(function(){\n` +
    `  var rumConfig = ${JSON.stringify(rumConfig)};\n` +
    `  var sessionRecorderConfig = ${JSON.stringify(
      sessionRecorderConfig
    )};\n` +
    `  if (!rumConfig.rumAccessToken) {\n` +
    `    return;\n` +
    `  }\n` +
    `  var possibleUsers = ['player-alpha', 'player-beta', 'player-gamma', 'player-delta', 'player-epsilon'];\n` +
    `\n` +
    `  function loadScript(src, onload) {\n` +
    `    var script = document.createElement('script');\n` +
    `    script.src = src;\n` +
    `    script.crossOrigin = 'anonymous';\n` +
    `    if (onload) {\n` +
    `      script.onload = onload;\n` +
    `    }\n` +
    `    document.head.appendChild(script);\n` +
    `  }\n` +
    `\n` +
    `  loadScript('https://cdn.signalfx.com/o11y-gdi-rum/latest/splunk-otel-web.js', function(){\n` +
    `    if (!window.SplunkRum) {\n` +
    `      console.warn('SplunkRum global not available after loading script');\n` +
    `      return;\n` +
    `    }\n` +
    `    window.SplunkRum.init(rumConfig);\n` +
    `    if (window.SplunkRum && window.SplunkRum.setGlobalAttributes) {\n` +
    `      var chosenUser = possibleUsers[Math.floor(Math.random() * possibleUsers.length)];\n` +
    `      window.SplunkRum.setGlobalAttributes({ 'user.name': chosenUser, 'service.name': 'pacman-ui' });\n` +
    `    }\n` +
    `\n` +
    `    if (!sessionRecorderConfig.recorder) {\n` +
    `      return;\n` +
    `    }\n` +
    `\n` +
    `    loadScript('https://cdn.signalfx.com/o11y-gdi-rum/latest/splunk-otel-web-session-recorder.js', function(){\n` +
    `      if (window.SplunkSessionRecorder) {\n` +
    `        window.SplunkSessionRecorder.init(sessionRecorderConfig);\n` +
    `      }\n` +
    `    });\n` +
    `  });\n` +
    `})();\n`;

  res.type("application/javascript").send(scriptSource);
});

app.use("/", express.static(path.join(__dirname, "public")));

app.use("/highscores", highscores);
app.use("/user", user);
app.use("/location", loc);

app.use(function (req, res, next) {
  const err = new Error("Not Found");
  err.status = 404;
  next(err);
});

app.use(function (err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  res.status(err.status || 500);
  res.render("error");
});

const dbReady = Database.connect(app)
  .then(function () {
    logger.info("Connected to database server successfully");
  })
  .catch(function (err) {
    logger.error({ err }, "Failed to connect to database server");
    throw err;
  });

app.locals.dbReady = dbReady;

module.exports = app;
