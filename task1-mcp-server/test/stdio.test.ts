import { spawn } from "node:child_process";
import path from "node:path";
import assert from "node:assert/strict";

const serverPath = path.join(process.cwd(), "dist", "index.js");

function send(child: ReturnType<typeof spawn>, msg: unknown) {
  child.stdin.write(JSON.stringify(msg) + "\n");
}

async function main() {
  const child = spawn("node", [serverPath], { stdio: ["pipe", "pipe", "pipe"] });

  const stdoutLines: string[] = [];
  const stderrChunks: string[] = [];
  const responses: any[] = [];
  let stdoutBuffer = "";

  child.stdout.on("data", (chunk: Buffer) => {
    stdoutBuffer += chunk.toString("utf8");
    const lines = stdoutBuffer.split("\n");
    stdoutBuffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.trim().length === 0) continue;
      stdoutLines.push(line);
      responses.push(JSON.parse(line));
    }
  });
  child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk.toString("utf8")));
  child.on("error", (err) => {
    throw err;
  });

  send(child, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test-client", version: "1.0.0" } },
  });
  send(child, { jsonrpc: "2.0", method: "notifications/initialized" });

  send(child, {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name: "get_customer_record", arguments: { customer_id: "not-valid" } },
  });

  send(child, {
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "trigger_refund", arguments: { customer_id: "CUST-12345", amount: 42.5, reason: "damaged item on arrival" } },
  });

  await waitForResponses(responses, [1, 2, 3]);
  child.kill();

  if (stdoutLines.length === 0) {
    console.error("DEBUG stderr:", stderrChunks.join(""));
  }
  assert.ok(stdoutLines.length > 0, "expected stdout output");
  assert.ok(responses.every((r) => r.jsonrpc === "2.0"), "every stdout line must be a JSON-RPC envelope");

  const invalidCallResponse = responses.find((r) => r.id === 2);
  assert.equal(invalidCallResponse.error?.code, -32602, "invalid customer_id must map to InvalidParams (-32602)");

  const refundResponse = responses.find((r) => r.id === 3);
  assert.ok(refundResponse.result, "valid trigger_refund call should succeed");

  console.log("PASS: stdio isolation + validation behave as expected");
  console.log(`(stderr captured ${stderrChunks.join("").split("\n").filter(Boolean).length} log lines, kept off stdout)`);
}

async function waitForResponses(responses: any[], ids: number[]): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < 2_000) {
    if (ids.every((id) => responses.some((r) => r.id === id))) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
