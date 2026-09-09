import { readdir, readFile } from "node:fs/promises";

import { matchGroups } from "@rheactor/rheactor-core";
import { Publisher } from "@triforce-heroes/triforce-publisher";

import { extract } from "#/Extract";
import { addDocumentToPublisher } from "#/services/PublisherSync";

const publisher = new Publisher(10);

publisher.addLanguage("en");
publisher.addLanguage("es");
publisher.addLanguage("fr");
publisher.addLanguage("it");
publisher.addLanguage("de");
publisher.addLanguage("ru");

const languagePattern = /^(?<lang>[a-z]{2})(?<conversations>_conversations)?\.csv$/v;

const files = await readdir("tests/fixtures");
const sortedFiles = files.toSorted((fileA, fileB) => fileA.localeCompare(fileB));

interface FixtureTask {
  file: string;
  lang: string;
  resource: string;
}

const tasks: FixtureTask[] = [];

for (const file of sortedFiles) {
  const groups = matchGroups<"lang" | "conversations">(languagePattern, file);
  const lang = groups?.["lang"];

  if (lang === undefined) {
    continue;
  }

  tasks.push({
    file,
    lang,
    resource: groups?.["conversations"] === undefined ? "strings" : "conversations",
  });
}

const contents = await Promise.all(
  tasks.map(async (task) => readFile(`tests/fixtures/${task.file}`)),
);

for (const [index, task] of tasks.entries()) {
  const content = contents.at(index);

  if (content === undefined) {
    throw new Error(`missing fixture content for file: "${task.file}"`);
  }

  const document = extract(content);

  addDocumentToPublisher(publisher, document, task.lang, task.resource);
}

await publisher.save("tools/resources");
