export interface Entry {
  key: string;
  value: string;
  notes?: string;
}

export type Document = Entry[];
