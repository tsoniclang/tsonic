import { sourceTypeDescriptorStructure } from "./descriptor-model.js";
const wideIntegers = new Set(["int64", "uint64", "int128", "uint128"]);
/**
 * The category, or undefined when the descriptor proves none (`object`, `any`, `unknown`, a type parameter, a reference
 * without a definition, a union of different categories). `literal` reads an enum member initializer's Host constant.
 */
export function sourceTypeDescriptorTypeofCategory(ast, type, literal) {
    const structure = sourceTypeDescriptorStructure(type);
    switch (structure.kind) {
        case "string": return "string";
        case "primitive":
            if (structure.primitive === "bool")
                return "boolean";
            if (structure.primitive === "char")
                return "string";
            return wideIntegers.has(structure.primitive) ? "bigint" : "number";
        case "intrinsic":
            return structure.intrinsic === "bigint" ? "bigint" : structure.intrinsic === "symbol" ? "symbol" : undefined;
        case "callable": return "function";
        // A value with a call or construct signature is a JS function (K-2669).
        case "shape": return structure.calls.length > 0 || structure.constructs.length > 0 ? "function" : "object";
        case "array":
        case "tuple": return "object";
        case "declared":
            if (ast.is.IsEnumDeclaration(structure.declaration)) {
                const members = ast.members(structure.declaration).filter((member) => member !== undefined);
                return members.length > 0 && members.every(member => {
                    const initializer = ast.as.AsEnumMember(member)?.Initializer;
                    const value = initializer === undefined ? undefined : literal(initializer);
                    return value?.form === "string" || value?.form === "template";
                }) ? "string" : "number";
            }
            return ast.is.IsClassDeclaration(structure.declaration) || ast.is.IsClassExpression(structure.declaration) ? "object" : undefined;
        case "union": {
            const categories = new Set(structure.types.map(member => sourceTypeDescriptorTypeofCategory(ast, member, literal)));
            return categories.size === 1 ? [...categories][0] : undefined;
        }
        case "optional": return sourceTypeDescriptorTypeofCategory(ast, structure.value, literal);
    }
}
//# sourceMappingURL=descriptor-categories.js.map