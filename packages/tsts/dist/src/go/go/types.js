export function Identical(x, y) {
    if (x === y) {
        return true;
    }
    if (x === undefined || y === undefined) {
        return false;
    }
    if (typeof x.String === "function" && typeof y.String === "function") {
        return (x.String() === y.String());
    }
    return false;
}
export const Alias = "Alias";
export const Array = "Array";
export const Basic = "Basic";
export const Chan = "Chan";
export const Interface = "Interface";
export const Map = "Map";
export const Named = "Named";
export const Pointer = "Pointer";
export const Signature = "Signature";
export const Slice = "Slice";
export const Struct = "Struct";
export const TypeName = "TypeName";
export const TypeParam = "TypeParam";
export const Universe = {};
export const Var = "Var";
//# sourceMappingURL=types.js.map