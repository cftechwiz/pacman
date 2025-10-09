var express = require("express");
var router = express.Router();
var bodyParser = require("body-parser");
var ObjectId = require("mongodb").ObjectId;
var Database = require("../lib/database");
var baseLogger = require("../lib/logger");

var logger = baseLogger.child({ module: "routes/user" });

// create application/x-www-form-urlencoded parser
var urlencodedParser = bodyParser.urlencoded({ extended: false });

// middleware that is specific to this router
router.use(function timeLog(req, res, next) {
  logger.debug({ method: req.method, url: req.originalUrl }, "Incoming request");
  next();
});

router.get("/id", async function (req, res, next) {
  logger.info("Handling GET /user/id");
  try {
    var db = await Database.getDb(req.app);
    var insertResult = await db.collection("userstats").insertOne(
      {
        date: Date(),
      },
      {
        writeConcern: {
          w: "majority",
          j: true,
          wtimeoutMS: 10000,
        },
      }
    );

    var userId = insertResult.insertedId || null;
    logger.info({ userId }, "Successfully inserted new user ID");
    res.json(userId);
  } catch (err) {
    logger.error({ err }, "Failed to insert new user ID");
    return next(err);
  }
});

router.post("/stats", urlencodedParser, async function (req, res, next) {
  logger.info(
    {
      body: req.body,
      host: req.headers.host,
      userAgent: req.headers["user-agent"],
      referer: req.headers.referer,
    },
    "Handling POST /user/stats"
  );

  var userScore = parseInt(req.body.score, 10);
  var userLevel = parseInt(req.body.level, 10);
  var userLives = parseInt(req.body.lives, 10);
  var userET = parseInt(req.body.elapsedTime, 10);

  try {
    var db = await Database.getDb(req.app);
    var updateResult = await db.collection("userstats").updateOne(
      {
        _id: new ObjectId(req.body.userId),
      },
      {
        $set: {
          cloud: req.body.cloud,
          zone: req.body.zone,
          host: req.body.host,
          score: userScore,
          level: userLevel,
          lives: userLives,
          elapsedTime: userET,
          date: Date(),
          referer: req.headers.referer,
          user_agent: req.headers["user-agent"],
          hostname: req.hostname,
          ip_addr: req.ip,
        },
        $inc: {
          updateCounter: 1,
        },
      },
      {
        writeConcern: {
          w: "majority",
          j: true,
          wtimeoutMS: 10000,
        },
      }
    );

    var returnStatus = updateResult.acknowledged ? "success" : "error";
    if (returnStatus === "success") {
      logger.info({ userId: req.body.userId }, "Successfully updated user stats");
    }

    res.json({
      rs: returnStatus,
    });
  } catch (err) {
    logger.error({ err }, "Failed to update user stats");
    return next(err);
  }
});

router.get("/stats", async function (req, res, next) {
  logger.info("Handling GET /user/stats");

  try {
    var db = await Database.getDb(req.app);
    var docs = await db
      .collection("userstats")
      .find({ score: { $exists: true } })
      .sort({ _id: 1 })
      .toArray();

    var result = docs.map(function (item) {
      return {
        cloud: item["cloud"],
        zone: item["zone"],
        host: item["host"],
        score: item["score"],
        level: item["level"],
        lives: item["lives"],
        et: item["elapsedTime"],
        txncount: item["updateCounter"],
      };
    });

    res.json(result);
  } catch (err) {
    logger.error({ err }, "Failed to fetch user stats");
    return next(err);
  }
});

module.exports = router;
