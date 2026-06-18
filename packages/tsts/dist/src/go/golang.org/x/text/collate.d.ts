import type { int } from "@tsonic/core/types.js";
import type { Tag } from "./language.js";
export type Option = (options: Intl.CollatorOptions) => void;
export declare const IgnoreCase: Option;
export declare const Loose: Option;
export declare const Numeric: Option;
export declare class Collator {
    private readonly collator;
    constructor(tag: Tag, options: Intl.CollatorOptions);
    CompareString(left: string, right: string): int;
}
export declare function New(tag: Tag, ...options: Array<Option>): Collator;
//# sourceMappingURL=collate.d.ts.map