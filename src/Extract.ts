import {
  DEFAULT_GROUP,
  isIgnorable,
  normalizeGroup,
  parseFields,
  resolveKey,
} from "#/services/Parser";
import type { Document } from "#/types/Document";

const BOM = "\uFEFF";

export function extract(input: string | Buffer): Document {
  const text = typeof input === "string" ? input : input.toString("utf-8");
  const source = text.startsWith(BOM) ? text.slice(1) : text;

  const document: Document = [];
  const seen = new Set<string>();
  let group = DEFAULT_GROUP;

  function claim(key: string): void {
    if (seen.has(key)) {
      throw new Error(`duplicate key: "${key}"`);
    }

    seen.add(key);
  }

  for (const raw of source.split("\n")) {
    const content = raw.endsWith("\r") ? raw.slice(0, -1) : raw;

    if (isIgnorable(content)) {
      const next = normalizeGroup(content);

      if (next !== undefined) {
        group = next;
      }

      continue;
    }

    const fields = parseFields(content);

    if (fields.length !== 2 && fields.length !== 3) {
      throw new Error(
        `invalid row: expected 2 or 3 columns but got ${fields.length} in line: "${content}"`,
      );
    }

    const rawKey = fields.at(0)!;
    const value = fields.at(1)!;
    const notesRaw = fields.at(2) ?? "";

    if (rawKey === "") {
      throw new Error(`invalid row: empty key in line: "${content}"`);
    }

    const key = resolveKey(rawKey, group);

    claim(key);

    if (notesRaw === "") {
      document.push({ key, value });
    } else {
      document.push({ key, value, notes: notesRaw });
    }
  }

  return document;
}
