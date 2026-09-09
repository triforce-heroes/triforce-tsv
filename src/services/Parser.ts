import type { Metadata } from "#/types/Document";

export const SPEAKER_PREFIX = "Speaker=";

export const NOTES_SEPARATOR = " Notes=";

export function isIgnorable(content: string): boolean {
  if (content.length === 0) {
    return true;
  }

  const first = content.codePointAt(0);

  if (first === 35) {
    return true;
  }

  if (first !== 32 && first !== 9) {
    return false;
  }

  for (let index = 1; index < content.length; index++) {
    const code = content.codePointAt(index);

    if (code !== 32 && code !== 9) {
      return false;
    }
  }

  return true;
}

export function parseFields(line: string): string[] {
  if (!line.includes('"')) {
    const first = line.indexOf("\t");

    if (first === -1) {
      return [line];
    }

    const second = line.indexOf("\t", first + 1);

    if (second === -1) {
      return [line.slice(0, first), line.slice(first + 1)];
    }

    if (line.includes("\t", second + 1)) {
      return line.split("\t");
    }

    return [line.slice(0, first), line.slice(first + 1, second), line.slice(second + 1)];
  }

  const fields: string[] = [];

  let current = "";
  let segment = 0;
  let index = 0;
  let inQuotes = false;

  while (index < line.length) {
    const code = line.codePointAt(index);

    if (inQuotes) {
      if (code === 34) {
        if (line.codePointAt(index + 1) === 34) {
          current += `${line.slice(segment, index)}"`;
          index += 2;
        } else {
          current += line.slice(segment, index);
          inQuotes = false;
          index += 1;
        }

        segment = index;
      } else {
        index += 1;
      }
    } else if (code === 34 && current === "" && index === segment) {
      inQuotes = true;
      index += 1;
      segment = index;
    } else if (code === 9) {
      current += line.slice(segment, index);
      fields.push(current);
      current = "";
      index += 1;
      segment = index;
    } else {
      index += 1;
    }
  }

  if (inQuotes) {
    throw new Error(`unterminated quoted field in line: "${line}"`);
  }

  current += line.slice(segment);
  fields.push(current);

  return fields;
}

const SEPARATOR_PATTERN = /[\t\r\n]/v;

export function serializeField(value: string): string {
  if (value.length === 0) {
    return value;
  }

  const first = value.codePointAt(0);

  if (first !== 34 && first !== 35 && !SEPARATOR_PATTERN.test(value)) {
    return value;
  }

  if (!value.includes('"')) {
    return `"${value}"`;
  }

  return `"${value.replaceAll('"', '""')}"`;
}

export function parseMetadata(raw: string): { metadata?: Metadata; speaker?: string } {
  if (raw === "") {
    return {};
  }

  if (!raw.startsWith(SPEAKER_PREFIX)) {
    return { metadata: { raw } };
  }

  const rest = raw.slice(SPEAKER_PREFIX.length);
  const separator = rest.indexOf(NOTES_SEPARATOR);

  if (separator === -1) {
    return { speaker: rest };
  }

  return {
    metadata: { notes: rest.slice(separator + NOTES_SEPARATOR.length) },
    speaker: rest.slice(0, separator),
  };
}

export function serializeMetadata(
  metadata: Metadata | undefined,
  speaker: string | undefined,
): string {
  if (speaker !== undefined) {
    if (metadata?.["raw"] !== undefined) {
      throw new Error(
        `metadata conflict for speaker "${speaker}": raw and Speaker cannot be combined`,
      );
    }

    const notes = metadata?.["notes"];

    return notes === undefined
      ? `${SPEAKER_PREFIX}${speaker}`
      : `${SPEAKER_PREFIX}${speaker}${NOTES_SEPARATOR}${notes}`;
  }

  if (metadata === undefined) {
    return "";
  }

  if (metadata["raw"] !== undefined) {
    return metadata["raw"];
  }

  const notes = metadata["notes"];

  if (notes !== undefined) {
    return `Notes=${notes}`;
  }

  return "";
}
