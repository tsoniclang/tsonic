import type { bool } from "@tsonic/core/types.js";
export interface Type {
    String?(): string;
    readonly __goFacadeName?: string;
}
export interface Object {
    Name?(): string;
    Type?(): Type;
    readonly __goFacadeName?: string;
}
export interface Scope {
    Lookup?(name: string): Object | undefined;
    readonly __goFacadeName?: string;
}
export declare function Identical(x: Type | undefined, y: Type | undefined): bool;
export declare const Alias = "Alias";
export declare const Array = "Array";
export declare const Basic = "Basic";
export declare const Chan = "Chan";
export declare const Interface = "Interface";
export declare const Map = "Map";
export declare const Named = "Named";
export declare const Pointer = "Pointer";
export declare const Signature = "Signature";
export declare const Slice = "Slice";
export declare const Struct = "Struct";
export declare const TypeName = "TypeName";
export declare const TypeParam = "TypeParam";
export declare const Universe: Scope;
export declare const Var = "Var";
//# sourceMappingURL=types.d.ts.map