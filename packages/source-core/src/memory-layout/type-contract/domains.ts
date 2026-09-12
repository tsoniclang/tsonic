import { fieldFactKey, pointerFactKey, rawPointerFactKey, sourcePrimitiveFactKey } from "@tsonic/tsts";
import type { Node, SourcePrimitiveFact, Symbol, Type } from "@tsonic/tsts";
import type { TsonicSourceFileAnalysisContext } from "../../analysis/context.js";
import { readSourceFact } from "../../analysis/source-call.js";
import { tsonicCoreSourceSemanticsModules } from "../../extension/source-modules.js";
import { memoryProviderFieldType } from "./provider-fields.js";
import { tsonicFixedArrayFactKey } from "../../fixed-arrays/facts.js";
import { createMemoryDomainRelation } from "./relations.js";
import type { MemoryRecordMember, MemoryRecordShape } from "./relations.js";

export interface MemoryTypeDomain {
  readonly key: number;
  readonly kind: "source" | "nullish" | "primitive" | "pointer" | "raw-pointer" | "union" | "intersection" | "reference" | "fixed-array" | "extent";
  readonly children: readonly MemoryTypeDomain[];
  readonly head: DomainPart | undefined;
}

export interface MemoryTypeDomains {
  authored(node: Node): MemoryTypeDomain | undefined;
  instantiated(node: Node, bindings: ReadonlyMap<Symbol, MemoryTypeDomain>): MemoryTypeDomain | undefined;
  member(node: Node, owner: MemoryTypeDomain): MemoryTypeDomain | undefined;
  indexed(owner: MemoryTypeDomain, type: Type): MemoryTypeDomain | undefined;
  union(children: readonly MemoryTypeDomain[]): MemoryTypeDomain;
  pointer(pointee: MemoryTypeDomain): MemoryTypeDomain;
  rawPointer(): MemoryTypeDomain;
  array(type: Type, element: MemoryTypeDomain, length: bigint, runtimeBase: "number" | "bigint"): MemoryTypeDomain | undefined;
  selected(type: Type): MemoryTypeDomain | undefined;
  isClosed(type: Type): boolean;
  pointee(domain: MemoryTypeDomain): MemoryTypeDomain | undefined;
  equivalent(left: MemoryTypeDomain, right: MemoryTypeDomain): boolean;
  bucket(domain: MemoryTypeDomain): string;
  referenceType(domain: MemoryTypeDomain): Type | undefined;
}

type DomainPart = object | string | number | bigint | boolean;
interface DomainTrie {
  readonly children: Map<DomainPart, DomainTrie>;
  domain?: MemoryTypeDomain;
}

export function createMemoryTypeDomains(context: TsonicSourceFileAnalysisContext): MemoryTypeDomains {
  const { ast, checker, typeShape } = context;
  const root: DomainTrie = { children: new Map() };
  const active = new Set<Node>();
  const cache = new Map<Node, MemoryTypeDomain | undefined>();
  const closed = new Map<Type, boolean>();
  const referenceBindings = new Map<MemoryTypeDomain, ReadonlyMap<Symbol, MemoryTypeDomain>>();
  const references = new Map<MemoryTypeDomain, { readonly symbol: Symbol; readonly type: Type | undefined }>();
  const records = new Map<MemoryTypeDomain, MemoryRecordShape | undefined>();
  const primitives = tsonicCoreSourceSemanticsModules().flatMap(module => module.exports)
    .filter(value => value.kind === "source-primitive");
  let nextKey = 0;
  const equivalent = createMemoryDomainRelation(context, domain => references.get(domain)?.symbol, record);

  function typeParameters(declaration: Node): readonly (Node | undefined)[] {
    return ast.is.IsTypeAliasDeclaration(declaration) || ast.is.IsInterfaceDeclaration(declaration) ||
      ast.is.IsClassDeclaration(declaration) || ast.is.IsClassExpression(declaration)
      ? ast.typeParameters(declaration) : [];
  }

  function intern(kind: MemoryTypeDomain["kind"], parts: readonly DomainPart[], children: readonly MemoryTypeDomain[] = []): MemoryTypeDomain {
    let current = root;
    for (const part of [kind, ...parts]) {
      let child = current.children.get(part);
      if (child === undefined) current.children.set(part, child = { children: new Map() });
      current = child;
    }
    return current.domain ??= Object.freeze({ kind, key: nextKey++, children: Object.freeze([...children]), head: parts[0] });
  }

  function primitive(fact: SourcePrimitiveFact): MemoryTypeDomain {
    return intern("primitive", [fact.kind, fact.runtimeBase, fact.width ?? "", fact.signed ?? ""]);
  }

  function array(type: Type, element: MemoryTypeDomain, length: bigint, runtimeBase: "number" | "bigint"): MemoryTypeDomain | undefined {
    const symbol = checker.getTypeSymbol(type);
    if (symbol === undefined) return undefined;
    const extent = intern("extent", [length, runtimeBase]);
    const domain = intern("fixed-array", [symbol, element, extent], [element, extent]);
    const bindings = new Map<Symbol, MemoryTypeDomain>();
    for (const declaration of checker.getSymbolDeclarations(symbol)) {
      if (declaration === undefined) continue;
      const parameters = typeParameters(declaration);
      if (parameters.length !== 2) continue;
      const elementParameter = checker.getSymbolAtLocation(ast.name(parameters[0]));
      const extentParameter = checker.getSymbolAtLocation(ast.name(parameters[1]));
      if (elementParameter !== undefined) bindings.set(elementParameter, element);
      if (extentParameter !== undefined) bindings.set(extentParameter, extent);
    }
    if (bindings.size !== 2) return undefined;
    referenceBindings.set(domain, bindings);
    return domain;
  }

  function combine(kind: "union" | "intersection", children: readonly MemoryTypeDomain[]): MemoryTypeDomain {
    const unique = [...new Set(children.flatMap(child => child.kind === kind ? child.children : [child]))]
      .sort((left, right) => left.key - right.key);
    return unique.length === 1 ? unique[0]! : intern(kind, unique, unique);
  }

  function record(domain: MemoryTypeDomain): MemoryRecordShape | undefined {
    if (records.has(domain)) return records.get(domain);
    const type = references.get(domain)?.type;
    if (type === undefined || !isClosed(type) || typeShape.isArrayLike(type) ||
        typeShape.getCallSignatures(type).length !== 0 || typeShape.getConstructSignatures(type).length !== 0 ||
        typeShape.getIndexInfos(type).length !== 0) return undefined;
    records.set(domain, undefined);
    const members = new Map<Symbol, MemoryRecordMember>();
    const properties = typeShape.getPropertyInfos(type);
    if (properties.length > 131072) return undefined;
    for (const property of properties) {
      const declarations = [...new Set([property.symbol, ...property.rootSymbols].flatMap(symbol =>
        checker.getSymbolDeclarations(symbol).filter(declaration => declaration !== undefined)))];
      if (declarations.length !== 1 || declarations.some(declaration =>
        !ast.is.IsPropertySignatureDeclaration(declaration) && !ast.is.IsPropertyDeclaration(declaration) &&
        !ast.is.IsPropertyAssignment(declaration))) return undefined;
      const declaration = declarations[0]!;
      const annotation = ast.typeNode(declaration) ?? readSourceFact(context, declaration, fieldFactKey)?.type;
      const child = annotation === undefined ? selected(property.type)
        : visit(annotation, referenceBindings.get(domain) ?? new Map());
      if (child === undefined || members.has(property.symbol)) return undefined;
      members.set(property.symbol, Object.freeze({ property, declarations: Object.freeze(declarations), domain: child }));
    }
    const result = Object.freeze({ type, members });
    records.set(domain, result);
    return result;
  }

  function bucket(domain: MemoryTypeDomain): string {
    if (domain.kind === "reference") {
      const shape = record(domain);
      if (shape !== undefined) return JSON.stringify(["record", ...[...shape.members.values()]
        .map(member => checker.getSymbolName(member.property.symbol)).sort()]);
    }
    if (domain.kind === "union" || domain.kind === "intersection") {
      const children = [...new Set(domain.children.map(bucket))];
      if (children.length === 1) return children[0]!;
    }
    return domain.kind === "primitive" || domain.kind === "source" || domain.kind === "nullish" || domain.kind === "extent"
      ? `${domain.kind}:${domain.key}` : domain.kind;
  }

  function isClosed(type: Type): boolean {
    const cached = closed.get(type);
    if (cached !== undefined) return cached;
    const pending = [type];
    const visited = new Set<Type>();
    while (pending.length !== 0) {
      const current = pending.pop()!;
      if (visited.has(current) || closed.get(current) === true) continue;
      visited.add(current);
      const symbol = checker.getTypeSymbol(current);
      if (visited.size > 131072 || closed.get(current) === false || typeShape.isAny(current) || typeShape.isUnknown(current) ||
          checker.getSymbolDeclarations(symbol).some(declaration => declaration !== undefined && ast.is.IsTypeParameterDeclaration(declaration))) {
        closed.set(type, false);
        return false;
      }
      if (!typeShape.couldContainTypeVariables(current)) continue;
      const children = typeShape.isUnion(current) || typeShape.isIntersection(current)
        ? typeShape.getUnionOrIntersectionTypes(current)
        : typeShape.isTypeReference(current) ? typeShape.getTypeArguments(current)
          : [
            ...typeShape.getPropertyInfos(current).map(property => property.type),
            ...typeShape.getIndexInfos(current).flatMap(index => [index.keyType, index.valueType]),
            ...[...typeShape.getCallSignatures(current), ...typeShape.getConstructSignatures(current)].flatMap(signature => [
              ...typeShape.getSignatureParameterInfos(signature).map(parameter => parameter.type),
              typeShape.getReturnTypeOfSignature(signature),
              ...[typeShape.getSignatureThisParameterInfo(signature)].flatMap(parameter => parameter === undefined ? [] : [parameter.type]),
            ]),
          ];
      for (const child of children) {
        if (child === undefined) { closed.set(type, false); return false; }
        pending.push(child);
      }
    }
    for (const entry of visited) closed.set(entry, true);
    return true;
  }

  function selected(type: Type): MemoryTypeDomain | undefined {
    if (!isClosed(type)) return undefined;
    const fact = readSourceFact(context, type, sourcePrimitiveFactKey);
    if (fact !== undefined) return primitive(fact);
    if (typeShape.isNullish(type)) return intern("nullish", [type]);
    if (typeShape.isUnion(type) || typeShape.isIntersection(type)) {
      const children = typeShape.getUnionOrIntersectionTypes(type).map(child => child === undefined ? undefined : selected(child));
      return children.some(child => child === undefined) ? undefined
        : combine(typeShape.isUnion(type) ? "union" : "intersection", children.filter(child => child !== undefined));
    }
    const symbol = checker.getTypeSymbol(type);
    if (symbol !== undefined) {
      const declarations = checker.getSymbolDeclarations(symbol).filter(declaration => declaration !== undefined);
      const parameters = declarations.flatMap(typeParameters);
      if (parameters.length !== 0) return undefined;
      const domain = intern("reference", [symbol]);
      references.set(domain, { symbol, type });
      return domain;
    }
    return intern("source", [type]);
  }

  function resolveSymbol(node: Node): Symbol | undefined {
    let symbol = checker.getSymbolAtLocation(node);
    if (checker.getSymbolDeclarations(symbol).some(declaration => declaration !== undefined && (
      ast.is.IsImportSpecifier(declaration) || ast.is.IsImportClause(declaration) ||
      ast.is.IsNamespaceImport(declaration) || ast.is.IsExportSpecifier(declaration)
    ))) symbol = checker.getAliasedSymbol(symbol);
    return symbol;
  }

  function visit(node: Node, bindings: ReadonlyMap<Symbol, MemoryTypeDomain>): MemoryTypeDomain | undefined {
    if (active.has(node) || active.size >= 128) return undefined;
    active.add(node);
    try {
      const provider = memoryProviderFieldType(context, node);
      if (provider !== undefined) {
        if (provider.type === undefined) return undefined;
        if (provider.type.kind === "source-primitive") {
          const model = provider.type;
          const declared = primitives.find(value => value.primitive === model.name);
          return declared === undefined ? undefined : primitive({ ...declared, kind: declared.primitive });
        }
      }
      const fact = readSourceFact(context, node, sourcePrimitiveFactKey);
      if (fact !== undefined) return primitive(fact);
      if (readSourceFact(context, node, rawPointerFactKey) !== undefined) return intern("raw-pointer", []);
      const pointer = readSourceFact(context, node, pointerFactKey);
      if (pointer !== undefined) {
        const child = visit(pointer.pointee, bindings);
        return child === undefined ? undefined : intern("pointer", [pointer.mutability, child], [child]);
      }
      const fixedArray = readSourceFact(context, node, tsonicFixedArrayFactKey);
      if (fixedArray?.elementType !== undefined && ast.is.IsTypeReferenceNode(node)) {
        const elementNode = fixedArray.elementType;
        const child = visit(elementNode, bindings);
        const type = checker.getTypeFromTypeNode(node);
        return child === undefined || type === undefined ? undefined
          : array(type, child, fixedArray.length, fixedArray.lengthRuntimeBase);
      }
      if (ast.is.IsParenthesizedTypeNode(node)) {
        const inner = ast.as.AsParenthesizedTypeNode(node)?.Type;
        return inner === undefined ? undefined : visit(inner, bindings);
      }
      if (ast.is.IsUnionTypeNode(node) || ast.is.IsIntersectionTypeNode(node)) {
        const children = ast.children(node).map(child => child === undefined ? undefined : visit(child, bindings));
        return children.some(child => child === undefined) ? undefined
          : combine(ast.is.IsUnionTypeNode(node) ? "union" : "intersection", children.filter(child => child !== undefined));
      }
      if (ast.is.IsTypeReferenceNode(node) || ast.is.IsImportTypeNode(node)) {
        const name = ast.is.IsTypeReferenceNode(node) ? ast.as.AsTypeReferenceNode(node)?.TypeName : undefined;
        const imported = ast.is.IsImportTypeNode(node) ? checker.getTypeFromTypeNode(node) : undefined;
        const symbol = imported === undefined ? name === undefined ? undefined : resolveSymbol(name)
          : checker.getTypeAliasSymbol(imported) ?? checker.getTypeSymbol(imported);
        if (symbol === undefined) return undefined;
        const bound = bindings.get(symbol);
        if (bound !== undefined) return bound;
        const declarations = checker.getSymbolDeclarations(symbol).filter(declaration => declaration !== undefined);
        const arguments_ = ast.typeArguments(node).map(argument => argument === undefined ? undefined : visit(argument, bindings));
        if (arguments_.some(argument => argument === undefined)) return undefined;
        const children = arguments_.filter(argument => argument !== undefined);
        const genericDeclaration = declarations.find(declaration => typeParameters(declaration).length !== 0);
        const substituted = new Map(bindings);
        if (genericDeclaration !== undefined) {
          const parameters = typeParameters(genericDeclaration);
          if (children.length > parameters.length) return undefined;
          for (const [index, parameter] of parameters.entries()) {
            const parameterSymbol = checker.getSymbolAtLocation(ast.name(parameter));
            const defaultType = ast.as.AsTypeParameterDeclaration(parameter)?.DefaultType;
            const argument = children[index] ?? (defaultType === undefined ? undefined : visit(defaultType, substituted));
            if (parameterSymbol === undefined || argument === undefined) return undefined;
            substituted.set(parameterSymbol, argument);
            if (children[index] === undefined) children.push(argument);
          }
        }
        if (declarations.length === 1 && ast.is.IsTypeAliasDeclaration(declarations[0])) {
          const declaration = declarations[0]!;
          const body = ast.as.AsTypeAliasDeclaration(declaration)?.Type;
          return body === undefined ? undefined : visit(body, substituted);
        }
        if (declarations.some(declaration => ast.is.IsTypeParameterDeclaration(declaration))) return undefined;
        const domain = intern("reference", [symbol, ...children], children);
        for (const declaration of declarations) {
          for (const [index, parameter] of typeParameters(declaration).entries()) {
            const parameterSymbol = checker.getSymbolAtLocation(ast.name(parameter));
            if (parameterSymbol !== undefined && children[index] !== undefined) substituted.set(parameterSymbol, children[index]!);
          }
        }
        referenceBindings.set(domain, substituted);
        if (references.get(domain)?.type === undefined) {
          const type = checker.getTypeFromTypeNode(node);
          references.set(domain, { symbol, type: type !== undefined && isClosed(type) ? type : undefined });
        }
        return domain;
      }
      if (ast.is.IsArrayTypeNode(node)) {
        const element = ast.as.AsArrayTypeNode(node)?.ElementType;
        const child = element === undefined ? undefined : visit(element, bindings);
        const symbol = checker.getTypeSymbol(checker.getTypeFromTypeNode(node));
        if (child === undefined || symbol === undefined) return undefined;
        const substituted = new Map<Symbol, MemoryTypeDomain>();
        for (const declaration of checker.getSymbolDeclarations(symbol)) {
          const parameters = declaration === undefined ? [] : typeParameters(declaration);
          if (parameters.length === 0) continue;
          if (parameters.length !== 1) return undefined;
          const parameter = checker.getSymbolAtLocation(ast.name(parameters[0]));
          if (parameter === undefined) return undefined;
          substituted.set(parameter, child);
        }
        if (substituted.size === 0) return undefined;
        const domain = intern("reference", [symbol, child], [child]);
        referenceBindings.set(domain, substituted);
        references.set(domain, { symbol, type: checker.getTypeFromTypeNode(node) });
        return domain;
      }
      if (!ast.is.IsKeywordTypeNode(node) && !ast.is.IsLiteralTypeNode(node) &&
          !ast.is.IsTypeQueryNode(node) && !(ast.is.IsTypeLiteralNode(node) && bindings.size === 0)) return undefined;
      const type = checker.getTypeFromTypeNode(node);
      return type === undefined ? undefined : selected(type);
    } finally {
      active.delete(node);
    }
  }

  return Object.freeze({
    authored(node: Node) {
      if (cache.has(node)) return cache.get(node);
      const domain = visit(node, new Map());
      cache.set(node, domain);
      return domain;
    },
    selected,
    equivalent,
    bucket,
    referenceType: (domain: MemoryTypeDomain) => references.get(domain)?.type,
    array,
    isClosed,
    instantiated: (node: Node, bindings: ReadonlyMap<Symbol, MemoryTypeDomain>) => visit(node, bindings),
    member(node: Node, owner: MemoryTypeDomain) {
      return visit(node, referenceBindings.get(owner) ?? new Map());
    },
    indexed(owner: MemoryTypeDomain, type: Type) {
      const indexes = typeShape.getIndexInfos(type).filter(index => typeShape.isNumberLike(index.keyType));
      const annotation = indexes.length === 1 ? ast.typeNode(indexes[0]?.declaration) : undefined;
      return annotation === undefined ? undefined : visit(annotation, referenceBindings.get(owner) ?? new Map());
    },
    union: (children: readonly MemoryTypeDomain[]) => combine("union", children),
    pointer: (pointee: MemoryTypeDomain) => intern("pointer", ["readwrite", pointee], [pointee]),
    rawPointer: () => intern("raw-pointer", []),
    pointee(domain: MemoryTypeDomain) {
      if (domain.kind === "pointer") return domain.children[0];
      if (domain.kind !== "union") return undefined;
      const pointers = domain.children.filter(child => child.kind === "pointer");
      return pointers.length !== 0 && pointers.every(pointer => equivalent(pointer, pointers[0]!)) &&
        domain.children.every(child => child.kind === "pointer" || child.kind === "nullish")
        ? pointers[0]!.children[0] : undefined;
    },
  });
}
