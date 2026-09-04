import assert from "node:assert/strict";
import { StreamRedactor } from "../src/redactor.js";
import { SCENARIOS } from "../src/llm-mock.js";

const RAW_PII_CHECK = /[\w.+-]+@[\w-]+\.[\w.-]+|\d{3}-\d{2}-\d{4}|(?:\d[ -]?){13,16}/;

const EXPECTED: Record<string, string> = {
  clean: "Hello, how can I help you today? No sensitive data here.",
  email_one_chunk: "Sure, contact me at [REDACTED] for details.",
  email_split: "Sure, contact me at [REDACTED] for details.",
  ssn_split: "My SSN is [REDACTED], please keep it safe.",
  credit_card_split: "Card number: [REDACTED], expires 12/29.",
  multiple_pii: "Email [REDACTED], SSN [REDACTED], card [REDACTED] done.",
};

function runScenario(name: string): string {
  const redactor = new StreamRedactor();
  let assembled = "";
  for (const chunk of SCENARIOS[name]) {
    const safe = redactor.push(chunk);
    assert.ok(!RAW_PII_CHECK.test(safe), `scenario "${name}" leaked raw PII in an intermediate chunk: "${safe}"`);
    assembled += safe;
  }
  assembled += redactor.flush();
  return assembled;
}

function main() {
  for (const [name, expected] of Object.entries(EXPECTED)) {
    const actual = runScenario(name);
    assert.equal(actual, expected, `scenario "${name}" mismatch`);
  }
  console.log("PASS: redactor handles clean text, single-chunk PII, and cross-chunk-split PII correctly");
}

main();
