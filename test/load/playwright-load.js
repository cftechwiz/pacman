#!/usr/bin/env node
"use strict";

const { chromium } = require("playwright");
const crypto = require("node:crypto");

const BASE_URL = process.env.LOAD_TEST_BASE_URL || "http://localhost:8080";
const VUS = Number.parseInt(process.env.LOAD_TEST_VUS || "5", 10);
const MIN_SESSION_SECONDS = Number.parseInt(process.env.LOAD_TEST_MIN_SESSION || "10", 10);
const MAX_SESSION_SECONDS = Number.parseInt(process.env.LOAD_TEST_MAX_SESSION || "30", 10);
const THINK_TIME_MS = Number.parseInt(process.env.LOAD_TEST_THINK_TIME_MS || "750", 10);
const MAX_HIGHSCORE = Number.parseInt(process.env.LOAD_TEST_MAX_SCORE || "5000", 10);
const MAX_LEVEL = Number.parseInt(process.env.LOAD_TEST_MAX_LEVEL || "25", 10);
const MAX_LIVES = Number.parseInt(process.env.LOAD_TEST_MAX_LIVES || "5", 10);

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice(list) {
  return list[randomInt(0, list.length - 1)];
}

function randomName() {
  const adjectives = ["red", "blue", "swift", "fierce", "lucky", "wild", "golden", "silent"];
  const nouns = ["ghost", "pellet", "maze", "runner", "hunter", "power", "sprite", "chomp"];
  return `${randomChoice(adjectives)}-${randomChoice(nouns)}-${randomInt(1, 9999)}`;
}

async function simulateUser(userIndex) {
  const runForMs = randomInt(MIN_SESSION_SECONDS, MAX_SESSION_SECONDS) * 1000;
  const start = Date.now();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  let userId;

  try {
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });

    const sessionMeta = {
      name: randomName(),
      cloud: randomChoice(["aws", "gcp", "azure", "onprem"]),
      zone: randomChoice(["us-east-1", "us-west-2", "eu-central-1", "asia-east"]).toLowerCase(),
      host: `vu-${userIndex}`,
    };

    userId = await page.evaluate(async () => {
      const res = await fetch("/user/id", { method: "GET" });
      if (!res.ok) {
        throw new Error(`Failed to obtain user id: ${res.status}`);
      }
      const data = await res.json();
      if (typeof data === "string") {
        return data;
      }
      if (data && data.$oid) {
        return data.$oid;
      }
      return data;
    });

    while (Date.now() - start < runForMs) {
      await page.evaluate(
        async ({ meta, limits, userIdValue }) => {
          const payload = new URLSearchParams({
            userId: userIdValue,
            cloud: meta.cloud,
            zone: meta.zone,
            host: meta.host,
            score: String(Math.floor(Math.random() * limits.maxScore)),
            level: String(Math.floor(Math.random() * limits.maxLevel) + 1),
            lives: String(Math.floor(Math.random() * limits.maxLives) + 1),
            elapsedTime: String(Math.floor(Math.random() * 600)),
          });

          await fetch("/user/stats", {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: payload.toString(),
          });

          await fetch("/highscores", {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              name: meta.name,
              cloud: meta.cloud,
              zone: meta.zone,
              host: meta.host,
              score: String(Math.floor(Math.random() * limits.maxScore)),
              level: String(Math.floor(Math.random() * limits.maxLevel) + 1),
            }).toString(),
          });

          await Promise.all([
            fetch("/highscores/list"),
            fetch("/user/stats"),
          ]);
        },
        {
          meta: sessionMeta,
          limits: {
            maxScore: MAX_HIGHSCORE,
            maxLevel: MAX_LEVEL,
            maxLives: MAX_LIVES,
          },
          userIdValue: userId,
        }
      );

      await page.waitForTimeout(randomInt(THINK_TIME_MS, THINK_TIME_MS * 3));
    }
  } catch (err) {
    console.error(`[vu ${userIndex}] Error:`, err.message);
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }
}

(async function run() {
  console.log(
    `Starting load test: ${VUS} virtual users, session duration between ${MIN_SESSION_SECONDS}-${MAX_SESSION_SECONDS}s`
  );

  const users = [];
  for (let i = 0; i < VUS; i += 1) {
    users.push(simulateUser(i + 1));
  }

  await Promise.all(users);
  console.log("Load test run complete.");
})();
