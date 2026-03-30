# Custom Codex Executable Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Support overriding the Codex executable used by Anchor via `.env` using a single `CODEX_REMOTE_CODEX_PATH` value, while keeping default behavior unchanged.

**Architecture:** Add one new environment variable consumed by the Anchor process and both CLI doctor entrypoints. Anchor will resolve the executable path once and use it when spawning `app-server`. Unix shell and PowerShell doctor commands will mirror that same source of truth so diagnostics match runtime behavior.

**Tech Stack:** Bun, TypeScript, Bash, PowerShell, existing task CLI, Bun test

---

## File Map

- Modify: `services/anchor/src/index.ts`
  - Add env parsing for `CODEX_REMOTE_CODEX_PATH`
  - Route `app-server` spawn through the resolved executable
  - Improve startup failure message to include the configured executable when spawn fails
- Modify: `bin/codex-remote`
  - Add `CODEX_REMOTE_CODEX_PATH` to generated default `.env`
  - Update `doctor` to validate configured executable path or fall back to PATH lookup
- Modify: `bin/codex-remote.ps1`
  - Add `CODEX_REMOTE_CODEX_PATH` to generated default `.env`
  - Update `doctor` to validate configured executable path or fall back to PATH lookup
- Modify: `.env.example`
  - Document optional `CODEX_REMOTE_CODEX_PATH`
- Modify: `services/anchor/README.md`
  - Document optional override and expected format
- Test: `services/anchor/src/orbit-connection.test.ts` or a new focused test file near `services/anchor/src/index.ts`
  - Cover path resolution behavior in a small extracted helper

## Chunk 1: Anchor Executable Resolution

### Task 1: Extract executable resolution behind a testable helper

**Files:**
- Modify: `services/anchor/src/index.ts`
- Test: `services/anchor/src/orbit-connection.test.ts` or create `services/anchor/src/codex-executable.test.ts`

- [ ] **Step 1: Write the failing test**

Add tests for:
- empty `CODEX_REMOTE_CODEX_PATH` -> `"codex"`
- trimmed configured value -> configured path

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test services/anchor/src/*.test.ts`
Expected: FAIL because helper does not exist yet or behavior is not implemented

- [ ] **Step 3: Write minimal implementation**

Add a small helper that resolves:
- trimmed env value if non-empty
- `"codex"` otherwise

- [ ] **Step 4: Switch `app-server` spawn to the resolved helper**

Change the spawn command from:

```ts
cmd: ["codex", "app-server"]
```

to:

```ts
cmd: [resolvedCodexExecutable, "app-server"]
```

- [ ] **Step 5: Improve startup error logging**

When spawn fails, include the resolved executable in the error output so misconfigured paths are obvious.

- [ ] **Step 6: Run tests to verify they pass**

Run: `bun test services/anchor/src/*.test.ts`
Expected: PASS

## Chunk 2: Unix Doctor Alignment

### Task 2: Make bash doctor respect `.env` override

**Files:**
- Modify: `bin/codex-remote`

- [ ] **Step 1: Add `CODEX_REMOTE_CODEX_PATH=` to generated default `.env`**

Update `default_env_content()`.

- [ ] **Step 2: Load configured executable for doctor**

Reuse already sourced `.env` values after `ensure_env_file`.

- [ ] **Step 3: Implement doctor branch**

Behavior:
- if `CODEX_REMOTE_CODEX_PATH` is non-empty:
  - check file exists
  - check executable bit or command invocation viability
  - print pass/fail mentioning configured path
- else:
  - keep current `command -v codex` behavior

- [ ] **Step 4: Verify shell syntax**

Run a focused syntax check if available:
`sh -n bin/codex-remote`

Expected: no syntax errors

## Chunk 3: PowerShell Doctor Alignment

### Task 3: Make PowerShell doctor respect `.env` override

**Files:**
- Modify: `bin/codex-remote.ps1`

- [ ] **Step 1: Add `CODEX_REMOTE_CODEX_PATH=` to generated default `.env`**

Update `Get-DefaultEnvContent`.

- [ ] **Step 2: Read configured executable path in doctor**

Use the existing `.env` map loading path and inspect `CODEX_REMOTE_CODEX_PATH`.

- [ ] **Step 3: Implement doctor branch**

Behavior:
- configured path -> `Test-Path` + suitable message
- fallback -> existing `Get-Command codex`

- [ ] **Step 4: Run a PowerShell parse check**

Run:
`pwsh -NoProfile -Command "[scriptblock]::Create((Get-Content -Raw 'bin/codex-remote.ps1')) | Out-Null"`

Expected: no parse errors

## Chunk 4: Docs And Regression Verification

### Task 4: Document the new environment variable and verify behavior

**Files:**
- Modify: `.env.example`
- Modify: `services/anchor/README.md`
- Modify: `tasks/TASK-1774809551846-自定义-Codex-可执行文件选择支持/log.md`

- [ ] **Step 1: Document the env var in `.env.example`**

Add:

```env
# Optional: override the Codex executable used for `codex app-server`
# CODEX_REMOTE_CODEX_PATH=
```

- [ ] **Step 2: Document the env var in Anchor README**

Explain:
- default behavior
- when to use override
- path-only limitation

- [ ] **Step 3: Run focused verification**

Run:
- `bun test services/anchor/src/*.test.ts`
- `bun run lint`

Expected: relevant tests pass and lint stays green

- [ ] **Step 4: Update task status/log**

Record the implementation outcome and verification commands in task files.

