import assert from "node:assert/strict";
import { rmSync, existsSync } from "node:fs";
import { openDatabase } from "../src/db.js";
import { SlidingWindowRateLimiter } from "../src/rate-limiter.js";

const DB_PATH = "test/.tmp/rate-limiter-test.sqlite";

function freshDb() {
  for (const suffix of ["", "-wal", "-shm"]) {
    if (existsSync(DB_PATH + suffix)) rmSync(DB_PATH + suffix);
  }
  return openDatabase(DB_PATH);
}

function main() {
  const db = freshDb();
  const limiter = new SlidingWindowRateLimiter(db, 50_000, 60_000);
  const t0 = 1_000_000;

  const first = limiter.tryConsume("tenant-a", 20_000, t0);
  assert.equal(first.allowed, true);
  assert.equal(first.remainingTokens, 30_000);

  const second = limiter.tryConsume("tenant-a", 25_000, t0 + 1_000);
  assert.equal(second.allowed, true);
  assert.equal(second.remainingTokens, 5_000);

  const third = limiter.tryConsume("tenant-a", 10_000, t0 + 2_000);
  assert.equal(third.allowed, false);

  const otherTenant = limiter.tryConsume("tenant-b", 40_000, t0 + 2_000);
  assert.equal(otherTenant.allowed, true, "a different tenant key must not share tenant-a's budget");

  const afterWindow = limiter.tryConsume("tenant-a", 10_000, t0 + 61_000);
  assert.equal(afterWindow.allowed, true, "usage older than the window must be evicted");

  console.log("PASS: sliding window rate limiter enforces per-tenant budgets and evicts stale usage");
  db.close();
}

main();
