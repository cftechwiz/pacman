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

app.get("/js/splunk-instrumentation.js", function (req, res) {
  const rumConfig = {
    realm: process.env.SPLUNK_REALM || "your-realm",
    rumAccessToken: process.env.SPLUNK_RUM_ACCESS_TOKEN || "your-token",
    applicationName: process.env.SPLUNK_APPLICATION_NAME || "your-app",
    version:
      process.env.SPLUNK_APPLICATION_VERSION || packageInfo.version || "1.2.3",
    deploymentEnvironment:
      process.env.SPLUNK_DEPLOYMENT_ENVIRONMENT ||
      process.env.NODE_ENV ||
      "production",
  };

  const sessionRecorderConfig = {
    realm: rumConfig.realm,
    rumAccessToken: rumConfig.rumAccessToken,
    recorder: process.env.SPLUNK_SESSION_RECORDER || "splunk",
  };

  const moduleSource = `import SplunkOtelWeb from '@splunk/otel-web';
import SplunkSessionRecorder from '@splunk/otel-web-session-recorder';

const rumConfig = ${JSON.stringify(rumConfig)};
const sessionRecorderConfig = ${JSON.stringify(sessionRecorderConfig)};

if (rumConfig.rumAccessToken) {
  SplunkOtelWeb.init(rumConfig);
}

if (sessionRecorderConfig.rumAccessToken && sessionRecorderConfig.recorder) {
  SplunkSessionRecorder.init(sessionRecorderConfig);
}
`;

  res.type("application/javascript").send(moduleSource);
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

Database.connect(app)
  .then(function () {
    logger.info("Connected to database server successfully");
  })
  .catch(function (err) {
    logger.error({ err }, "Failed to connect to database server");
  });

module.exports = app;
