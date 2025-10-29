# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Cloudflare Workers** project named "monica". It's a serverless application that runs on Cloudflare's edge network. The project uses TypeScript and is configured with strict type checking.

## Architecture

### Worker Structure
- **Entry Point**: [src/index.ts](src/index.ts) - Exports a default object satisfying `ExportedHandler<Env>` interface
- **Handler Pattern**: The worker implements a `fetch` handler that receives `(request, env, ctx)` parameters
  - `request`: The incoming HTTP request
  - `env`: Environment bindings (typed via `Env` interface from worker-configuration.d.ts)
  - `ctx`: Execution context for async operations like `ctx.waitUntil()`

### Type System
- **Configuration Types**: [worker-configuration.d.ts](worker-configuration.d.ts) - Auto-generated type definitions for Cloudflare bindings
- **Env Interface**: Defines the shape of environment variables and resource bindings available to the worker
- **Type Generation**: Run `npm run cf-typegen` after modifying [wrangler.jsonc](wrangler.jsonc) to regenerate types

### Configuration
- **Worker Config**: [wrangler.jsonc](wrangler.jsonc) - Primary configuration for deployment, bindings, and runtime settings
  - `main`: Points to src/index.ts as the entry point
  - `compatibility_date`: Defines the Cloudflare Workers runtime version
  - Bindings for databases, KV stores, R2, etc. are defined here (currently none configured)

## Development Commands

### Running the Worker
```bash
npm run dev        # Start local development server on http://localhost:8787
npm start          # Alias for npm run dev
```

### Testing
```bash
npm test           # Run all tests with Vitest
```

The test suite uses `@cloudflare/vitest-pool-workers` which provides:
- **Unit-style tests**: Import the worker and call `worker.fetch()` directly with mocked `env` and `ctx`
- **Integration-style tests**: Use the `SELF` binding to make actual HTTP requests to the worker

Test utilities from `cloudflare:test`:
- `env`: Mock environment object
- `createExecutionContext()`: Create execution context for unit tests
- `waitOnExecutionContext(ctx)`: Wait for all promises passed to `ctx.waitUntil()` to settle
- `SELF`: Integration test binding to make real requests

### Deployment
```bash
npm run deploy     # Deploy to Cloudflare Workers
```

### Type Generation
```bash
npm run cf-typegen # Regenerate worker-configuration.d.ts after changing wrangler.jsonc
```

## Key Patterns

### Adding Bindings
To add resources (KV, R2, D1, etc.):
1. Add the binding configuration to [wrangler.jsonc](wrangler.jsonc)
2. Run `npm run cf-typegen` to update types
3. Access the binding via the `env` parameter: `env.MY_BINDING`

### Testing New Handlers
- Use unit-style tests for logic testing (faster, isolated)
- Use integration-style tests with `SELF.fetch()` for end-to-end testing
- Always call `waitOnExecutionContext(ctx)` before assertions in unit tests

### TypeScript Configuration
- The project uses strict mode with `isolatedModules: true`
- Module resolution is set to "Bundler" (modern bundler-aware resolution)
- JSX is configured for React (though not currently used)
- Tests are excluded from the main compilation
