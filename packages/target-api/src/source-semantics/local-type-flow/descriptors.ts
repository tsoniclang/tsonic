import { sourcePrimitiveFactKey, type ExtensionFactSubject, type Node, type Type } from "@tsonic/tsts";
import { sourceArrayElementType } from "../array-types.js";
import { sourceTypeDescriptorMemberOrigin } from "./member-origins.js";
import { sourceTypeDescriptorsEqual, sourceTypeDescriptorUnion } from "./terms.js";
import { sourceTypeFlowHomomorphicInput } from "./mapped-types.js";
import { failTargetCompilerResourceLimit } from "../../artifacts.js";
import { sourceTypeExpansionBudget } from "../type-expansion-budget.js";
import type { SourceFileSemantics, SourceTypeComponentEvidence } from "../types.js";
import type { SourceTypeDescriptor, SourceTypeDescriptorIndex, SourceTypeDescriptorMember, SourceTypeDescriptorSignature, SourceTypeDescriptorTupleElement, SourceTypeFlowSource } from "./types.js";

type Bindings = ReadonlyMap<Node, SourceTypeDescriptor>;

export interface SourceTypeDescriptorReadFailure {
  readonly kind: "refused";
  readonly code: "TSONIC_SOURCE_MAPPED_KEY_NOT_SINGLE";
  readonly owner: Node;
  readonly name: string;
}

export type SourceTypeDescriptorReadResult =
  | { readonly kind: "resolved"; readonly type: SourceTypeDescriptor | undefined }
  | SourceTypeDescriptorReadFailure;

export function createSourceTypeDescriptorReader(
  source: SourceTypeFlowSource,
  declarationFor: (type: Type, queries: SourceFileSemantics, authoredTypeNode?: Node) => Node | undefined,
  parametersFor: (declaration: Node) => readonly Node[],
  declaredValue: (declaration: Node, queries: SourceFileSemantics, bindings: Bindings) => SourceTypeDescriptor | undefined,
  refusedSignature: (declaration: Node) => boolean,
) {
  const { ast } = source;
  const active: { readonly declaration: Node; readonly arguments: readonly SourceTypeDescriptor[] }[] = [];
  const activeCallables = new Map<Type, Set<number>>();
  const empty: Bindings = new Map();
  const expansions = new Set<Type>();
  let expansionDepth = 0;
  let expansionSite: Node | undefined;
  const reads: { failure?: SourceTypeDescriptorReadFailure }[] = [];

  function capture(read: () => SourceTypeDescriptor | undefined): SourceTypeDescriptorReadResult {
    const frame: { failure?: SourceTypeDescriptorReadFailure } = {};
    reads.push(frame);
    try {
      const type = read();
      return frame.failure === undefined ? Object.freeze({ kind: "resolved", type })
        : frame.failure;
    } finally { reads.pop(); }
  }

  function expand<Value>(selectedType: Type | undefined, site: Node | undefined, depth: number, read: () => Value): Value {
    if (expansionDepth === 0) {
      expansions.clear();
      expansionSite = site;
    }
    expansionDepth += 1;
    if (Math.max(depth, active.length) > sourceTypeExpansionBudget.depth) {
      failTargetCompilerResourceLimit("tsonic", "Declared source type expansion", "depth", sourceTypeExpansionBudget.depth, expansionSite);
    }
    if (selectedType !== undefined) expansions.add(selectedType);
    if (expansions.size > sourceTypeExpansionBudget.types) {
      failTargetCompilerResourceLimit("tsonic", "Declared source type expansion", "types", sourceTypeExpansionBudget.types, expansionSite);
    }
    try { return read(); } finally { expansionDepth -= 1; }
  }

  function expanding(declaration: Node, arguments_: readonly SourceTypeDescriptor[]): boolean {
    return active.some(selected => selected.declaration === declaration && selected.arguments.length === arguments_.length &&
      selected.arguments.every((argument, index) => sourceTypeDescriptorsEqual(argument, arguments_[index]!)));
  }

  function recursionCut(declaration: Node, arguments_: readonly SourceTypeDescriptor[]): boolean {
    return ast.is.IsClassDeclaration(declaration) || ast.is.IsClassExpression(declaration) || ast.is.IsInterfaceDeclaration(declaration)
      ? active.some(selected => selected.declaration === declaration) : expanding(declaration, arguments_);
  }

  function primitive(subjects: readonly ExtensionFactSubject[]): SourceTypeDescriptor | undefined {
    for (const subject of subjects) {
      const fact = source.sourceFacts.getFact(subject, sourcePrimitiveFactKey);
      if (fact !== undefined) return { kind: "primitive", primitive: fact.kind };
    }
    return undefined;
  }

  function syntax(node: Node, queries: SourceFileSemantics, depth = 0, bindings: Bindings = empty): SourceTypeDescriptor | undefined {
    if (reads.some(read => read.failure !== undefined)) return undefined;
    return expand(queries.types.authoredType(node), node, depth, () => readSyntax(node, queries, depth, bindings));
  }

  function readSyntax(node: Node, queries: SourceFileSemantics, depth: number, bindings: Bindings): SourceTypeDescriptor | undefined {
    const direct = ast.is.IsUnionTypeNode(node) ? undefined : primitive([node]);
    if (direct !== undefined) return direct;
    const selectedType = queries.types.authoredType(node);
    if (selectedType === undefined) return undefined;
    const declaration = declarationFor(selectedType, queries, node);
    const substituted = declaration === undefined ? undefined : bindings.get(declaration);
    if (substituted !== undefined) return substituted;
    if (ast.is.IsParenthesizedTypeNode(node)) {
      const inner = ast.as.AsParenthesizedTypeNode(node)?.Type;
      return inner === undefined ? undefined : syntax(inner, queries, depth, bindings);
    }
    if (ast.is.IsArrayTypeNode(node)) {
      const elementNode = ast.as.AsArrayTypeNode(node)?.ElementType;
      const element = elementNode === undefined ? undefined : syntax(elementNode, queries, depth + 1, bindings);
      return element === undefined ? undefined : { kind: "array", readonly: false, element };
    }
    if (ast.is.IsTypeOperatorNode(node) && ast.operatorKindName(node) === "KindReadonlyKeyword") {
      const inner = ast.as.AsTypeOperatorNode(node)?.Type;
      const value = inner === undefined ? undefined : syntax(inner, queries, depth, bindings);
      return value?.kind === "array" || value?.kind === "tuple" ? { ...value, readonly: true } : value;
    }
    if (ast.is.IsTupleTypeNode(node)) {
      return tuple(selectedType, queries, depth, bindings, node);
    }
    if (ast.is.IsUnionTypeNode(node)) {
      const types: SourceTypeDescriptor[] = [];
      for (const child of ast.children(node)) {
        if (child === undefined) return undefined;
        const value = syntax(child, queries, depth + 1, bindings);
        if (value === undefined) return undefined;
        types.push(value);
      }
      return sourceTypeDescriptorUnion(types);
    }
    if (ast.is.IsTypeLiteralNode(node)) return structure(selectedType, queries, depth, bindings);
    if (ast.is.IsMappedTypeNode(node)) return structure(selectedType, queries, depth, bindings, node);
    if (ast.is.IsFunctionTypeNode(node) || ast.is.IsConstructorTypeNode(node)) {
      return structure(selectedType, queries, depth, bindings);
    }
    if (ast.is.IsImportTypeNode(node) && ast.typeArguments(node).length === 0) {
      const imported = primitive(queries.facts.authoredTypeSubjects(node));
      if (imported !== undefined) return imported;
    }
    if (declaration !== undefined) {
      const declaredPrimitive = primitive([declaration, ...queries.facts.selectedSubjects(undefined, declaration)]);
      if (declaredPrimitive !== undefined) return declaredPrimitive;
      if (ast.is.IsTypeReferenceNode(node) || ast.is.IsImportTypeNode(node)) {
        const argumentNodes = ast.typeArguments(node);
        const arguments_: SourceTypeDescriptor[] = [];
        for (const argument of argumentNodes) {
          const selected = argument === undefined ? undefined : syntax(argument, queries, depth + 1, bindings);
          if (selected === undefined) return undefined;
          arguments_.push(selected);
        }
        const parameters = parametersFor(declaration);
        const instantiated = new Map(bindings);
        parameters.forEach((parameter, index) => {
          const argument = arguments_[index];
          if (argument !== undefined) instantiated.set(parameter, argument);
        });
        let declaredBindings: readonly { readonly declaration: Node; readonly argumentType: Type }[] | undefined;
        if (ast.is.IsTypeAliasDeclaration(declaration)) {
          const checkedArguments: Type[] = [];
          for (const argument of argumentNodes) {
            const checked = argument === undefined ? undefined : queries.types.authoredType(argument);
            if (checked === undefined) return undefined;
            checkedArguments.push(checked);
          }
          const application = queries.types.instantiateAlias(declaration, checkedArguments);
          if (application?.kind !== "direct" || application.declaration !== declaration) return undefined;
          declaredBindings = application.bindings.map(binding => ({ declaration: binding.declaration, argumentType: binding.argument }));
        } else declaredBindings = queries.types.typeArgumentBindings(selectedType);
        if (declaredBindings !== undefined) {
          const ordered: SourceTypeDescriptor[] = [];
          for (const binding of declaredBindings) {
            const argument = instantiated.get(binding.declaration) ?? type(binding.argumentType, queries,
              { selectedType: binding.argumentType }, depth + 1, instantiated);
            if (argument === undefined) return undefined;
            ordered.push(argument);
            instantiated.set(binding.declaration, argument);
          }
          arguments_.splice(0, arguments_.length, ...ordered);
        }
        const body = ast.is.IsTypeAliasDeclaration(declaration) ? ast.typeNode(declaration) : undefined;
        const referenceOnly = body !== undefined && (ast.is.IsUnionTypeNode(body) || ast.is.IsMappedTypeNode(body) ||
          ast.is.IsConditionalTypeNode(body) || ast.is.IsTypeLiteralNode(body) &&
            ast.members(body).some(member => member !== undefined && ast.is.IsIndexSignatureDeclaration(member)));
        if (referenceOnly) return nominal(selectedType, declaration, arguments_, queries, {
          selectedType, declaration, authoredTypeNode: node,
        }, depth, instantiated);
        if (ast.is.IsTypeAliasDeclaration(declaration) && !expanding(declaration, arguments_)) {
          if (body !== undefined) {
            active.push({ declaration, arguments: arguments_ });
            const value = syntax(body, queries, depth, instantiated);
            active.pop();
            if (value !== undefined) return value;
          }
        }
        if (queries.types.isArrayLike(selectedType) && arguments_.length === 1) {
          return { kind: "array", readonly: queries.types.indexInfos(selectedType).some(index => index.readonly), element: arguments_[0]! };
        }
        if (arguments_.length > 0 || expanding(declaration, arguments_)) {
          return nominal(selectedType, declaration, arguments_, queries, {
            selectedType, declaration, authoredTypeNode: node,
          }, depth, instantiated);
        }
      }
    }
    return type(selectedType, queries, { selectedType, authoredTypeNode: node }, depth, bindings);
  }

  function members(selectedType: Type, queries: SourceFileSemantics, depth: number,
    bindings: Bindings): readonly SourceTypeDescriptorMember[] | undefined {
    const inherited = inheritedBindings(selectedType, queries, depth, bindings);
    const result: SourceTypeDescriptorMember[] = [];
    for (const property of queries.types.propertyInfos(selectedType)) {
      const selectedOrigin = sourceTypeDescriptorMemberOrigin(source, queries, property, selectedType);
      if (selectedOrigin?.kind === "refused") {
        const failure: SourceTypeDescriptorReadFailure = Object.freeze({ ...selectedOrigin, code: "TSONIC_SOURCE_MAPPED_KEY_NOT_SINGLE" });
        for (const read of reads) read.failure ??= failure;
        return undefined;
      }
      if (selectedOrigin === undefined) throw new Error(`Source member '${property.name}' has no approved checked origin (flags ${property.symbol.Flags}).`);
      const origin = selectedOrigin.origin;
      if (origin.kind !== "declared") {
        const value = type(property.type, queries, { selectedType: property.type }, depth + 1, inherited);
        if (value === undefined) return undefined;
        result.push({ name: property.name, optional: property.optional, readonly: property.readonly,
          origin, type: value });
        continue;
      }
      const declaration = origin.declaration;
      const method = ast.is.IsMethodDeclaration(declaration) || ast.is.IsMethodSignatureDeclaration(declaration);
      const annotation = method ? undefined : ast.is.IsSetAccessorDeclaration(declaration)
        ? ast.typeNode(ast.parameters(declaration)[0]) : ast.typeNode(declaration);
      let value = annotation === undefined && ast.is.IsPropertyDeclaration(declaration) &&
        ast.as.AsPropertyDeclaration(declaration)?.Initializer !== undefined ? declaredValue(declaration, queries, inherited)
        : annotation === undefined ? type(property.type, queries, { selectedType: property.type, declaration }, depth + 1, inherited)
        : syntax(annotation, queries, depth + 1, inherited);
      if (value === undefined) return undefined;
      if (property.optional && value.kind !== "optional") value = { kind: "optional", value };
      result.push({ name: property.name, optional: property.optional, readonly: property.readonly,
        origin, type: value });
    }
    return result;
  }

  function inheritedBindings(selectedType: Type, queries: SourceFileSemantics, depth: number, bindings: Bindings): Bindings {
    const result = new Map(bindings);
    const application = queries.types.aliasApplication(selectedType);
    if (application?.kind === "direct" && application.bindings.length === 1 &&
      sourceTypeFlowHomomorphicInput(source, queries, selectedType) !== undefined) {
      const input = bindings.get(application.bindings[0]!.declaration);
      const declared = input?.kind === "declared" ? queries.declarations.declaredType(input.declaration) : undefined;
      const parameters = declared === undefined ? undefined
        : queries.types.typeArgumentBindings(declared)?.map(binding => binding.declaration);
      if (input?.kind === "declared") (parameters ?? parametersFor(input.declaration)).forEach((parameter, index) => {
        const argument = input.typeArguments[index];
        if (argument !== undefined) result.set(parameter, argument);
      });
    }
    const declaration = declarationFor(selectedType, queries);
    const declaredType = declaration === undefined ? undefined : queries.declarations.declaredType(declaration);
    const pending = [{ type: declaredType ?? selectedType, depth: 0 }];
    const seen = new Set<Type>();
    while (pending.length > 0) {
      const current = pending.shift()!;
      if (seen.has(current.type)) continue;
      seen.add(current.type);
      for (const binding of queries.types.typeArgumentBindings(current.type) ?? []) {
        if (result.has(binding.declaration)) continue;
        const argument = type(binding.argumentType, queries, { selectedType: binding.argumentType }, depth + 1, result);
        if (argument !== undefined) result.set(binding.declaration, argument);
      }
      for (const base of queries.types.instantiatedBaseTypes(current.type) ?? []) pending.push({ type: base, depth: current.depth + 1 });
    }
    return result;
  }

  function indexes(selectedType: Type, queries: SourceFileSemantics, depth: number,
    bindings: Bindings, mappedOrigin?: Node): readonly SourceTypeDescriptorIndex[] | undefined {
    const result: SourceTypeDescriptorIndex[] = [];
    for (const index of queries.types.indexInfos(selectedType)) {
      const declaration = index.declaration ?? mappedOrigin;
      if (declaration === undefined || !(ast.is.IsIndexSignatureDeclaration(declaration) || ast.is.IsMappedTypeNode(declaration)) ||
        index.keyType === undefined || index.valueType === undefined) return undefined;
      const keyBase = queries.types.literalBaseType(index.keyType);
      if (keyBase === undefined || !queries.types.isIdentical(keyBase, index.keyType) ||
        !(queries.types.isStringLike(index.keyType) || queries.types.isNumberLike(index.keyType) ||
          queries.types.isSymbolLike(index.keyType))) return undefined;
      const parameter = ast.is.IsIndexSignatureDeclaration(declaration) ? ast.parameters(declaration)[0] : undefined;
      const keyNode = parameter === undefined ? undefined : ast.typeNode(parameter);
      const valueNode = ast.is.IsMappedTypeNode(declaration) ? ast.as.AsMappedTypeNode(declaration)?.Type : ast.typeNode(declaration);
      const key = keyNode === undefined ? type(index.keyType, queries, { selectedType: index.keyType }, depth + 1, bindings)
        : syntax(keyNode, queries, depth + 1, bindings);
      const value = valueNode === undefined ? type(index.valueType, queries, { selectedType: index.valueType }, depth + 1, bindings)
        : syntax(valueNode, queries, depth + 1, bindings);
      if (key === undefined || value === undefined || key.kind !== "string" &&
        !(key.kind === "primitive" && key.primitive === "float64") &&
        !(key.kind === "intrinsic" && key.intrinsic === "symbol")) return undefined;
      result.push({ declaration, key, value, readonly: index.readonly });
    }
    return result;
  }

  function nominal(selectedType: Type, declaration: Node, arguments_: readonly SourceTypeDescriptor[], queries: SourceFileSemantics,
    component: SourceTypeComponentEvidence, depth: number, bindings: Bindings): SourceTypeDescriptor | undefined {
    const reference = { kind: "declared" as const, declaration, typeArguments: arguments_ };
    if (recursionCut(declaration, arguments_) || ast.is.IsTypeParameterDeclaration(declaration) ||
      ast.is.IsEnumDeclaration(declaration)) return reference;
    active.push({ declaration, arguments: arguments_ });
    const alias = ast.is.IsTypeAliasDeclaration(declaration);
    const body = alias ? ast.typeNode(declaration) : undefined;
    const definition = body === undefined ? structure(selectedType, queries, depth, bindings)
      : ast.is.IsMappedTypeNode(body) || ast.is.IsConditionalTypeNode(body) ? type(selectedType, queries, component, depth, bindings, true)
        : syntax(body, queries, depth, bindings);
    active.pop();
    return definition === undefined ? undefined : { ...reference, definition };
  }

  function structure(selectedType: Type, queries: SourceFileSemantics, depth: number, bindings: Bindings,
    mappedOrigin?: Node): SourceTypeDescriptor | undefined {
    for (const signature of [...queries.types.signatureInfos(selectedType, "call"), ...queries.types.signatureInfos(selectedType, "construct")]) {
      const declaration = queries.declarations.signatureDeclaration(signature.signature);
      if (declaration !== undefined && refusedSignature(declaration)) return undefined;
    }
    let scopes = activeCallables.get(selectedType);
    if (scopes === undefined) { scopes = new Set(); activeCallables.set(selectedType, scopes); }
    const scope = active.length;
    if (scopes.has(scope)) return undefined;
    scopes.add(scope);
    try {
      const selectedMembers = members(selectedType, queries, depth, bindings);
      const selectedIndexes = indexes(selectedType, queries, depth, bindings, mappedOrigin);
      const calls = signatures(selectedType, queries, "call", depth, bindings);
      const constructs = signatures(selectedType, queries, "construct", depth, bindings);
      if (selectedMembers === undefined || selectedIndexes === undefined || calls === undefined || constructs === undefined) return undefined;
      return selectedMembers.length === 0 && selectedIndexes.length === 0 && calls.length + constructs.length > 0
        ? { kind: "callable", calls, constructs }
        : { kind: "shape", members: selectedMembers, indexes: selectedIndexes, calls, constructs };
    } finally {
      scopes.delete(scope);
      if (scopes.size === 0) activeCallables.delete(selectedType);
    }
  }

  function tuple(selectedType: Type, queries: SourceFileSemantics, depth: number, bindings: Bindings,
    authored?: Node): SourceTypeDescriptor | undefined {
    const elements: SourceTypeDescriptorTupleElement[] = [];
    const authoredElements = authored === undefined ? [] : ast.elements(authored);
    for (const [index, element] of queries.types.tupleElementInfos(selectedType).entries()) {
      const member = authoredElements[index] ?? element.declaration;
      let annotation = member === undefined ? undefined : ast.is.IsNamedTupleMember(member)
        ? ast.as.AsNamedTupleMember(member)?.Type : member;
      if (annotation !== undefined && ast.is.IsOptionalTypeNode(annotation)) annotation = ast.as.AsOptionalTypeNode(annotation)?.Type;
      if (annotation !== undefined && ast.is.IsRestTypeNode(annotation)) annotation = ast.as.AsRestTypeNode(annotation)?.Type;
      let value = annotation === undefined ? type(element.type, queries, { selectedType: element.type }, depth + 1, bindings)
        : syntax(annotation, queries, depth + 1, bindings);
      if (value === undefined) return undefined;
      const kind = element.elementKind === "variadic" ? "rest" : element.elementKind;
      if (kind === "rest" && value.kind === "array" && !queries.types.isArrayLike(element.type)) value = value.element;
      if (value.kind !== "optional" && queries.types.isUnion(element.type) &&
        queries.types.unionOrIntersectionTypes(element.type).some(selected => queries.types.isNullish(selected))) {
        value = { kind: "optional", value };
      }
      const declaration = element.declaration ?? (member !== undefined && ast.is.IsNamedTupleMember(member) ? member : undefined);
      elements.push({ kind, type: value, ...(declaration === undefined ? {} : { declaration }) });
    }
    return { kind: "tuple", readonly: queries.types.indexInfos(selectedType).some(index => index.readonly), elements };
  }

  function signatures(selectedType: Type, queries: SourceFileSemantics, kind: "call" | "construct", depth: number,
    bindings: Bindings): readonly SourceTypeDescriptorSignature[] | undefined {
    const result: SourceTypeDescriptorSignature[] = [];
    for (const signature of queries.types.signatureInfos(selectedType, kind)) {
      if (signature.returnType === undefined) return undefined;
      const declaration = queries.declarations.signatureDeclaration(signature.signature);
      const parameters: SourceTypeDescriptorSignature["parameters"][number][] = [];
      for (const parameter of signature.parameters) {
        const annotation = parameter.declaration === undefined ? undefined : ast.typeNode(parameter.declaration);
        const selected = annotation === undefined ? type(parameter.type, queries, { selectedType: parameter.type,
          ...(parameter.declaration === undefined ? {} : { declaration: parameter.declaration }) }, depth + 1, bindings)
          : syntax(annotation, queries, depth + 1, bindings);
        if (selected === undefined) return undefined;
        parameters.push({ type: selected, kind: parameter.parameterKind,
          ...(parameter.declaration === undefined ? {} : { declaration: parameter.declaration }) });
      }
      const annotation = declaration === undefined ? undefined : ast.typeNode(declaration);
      const returned = annotation === undefined ? type(signature.returnType, queries, { selectedType: signature.returnType }, depth + 1, bindings)
        : syntax(annotation, queries, depth + 1, bindings);
      if (returned === undefined) return undefined;
      result.push({ ...(declaration === undefined ? {} : { declaration }),
        typeParameters: declaration === undefined ? [] : parametersFor(declaration), parameters, result: returned });
    }
    return result;
  }

  function type(selectedType: Type, queries: SourceFileSemantics, component: SourceTypeComponentEvidence,
    depth = 0, bindings: Bindings = empty, aliasBody = false): SourceTypeDescriptor | undefined {
    if (reads.some(read => read.failure !== undefined)) return undefined;
    return expand(selectedType, component.authoredTypeNode ?? component.declaration, depth,
      () => readType(selectedType, queries, component, depth, bindings, aliasBody));
  }

  function readType(selectedType: Type, queries: SourceFileSemantics, component: SourceTypeComponentEvidence,
    depth: number, bindings: Bindings, aliasBody: boolean): SourceTypeDescriptor | undefined {
    const declaration = declarationFor(selectedType, queries);
    const substituted = declaration === undefined ? undefined : bindings.get(declaration);
    if (substituted !== undefined) return substituted;
    const direct = primitive(queries.facts.typeSubjects(selectedType));
    if (direct !== undefined) return direct;
    if (declaration !== undefined && ast.is.IsEnumDeclaration(declaration)) {
      return nominal(selectedType, declaration, [], queries, component, depth, bindings);
    }
    if (queries.types.isAny(selectedType)) return { kind: "intrinsic", intrinsic: "any" };
    if (queries.types.isUnknown(selectedType)) return { kind: "intrinsic", intrinsic: "unknown" };
    if (queries.types.isNonPrimitive(selectedType)) return { kind: "intrinsic", intrinsic: "object" };
    if (queries.types.isNever(selectedType)) return { kind: "intrinsic", intrinsic: "never" };
    if (queries.types.isNullish(selectedType)) return { kind: "intrinsic", intrinsic: "absence" };
    if (queries.types.isVoidLike(selectedType)) return { kind: "intrinsic", intrinsic: "void" };
    if (queries.types.isBooleanLike(selectedType)) return { kind: "primitive", primitive: "bool" };
    if (queries.types.isNumberLike(selectedType)) return { kind: "primitive", primitive: "float64" };
    if (queries.types.isStringLike(selectedType)) return { kind: "string" };
    if (queries.types.isBigIntLike(selectedType)) return { kind: "intrinsic", intrinsic: "bigint" };
    if (queries.types.isSymbolLike(selectedType)) return { kind: "intrinsic", intrinsic: "symbol" };
    if (declaration !== undefined && (ast.is.IsClassDeclaration(declaration) || ast.is.IsClassExpression(declaration)) &&
      queries.types.constructSignatures(selectedType).length > 0) return structure(selectedType, queries, depth, bindings);
    if (queries.types.isUnion(selectedType)) {
      const types: SourceTypeDescriptor[] = [];
      for (const member of queries.types.unionOrIntersectionTypes(selectedType)) {
        const selected = type(member, queries, { selectedType: member }, depth + 1, bindings);
        if (selected === undefined) return undefined;
        types.push(selected);
      }
      return sourceTypeDescriptorUnion(types);
    }
    if (queries.types.isIntersection(selectedType)) {
      return declaration === undefined ? undefined : nominal(selectedType, declaration, [], queries, component, depth, bindings);
    }
    if (queries.types.isTuple(selectedType)) {
      return tuple(selectedType, queries, depth, bindings);
    }
    const elementType = sourceArrayElementType(selectedType, queries);
    if (elementType !== undefined) {
      const element = type(elementType, queries, { selectedType: elementType }, depth + 1, bindings);
      return element === undefined ? undefined : { kind: "array", readonly: queries.types.indexInfos(selectedType).some(index => index.readonly), element };
    }
    if (declaration !== undefined && !ast.is.IsTypeLiteralNode(declaration) &&
      !(aliasBody && ast.is.IsTypeAliasDeclaration(declaration))) {
      const arguments_: SourceTypeDescriptor[] = [];
      const declaredBindings = queries.types.typeArgumentBindings(selectedType);
      const instantiated = new Map(bindings);
      for (const binding of declaredBindings ?? []) {
        const selected = bindings.get(binding.declaration) ?? type(binding.argumentType, queries, {
          selectedType: binding.argumentType,
        }, depth + 1, bindings);
        if (selected === undefined) return undefined;
        arguments_.push(selected);
        instantiated.set(binding.declaration, selected);
      }
      if (declaredBindings === undefined) for (const argument of queries.types.typeArguments(selectedType)) {
        const selected = type(argument, queries, { selectedType: argument }, depth + 1, bindings);
        if (selected === undefined) return undefined;
        arguments_.push(selected);
      }
      return nominal(selectedType, declaration, arguments_, queries, component, depth, instantiated);
    }
    if (queries.types.callSignatures(selectedType).length > 0 || queries.types.constructSignatures(selectedType).length > 0) {
      return structure(selectedType, queries, depth, bindings);
    }
    const body = aliasBody && declaration !== undefined && ast.is.IsTypeAliasDeclaration(declaration) ? ast.typeNode(declaration) : undefined;
    return structure(selectedType, queries, depth, bindings, body !== undefined && ast.is.IsMappedTypeNode(body) ? body : undefined);
  }

  return Object.freeze({
    syntax: (node: Node, queries: SourceFileSemantics, depth = 0, bindings: Bindings = empty) =>
      capture(() => syntax(node, queries, depth, bindings)),
    type: (selectedType: Type, queries: SourceFileSemantics, component: SourceTypeComponentEvidence,
      depth = 0, bindings: Bindings = empty) =>
      capture(() => type(selectedType, queries, component, depth, bindings)),
  });
}
