process.env.LLM_MOCK_PORT = "5100";
process.env.LLM_MOCK_URL = "http://localhost:5100";
process.env.GATEWAY_PORT = "5101";

import assert from "node:assert/strict";
import { startLlmMock } from "../src/llm-mock.js";
import { startGateway } from "../src/gateway.js";

const GATEWAY_URL = "http://localhost:5101";

async function streamScenario(scenario: string, chunkDelayMs: number) {
  const start = Date.now();
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenario, chunkDelayMs }),
  });
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();

  let assembled = "";
  let firstByteAt: number | null = null;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (firstByteAt === null) firstByteAt = Date.now();
    assembled += decoder.decode(value, { stream: true });
  }

  return { assembled, ttfbMs: firstByteAt! - start, totalMs: Date.now() - start };
}

async function main() {
  const llm = startLlmMock();
  const gateway = startGateway();
  await new Promise((r) => setTimeout(r, 200));

  const emailResult = await streamScenario("email_split", 15);
  assert.equal(emailResult.assembled, "Sure, contact me at [REDACTED] for details.");

  const ccResult = await streamScenario("credit_card_split", 15);
  assert.equal(ccResult.assembled, "Card number: [REDACTED], expires 12/29.");

  const longResult = await streamScenario("long_clean", 15);
  assert.ok(
    longResult.ttfbMs < longResult.totalMs * 0.5,
    `expected low TTFB relative to total stream time, got ttfb=${longResult.ttfbMs}ms total=${longResult.totalMs}ms`
  );

  console.log("PASS: end-to-end streaming redaction is correct and low-latency");
  console.log(`(long_clean scenario: first byte in ${longResult.ttfbMs}ms, full stream in ${longResult.totalMs}ms)`);

  llm.close();
  gateway.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
