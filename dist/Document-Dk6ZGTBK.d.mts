//#region src/types/Document.d.ts
type Metadata = Record<string, string>;
interface Entry {
  key: string;
  value: string;
  metadata?: Metadata;
}
type Document = Entry[];
//#endregion
export { Document as t };