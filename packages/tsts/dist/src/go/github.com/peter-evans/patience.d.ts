import type { int } from "../../scalars.js";
import type { GoSlice } from "../../compat.js";
export type DiffKind = "equal" | "delete" | "insert";
export interface DiffLine {
    Kind: DiffKind;
    Text: string;
}
export interface UnifiedDiffOptions {
    Precontext?: int;
    Postcontext?: int;
    SrcHeader?: string;
    DstHeader?: string;
}
export declare function Diff(oldLines: GoSlice<string>, newLines: GoSlice<string>): GoSlice<DiffLine>;
export declare function UnifiedDiffTextWithOptions(lines: GoSlice<DiffLine>, options: UnifiedDiffOptions): string;
//# sourceMappingURL=patience.d.ts.map