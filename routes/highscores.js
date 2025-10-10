const { trace } = require("@opentelemetry/api");
var express = require("express");
var router = express.Router();
var bodyParser = require("body-parser");
var Database = require("../lib/database");
var baseLogger = require("../lib/logger");

var logger = baseLogger.child({ module: "routes/highscores" });

// create application/x-www-form-urlencoded parser
var urlencodedParser = bodyParser.urlencoded({ extended: false });

const tracer = trace.getTracer("pacman");
// middleware that is specific to this router
router.use(function timeLog(req, res, next) {
  logger.debug(
    { method: req.method, url: req.originalUrl },
    "Incoming request"
  );
  next();
});

router.get("/list", urlencodedParser, async function (req, res, next) {
  return tracer.startActiveSpan("getHighScores", async (span) => {
    logger.info("Handling GET /highscores/list");
    try {
      var db = await Database.getDb(req.app);
      var docs = await db
        .collection("highscore")
        .find({})
        .sort({ score: -1 })
        .limit(10)
        .toArray();

      var result = docs.map(function (item) {
        return {
          name: item["name"],
          cloud: item["cloud"],
          zone: item["zone"],
          host: item["host"],
          score: item["score"],
        };
      });
      res.json(result);
    } catch (err) {
      logger.error({ err }, "Failed to fetch highscores");
      span.recordException(err);
      return next(err);
    } finally {
      span.end();
    }
  });
});

// Accessed at /highscores
router.post("/", urlencodedParser, async function (req, res, next) {
  return tracer.startActiveSpan("addHighScore", async (span) => {
    logger.info(
      {
        body: req.body,
        host: req.headers.host,
        userAgent: req.headers["user-agent"],
        referer: req.headers.referer,
      },
      "Handling POST /highscores"
    );

    var userScore = parseInt(req.body.score, 10);
    var userLevel = parseInt(req.body.level, 10);
    var userName = ((req.body.name ?? "") + "").substring(0, 32);
    var cloud = ((req.body.cloud ?? "") + "").substring(0, 32);
    var zone = ((req.body.zone ?? "") + "").substring(0, 32);
    var host = ((req.body.host ?? "") + "").substring(0, 32);
    var insertDocument = {
      name: userName,
      cloud: cloud,
      zone: zone,
      host: host,
      score: userScore,
      level: userLevel,
      date: Date(),
      referer: req.headers.referer || "",
      user_agent: req.headers["user-agent"] || "",
      hostname: req.hostname || "",
      ip_addr: req.ip || "",
    };

    span.setAttributes({
      "user.name": insertDocument.name,
      "user.cloud": insertDocument.cloud,
      "user.zone": insertDocument.zone,
      "user.host": insertDocument.host,
      "user.score": insertDocument.score,
      "user.level": insertDocument.level,
    });

    try {
      var db = await Database.getDb(req.app);
      var insertResult = await db
        .collection("highscore")
        .insertOne(insertDocument, {
          writeConcern: {
            w: "majority",
            j: true,
            wtimeoutMS: 10000,
          },
        });

      var returnStatus = insertResult.acknowledged ? "success" : "error";
      if (returnStatus === "success") {
        logger.info(
          { name: insertDocument.name, score: insertDocument.score },
          "Successfully inserted highscore"
        );
      }

      res.json({
        name: insertDocument.name,
        zone: insertDocument.zone,
        score: insertDocument.score,
        level: insertDocument.level,
        rs: returnStatus,
      });
    } catch (err) {
      logger.error({ err }, "Failed to insert highscore");
      span.recordException(err);
      return next(err);
    } finally {
      span.end();
    }
  });
});

module.exports = router;
