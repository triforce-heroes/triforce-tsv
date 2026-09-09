export const SPEAKER_SUFFIX = ".Speaker";

export type Metadata = Record<string, string>;

export interface Entry {
  key: string;
  value: string;
  metadata?: Metadata;
}

export type Document = Entry[];
