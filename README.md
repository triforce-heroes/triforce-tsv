# @triforce-heroes/triforce-tsv

Extract and rebuild TSV.

## Installation

```sh
bun install
```

```sh
bun add @triforce-heroes/triforce-tsv
```

Runtime dependencies resolve through the `github:` protocol (`@rheactor/rheactor-core`,
`@triforce-heroes/triforce-core`), so no extra registry configuration is needed beyond a working
`bun` install.

## Quick start

```ts
import { extract } from "@triforce-heroes/triforce-tsv/Extract";
import { rebuildRaw } from "@triforce-heroes/triforce-tsv/Rebuild";

const document = extract("next\tNext\t\n");
// [{ key: "next", value: "Next" }]

const output = rebuildRaw(document).toString("utf-8");
// "next\tNext\t\n"
```

## Types

```ts
interface TsvEntry {
  key: string;
  value: string;
  notes?: string;
}

type TsvDocument = TsvEntry[];
```

`TsvDocument` is the in-memory form used by every entry point. The third column is a free-form
comment kept verbatim as `notes?: string` on the entry; `Speaker=` and `Notes=` have no special
meaning and never generate synthetic entries.

# Extract functions

### extract

```ts
extract(input: string | Buffer): TsvDocument;
```

Parses a locale TSV payload into a `TsvDocument`. Use it to load a fixture or patch source before
editing or syncing. It strips one leading BOM, skips empty lines, `#` comments, and whitespace-only
lines, and throws on duplicate keys, empty keys, or rows without exactly 3 tab columns.

```ts
import { extract } from "@triforce-heroes/triforce-tsv/Extract";

const document = extract("next\tNext\t\n");
// [{ key: "next", value: "Next" }]

const withComment = extract("conversation_a\tHi.\tSpeaker=Fen Notes=Comes up.\n");
// [{ key: "conversation_a", value: "Hi.", notes: "Speaker=Fen Notes=Comes up." }]
```

# Rebuild functions

### rebuild

```ts
rebuild(data: string | Buffer, entries: Map<string, string>): Buffer;
```

Patches selected values in an existing TSV payload and returns a UTF-8 `Buffer`. Use it for
translations when comments and untouched rows must stay byte-identical. Keys absent from the map are
returned verbatim, the comment column is carried through as-is, and unknown patch keys are ignored.

```ts
import { rebuild } from "@triforce-heroes/triforce-tsv/Rebuild";

const output = rebuild("next\tNext\t\n", new Map([["next", "Seguinte"]])).toString("utf-8");
// "next\tSeguinte\t\n"
```

### rebuildRaw

```ts
rebuildRaw(document: TsvDocument): Buffer;
```

Serializes a `TsvDocument` from scratch into a UTF-8 `Buffer` with `\n` line endings. Use it to emit
a clean payload without comments. It writes each entry's `notes` verbatim into the third column and
returns an empty buffer for an empty document.

```ts
import { rebuildRaw } from "@triforce-heroes/triforce-tsv/Rebuild";

const output = rebuildRaw([{ key: "next", value: "Next" }]).toString("utf-8");
// "next\tNext\t\n"
```

## License

Apache License 2.0. See `LICENSE`.
