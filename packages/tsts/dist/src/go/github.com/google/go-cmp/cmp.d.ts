import type { bool } from "../../../scalars.js";
export interface Option {
    readonly kind: string;
    readonly args: readonly unknown[];
}
export type Path = readonly unknown[];
export declare function AllowUnexported(...types: Array<unknown>): Option;
export declare function Diff(x: unknown, y: unknown, ..._opts: Array<Option>): string;
export declare function FilterPath(filter: (path: Path) => bool, opt: Option): Option;
export declare function Ignore(): Option;
//# sourceMappingURL=cmp.d.ts.map