import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Publisher } from "@triforce-heroes/triforce-publisher";
import { describe, expect, it } from "vitest";

import { extract } from "#/Extract";
import { addDocumentToPublisher } from "#/services/PublisherSync";

describe(addDocumentToPublisher, () => {
  it("maps entries and notes to references", async () => {
    expect.hasAssertions();

    const publisher = new Publisher(1);
    publisher.addLanguage("en");

    const document = extract(
      "skip\tSkip\t*DEMO*\r\nconversation_a\tHi.\tSpeaker=Fen Notes=Comes up.\r\nconversation_b\tYo.\tSpeaker=Bob\r\n",
    );
    addDocumentToPublisher(publisher, document, "en", "conversations");

    const entries = publisher.getEntries();
    const byReference = new Map(entries.map((entry) => [entry.reference, entry]));

    expect(byReference.get("_.skip")).toStrictEqual({
      resource: "conversations",
      reference: "_.skip",
      sources: { Skip: ["en"] },
      metadata: { notes: "*DEMO*" },
    });
    expect(byReference.get("_.conversation_a")).toStrictEqual({
      resource: "conversations",
      reference: "_.conversation_a",
      sources: { "Hi.": ["en"] },
      metadata: { notes: "Speaker=Fen Notes=Comes up." },
    });
    expect(byReference.get("_.conversation_b")).toStrictEqual({
      resource: "conversations",
      reference: "_.conversation_b",
      sources: { "Yo.": ["en"] },
      metadata: { notes: "Speaker=Bob" },
    });

    const output = await publisher.dryRun(await mkdtemp(join(tmpdir(), "triforce-tsv-")));

    expect(output.version.needed).toBe(true);
    expect(output.entries).toHaveLength(3);
  });
});
