import type { Publisher } from "@triforce-heroes/triforce-publisher";

import type { Document } from "#/types/Document";

export function addDocumentToPublisher(
  publisher: Publisher,
  document: Document,
  language: string,
  resource: string,
): void {
  for (const node of document) {
    const metadata = node.notes === undefined ? undefined : { notes: node.notes };

    publisher.addReference(language, resource, node.key, node.value, metadata);
  }
}
