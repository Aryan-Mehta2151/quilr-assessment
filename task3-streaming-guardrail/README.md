# Task 3 - Streaming PII Redaction Guardrail

This is a simple LLM gateway that receives a streaming response from a mock provider, redacts sensitive data while the text is still streaming, and sends the cleaned text back to the client.

The goal is to avoid waiting for the whole model response before checking it. The gateway should stay responsive, but still catch PII that may be split across chunks.

## Run it

```bash
npm install
npm run build
npm test
```

To run it manually, use two terminals:

```bash
npm run start:llm
npm run start:gateway
```

The mock LLM runs on `http://localhost:5000`. The gateway runs on `http://localhost:5001`.

Example:

```powershell
Invoke-WebRequest -Uri http://localhost:5001 -Method Post -ContentType "application/json" `
  -Body '{"scenario":"email_split","chunkDelayMs":100}'
```

## What is implemented

`src/llm-mock.ts` simulates a streaming LLM response. It has scenarios for clean text, email addresses, SSNs, credit cards, and values split across chunk boundaries.

`src/redactor.ts` is the main guardrail. It keeps a small trailing buffer instead of storing the whole response. That lets it catch things like `john.doe@exam` in one chunk and `ple.com` in the next chunk.

The redactor replaces matching sensitive data with:

```text
[REDACTED]
```

It currently checks for:

- email addresses
- SSNs like `123-45-6789`
- credit card-like numbers with spaces or dashes

`src/gateway.ts` calls the upstream mock provider, reads the response stream chunk by chunk, passes each chunk through the redactor, and writes safe output back to the client as soon as possible.

## Test coverage

`test/redactor.test.ts` checks the redaction logic directly, including PII split across chunks.

`test/stream.test.ts` runs the mock LLM and gateway together over real HTTP and checks both correctness and latency. The latency check proves the gateway is streaming progressively instead of buffering the whole response first.
