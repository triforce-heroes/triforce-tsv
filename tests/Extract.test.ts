import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { extract } from "#/Extract";
import type { Document, Entry } from "#/types/Document";

const files = await readdir("tests/fixtures");
const fixtures = files
  .filter((file) => file.endsWith(".csv"))
  .toSorted((fileA, fileB) => fileA.localeCompare(fileB))
  .map((file) => join("tests/fixtures", file));

const plain = extract(await readFile(join("tests/fixtures", "en.csv")));
const conversations = extract(await readFile(join("tests/fixtures", "en_conversations.csv")));

function entryOf(document: Document, key: string): Entry | undefined {
  return document.find((node) => node.key === key);
}

describe.each(fixtures)("extract(%s) function", (file) => {
  it("matches snapshot", async () => {
    expect.hasAssertions();
    expect(extract(await readFile(file))).toMatchSnapshot(file);
  });
});

describe("extract behavior", () => {
  it("extracts key, value and empty metadata", () => {
    expect(entryOf(plain, "generic.next")).toStrictEqual({ key: "generic.next", value: "Next" });
  });

  it("prefixes keys without group with _", () => {
    expect(entryOf(plain, "_.string")).toStrictEqual({
      key: "_.string",
      value: "english (円,원,$,£,€,zł)",
      metadata: {
        raw: "comment. Include all currency characters here to get them included in used_chars.txt, because they're retrieved automatically from the 3DS eShop.",
      },
    });
  });

  it("normalizes group names to key format", () => {
    expect(extract("# ----- Generic ----\nnext\tNext\r\n")).toStrictEqual([
      { key: "generic.next", value: "Next" },
    ]);
    expect(extract("# ----- Ask Choice ----\ncarson_buy\tOne\r\n")).toStrictEqual([
      { key: "ask_choice.carson_buy", value: "One" },
    ]);
    expect(extract("# ------ Contact Menu -----\nfoo\tBar\r\n")).toStrictEqual([
      { key: "contact_menu.foo", value: "Bar" },
    ]);
  });

  it("keeps previous group for notes that are not groups", () => {
    expect(
      extract("# ----- Quests ----\nquest_a\tA\r\n# -- %1% is finished, %2% count\nquest_b\tB\r\n"),
    ).toStrictEqual([
      { key: "quests.quest_a", value: "A" },
      { key: "quests.quest_b", value: "B" },
    ]);
  });

  it("does not duplicate prefix for already prefixed keys", () => {
    expect(extract("# ----- Generic ----\ngeneric.next\tNext\r\n")).toStrictEqual([
      { key: "generic.next", value: "Next" },
    ]);
  });

  it("stores plain comment as raw", () => {
    expect(entryOf(plain, "generic.skip")).toStrictEqual({
      key: "generic.skip",
      value: "Skip",
      metadata: { raw: "*DEMO*" },
    });
    expect(entryOf(plain, "generic.yay")).toStrictEqual({
      key: "generic.yay",
      value: "Yay!",
      metadata: { raw: 'A in "horray!"' },
    });
  });

  it("keeps bare quotes without quoting", () => {
    expect(entryOf(plain, "menus.menu_sell_resources_bonus")).toStrictEqual({
      key: "menus.menu_sell_resources_bonus",
      value: "Bonus: %1%%%",
      metadata: { raw: 'Only translate "Bonus:"' },
    });
  });

  it("splits Speaker into its own key and keeps notes in metadata", () => {
    expect(entryOf(conversations, "buddy_inventory_full.conversation_yjp8nk_text")).toStrictEqual({
      key: "buddy_inventory_full.conversation_yjp8nk_text",
      value: "Hey, your {format highlight}bag's already full{format reset}, doofus.",
      metadata: { notes: "Comes up when your inventory is full anyou try to pick up more ores." },
    });
    expect(
      entryOf(conversations, "buddy_inventory_full.conversation_yjp8nk_text.Speaker"),
    ).toStrictEqual({
      key: "buddy_inventory_full.conversation_yjp8nk_text.Speaker",
      value: "Fen",
    });
    expect(entryOf(conversations, "ore_vendor.conversation_hxfr0f_text")).toStrictEqual({
      key: "ore_vendor.conversation_hxfr0f_text",
      value: "Hey, got anything shiny for me there?",
      metadata: { notes: '*new* added "there"' },
    });
  });

  it("ignores comments and blank lines", () => {
    expect(extract("# ----- Generic ----\nnext\tNext\r\n\n")).toStrictEqual([
      { key: "generic.next", value: "Next" },
    ]);
  });

  it("accepts a trailing tab for empty metadata", () => {
    expect(extract("next\tNext\t\r\n")).toStrictEqual([{ key: "_.next", value: "Next" }]);
  });

  it("normalizes unnecessary quoting", () => {
    expect(extract('"next"\t"Next"\r\n')).toStrictEqual([{ key: "_.next", value: "Next" }]);
  });

  it("rejects duplicate key", () => {
    expect(() => extract("dup\tone\r\ndup\ttwo\r\n")).toThrow('duplicate key: "_.dup"');
  });

  it("rejects duplicate key within the same group", () => {
    expect(() => extract("# ----- Generic ----\ndup\tone\r\ndup\ttwo\r\n")).toThrow(
      'duplicate key: "generic.dup"',
    );
  });

  it("rejects row with invalid columns", () => {
    expect(() => extract("only\r\n")).toThrow("expected 2 or 3 columns");
    expect(() => extract("a\tb\tc\td\r\n")).toThrow("expected 2 or 3 columns");
    expect(() => extract("\tvalue\r\n")).toThrow("empty key");
  });
});
