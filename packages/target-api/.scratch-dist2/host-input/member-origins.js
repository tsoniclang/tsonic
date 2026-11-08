import { SymbolFlagsPrototype } from "@tsonic/tsts";
import { selectSourcePropertyDeclaration, selectedSourcePropertyDeclarations } from "./semantics-selected-property-declarations.js";
export function sourceTypeDescriptorMemberKey(type, queries) {
    if (queries.types.isUnion(type) || queries.types.isIntersection(type))
        return undefined;
    const string = queries.types.stringLiteralValue(type);
    if (string !== undefined)
        return Object.freeze({ kind: "string", value: string });
    const number = queries.types.numericLiteralValue(type);
    if (typeof number === "number" && Number.isFinite(number))
        return Object.freeze({ kind: "number", value: number });
    if (!queries.types.isSymbolLike(type))
        return undefined;
    const symbol = queries.declarations.typeSymbol(type);
    const declaration = symbol === undefined ? undefined : queries.declarations.primarySymbolDeclaration(symbol);
    const declared = declaration === undefined ? undefined : queries.declarations.declaredValueType(declaration);
    return declaration !== undefined && declared !== undefined && queries.types.isIdentical(declared, type)
        ? Object.freeze({ kind: "unique-symbol", declaration }) : undefined;
}
export function sourceTypeDescriptorMemberOrigin(source, queries, property, receiver) {
    const { ast } = source;
    const mapped = property.mapped;
    // A homomorphic member keeps its original property's identity (C-2290) only when the mapped type keeps the key.
    // An `as` clause renames keys, so a renamed member is identified by its mapped owner and checked key (C-2296).
    const renamed = mapped?.declaration !== undefined && ast.is.IsMappedTypeNode(mapped.declaration) &&
        ast.as.AsMappedTypeNode(mapped.declaration)?.NameType !== undefined;
    if (mapped !== undefined && (mapped.syntheticOrigin === undefined || renamed)) {
        const owner = mapped.declaration;
        if (owner === undefined || !ast.is.IsMappedTypeNode(owner)) {
            throw new Error("A checked mapped property requires its actual mapped declaration.");
        }
        const key = mapped.keyType === undefined ? undefined : sourceTypeDescriptorMemberKey(mapped.keyType, queries);
        return key === undefined ? Object.freeze({ kind: "refused", owner, name: property.name })
            : Object.freeze({ kind: "resolved", origin: Object.freeze({ kind: "mapped", owner, key }) });
    }
    const declarations = mapped?.syntheticOrigin === undefined
        ? selectedSourcePropertyDeclarations(queries, undefined, property.symbol, [receiver])
        : queries.declarations.symbolDeclarations(mapped.syntheticOrigin);
    const role = declarations?.every(declaration => ast.is.IsSetAccessorDeclaration(declaration)) ? "write" : "read";
    const declaration = declarations === undefined ? undefined : selectSourcePropertyDeclaration(ast, declarations, role)
        ?? canonicalMemberDeclaration(ast, declarations, property);
    if (declaration !== undefined)
        return Object.freeze({ kind: "resolved",
            origin: Object.freeze({ kind: "declared", declaration }) });
    const parent = property.symbol.Parent;
    const owners = mapped === undefined && (property.symbol.Flags & SymbolFlagsPrototype) !== 0 && parent !== undefined
        ? queries.declarations.symbolDeclarations(parent).filter(owner => ast.is.IsClassDeclaration(owner) || ast.is.IsClassExpression(owner)) : [];
    return owners.length !== 1 ? undefined : Object.freeze({ kind: "resolved",
        origin: Object.freeze({ kind: "class-prototype", owner: owners[0] }) });
}
// A member with several non-accessor declarations (overloads, or one interface merged across files) is
// identified by the first entry of its ONE checked logical symbol's own Declarations vector: the checker's
// binder appends a symbol's declarations in bind order and mergeSymbol appends merged declarations in program
// file order. A synthetic member with several root symbols (e.g. an intersection of distinct members) is not one
// logical member and has no declared origin here.
function canonicalMemberDeclaration(ast, declarations, property) {
    if (property.rootSymbols.length > 1)
        return undefined;
    if (declarations.length < 2 || declarations.some(declaration => ast.is.IsGetAccessorDeclaration(declaration) || ast.is.IsSetAccessorDeclaration(declaration)))
        return undefined;
    return declarations[0];
}
//# sourceMappingURL=member-origins.js.map