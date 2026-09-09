import { isIgnorable, parseFields, parseMetadata } from "#/services/Parser";
import { SPEAKER_SUFFIX } from "#/types/Document";
import type { Document } from "#/types/Document";

const BOM = "\uFEFF";

export function extract(input: string | Buffer): Document {
  const text = typeof input === "string" ? input : input.toString("utf-8");
  const source = text.startsWith(BOM) ? text.slice(1) : text;

  const document: Document = [];
  const seen = new Set<string>();

  function claim(key: string): void {
    if (seen.has(key)) {
      throw new Error(`duplicate key: "${key}"`);
    }

    seen.add(key);
  }

  for (const raw of source.split("\n")) {
    const content = raw.endsWith("\r") ? raw.slice(0, -1) : raw;

    if (isIgnorable(content)) {
      continue;
    }

    const fields = parseFields(content);

    if (fields.length !== 2 && fields.length !== 3) {
      throw new Error(
        `invalid row: expected 2 or 3 columns but got ${fields.length} in line: "${content}"`,
      );
    }

    const key = fields.at(0)!;
    const value = fields.at(1)!;
    const metadataRaw = fields.at(2) ?? "";

    if (key === "") {
      throw new Error(`invalid row: empty key in line: "${content}"`);
    }

    claim(key);

    const { metadata, speaker } = parseMetadata(metadataRaw);

    if (metadata === undefined) {
      document.push({ key, value });
    } else {
      document.push({ key, value, metadata });
    }

    if (speaker !== undefined) {
      const speakerKey = `${key}${SPEAKER_SUFFIX}`;
      claim(speakerKey);
      document.push({ key: speakerKey, value: speaker });
    }
  }

  return document;
}
