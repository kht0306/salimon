---
trigger: always_on
---

# AGENTS.md

Behavioral guidelines for coding agents.
These instructions are intended to reduce unnecessary code changes, unsafe terminal usage, and common LLM coding mistakes.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State assumptions explicitly.
- If multiple interpretations exist, present them instead of choosing silently.
- If a simpler approach exists, say so.
- Push back when the requested solution seems overcomplicated or risky.
- If something is unclear and affects the implementation, ask before proceeding.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- Do not add features beyond what was requested.
- Do not create abstractions for single-use code.
- Do not add flexibility, configurability, or generic utilities unless needed now.
- Do not add error handling for impossible or irrelevant scenarios.
- If a solution becomes much larger than necessary, simplify it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own changes.**

When editing existing code:

- Do not improve adjacent code, comments, or formatting unless directly required.
- Do not refactor unrelated code.
- Match the existing project style.
- If unrelated dead code is found, mention it but do not delete it unless asked.

When your changes create orphans:

- Remove imports, variables, functions, and types that became unused because of your change.
- Do not remove pre-existing dead code unless explicitly requested.

Every changed line should clearly trace back to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" => write or identify checks for invalid inputs, then make them pass.
- "Fix the bug" => reproduce or explain the bug, then verify the fix.
- "Refactor X" => ensure behavior is preserved before and after.

For multi-step tasks, state a brief plan:

1. Step => verify with a concrete check.
2. Step => verify with a concrete check.
3. Step => verify with a concrete check.

## 5. Project Context & Tech Stack

- Salimon is a personal/shared finance management product. The current web app covers authentication, ledgers, transactions, cards/payment methods, categories, settlements, and receipt parsing.
- The repository is a pnpm workspace monorepo (`apps/*`, `packages/*`) using Node.js 24.15.0, pnpm 11.7.0, and strict TypeScript with ES modules.
- `apps/web` is a Next.js App Router application using React, Emotion (`@emotion/styled`) for component styling, MobX/MobX React Lite for client state, and Lucide React for icons.
- `apps/mobile` is currently a TypeScript scaffold and Android notification-integration plan, not a complete React Native application.
- Shared packages are split by responsibility: `@salimon/types`, `@salimon/domain`, `@salimon/api-client`, `@salimon/store`, and `@salimon/ui-tokens`. Preserve these boundaries when adding shared code.
- Supabase provides authentication, Postgres persistence, and row-level security. Database changes live as ordered SQL files under `supabase/migrations`.
- Tests use Vitest. Linting uses ESLint 9 with the Next.js Core Web Vitals and TypeScript configurations. Formatting follows the root Prettier configuration.
- Use the root scripts for repository-wide checks: `pnpm typecheck`, `pnpm lint`, and `pnpm test`. Build the web app with `pnpm build:web`.
- Follow `docs/design-system.md` for UI decisions. Do not introduce MUI, styled-components, or another styling/state library unless the user explicitly approves the dependency and migration cost.

## 6. Strict Development Guidelines

### Type Safety

- Always define explicit `interface` or `type` for props and important data structures.
- Do not introduce explicit `any` in new or modified TypeScript code. Do not clean up pre-existing type debt unless it is directly required by the task.
- Prefer `unknown` with proper narrowing when the type is genuinely uncertain.
- Do not suppress TypeScript errors with `// @ts-ignore` unless the user explicitly approves.

### React

- Prefer Server Components by default in the Next.js App Router.
- Use Client Components and React Hooks only when browser APIs, local interactivity, effects, or client-side state are required.
- Use functional components for both Server and Client Components.
- Keep components small and focused.
- Avoid unnecessary memoization.
- Do not introduce new state management libraries.

### Styling

- Prefer Emotion's styled API.
- Do not introduce MUI, styled-components, or any other styling library. Emotion is the only styling approach in this repo.
- Match the existing design system and naming conventions.

## 7. Agent Execution Workflow

### Planning Before Changes

Before making multi-step or non-trivial code changes:

- Present an implementation plan.
- Include exact file paths to be created or modified.
- Summarize the specific code changes.
- If the user's request already clearly authorizes the planned change, proceed without asking for approval again.
- Ask for explicit approval when the scope is materially ambiguous, the choice would change behavior or architecture, or the action is destructive, externally visible, or otherwise difficult to reverse.

For trivial, low-risk changes such as typos, formatting inside an already-touched file, or removing an unused import caused by the current change, briefly state the intended change and proceed.

## 8. Verification Order

Verify changes according to the tier below. For the selected tier, run the required checks in this order:

1. Type check: `pnpm typecheck`
2. Lint: `pnpm lint`
3. Build: `pnpm build:web`

Do not skip checks required by the selected tier. If a required check cannot be run, explain why and provide the safest manual check steps.

**Verification scope by change type.** Decide scope by what the change can break, not by how small it feels. Choose the lowest tier that fits; when unsure, use the higher tier. State the chosen tier and reason in one line (e.g., "Tier B: text-only edit, ran type check + lint, skipped build").

- **Tier A: skip all three.** Markdown-only and comment-only changes. Verify the edited files remain well-formed and internally consistent.
- **Tier B: type check + lint only; skip build.** Local presentational edits inside code that do not change imports, control flow, behavior, or types, such as label text and Emotion style values.
- **Tier C: type check + lint + build.** Everything else: new files or components, added or changed imports, logic or type changes, and any dependency or configuration change (`tsconfig`, `package.json`, framework configuration, and similar files). For logic or type changes, also run the relevant tests (`pnpm test`, or the specific package's test script).

**Command scope caveats.** These root scripts do not cover the whole repo uniformly: `pnpm lint` currently applies only to `apps/web`, `pnpm build:web` builds the web app only, and `pnpm test` runs via `pnpm -r --if-present test`, so it executes only where a `test` script exists (`apps/web`, `packages/domain`, `packages/api-client`). When changing a shared package under `packages/*`, run `pnpm typecheck` for repo-wide type coverage and run that package's tests directly.

## 9. Security & Sensitive Files

- Never read, print, modify, or expose secrets such as API keys, tokens, passwords, cookies, private keys, or credentials.
- Treat `.env`, `.env.*`, `.npmrc`, `.netrc`, `*.pem`, `*.key`, `*.pfx`, `*.p12`, `id_rsa*`, credential files, and config files containing secrets as sensitive.
- If a task requires environment variables, ask for variable names only, not secret values.
- Never commit, log, or suggest committing secrets.
- Do not run destructive commands such as deleting large directories, `git reset --hard`, or force-pushing without explicit confirmation.
- Do not install new dependencies without explaining why they are necessary.

## 10. Dependency Policy

Before adding a new dependency:

- Check whether the project already has a suitable dependency.
- Prefer built-in browser APIs or existing utilities.
- Explain the tradeoff of adding the dependency.
- Ask for approval before modifying dependency files.

## 11. Output Style

When responding:

- Be concise but explicit.
- Prefer tables for comparing options.
- Explain tradeoffs clearly.
- Do not hide uncertainty.
- Mention risks or assumptions before implementation.

# Development environments

This repository is developed on two machines. Detect the current platform and follow the matching profile. Never assume one machine's paths or tooling on the other.

Runtime/setup environment variables for `apps/web/.env.local` are documented in `docs/environment.md` (treat their values as secrets per the Security section).

## Windows (company PC)

- Project root: `C:\Users\ssc\personal\salimon`. Run all commands and resolve relative paths from here. Do not search the filesystem for the repository unless this path no longer exists.
- Node 24.15.0 is managed by Volta (`"volta": { "node": "24.15.0" }` in `package.json`).
- Start the web development server with `pnpm dev:seoulsys` (this script hardcodes the Volta Node path and is Windows-only).

## macOS (personal PC)

- Project root: _TODO — fill in the absolute macOS repo path (NOT the Windows path)._ Until filled in, resolve the repo root from the current working directory.
- Node manager: _TODO — fill in (NOT Volta)._ Ensure Node 24.15.x is active.
- Start the web development server with `pnpm dev:web`. Do NOT use `pnpm dev:seoulsys` — it hardcodes the Windows Volta path and fails on macOS.

# Delivery defaults

- Unless the user explicitly requests otherwise, finish every code change by committing it and pushing it directly to `origin/main`.
- If repository protection rejects a direct `main` push, push a task branch, open a pull request, wait for required checks, and merge it into `main` instead.
- Unless the user explicitly requests otherwise, apply new Supabase migrations to the linked remote project as part of the same delivery. Apply via the Supabase CLI. The linked project is configured locally (`supabase link`), not stored in the repo (there is no `supabase/config.toml`).
- Run relevant tests, type checks, lint, and builds before pushing. Do not push when required verification fails; fix the failure first or report the blocker.
- Never rewrite or force-push shared history. Preserve unrelated user changes and include only changes made for the current request.

These guidelines are working if:

- Diffs are smaller.
- Fewer unrelated files are changed.
- Fewer unnecessary abstractions are introduced.
- The agent asks clarifying questions before risky implementation.
- Verification steps are concrete and repeatable.
