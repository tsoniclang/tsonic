import type { int } from "../../../scalars.js";
import type { GoError, GoSlice } from "../../../compat.js";
export type Tag = string & {
    readonly __goFacadeName: "golang.org/x/text/language.Tag";
};
export type Confidence = int;
export declare const No: Confidence;
export declare const Low: Confidence;
export declare const High: Confidence;
export declare const Exact: Confidence;
export declare const Und: Tag;
export declare const English: Tag;
export interface Matcher {
    Match(tag: Tag): [Tag, int, Confidence];
}
export declare function Parse(value: string): [Tag, GoError];
export declare function MustParse(value: string): Tag;
export declare function NewMatcher(tags: GoSlice<Tag>): Matcher;
//# sourceMappingURL=language.d.ts.map