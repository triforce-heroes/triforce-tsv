import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { extract } from "#/Extract";
import { rebuild, rebuildRaw } from "#/Rebuild";
import type { Document } from "#/types/Document";

const files = await readdir("tests/fixtures");
const fixtures = files
  .filter((file) => file.endsWith(".csv"))
  .toSorted((fileA, fileB) => fileA.localeCompare(fileB))
  .map((file) => join("tests/fixtures", file));

describe("roundtrip: Extract + Rebuild", () => {
  describe("pure synthetic data", () => {
    it("rebuildRaw + extract: round-trip with entries created from scratch", () => {
      const document: Document = [
        { key: "_.next", value: "Next" },
        { key: "_.skip", value: "Skip", notes: "*DEMO*" },
        { key: "_.yay", value: "Yay!", notes: 'A in "horray!"' },
        {
          key: "_.conversation_a",
          value: "Hi.",
          notes: "Speaker=Fen Notes=Comes up when full.",
        },
      ];

      const rebuilt = rebuildRaw(document).toString("utf-8");

      expect(rebuilt).toBe(
        "_.next\tNext\n_.skip\tSkip\t*DEMO*\n" +
          '_.yay\tYay!\tA in "horray!"\n' +
          "_.conversation_a\tHi.\tSpeaker=Fen Notes=Comes up when full.\n",
      );
      expect(extract(rebuilt)).toStrictEqual(document);
    });

    it("quotes fields only when needed", () => {
      const document: Document = [
        { key: "plain", value: "Oi" },
        { key: "quoted", value: 'Diz "oi"' },
        { key: "tabbed", value: "a\tb" },
      ];

      expect(rebuildRaw(document).toString("utf-8")).toBe(
        'plain\tOi\nquoted\tDiz "oi"\ntabbed\t"a\tb"\n',
      );
    });

    it("encodes real line breaks as \\n", () => {
      const document: Document = [
        { key: "_.hello", value: "Hi\nBye" },
        { key: "_.note", value: "Hi", notes: "a\nb" },
      ];

      const rebuilt = rebuildRaw(document).toString("utf-8");

      expect(rebuilt).toBe("_.hello\tHi\\nBye\n_.note\tHi\ta\\nb\n");
      expect(rebuilt).not.toContain("\n\n");
      expect(extract(rebuilt)).toStrictEqual(document);
    });
  });

  describe("notes option", () => {
    it("rebuildRaw omits the third column when notes is false", () => {
      const document: Document = [
        { key: "_.next", value: "Next" },
        { key: "_.skip", value: "Skip", notes: "*DEMO*" },
      ];

      const rebuilt = rebuildRaw(document, { notes: false }).toString("utf-8");

      expect(rebuilt).toBe("_.next\tNext\n_.skip\tSkip\n");
      expect(extract(rebuilt)).toStrictEqual([
        { key: "_.next", value: "Next" },
        { key: "_.skip", value: "Skip" },
      ]);
    });

    it("rebuildRaw keeps the third column by default", () => {
      const document: Document = [{ key: "_.skip", value: "Skip", notes: "*DEMO*" }];

      expect(rebuildRaw(document).toString("utf-8")).toBe("_.skip\tSkip\t*DEMO*\n");
    });

    it("rebuild omits the third column from every data row when notes is false", () => {
      const source = "next\tNext\nskip\tSkip\t*DEMO*\n";

      const rebuilt = rebuild(source, new Map([["_.next", "Seguinte"]]), {
        notes: false,
      }).toString("utf-8");

      expect(rebuilt).toBe("next\tSeguinte\nskip\tSkip\n");
      expect(extract(rebuilt)).toStrictEqual([
        { key: "_.next", value: "Seguinte" },
        { key: "_.skip", value: "Skip" },
      ]);
    });

    it("rebuild keeps rows without a third column verbatim when notes is false", () => {
      const rebuilt = rebuild('"next"\t"Next"\n', new Map(), { notes: false });

      expect(rebuilt.toString("utf-8")).toBe('"next"\t"Next"\n');
    });
  });

  describe("rebuild: selective patch", () => {
    const source =
      "# ----- Generic ----\r\n" +
      "next\tNext\r\n" +
      "\r\n" +
      "skip\tSkip\t*DEMO*\r\n" +
      "conversation_a\tHi.\tSpeaker=Fen Notes=Comes up when full.\r\n" +
      "conversation_b\tYo.\tSpeaker=Bob\r\n";

    it("patches values while keeping comments and original keys", () => {
      const rebuilt = rebuild(source, new Map([["generic.next", "Seguinte"]])).toString("utf-8");

      expect(rebuilt).toContain("# ----- Generic ----");
      expect(rebuilt).toContain("next\tSeguinte");
      expect(rebuilt).not.toContain("generic.next");
      expect(rebuilt).toContain("skip\tSkip\t*DEMO*");
      expect(rebuilt).toContain("conversation_a\tHi.\tSpeaker=Fen Notes=Comes up when full.");
      expect(rebuilt).not.toContain("\r");
      expect(extract(rebuilt)).toStrictEqual([
        { key: "generic.next", value: "Seguinte" },
        { key: "generic.skip", value: "Skip", notes: "*DEMO*" },
        {
          key: "generic.conversation_a",
          value: "Hi.",
          notes: "Speaker=Fen Notes=Comes up when full.",
        },
        { key: "generic.conversation_b", value: "Yo.", notes: "Speaker=Bob" },
      ]);
    });

    it("keeps the comment column verbatim when patching a value", () => {
      const rebuilt = rebuild(source, new Map([["generic.conversation_a", "Hola."]])).toString(
        "utf-8",
      );

      expect(rebuilt).toContain("conversation_a\tHola.\tSpeaker=Fen Notes=Comes up when full.");
      expect(extract(rebuilt).find((node) => node.key === "generic.conversation_a")).toStrictEqual({
        key: "generic.conversation_a",
        value: "Hola.",
        notes: "Speaker=Fen Notes=Comes up when full.",
      });
    });

    it("ignores unknown keys", () => {
      expect(extract(rebuild("next\tNext\n", new Map([["missing", "X"]])))).toStrictEqual([
        { key: "_.next", value: "Next" },
      ]);
    });

    it("escapes patched line breaks as \\n", () => {
      const rebuilt = rebuild("hello\tHi\n", new Map([["_.hello", "A\nB"]]));

      expect(rebuilt.toString("utf-8")).toBe("hello\tA\\nB\n");
      expect(extract(rebuilt)).toStrictEqual([{ key: "_.hello", value: "A\nB" }]);
    });
  });

  describe.each(fixtures)("locales: %s", (fixture) => {
    it("initial extraction works", async () => {
      expect.hasAssertions();

      const extracted = extract(await readFile(fixture));

      expect(extracted.length).toBeGreaterThan(0);
    });

    it("round-trip: rebuildRaw -> extract -> compare data", async () => {
      expect.hasAssertions();

      const extracted = extract(await readFile(fixture));
      const rebuilt = rebuildRaw(extracted);
      const reExtracted = extract(rebuilt);

      expect(reExtracted).toStrictEqual(extracted);
      expect(rebuilt.toString("utf-8")).not.toContain("\r");
    });

    it("selective rebuild patches only the given keys", async () => {
      expect.hasAssertions();

      const data = await readFile(fixture);
      const extracted = extract(data);
      const target = extracted.at(0)!;
      const rebuilt = rebuild(data, new Map([[target.key, "PATCHED VALUE"]]));
      const reExtracted = extract(rebuilt);

      expect(rebuilt.toString("utf-8")).not.toContain("\r");
      expect(reExtracted).toHaveLength(extracted.length);
      expect(reExtracted.find((node) => node.key === target.key)).toStrictEqual({
        ...target,
        value: "PATCHED VALUE",
      });
      expect(reExtracted.filter((node) => node.key !== target.key)).toStrictEqual(
        extracted.filter((node) => node.key !== target.key),
      );
    });
  });
});
