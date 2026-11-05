import { SymbolFlagsPrototype, type Node, type Type, type TypePropertyInfo } from "@tsonic/tsts";
import type { SourceFileSemantics } from "../types.js";
import { selectSourcePropertyDeclaration, selectedSourcePropertyDeclarations } from "../selected-property-declarations.js";
import type { SourceMemberKey, SourceTypeDescriptorMember, SourceTypeFlowSource } from "./types.js";

type Origin = SourceTypeDescriptorMember["origin"];

export function sourceTypeDescriptorMemberOriginsEqual(left: Origin, right: Origin): boolean {
  if (left.kind !== right.kind) return false;
  switch (left.kind) {
    case "declared": return right.kind === "declared" && left.declaration === right.declaration;
    case "class-prototype": return right.kind === "class-prototype" && left.owner === right.owner;
    case "mapped": return right.kind === "mapped" && left.owner === right.owner && keysEqual(left.key, right.key);
  }
}

function keysEqual(left: SourceMemberKey, right: SourceMemberKey): boolean {
  if (left.kind !== right.kind) return false;
  switch (left.kind) {
    case "string": return right.kind === "string" && left.value === right.value;
    case "number": return right.kind === "number" && Object.is(left.value, right.value);
    case "unique-symbol": return right.kind === "unique-symbol" && left.declaration === right.declaration;
  }
}

export function freezeSourceTypeDescriptorMemberOrigin(origin: Origin): Origin {
  return origin.kind === "mapped" ? Object.freeze({ ...origin, key: Object.freeze({ ...origin.key }) })
    : Object.freeze({ ...origin });
}

function memberKey(type: Type, queries: SourceFileSemantics): SourceMemberKey | undefined {
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

export function sourceTypeDescriptorMemberOrigin(source: SourceTypeFlowSource, queries: SourceFileSemantics,
  property: TypePropertyInfo, receiver: Type): SourceMemberOriginResult | undefined {
  const { ast } = source;
  const mapped = property.mapped;
  if (mapped !== undefined && mapped.syntheticOrigin === undefined) {
    const owner = mapped.declaration;
    if (owner === undefined || !ast.is.IsMappedTypeNode(owner)) {
      throw new Error("A checked mapped property requires its actual mapped declaration.");
    }
    const key = mapped.keyType === undefined ? undefined : memberKey(mapped.keyType, queries);
    return key === undefined ? Object.freeze({ kind: "refused", owner, name: property.name })
      : Object.freeze({ kind: "resolved", origin: freezeSourceTypeDescriptorMemberOrigin({ kind: "mapped", owner, key }) });
  }
  const declarations = mapped?.syntheticOrigin === undefined
    ? selectedSourcePropertyDeclarations(queries, undefined, property.symbol, [receiver])
    : queries.declarations.symbolDeclarations(mapped.syntheticOrigin);
  const role = declarations?.every(declaration => ast.is.IsSetAccessorDeclaration(declaration)) ? "write" : "read";
  const declaration = declarations === undefined ? undefined : selectSourcePropertyDeclaration(ast, declarations, role);
  if (declaration !== undefined) return Object.freeze({ kind: "resolved",
    origin: freezeSourceTypeDescriptorMemberOrigin({ kind: "declared", declaration }) });
  const parent = property.symbol.Parent;
  const owners = mapped === undefined && (property.symbol.Flags & SymbolFlagsPrototype) !== 0 && parent !== undefined
    ? queries.declarations.symbolDeclarations(parent).filter(owner => ast.is.IsClassDeclaration(owner) || ast.is.IsClassExpression(owner)) : [];
  return owners.length !== 1 ? undefined : Object.freeze({ kind: "resolved",
    origin: freezeSourceTypeDescriptorMemberOrigin({ kind: "class-prototype", owner: owners[0]! }) });
}
