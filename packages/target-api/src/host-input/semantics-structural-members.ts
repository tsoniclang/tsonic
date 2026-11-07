import type { AstReader, Node, Signature, Symbol, Type, TypeCheckerQueries, TypeIndexInfo, TypePropertyInfo, TypeShapeQueries } from "@tsonic/tsts";

export interface SourceStructuralMember {
  readonly receiverType: Type;
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
        | "unreadable-member"
        | "disjoint-shape";
    };

export function createSourceStructuralMemberQueries(
  ast: AstReader,
  checker: TypeCheckerQueries,
  types: TypeShapeQueries,
): {
  readonly structuralMembers: (source: Type, destination: Type,
    purpose: "correspondence" | "read") => SourceStructuralMemberCorrespondence;
  readonly structuralMember: (source: Type, destination: Type, selectedDeclaration: Node,
    purpose: "correspondence" | "read") => SourceStructuralMemberPair | undefined;
} {
  type MemberIndex = {
    readonly correspondence: SourceStructuralMemberCorrespondence;
    readonly readable: SourceStructuralMemberCorrespondence;
    readonly members: readonly SourceStructuralMemberPair[];
  };
  const cache = new WeakMap<Type, WeakMap<Type, MemberIndex>>();
  const unresolved = (type: Type, allowUnion = false): boolean => {
    if (allowUnion && types.isUnion(type)) {
      const members = types.getUnionOrIntersectionTypes(type);
      return members.length === 0 || members.some(member => member === undefined || unresolved(member, true));
    }
    const shape = types.isUnion(type) ? types.getApparentType(type) : type;
    return shape === undefined || types.isAny(shape) || types.isUnknown(shape) || types.isNever(shape) ||
      types.isNullish(shape) || types.isVoidLike(shape) || types.isUnion(shape);
  };
  const describe = (property: TypePropertyInfo, receiverType: Type): SourceStructuralMember => {
    const symbols = [property.symbol, ...property.rootSymbols];
    const declarations = Object.freeze([...new Set(symbols
      .flatMap((symbol) => checker.getSymbolDeclarations(symbol))
      .filter((node): node is Node => node !== undefined))]);
    const getters = Object.freeze(declarations.filter(ast.is.IsGetAccessorDeclaration));
    const setters = Object.freeze(declarations.filter(ast.is.IsSetAccessorDeclaration));
    return Object.freeze({
      receiverType,
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
  const matchMember = (source: Type, destination: Type, actual: ReadonlyMap<Symbol, TypePropertyInfo>, property: TypePropertyInfo):
    SourceStructuralMemberPair | Extract<SourceStructuralMemberCorrespondence, { readonly kind: "unavailable" }> => {
    const name = checker.getSymbolName(property.symbol);
    const selected = checker.getPropertyOfType(source, name);
    const destinationMember = describe(property, destination);
    if (selected === undefined) {
      if (types.isUnion(source) && types.getUnionOrIntersectionTypes(source).some(member =>
        member === undefined || checker.getPropertyOfType(member, name) !== undefined))
        return Object.freeze({ kind: "unavailable", reason: "inconsistent-member" });
      return Object.freeze({ kind: "absent", destination: destinationMember });
    }
    const sourceProperty = actual.get(selected);
    if (sourceProperty === undefined) return Object.freeze({ kind: "unavailable", reason: "inconsistent-member" });
    if (!property.optional && !sourceProperty.optional) {
      const left = sourceProperty.type;
      const right = property.type;
      for (const literal of [types.getStringLiteralTypeValue, types.getNumericLiteralTypeValue, types.getBooleanLiteralTypeValue]) {
        const from = literal(left);
        const to = literal(right);
        if (from !== undefined && to !== undefined && typeof from === typeof to && from !== to)
          return Object.freeze({ kind: "unavailable", reason: "disjoint-shape" });
      }
    }
    const sourceMember = describe(sourceProperty, source);
    return Object.freeze({ kind: "present", destination: destinationMember, source: sourceMember });
  };
  const select = (source: Type, destination: Type): MemberIndex => {
    let refusal: Extract<SourceStructuralMemberCorrespondence, { readonly kind: "unavailable" }> | undefined;
    if (types.isNullish(source) && !unresolved(destination) || types.isNullish(destination) && !unresolved(source))
      refusal = Object.freeze({ kind: "unavailable", reason: "disjoint-shape" });
    else if (unresolved(source) || unresolved(destination))
      refusal = Object.freeze({ kind: "unavailable", reason: "unresolved-shape" });
    if (unresolved(source, true) || unresolved(destination, true)) {
      const correspondence = refusal ?? Object.freeze({ kind: "unavailable", reason: "unresolved-shape" } as const);
      return Object.freeze({ correspondence, readable: correspondence, members: Object.freeze([]) });
    }
    const actual = new Map<Symbol, TypePropertyInfo>();
    for (const property of types.getPropertyInfos(source)) {
      if (actual.has(property.symbol)) {
        const correspondence = refusal ?? Object.freeze({ kind: "unavailable", reason: "inconsistent-member" } as const);
        return Object.freeze({ correspondence, readable: correspondence, members: Object.freeze([]) });
      }
      actual.set(property.symbol, property);
    }
    const members: SourceStructuralMemberPair[] = [];
    const seen = new Set<Symbol>();
    let missingRequired = false;
    let ambiguous = false;
    let disjoint = false;
    let readRefusal = refusal;
    for (const property of types.getPropertyInfos(destination)) {
      if (seen.has(property.symbol)) {
        const duplicate = Object.freeze({ kind: "unavailable", reason: "inconsistent-member" } as const);
        refusal ??= duplicate;
        readRefusal ??= duplicate;
        ambiguous = true;
        continue;
      }
      seen.add(property.symbol);
      const member = matchMember(source, destination, actual, property);
      if (member.kind === "unavailable") {
        disjoint ||= member.reason === "disjoint-shape";
        refusal ??= member;
        readRefusal ??= member;
      } else {
        if (member.kind === "absent" && !property.optional) missingRequired = true;
        if (member.kind === "present" && member.source.read === "unavailable")
          readRefusal ??= Object.freeze({ kind: "unavailable", reason: "unreadable-member" });
        members.push(member);
      }
    }
    if (missingRequired) {
      const missing = Object.freeze({ kind: "unavailable", reason: "missing-required-member" } as const);
      refusal ??= missing;
      readRefusal ??= missing;
    }
    const selected = Object.freeze(members);
    const correspondence: SourceStructuralMemberCorrespondence = refusal ?? Object.freeze({ kind: "available",
      source: inventory(source), destination: inventory(destination), members: selected });
    return Object.freeze({ correspondence, readable: readRefusal ?? correspondence,
      members: ambiguous || disjoint ? Object.freeze([]) : selected });
  };
  const indexFor = (source: Type, destination: Type, purpose: "correspondence" | "read"): MemberIndex => {
    if (purpose !== "correspondence" && purpose !== "read")
      throw new TypeError("Source structural member queries require an explicit correspondence or read purpose.");
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
  return Object.freeze({
    structuralMembers(source: Type, destination: Type, purpose: "correspondence" | "read"): SourceStructuralMemberCorrespondence {
      const index = indexFor(source, destination, purpose);
      return purpose === "read" ? index.readable : index.correspondence;
    },
    structuralMember(source: Type, destination: Type, selectedDeclaration: Node,
      purpose: "correspondence" | "read"): SourceStructuralMemberPair | undefined {
      let selected: SourceStructuralMemberPair | undefined;
      for (const member of indexFor(source, destination, purpose).members) {
        if (!member.destination.declarations.includes(selectedDeclaration)) continue;
        if (member.kind === "present" && member.source.declarations.length === 0) return undefined;
        if (purpose === "read" && member.kind === "present" && member.source.read === "unavailable") return undefined;
        if (selected !== undefined) return undefined;
        selected = member;
      }
      return selected;
    },
  });
}
