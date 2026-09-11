import {
  DEFAULT_GROUP,
  isIgnorable,
  normalizeGroup,
  parseFields,
  resolveKey,
  serializeField,
} from "#/services/Parser";
import type { Document } from "#/types/Document";
import type { RebuildOptions } from "#/types/RebuildOptions";

export function rebuildRaw(document: Document, options: RebuildOptions = {}): Buffer {
  const withNotes = options.notes ?? true;

  const lines = document.map((entry) => {
    const head = `${serializeField(entry.key)}\t${serializeField(entry.value)}`;

    if (!withNotes || entry.notes === undefined) {
      return head;
    }

    return `${head}\t${serializeField(entry.notes)}`;
  });

  if (lines.length === 0) {
    return Buffer.from("", "utf-8");
  }

  return Buffer.from(`${lines.join("\n")}\n`, "utf-8");
}

export function rebuild(
  data: string | Buffer,
  entries: Map<string, string>,
  options: RebuildOptions = {},
): Buffer {
  const text = typeof data === "string" ? data : data.toString("utf-8");
  const withNotes = options.notes ?? true;
  let group = DEFAULT_GROUP;

  const lines = text.split("\n").map((raw) => {
    const content = raw.endsWith("\r") ? raw.slice(0, -1) : raw;

    if (isIgnorable(content)) {
      const next = normalizeGroup(content);

      if (next !== undefined) {
        group = next;
      }

      return content;
    }

    const fields = parseFields(content);

    if (fields.length !== 2 && fields.length !== 3) {
      throw new Error(
        `invalid row: expected 2 or 3 columns but got ${fields.length} in line: "${content}"`,
      );
    }

    const rawKey = fields.at(0)!;
    const rawValue = fields.at(1)!;
    const notesRaw = fields.at(2) ?? "";

    if (rawKey === "") {
      throw new Error(`invalid row: empty key in line: "${content}"`);
    }

    const key = resolveKey(rawKey, group);
    const valuePatch = entries.get(key) ?? (key === rawKey ? undefined : entries.get(rawKey));

    if (!withNotes) {
      if (fields.length === 2 && valuePatch === undefined) {
        return content;
      }

      const value = valuePatch ?? rawValue;

      return `${serializeField(rawKey)}\t${serializeField(value)}`;
    }

    if (valuePatch === undefined) {
      return content;
    }

    const head = `${serializeField(rawKey)}\t${serializeField(valuePatch)}`;

    return notesRaw === "" ? head : `${head}\t${serializeField(notesRaw)}`;
  });

  return Buffer.from(lines.join("\n"), "utf-8");
}
