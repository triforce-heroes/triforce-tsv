import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { extract } from "#/Extract";
import { rebuild, rebuildRaw } from "#/Rebuild";
import { SPEAKER_SUFFIX } from "#/types/Document";
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
        { key: "_.skip", value: "Skip", metadata: { raw: "*DEMO*" } },
        { key: "_.yay", value: "Yay!", metadata: { raw: 'A in "horray!"' } },
        { key: "_.conversation_a", value: "Hi.", metadata: { notes: "Comes up when full." } },
        { key: "_.conversation_a.Speaker", value: "Fen" },
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
  });

  describe("rebuild: selective patch", () => {
    const source =
      "# ----- Generic ----\r\n" +
      "next\tNext\r\n" +
      "\r\n" +
      "skip\tSkip\t*DEMO*\r\n" +
      "conversation_a\tHi.\tSpeaker=Fen Notes=Comes up when full.\r\n" +
      "conversation_b\tYo.\tSpeaker=Bob\r\n";

    it("patches values and speakers while keeping original keys", () => {
      const rebuilt = rebuild(
        source,
        new Map([
          ["generic.next", "Seguinte"],
          [`generic.conversation_a${SPEAKER_SUFFIX}`, "Max"],
        ]),
      ).toString("utf-8");

      expect(rebuilt).toContain("# ----- Generic ----");
      expect(rebuilt).toContain("next\tSeguinte");
      expect(rebuilt).not.toContain("generic.next");
      expect(rebuilt).toContain("skip\tSkip\t*DEMO*");
      expect(rebuilt).not.toContain("\r");
      expect(extract(rebuilt)).toStrictEqual([
        { key: "generic.next", value: "Seguinte" },
        { key: "generic.skip", value: "Skip", metadata: { raw: "*DEMO*" } },
        {
          key: "generic.conversation_a",
          value: "Hi.",
          metadata: { notes: "Comes up when full." },
        },
        { key: `generic.conversation_a${SPEAKER_SUFFIX}`, value: "Max" },
        { key: "generic.conversation_b", value: "Yo." },
        { key: `generic.conversation_b${SPEAKER_SUFFIX}`, value: "Bob" },
      ]);
    });

    it("ignores unknown keys", () => {
      expect(
        extract(
          rebuild(
            "next\tNext\n",
            new Map([
              ["missing", "X"],
              [`missing${SPEAKER_SUFFIX}`, "Y"],
            ]),
          ),
        ),
      ).toStrictEqual([{ key: "_.next", value: "Next" }]);
    });

    it("adds a speaker column to a row without one", () => {
      expect(
        extract(rebuild("hello\tHi\n", new Map([[`_.hello${SPEAKER_SUFFIX}`, "Fen"]]))),
      ).toStrictEqual([
        { key: "_.hello", value: "Hi" },
        { key: `_.hello${SPEAKER_SUFFIX}`, value: "Fen" },
      ]);
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
      const target = extracted.find((node) => !node.key.endsWith(SPEAKER_SUFFIX))!;
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
