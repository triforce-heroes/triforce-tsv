# AGENTS.md

## 1. Project overview

Library `@triforce-heroes/triforce-tsv` (`Extract and rebuild TSV.`).

Stack: TypeScript (strict, `ESNext` target, `Bundler` module resolution, `node` types), ESM
(`type: module`), Node runtime (`Buffer` UTF-8 I/O, `tsdown` platform `node`, `minify: true`), `bun`
runner (`bun.lock` committed), `tsdown` build, `vitest` tests, `tsc --noEmit` typecheck, `oxlint` +
`oxfmt` via `@rheactor/rheactor-oxc-config`, `tsx` for the watch tool.

Entry points (see `package.json` `exports` and `tsdown.config.ts` `entry`):

- `src/Extract.ts` -> `@triforce-heroes/triforce-tsv/Extract` (`dist/Extract.mjs`,
  `dist/Extract.d.mts`).
- `src/Rebuild.ts` -> `@triforce-heroes/triforce-tsv/Rebuild` (`dist/Rebuild.mjs`,
  `dist/Rebuild.d.mts`).

Purpose: parse locale TSV payloads (stored with a `.csv` extension, 3 tab-separated columns `key`,
`value`, `metadata`, `#` comment lines) into a `Document` and rebuild or selectively patch them,
treating the third column as a free-form comment (`notes` on the entry) and sync into
`@triforce-heroes/triforce-publisher`.

Folder structure:

- `src/Extract.ts`: public `extract` function.
- `src/Rebuild.ts`: public `rebuildRaw` and `rebuild` functions.
- `src/services/Parser.ts`: internal TSV lexer (`isIgnorable`, `parseFields`, `serializeField`,
  `unescapeText`, `escapeText`, `normalizeGroup`, `resolveKey`).
- `src/services/PublisherSync.ts`: internal `addDocumentToPublisher` bridge.
- `src/types/Document.ts`: shared types (`Document`, `Entry`).
- `tests/`: `Extract.test.ts`, `Rebuild.test.ts`, `PublisherSync.test.ts`, `fixtures/*.csv` (12
  locale files: `en/de/es/fr/it/ru` plus `_conversations` variants), `__snapshots__/*.snap`.
- `tools/watch.ts`: dev-only script that extracts every `tests/fixtures/*.csv` file and saves a
  `Publisher` snapshot into `tools/resources/`.
- `tools/resources/`: generated output (`entries.json`, `letters.json`, `query_v1.json`,
  `query_v1.sql`, `uniques.json`); only `.gitignore` is tracked.
- `dist/`: tracked build output (`.mjs` + `.d.mts`).
- Configs: `tsconfig.json`, `tsdown.config.ts`, `vitest.config.ts`, `oxlint.config.ts`,
  `oxfmt.config.ts`, `bun.lock`.

## 2. Mandatory rules

- Public API lives only in `src/Extract.ts` (`extract`) and `src/Rebuild.ts` (`rebuildRaw`,
  `rebuild`). Everything under `src/services/` and `src/types/` is a helper; do not add new package
  export paths without updating `package.json` `exports`, `tsdown.config.ts` `entry`, and
  `README.md`.
- Import source files through the `#/*` alias (`#/*` -> `./src/*`, `#tests/*` -> `./tests/*` per
  `package.json` `imports` and `tsconfig.json` `paths`). Example:
  `import { extract } from "#/Extract"`. Use the `node:` prefix for Node builtins
  (`node:fs/promises`, `node:path`, `node:os`).
- Naming: `camelCase` for functions and variables (`extract`, `rebuildRaw`, `valuePatch`),
  `PascalCase` for types and interfaces (`Document`, `Entry`, `Publisher`), `UPPER_SNAKE_CASE` for
  constants (`BOM`).
- Text contract: public functions accept `string | Buffer` and decode input as UTF-8. `extract`
  strips one leading BOM. Lines are split on `\n` with one trailing `\r` stripped. Output is a UTF-8
  `Buffer` with `\n` separators: `rebuildRaw` appends a trailing `\n` (empty document yields an
  empty buffer), `rebuild` preserves the original line layout and returns ignorable lines verbatim.
- TSV contract: every data row has exactly 3 tab columns. Quoted fields use `""` to escape `"`.
  `serializeField` quotes only fields starting with `"` or `#` or containing `\t`, `\r`, `\n`. Empty
  notes serialize to `""`. Non-empty third column is stored verbatim as `notes`; no `Speaker=` /
  `Notes=` parsing and no synthetic entries are generated.
- Ignorable lines (`src/services/Parser.ts` `isIgnorable`): empty lines, lines starting with `#`,
  and lines containing only spaces/tabs are skipped by `extract`/`rebuildRaw` and passed through
  untouched by `rebuild`.
- Failures use `throw new Error(...)` with these message shapes: `duplicate key: "<key>"`,
  `invalid row: expected 3 columns but got <n> in line: "<line>"`,
  `invalid row: empty key in line: "<line>"`, `unterminated quoted field in line: "<line>"`.
- Publisher bridge (`src/services/PublisherSync.ts` `addDocumentToPublisher`): every entry maps
  `node.notes` to the `{ notes }` publisher metadata record.
- Dev tool (`tools/watch.ts`): `new Publisher(10)`, languages `en`, `de`, `es`, `fr`, `it`, `ru`,
  file pattern `/^(?<lang>[a-z]{2})(?<conversations>_conversations)?\.csv$/v`, resource `strings`
  (plain files) versus `conversations` (`*_conversations.csv`), output directory `tools/resources`.
  Keep this file covered by lint (`./tools` is in the `oxlint`/`oxfmt` scopes).
- This file is the authority on agent conventions. The code wins over prose: when a rule below
  disagrees with the implementation, fix the rule and report it. `README.md` and `CHANGELOG.md` are
  maintained by the `/create-agents` skill; do not hand-edit generated entries outside a skill run.

## 3. Testing policy

- Framework: `vitest` (`^5.0.0`). Run with `bun run test` (`vitest --run`); `bun run test:watch`
  (`vitest`) for watch mode. Config: `vitest.config.ts` with `fileParallelism: false`,
  `isolate: false`, `fsModuleCache: true`.
- Location and naming: test files live in `tests/*.test.ts` (`Extract.test.ts`, `Rebuild.test.ts`,
  `PublisherSync.test.ts`). Snapshots live in `tests/__snapshots__/*.snap`. Fixtures live in
  `tests/fixtures/*.csv`. Snapshot tests iterate every fixture file sorted with `localeCompare`.
- No minimum coverage is configured (no `coverage` section in `vitest.config.ts`); do not claim a
  threshold.
- Every bug fix must add or update a regression test that fails before the fix and passes after it.
  Round-trip behavior (`extract` -> `rebuildRaw` -> `extract`) is covered per fixture in
  `tests/Rebuild.test.ts`; keep that coverage when touching the parser or serializer.

## 4. Documentation format

`README.md` is self-hosted by this repo and follows the library template. Each public function entry
uses exactly this shape:

````markdown
### functionName

```ts
functionName(input: string | Buffer): TsvDocument;
```

What it does. When to use it. Notable edge-case behavior.

```ts
import { functionName } from "@triforce-heroes/triforce-tsv/Extract";

const output = functionName("next\tNext\t\n");
// expected output as a comment
```
````

Rules: H1 is the verbatim `package.json` `name`; the tagline is the verbatim `package.json`
`description`; `Installation` states the real install command including GitHub-protocol
particularities; `Quick start` is a minimal copyable example immediately after installation; entry
points come first (`# Extract functions`, `# Rebuild functions`); functions inside each entry point
are `###` sections; every overload of one function shares a single signature code block; the prose
states what it does, when to use it, and edge-case behavior in that order; the second code block is
a minimal TypeScript example whose expected output is a comment. Existing badges, logos, custom
sections, and authorial paragraphs stay intact in their original position.

## 5. Dependencies, environment, and build

- Dependency policy: official manager is `bun` (`bun.lock` is committed, all scripts run via
  `bun run <script>`). Runtime: `@rheactor/rheactor-core`, `@triforce-heroes/triforce-core` (both
  `github:` protocol). Dev: `@rheactor/rheactor-oxc-config`, `@triforce-heroes/triforce-publisher`,
  `@types/node`, `oxfmt`, `oxlint`, `oxlint-tsgolint`, `tsdown`, `tsx`, `typescript`, `vitest`. Zero
  new dependencies without justification; prefer the standard library or an already-listed package
  and note the suggestion separately instead of installing it.
- Environment variables: none. No `process.env` usage was found in `src/` or `tools/`, and no
  `.env.example` exists. If a variable is ever introduced, document it and update `.env.example`
  without committing real values.
- Build and publication: `tsdown` with `entry: ["./src/Extract.ts", "./src/Rebuild.ts"]`,
  `minify: true`, `platform: "node"`. Published files: `dist` only (`package.json` `files`). Package
  is ESM-only (`type: module`) with explicit `./Extract` and `./Rebuild` export maps
  (`./dist/*.mjs` + `./dist/*.d.mts`). License: `Apache License 2.0` (see `LICENSE`). Note: `dist/`
  output is tracked in git in this repo.

## 6. Quality gates

Reference pattern recognized in this repo: `build` via `tsdown`, `lint` =
`bun run typecheck && bun run oxlint && bun run oxfmt`, `test` via `vitest --run`, `typecheck` via
`tsc --noEmit`. Always invoke through `bun run <script>`, never the underlying binary directly.

Existing scripts (`package.json`):

- `build`: `bun run lint && bun run test && tsdown`.
- `lint`: `bun run typecheck && bun run oxlint && bun run oxfmt`.
- `lint:fix`: `bun run typecheck && bun run oxlint:fix && bun run oxfmt:fix`.
- `oxfmt`: `oxfmt --check ./src ./tests ./tools`.
- `oxfmt:fix`: `oxfmt --write ./src ./tests ./tools`.
- `oxlint`: `oxlint ./src ./tests ./tools`.
- `oxlint:fix`: `oxlint --fix ./src ./tests ./tools`.
- `test`: `vitest --run`.
- `test:watch`: `vitest`.
- `typecheck`: `tsc --noEmit`.
- `watch`: `tsx --watch ./tools/watch.ts`.

Run `bun run lint` and `bun run test` after code changes; `bun run build` is the full gate (lint +
test + `tsdown`).
