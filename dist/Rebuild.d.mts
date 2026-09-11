import { t as Document } from "./Document-DcMbbsYX.mjs";
//#region src/types/RebuildOptions.d.ts
interface RebuildOptions {
  notes?: boolean;
}
//#endregion
//#region src/Rebuild.d.ts
export declare function rebuildRaw(document: Document, options?: RebuildOptions): Buffer;
export declare function rebuild(data: string | Buffer, entries: Map<string, string>, options?: RebuildOptions): Buffer;
//#endregion