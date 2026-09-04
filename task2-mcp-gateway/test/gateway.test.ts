process.env.DOWNSTREAM_PORT = "4100";
process.env.DOWNSTREAM_URL = "http://localhost:4100";
process.env.GATEWAY_PORT = "4101";

import assert from "node:assert/strict";
import { startDownstreamMock } from "../src/downstream-mock.js";
import { startGateway } from "../src/gateway.js";

const GATEWAY_URL = "http://localhost:4101";

async function call(token: string | undefined, method: string, params?: unknown, id = 1) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
  return { status: res.status, body: await res.json() as any };
}

async function main() {
  const downstream = startDownstreamMock();
  const gateway = startGateway();
  await new Promise((r) => setTimeout(r, 200));

  const list = await call("viewer-token-456", "tools/list");
  assert.ok(Array.isArray(list.body.result?.tools), "tools/list should forward downstream's tool list");

  const weather = await call("viewer-token-456", "tools/call", { name: "get_weather" });
  assert.ok(weather.body.result, "viewer should be able to call get_weather");

  const blocked = await call("viewer-token-456", "tools/call", { name: "admin_reset_key" });
  assert.equal(blocked.body.error?.code, -32001, "viewer calling admin_ tool must be rejected with -32001");

  const allowed = await call("admin-token-123", "tools/call", { name: "admin_reset_key" });
  assert.ok(allowed.body.result, "admin should be able to call admin_reset_key");

  const noAuth = await call(undefined, "tools/list");
  assert.equal(noAuth.body.error?.code, -32000, "missing token should be rejected");

  console.log("PASS: gateway auth + tool-name authorization behave as expected");

  downstream.close();
  gateway.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
