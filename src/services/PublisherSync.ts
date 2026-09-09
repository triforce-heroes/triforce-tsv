import type { Publisher } from "@triforce-heroes/triforce-publisher";

import { SPEAKER_SUFFIX } from "#/types/Document";
import type { Document } from "#/types/Document";

export function addDocumentToPublisher(
  publisher: Publisher,
  document: Document,
  language: string,
  resource: string,
): void {
  for (const node of document) {
    if (node.key.endsWith(SPEAKER_SUFFIX)) {
      publisher.addReference(language, resource, node.key, node.value);
    } else {
      publisher.addReference(language, resource, node.key, node.value, node.metadata);
    }
  }
}
