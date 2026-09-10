//#region src/types/Document.d.ts
interface Entry {
  key: string;
  value: string;
  notes?: string;
}
type Document = Entry[];
//#endregion
export { Document as t };