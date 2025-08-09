### TODO (csv-utils)

Prioritized tasks to evolve into a monorepo with shared core, CLI, and a lightweight web UI.

### Now

- [ ] Convert to npm workspaces monorepo
  - [ ] Root `package.json` with `workspaces: ["packages/*", "apps/*"]`
  - [ ] Add `tsconfig.base.json` and reference it from all packages/apps
  - [ ] Move current CLI into `apps/cli` (preserve behavior and bin)
- [ ] Create `packages/core`
  - [ ] Extract pure search-by-column function (no FS/DOM)
  - [ ] Export types for rows/headers and match options
  - [ ] Unit tests with Vitest (use `test`)
- [ ] Create `packages/io-node`
  - [ ] Node CSV adapters using `csv-parse`/`csv-stringify`
  - [ ] Streaming API for large files
  - [ ] Tests for I/O paths (fixtures)
- [ ] Refactor `apps/cli` to use `core` + `io-node`
  - [ ] Keep current CLI flags and output identical
  - [ ] Prepare for future subcommands (internal command router)

### Next (Web UI MVP)

- [ ] Scaffold `apps/web` with Vite + React + TS
- [ ] Create `packages/io-browser` (PapaParse-based)
- [ ] Minimal UI features
  - [ ] Upload one or more CSV files
  - [ ] Read headers, pick a column, enter keyword
  - [ ] Display matching rows in a table (`@tanstack/react-table`)
  - [ ] Download result as CSV
  - [ ] Use `useCallback`/`useCallbackRef` instead of disabling `exhaustive-deps`
- [ ] Basic component/unit tests with Vitest + happy-dom (use `test`)

### DX / Quality

- [ ] Shared ESLint/Prettier configs in `configs/`
- [ ] Vitest config shared where possible
- [ ] GitHub Actions: install, build, test for all workspaces

### Features (incremental)

- [ ] Promote single binary name `csv-utils` with subcommands; keep `csv-search` alias
- [ ] CLI/Web options: delimiter, quote, escape, BOM handling
- [ ] More ops: select columns, filter predicates, dedupe, concat, join on key, transforms
- [ ] Progress reporting and memory-friendly streaming for very large files
- [ ] Better errors when headers/columns are missing; suggest closest matches

### Later

- [ ] Desktop option (Tauri) if native FS workflows are needed
- [ ] Performance experiments (WASM CSV parser) if bottlenecks appear
- [ ] Publishing and versioning strategy for packages
