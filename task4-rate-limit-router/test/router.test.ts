import assert from "node:assert/strict";
import { rmSync, existsSync } from "node:fs";
import { openDatabase } from "../src/db.js";
import { SlidingWindowRateLimiter } from "../src/rate-limiter.js";
import { ModelRouter } from "../src/router.js";
import { startProvider } from "../src/provider-mock.js";

const DB_PATH = "test/.tmp/router-test.sqlite";
const PRIMARY_URL = "http://localhost:6100";
const SECONDARY_URL = "http://localhost:6101";

function freshDb() {
  for (const suffix of ["", "-wal", "-shm"]) {
    if (existsSync(DB_PATH + suffix)) rmSync(DB_PATH + suffix);
  }
  return openDatabase(DB_PATH);
}

async function main() {
  const primary = startProvider("primary", 6100);
  let secondary = startProvider("secondary", 6101);
  await new Promise((r) => setTimeout(r, 200));

  const db = freshDb();
  const router = new ModelRouter(new SlidingWindowRateLimiter(db, 50_000, 60_000), PRIMARY_URL, SECONDARY_URL, 300);

  const ok = await router.route({ tenantKey: "t1", estimatedTokens: 100, payload: { simulate: "success", tokens: 100 } });
  assert.ok(ok.ok && ok.provider === "primary", "expected primary to serve a healthy request");

  const rateLimited = await router.route({
    tenantKey: "t1",
    estimatedTokens: 100,
    payload: { providerBehavior: { primary: "429", secondary: "success" }, tokens: 100 },
  });
  assert.ok(rateLimited.ok && rateLimited.provider === "secondary", "expected fallback to secondary on primary 429");

  const timedOut = await router.route({
    tenantKey: "t1",
    estimatedTokens: 100,
    payload: { providerBehavior: { primary: "timeout", secondary: "success" }, tokens: 100 },
  });
  assert.ok(timedOut.ok && timedOut.provider === "secondary", "expected fallback to secondary on primary timeout");

  const hardError = await router.route({
    tenantKey: "t1",
    estimatedTokens: 100,
    payload: { simulate: "error", tokens: 100 },
  });
  assert.equal(hardError.ok, false);
  if (!hardError.ok) {
    assert.equal(hardError.error.code, "UPSTREAM_ERROR");
    assert.ok(!hardError.error.message.includes("NullPointerException"), "raw upstream error must not leak to the client");
  }

  secondary.close();
  await new Promise((r) => setTimeout(r, 100));
  const bothDown = await router.route({
    tenantKey: "t1",
    estimatedTokens: 100,
    payload: { simulate: "429", tokens: 100 },
  });
  assert.equal(bothDown.ok, false);
  if (!bothDown.ok) assert.equal(bothDown.error.code, "UPSTREAM_UNAVAILABLE");
  secondary = startProvider("secondary", 6101);

  const limited = await router.route({
    tenantKey: "t2",
    estimatedTokens: 60_000,
    payload: { simulate: "success", tokens: 60_000 },
  });
  assert.equal(limited.ok, false);
  if (!limited.ok) assert.equal(limited.error.code, "RATE_LIMITED");

  console.log("PASS: router handles primary success, 429 fallback, timeout fallback, hard errors, both-down, and rate limiting");

  primary.close();
  secondary.close();
  db.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
