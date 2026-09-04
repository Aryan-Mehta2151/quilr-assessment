import { createServer, IncomingMessage, ServerResponse } from "node:http";

export const SCENARIOS: Record<string, string[]> = {
  clean: ["Hello, ", "how can I ", "help you today? ", "No sensitive data here."],
  email_one_chunk: ["Sure, contact me at john.doe@example.com for details."],
  email_split: ["Sure, contact me at john.doe@exam", "ple.com for details."],
  ssn_split: ["My SSN is 123-", "45-6789, please keep it safe."],
  credit_card_split: ["Card number: 4111 1111 ", "1111 1111, expires 12/29."],
  multiple_pii: ["Email jane@test.com, SSN 987-", "65-4321, card 4222 2222 2222 2222 done."],
  long_clean: Array.from({ length: 20 }, (_, i) => `word${i} `),
};

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  if (req.method !== "POST") {
    res.writeHead(405).end("Only POST supported");
    return;
  }

  const raw = await readBody(req);
  let body: { scenario?: string; chunkDelayMs?: number } = {};
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    res.writeHead(400).end("Invalid JSON body");
    return;
  }

  const chunks = SCENARIOS[body.scenario ?? "clean"];
  if (!chunks) {
    res.writeHead(400).end(`Unknown scenario: ${body.scenario}`);
    return;
  }
  const delayMs = body.chunkDelayMs ?? 15;

  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Transfer-Encoding": "chunked" });
  for (const chunk of chunks) {
    res.write(chunk);
    await sleep(delayMs);
  }
  res.end();
});

export function startLlmMock(port = Number(process.env.LLM_MOCK_PORT ?? 5000)) {
  return server.listen(port, () => {
    console.error(`[llm-mock] listening on http://localhost:${port}`);
  });
}
