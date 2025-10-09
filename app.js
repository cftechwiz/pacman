"use strict";

const express = require("express");
const path = require("path");
const Database = require("./lib/database");
const baseLogger = require("./lib/logger");

const highscores = require("./routes/highscores");
const user = require("./routes/user");
const loc = require("./routes/location");

const app = express();
const logger = baseLogger.child({ module: "app" });

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

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
