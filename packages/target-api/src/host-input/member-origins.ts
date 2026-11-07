import { SymbolFlagsPrototype, type AstReader, type Node, type Type, type TypePropertyInfo } from "@tsonic/tsts";
import type { SourceFileSemantics } from "./semantics-types.js";
import { selectSourcePropertyDeclaration, selectedSourcePropertyDeclarations } from "./semantics-selected-property-declarations.js";
import type { SourceMemberKey, SourceTypeDescriptorMember } from "../source-semantics/descriptor-model.js";

// The checker member-origin selection (a selection witness: which declaration, mapped key or class prototype a checked
// property comes from). The records are neutral identities; the descriptor rules that read them are local-type-flow's.
type Origin = SourceTypeDescriptorMember["origin"];

export function sourceTypeDescriptorMemberKey(type: Type, queries: SourceFileSemantics): SourceMemberKey | undefined {
  if (queries.types.isUnion(type) || queries.types.isIntersection(type)) return undefined;
  const string = queries.types.stringLiteralValue(type);
  if (string !== undefined) return Object.freeze({ kind: "string", value: string });
  const number = queries.types.numericLiteralValue(type);
  if (typeof number === "number" && Number.isFinite(number)) return Object.freeze({ kind: "number", value: number });
  if (!queries.types.isSymbolLike(type)) return undefined;
  const symbol = queries.declarations.typeSymbol(type);
  const declaration = symbol === undefined ? undefined : queries.declarations.primarySymbolDeclaration(symbol);
  const declared = declaration === undefined ? undefined : queries.declarations.declaredValueType(declaration);
  return declaration !== undefined && declared !== undefined && queries.types.isIdentical(declared, type)
    ? Object.freeze({ kind: "unique-symbol", declaration }) : undefined;
}

export type SourceMemberOriginResult =
  | { readonly kind: "resolved"; readonly origin: Origin }
  | { readonly kind: "refused"; readonly owner: Node; readonly name: string };

export function sourceTypeDescriptorMemberOrigin(source: { readonly ast: AstReader }, queries: SourceFileSemantics,
  property: TypePropertyInfo, receiver: Type): SourceMemberOriginResult | undefined {
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
      : Object.freeze({ kind: "resolved", origin: Object.freeze({ kind: "mapped" as const, owner, key }) });
  }
  const declarations = mapped?.syntheticOrigin === undefined
    ? selectedSourcePropertyDeclarations(queries, undefined, property.symbol, [receiver])
    : queries.declarations.symbolDeclarations(mapped.syntheticOrigin);
  const role = declarations?.every(declaration => ast.is.IsSetAccessorDeclaration(declaration)) ? "write" : "read";
  const declaration = declarations === undefined ? undefined : selectSourcePropertyDeclaration(ast, declarations, role)
    ?? canonicalMemberDeclaration(ast, declarations, property);
  if (declaration !== undefined) return Object.freeze({ kind: "resolved",
    origin: Object.freeze({ kind: "declared" as const, declaration }) });
  const parent = property.symbol.Parent;
  const owners = mapped === undefined && (property.symbol.Flags & SymbolFlagsPrototype) !== 0 && parent !== undefined
    ? queries.declarations.symbolDeclarations(parent).filter(owner => ast.is.IsClassDeclaration(owner) || ast.is.IsClassExpression(owner)) : [];
  return owners.length !== 1 ? undefined : Object.freeze({ kind: "resolved",
    origin: Object.freeze({ kind: "class-prototype" as const, owner: owners[0]! }) });
}

// A member with several non-accessor declarations (overloads, or one interface merged across files) is
// identified by the first entry of its ONE checked logical symbol's own Declarations vector: the checker's
// binder appends a symbol's declarations in bind order and mergeSymbol appends merged declarations in program
// file order. A synthetic member with several root symbols (e.g. an intersection of distinct members) is not one
// logical member and has no declared origin here.
function canonicalMemberDeclaration(ast: AstReader, declarations: readonly Node[],
  property: TypePropertyInfo): Node | undefined {
  if (property.rootSymbols.length > 1) return undefined;
  if (declarations.length < 2 || declarations.some(declaration =>
    ast.is.IsGetAccessorDeclaration(declaration) || ast.is.IsSetAccessorDeclaration(declaration))) return undefined;
  return declarations[0];
}

