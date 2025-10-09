var express = require("express");
var router = express.Router();
var bodyParser = require("body-parser");
var Database = require("../lib/database");
var baseLogger = require("../lib/logger");

var logger = baseLogger.child({ module: "routes/highscores" });

// create application/x-www-form-urlencoded parser
var urlencodedParser = bodyParser.urlencoded({ extended: false });

// middleware that is specific to this router
router.use(function timeLog(req, res, next) {
  logger.debug({ method: req.method, url: req.originalUrl }, "Incoming request");
  next();
});

router.get("/list", urlencodedParser, async function (req, res, next) {
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
    return next(err);
  }
});

// Accessed at /highscores
router.post("/", urlencodedParser, async function (req, res, next) {
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

  try {
    var db = await Database.getDb(req.app);
    var insertResult = await db.collection("highscore").insertOne(
      {
        name: req.body.name,
        cloud: req.body.cloud,
        zone: req.body.zone,
        host: req.body.host,
        score: userScore,
        level: userLevel,
        date: Date(),
        referer: req.headers.referer,
        user_agent: req.headers["user-agent"],
        hostname: req.hostname,
        ip_addr: req.ip,
      },
      {
        writeConcern: {
          w: "majority",
          j: true,
          wtimeoutMS: 10000,
        },
      }
    );

    var returnStatus = insertResult.acknowledged ? "success" : "error";
    if (returnStatus === "success") {
      logger.info({ name: req.body.name, score: userScore }, "Successfully inserted highscore");
    }

    res.json({
      name: req.body.name,
      zone: req.body.zone,
      score: userScore,
      level: userLevel,
      rs: returnStatus,
    });
  } catch (err) {
    logger.error({ err }, "Failed to insert highscore");
    return next(err);
  }
});

module.exports = router;
