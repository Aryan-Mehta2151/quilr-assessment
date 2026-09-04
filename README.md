# Quilr FDE Assessment

This repo contains my implementation for the four concrete tasks in the Forward Deployed Engineer / AI Integration Engineer assessment.

Each task is kept as a separate small TypeScript project so it can be reviewed, run, and tested independently. The tasks cover MCP servers, MCP gateway authorization, streaming guardrails, and LLM routing resilience.

## Projects

| Task | Folder | What it does |
|---|---|---|
| Task 1 | `task1-mcp-server` | MCP server over stdio with strict Zod validation and clean stdout/stderr handling |
| Task 2 | `task2-mcp-gateway` | HTTP JSON-RPC MCP gateway that blocks unauthorized `admin_*` tool calls |
| Task 3 | `task3-streaming-guardrail` | Streaming LLM proxy that redacts emails, SSNs, and credit-card-like values in real time |
| Task 4 | `task4-rate-limit-router` | SQLite-backed token rate limiter with primary/secondary model fallback routing |

## Run everything

Each task has its own `package.json`, dependencies, tests, and README.

From any task folder:

```bash
npm install
npm run build
npm test
```

For example:

```bash
cd task1-mcp-server
npm install
npm run build
npm test
```

Repeat the same flow for the other task folders.

## Notes

The assessment overview mentioned five task areas, but the provided problem statement included four detailed implementation tasks. This repo implements those four concrete tasks.

I kept the projects separate because the runtimes are different:

- Task 1 is stdio-based MCP.
- Task 2 is HTTP JSON-RPC proxying.
- Task 3 is HTTP streaming.
- Task 4 is a routing/rate-limiting module with SQLite state.

That separation keeps the code easier to review and avoids mixing unrelated concerns into one process.
