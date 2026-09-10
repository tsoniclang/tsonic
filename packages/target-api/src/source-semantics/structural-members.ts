import type {
  AstReader,
  Node,
  Signature,
  Symbol,
  Type,
  TypeCheckerQueries,
  TypeIndexInfo,
  TypePropertyInfo,
  TypeShapeQueries,
} from "@tsonic/tsts";

export interface SourceStructuralMember {
  readonly property: TypePropertyInfo;
  readonly declarations: readonly Node[];
  readonly getters: readonly Node[];
  readonly setters: readonly Node[];
  readonly read: "property" | "accessor" | "method" | "unavailable";
}

export type SourceStructuralMemberPair =
  | {
      readonly kind: "present";
      readonly destination: SourceStructuralMember;
      readonly source: SourceStructuralMember;
    }
  | { readonly kind: "absent"; readonly destination: SourceStructuralMember };

export interface SourceStructuralTypeMembers {
  readonly type: Type;
  readonly calls: readonly Signature[];
  readonly constructs: readonly Signature[];
  readonly indexes: readonly TypeIndexInfo[];
}

export type SourceStructuralMemberCorrespondence =
  | {
      readonly kind: "available";
      readonly source: SourceStructuralTypeMembers;
      readonly destination: SourceStructuralTypeMembers;
      readonly members: readonly SourceStructuralMemberPair[];
    }
  | {
      readonly kind: "unavailable";
      readonly reason:
        | "unresolved-shape"
        | "missing-required-member"
        | "inconsistent-member"
        | "unreadable-member";
    };

export function createSourceStructuralMemberQuery(
  ast: AstReader,
  checker: TypeCheckerQueries,
  types: TypeShapeQueries,
): (source: Type, destination: Type) => SourceStructuralMemberCorrespondence {
  const cache = new WeakMap<Type, WeakMap<Type, SourceStructuralMemberCorrespondence>>();
  const unresolved = (type: Type): boolean => types.isAny(type) || types.isUnknown(type) ||
    types.isNever(type) || types.isNullish(type) || types.isUnion(type) ||
    types.isStringLike(type) || types.isNumberLike(type) || types.isBooleanLike(type) ||
    types.isBigIntLike(type) || types.isSymbolLike(type) || types.isVoidLike(type);
  const describe = (property: TypePropertyInfo): SourceStructuralMember => {
    const symbols = [property.symbol, ...property.rootSymbols];
    const declarations = Object.freeze([...new Set(symbols
      .flatMap((symbol) => checker.getSymbolDeclarations(symbol))
      .filter((node): node is Node => node !== undefined))]);
    const getters = Object.freeze(declarations.filter(ast.is.IsGetAccessorDeclaration));
    const setters = Object.freeze(declarations.filter(ast.is.IsSetAccessorDeclaration));
    return Object.freeze({
      property: Object.freeze({
        ...property,
        rootSymbols: Object.freeze([...property.rootSymbols]),
      }),
      declarations,
      getters,
      setters,
      read: getters.length > 0 ? "accessor" : setters.length > 0 ? "unavailable" :
        declarations.some((node) => ast.is.IsMethodDeclaration(node) || ast.is.IsMethodSignatureDeclaration(node))
          ? "method" : "property",
    });
  };
  const inventory = (type: Type): SourceStructuralTypeMembers => Object.freeze({
    type,
    calls: Object.freeze(types.getCallSignatures(type)
      .filter((signature): signature is Signature => signature !== undefined)),
    constructs: Object.freeze(types.getConstructSignatures(type)
      .filter((signature): signature is Signature => signature !== undefined)),
    indexes: Object.freeze(types.getIndexInfos(type).map((info) => Object.freeze({
      ...info,
      components: Object.freeze([...info.components]),
    }))),
  });
  const select = (source: Type, destination: Type): SourceStructuralMemberCorrespondence => {
    if (unresolved(source) || unresolved(destination)) {
      return Object.freeze({ kind: "unavailable", reason: "unresolved-shape" });
    }
    const actual = new Map<Symbol, TypePropertyInfo>();
    for (const property of types.getPropertyInfos(source)) {
      if (actual.has(property.symbol)) {
        return Object.freeze({ kind: "unavailable", reason: "inconsistent-member" });
      }
      actual.set(property.symbol, property);
    }
    const members: SourceStructuralMemberPair[] = [];
    const seen = new Set<Symbol>();
    for (const property of types.getPropertyInfos(destination)) {
      if (seen.has(property.symbol)) {
        return Object.freeze({ kind: "unavailable", reason: "inconsistent-member" });
      }
      seen.add(property.symbol);
      const selected = checker.getPropertyOfType(source, checker.getSymbolName(property.symbol));
      const destinationMember = describe(property);
      if (selected === undefined) {
        if (!property.optional) {
          return Object.freeze({ kind: "unavailable", reason: "missing-required-member" });
        }
        members.push(Object.freeze({ kind: "absent", destination: destinationMember }));
        continue;
      }
      const sourceProperty = actual.get(selected);
      if (sourceProperty === undefined) {
        return Object.freeze({ kind: "unavailable", reason: "inconsistent-member" });
      }
      const sourceMember = describe(sourceProperty);
      if (sourceMember.read === "unavailable") {
        return Object.freeze({ kind: "unavailable", reason: "unreadable-member" });
      }
      members.push(Object.freeze({
        kind: "present",
        destination: destinationMember,
        source: sourceMember,
      }));
    }
    return Object.freeze({
      kind: "available",
      source: inventory(source),
      destination: inventory(destination),
      members: Object.freeze(members),
    });
  };
  return (source, destination) => {
    let destinations = cache.get(source);
    if (destinations === undefined) {
      destinations = new WeakMap();
      cache.set(source, destinations);
    }
    let result = destinations.get(destination);
    if (result === undefined) {
      result = select(source, destination);
      destinations.set(destination, result);
    }
    return result;
  };
}
