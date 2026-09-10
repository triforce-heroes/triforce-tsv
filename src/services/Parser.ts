export const DEFAULT_GROUP = "_";

const GROUP_NAME_PATTERN = /^[A-Za-z0-9]+(?:[ _\-][A-Za-z0-9]+)*$/v;

const NORMALIZED_GROUP_PATTERN = /^[a-z0-9_]+$/v;

export function normalizeGroup(content: string): string | undefined {
  if (content.length === 0 || content.codePointAt(0) !== 35) {
    return undefined;
  }

  const trimmed = content
    .slice(1)
    .trim()
    .replace(/^[\-=*~\s]+/v, "")
    .replace(/[\-=*~\s]+$/v, "")
    .trim();

  if (trimmed === "" || !GROUP_NAME_PATTERN.test(trimmed)) {
    return undefined;
  }

  const normalized = trimmed
    .toLowerCase()
    .replaceAll(/[\s\-]+/gv, "_")
    .replaceAll(/__+/gv, "_")
    .replaceAll(/^_+|_+$/gv, "");

  if (normalized === "" || !NORMALIZED_GROUP_PATTERN.test(normalized)) {
    return undefined;
  }

  return normalized;
}

export function resolveKey(rawKey: string, group: string): string {
  if (rawKey === group || rawKey.startsWith(`${group}.`)) {
    return rawKey;
  }

  if (group === DEFAULT_GROUP && rawKey.includes(".")) {
    return rawKey;
  }

  return `${group}.${rawKey}`;
}

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

const SEPARATOR_PATTERN = /[\t\r\n]/v;

// Files store line breaks as the two-character escape "\n" to keep every row
// on a single TSV line. Extract decodes it to a real line break, rebuild
// encodes it back.
export function unescapeText(value: string): string {
  return value.replaceAll("\\n", "\n");
}

export function escapeText(value: string): string {
  return value.replaceAll("\n", "\\n");
}

export function parseFields(line: string): string[] {
  if (!line.includes('"')) {
    const first = line.indexOf("\t");

    if (first === -1) {
      return [unescapeText(line)];
    }

    const second = line.indexOf("\t", first + 1);

    if (second === -1) {
      return [unescapeText(line.slice(0, first)), unescapeText(line.slice(first + 1))];
    }

    if (line.includes("\t", second + 1)) {
      return line.split("\t").map((field) => unescapeText(field));
    }

    return [
      unescapeText(line.slice(0, first)),
      unescapeText(line.slice(first + 1, second)),
      unescapeText(line.slice(second + 1)),
    ];
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

  return fields.map((field) => unescapeText(field));
}

export function serializeField(value: string): string {
  const escaped = escapeText(value);

  if (escaped.length === 0) {
    return escaped;
  }

  const first = escaped.codePointAt(0);

  if (first !== 34 && first !== 35 && !SEPARATOR_PATTERN.test(escaped)) {
    return escaped;
  }

  if (!escaped.includes('"')) {
    return `"${escaped}"`;
  }

  return `"${escaped.replaceAll('"', '""')}"`;
}
