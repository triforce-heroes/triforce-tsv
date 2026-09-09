import {
  DEFAULT_GROUP,
  isIgnorable,
  normalizeGroup,
  parseFields,
  parseMetadata,
  resolveKey,
  serializeField,
  serializeMetadata,
} from "#/services/Parser";
import { SPEAKER_SUFFIX } from "#/types/Document";
import type { Document } from "#/types/Document";

export function rebuildRaw(document: Document): Buffer {
  const entries: Document = [];
  const speakers = new Map<string, string>();
  const keys = new Set<string>();

  for (const node of document) {
    if (node.key.endsWith(SPEAKER_SUFFIX)) {
      const sourceKey = node.key.slice(0, -SPEAKER_SUFFIX.length);

      if (speakers.has(sourceKey)) {
        throw new Error(`duplicate speaker for key: "${sourceKey}"`);
      }

      speakers.set(sourceKey, node.value);
    } else {
      keys.add(node.key);
      entries.push(node);
    }
  }

  for (const sourceKey of speakers.keys()) {
    if (!keys.has(sourceKey)) {
      throw new Error(`orphan speaker: "${sourceKey}${SPEAKER_SUFFIX}"`);
    }
  }

  const lines = entries.map((entry) => {
    const metadata = serializeMetadata(entry.metadata, speakers.get(entry.key));
    const head = `${serializeField(entry.key)}\t${serializeField(entry.value)}`;

    return metadata === "" ? head : `${head}\t${serializeField(metadata)}`;
  });

  if (lines.length === 0) {
    return Buffer.from("", "utf-8");
  }

  return Buffer.from(`${lines.join("\n")}\n`, "utf-8");
}

export function rebuild(data: string | Buffer, entries: Map<string, string>): Buffer {
  const text = typeof data === "string" ? data : data.toString("utf-8");
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
    const value = fields.at(1)!;
    const metadataRaw = fields.at(2) ?? "";

    if (rawKey === "") {
      throw new Error(`invalid row: empty key in line: "${content}"`);
    }

    const key = resolveKey(rawKey, group);
    const valuePatch = entries.get(key);
    const speakerPatch = entries.get(`${key}${SPEAKER_SUFFIX}`);

    let nextMetadata = metadataRaw;

    if (speakerPatch !== undefined) {
      const { metadata } = parseMetadata(metadataRaw);
      nextMetadata = serializeMetadata(metadata, speakerPatch);
    }

    const head = `${serializeField(key)}\t${serializeField(valuePatch ?? value)}`;

    return nextMetadata === "" ? head : `${head}\t${serializeField(nextMetadata)}`;
  });

  return Buffer.from(lines.join("\n"), "utf-8");
}
