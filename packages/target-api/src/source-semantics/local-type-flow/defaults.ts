import { sourcePrimitiveFactKey, type ExtensionFactSubject, type Node, type SourcePrimitiveKind, type Type } from "@tsonic/tsts";
import { analyzeSourceLiteralValues } from "../literal-values.js";
import type { SourceLiteralValue } from "../literal-values-model.js";
import type { SourceFileSemantics, SourceTypeComponentEvidence } from "../types.js";
import { freezeSourceTypeDescriptor, sourceTypeDescriptorsEqual, sourceTypeDescriptorStructure, sourceTypeDescriptorTupleValue } from "./terms.js";
import { createSourceTypeDescriptorReader, type SourceTypeDescriptorReadResult } from "./descriptors.js";
import { createSourceTypeFlowRefusal } from "./refusals.js";
import { sourceTypeFlowTypeSyntax, sourceTypeFlowValueSyntax } from "./value-syntax.js";
import { sourceTypeFlowRecursiveSignatures } from "./callable-returns.js";
import { createSourceTypeFlowDeclaredSlotReader } from "./declared-slots.js";
import type {
  SourceEffectiveTypeArgument, SourceTypeDescriptor, SourceTypeDescriptorMember, SourceTypeFlowAnalysisContext,
  SourceTypeFlowFixedRule, SourceTypeFlowRefusal, SourceTypeFlowSource,
} from "./types.js";

export interface SourceTypeFlowDefaults {
  readonly context: SourceTypeFlowAnalysisContext;
  readonly nodes: readonly Node[];
  readonly values: readonly Node[];
  readonly signatureRefusals: ReadonlyMap<Node, SourceTypeFlowRefusal>;
  readonly descriptorRefusals: ReadonlyMap<Node, SourceTypeFlowRefusal>;
  readonly declaredSlots: ReturnType<typeof createSourceTypeFlowDeclaredSlotReader>;
  fixedRule(node: Node): SourceTypeFlowFixedRule | undefined;
  hasDeclaredSourceType(node: Node): boolean;
}

export function sourceTypeFlowTypeDeclaration(
  source: SourceTypeFlowSource,
  queries: SourceFileSemantics,
  type: Type,
  authoredTypeNode?: Node,
  excludedDeclaration?: Node,
): Node | undefined {
  const { ast, navigation } = source;
  const reference = authoredTypeNode !== undefined && ast.is.IsTypeReferenceNode(authoredTypeNode)
    ? ast.as.AsTypeReferenceNode(authoredTypeNode)?.TypeName
    : authoredTypeNode !== undefined && ast.is.IsImportTypeNode(authoredTypeNode)
      ? ast.as.AsImportTypeNode(authoredTypeNode)?.Qualifier : undefined;
  const authored = reference === undefined ? undefined : navigation.sourceReferenceFor(reference)?.declaration;
  if (authored !== undefined && (ast.is.IsTypeAliasDeclaration(authored) || ast.is.IsClassDeclaration(authored) ||
    ast.is.IsInterfaceDeclaration(authored) || ast.is.IsEnumDeclaration(authored) || ast.is.IsTypeParameterDeclaration(authored))) return authored;
  const symbols = [...new Set([queries.declarations.typeAliasSymbol(type), queries.declarations.typeSymbol(type)])];
  // A symbol can merge a type parameter with a same-named value (e.g. `function f<T>() { function T() {} }`): a type
  // parameter declaration names this type only when its declared type is this type.
  return symbols.flatMap(symbol => symbol === undefined ? [] : queries.declarations.symbolDeclarations(symbol)).find(declaration =>
    declaration !== excludedDeclaration && (ast.is.IsTypeAliasDeclaration(declaration) || ast.is.IsClassDeclaration(declaration) ||
    ast.is.IsClassExpression(declaration) || ast.is.IsInterfaceDeclaration(declaration) ||
    ast.is.IsEnumDeclaration(declaration) || ast.is.IsTypeLiteralNode(declaration) ||
    ast.is.IsTypeParameterDeclaration(declaration) && (() => {
      const declared = queries.declarations.declaredType(declaration);
      return declared !== undefined && queries.types.isIdentical(declared, type);
    })()));
}

export function sourceTypeFlowTypeParameters(ast: SourceTypeFlowSource["ast"], declaration: Node): readonly Node[] {
  const owner = ast.is.IsClassDeclaration(declaration) || ast.is.IsClassExpression(declaration) ||
    ast.is.IsInterfaceDeclaration(declaration) || ast.is.IsTypeAliasDeclaration(declaration) ||
    ast.is.IsFunctionDeclaration(declaration) || ast.is.IsFunctionExpression(declaration) || ast.is.IsArrowFunction(declaration) ||
    ast.is.IsMethodDeclaration(declaration) || ast.is.IsMethodSignatureDeclaration(declaration) ||
    ast.is.IsFunctionTypeNode(declaration) || ast.is.IsConstructorTypeNode(declaration) ||
    ast.is.IsCallSignatureDeclaration(declaration) || ast.is.IsConstructSignatureDeclaration(declaration);
  return owner ? ast.typeParameters(declaration).filter((parameter): parameter is Node => parameter !== undefined) : [];
}

function sourceTypeFlowOptionalChainRead(node: Node, queries: SourceFileSemantics): boolean {
  return queries.operations.propertyAccess(node)?.optionalChain === true || queries.operations.elementAccess(node)?.optionalChain === true ||
    queries.operations.call(node)?.optionalChain === true;
}

export function createSourceTypeFlowAnalysisContext(source: SourceTypeFlowSource): SourceTypeFlowDefaults {
  const { ast, semantics, navigation, sourceFacts } = source;
  const literals = analyzeSourceLiteralValues(ast, source.sourceFiles).literalValue;
  const nodes: Node[] = [];
  const values: Node[] = [];
  const ordinals = new WeakMap<Node, number>();
  const counters = new WeakMap<Node, SourceTypeFlowFixedRule>();
  const pending: { readonly node: Node; readonly typeOnly: boolean }[] = [];
  for (let index = source.sourceFiles.length - 1; index >= 0; index -= 1) {
    const file = source.sourceFiles[index]!;
    if (!ast.isDeclarationFile(file)) pending.push({ node: file, typeOnly: false });
  }
  while (pending.length > 0) {
    const entry = pending.pop()!;
    const { node } = entry;
    const typeOnly = entry.typeOnly || sourceTypeFlowTypeSyntax(ast, node);
    ordinals.set(node, nodes.length);
    nodes.push(node);
    if (!typeOnly && sourceTypeFlowValueSyntax(ast, node)) values.push(node);
    const children = ast.children(node);
    for (let index = children.length - 1; index >= 0; index -= 1) {
      const child = children[index];
      if (child !== undefined) pending.push({ node: child, typeOnly });
    }
  }
  const cache = new WeakMap<Node, SourceTypeDescriptor>();
  const signatureRefusals = sourceTypeFlowRecursiveSignatures(source, nodes);
  const descriptorRefusals = new Map<Node, SourceTypeFlowRefusal>();
  const describing: Node[] = [];
  const active = new Set<Node>();
  let declaredSlots: ReturnType<typeof createSourceTypeFlowDeclaredSlotReader>;
  const declarationQueries = new WeakMap<Node, SourceFileSemantics>();
  for (const node of nodes) {
    if (!(ast.is.IsPropertyAccessExpression(node) || ast.is.IsElementAccessExpression(node) ||
      ast.is.IsCallExpression(node) || ast.is.IsNewExpression(node))) continue;
    const queries = semantics.forNode(node);
    const access = ast.is.IsPropertyAccessExpression(node) ? queries.operations.propertyAccess(node)
      : ast.is.IsElementAccessExpression(node) ? queries.operations.elementAccess(node) : undefined;
    const call = ast.is.IsCallExpression(node) || ast.is.IsNewExpression(node) ? queries.operations.call(node) : undefined;
    for (const declaration of [access?.selectedDeclaration, call === undefined ? undefined : queries.declarations.signatureDeclaration(call.selectedSignature)]) {
      if (declaration !== undefined) declarationQueries.set(declaration, queries);
    }
  }

  function primitive(subjects: readonly ExtensionFactSubject[]): SourceTypeDescriptor | undefined {
    for (const subject of subjects) {
      const fact = sourceFacts.getFact(subject, sourcePrimitiveFactKey);
      if (fact !== undefined) return { kind: "primitive", primitive: fact.kind };
    }
    return undefined;
  }

  function declarationFor(node: Node): Node | undefined {
    if (ast.is.IsPropertyAccessExpression(node)) {
      const access = semantics.forNode(node).operations.propertyAccess(node);
      const declaration = access?.selectedReadDeclaration ?? access?.selectedDeclaration;
      return declaration !== undefined && (ast.is.IsMethodDeclaration(declaration) || ast.is.IsMethodSignatureDeclaration(declaration))
        ? undefined : declaration;
    }
    if (ast.is.IsElementAccessExpression(node)) return semantics.forNode(node).operations.elementAccess(node)?.selectedDeclaration;
    const declaration = navigation.sourceReferenceFor(node)?.declaration;
    if (declaration !== undefined && (ast.is.IsFunctionDeclaration(declaration) || ast.is.IsMethodDeclaration(declaration) ||
      ast.is.IsMethodSignatureDeclaration(declaration))) return undefined;
    return declaration ??
      (ast.is.IsVariableDeclaration(node) || ast.is.IsParameterDeclaration(node) ||
        ast.is.IsPropertyDeclaration(node) || ast.is.IsPropertySignatureDeclaration(node) ? node : undefined);
  }

  function fixedRule(node: Node): SourceTypeFlowFixedRule | undefined {
    const declaration = declarationFor(node);
    if (declaration === undefined || !ast.is.IsVariableDeclaration(declaration)) return undefined;
    if (ast.typeNode(declaration) !== undefined) return undefined;
    const existing = counters.get(declaration);
    if (existing !== undefined) return existing;
    const list = ast.parent(declaration);
    const loop = list === undefined ? undefined : ast.parent(list);
    if (loop === undefined || !ast.is.IsForStatement(loop) ||
      ast.as.AsForStatement(loop)?.Initializer !== list) return undefined;
    const initializer = ast.as.AsVariableDeclaration(declaration)?.Initializer;
    if (initializer === undefined || literals.get(initializer)?.integer === undefined) return undefined;
    const rule: SourceTypeFlowFixedRule = Object.freeze({ kind: "loop-counter", declaration });
    counters.set(declaration, rule);
    return rule;
  }

  function initializerOf(node: Node): Node | undefined {
    if (ast.is.IsVariableDeclaration(node)) return ast.as.AsVariableDeclaration(node)?.Initializer;
    if (ast.is.IsParameterDeclaration(node)) return ast.as.AsParameterDeclaration(node)?.Initializer;
    if (ast.is.IsPropertyDeclaration(node)) return ast.as.AsPropertyDeclaration(node)?.Initializer;
    if (ast.is.IsPropertyAssignment(node)) return ast.as.AsPropertyAssignment(node)?.Initializer;
    return undefined;
  }

  function typeDeclaration(type: Type, queries: SourceFileSemantics, authoredTypeNode?: Node,
    excludedDeclaration?: Node): Node | undefined {
    return sourceTypeFlowTypeDeclaration(source, queries, type, authoredTypeNode, excludedDeclaration);
  }

  const descriptor = createSourceTypeDescriptorReader(source, typeDeclaration,
    declaration => sourceTypeFlowTypeParameters(ast, declaration), (declaration, queries, bindings) =>
      describe(declaration, undefined, 0, queries, [...bindings].map(([declaration, type]) => ({ declaration, type }))),
    declaration => signatureRefusals.has(declaration));

  function descriptorValue(result: SourceTypeDescriptorReadResult): SourceTypeDescriptor | undefined {
    if (result.kind === "resolved") return result.type;
    const node = describing[describing.length - 1];
    if (node === undefined) throw new Error("A refused Source descriptor requires its original value occurrence.");
    if (!descriptorRefusals.has(node)) descriptorRefusals.set(node, Object.freeze({
      ...createSourceTypeFlowRefusal(result.code, node, result.owner),
      reason: `Mapped property ${JSON.stringify(result.name)} requires one checked string literal, number literal or unique symbol key.`,
    }));
    return undefined;
  }

  function describeSyntax(...arguments_: Parameters<typeof descriptor.syntax>): SourceTypeDescriptor | undefined {
    return descriptorValue(descriptor.syntax(...arguments_));
  }

  function describeType(...arguments_: Parameters<typeof descriptor.type>): SourceTypeDescriptor | undefined {
    return descriptorValue(descriptor.type(...arguments_));
  }

  function occurrenceBindings(node: Node, queries: SourceFileSemantics,
    component?: SourceTypeComponentEvidence): ReadonlyMap<Node, SourceTypeDescriptor> {
    const bindings = new Map<Node, SourceTypeDescriptor>();
    const call = component?.contextualCall ?? ((ast.is.IsCallExpression(node) || ast.is.IsNewExpression(node))
      ? queries.operations.call(node) : undefined);
    const receiver = call?.sourceReceiver ?? (ast.is.IsPropertyAccessExpression(node)
      ? queries.operations.propertyAccess(node)?.receiver : ast.is.IsElementAccessExpression(node)
        ? queries.operations.elementAccess(node)?.receiver : undefined);
    if (receiver !== undefined && receiver.expression !== node) {
      const descriptor = describe(receiver.expression);
      const arguments_ = descriptor?.kind === "declared" ? descriptor.typeArguments
        : descriptor?.kind === "array" ? [descriptor.element] : [];
      const declared = queries.types.typeArgumentBindings(receiver.type) ?? [];
      declared.forEach((binding, index) => {
        const value = arguments_[index] ?? describeType(binding.argumentType, queries, { selectedType: binding.argumentType });
        if (value !== undefined) bindings.set(binding.declaration, value);
      });
    }
    for (const selected of call?.sourceSelectedMethodTypeArguments ?? []) {
      const declaration = typeDeclaration(selected.typeParameter, queries);
      const descriptor = selected.explicitTypeNode === undefined
        ? describeType(selected.selectedType, queries, { selectedType: selected.selectedType }, 0, bindings)
        : describeSyntax(selected.explicitTypeNode, queries, 0, bindings);
      if (declaration !== undefined && descriptor !== undefined) bindings.set(declaration, descriptor);
    }
    if (call !== undefined && ast.is.IsNewExpression(node)) {
      const owner = typeDeclaration(call.sourceResultType, queries);
      const parameters = owner === undefined ? [] : sourceTypeFlowTypeParameters(ast, owner);
      const arguments_ = ast.typeArguments(node);
      if (arguments_.length === parameters.length) parameters.forEach((parameter, index) => {
        const argument = arguments_[index];
        const descriptor = argument === undefined ? undefined : describeSyntax(argument, queries, 0, bindings);
        if (descriptor !== undefined) bindings.set(parameter, descriptor);
      });
    }
    return bindings;
  }

  function ownLiteral(node: Node, depth: number): SourceTypeDescriptor | undefined {
    if (depth > 4) return undefined;
    if (ast.is.IsNewExpression(node)) {
      const queries = semantics.forNode(node);
      const call = queries.operations.call(node);
      if (call?.sourceSelectedSignatureKind === "resolved") return describeType(call.sourceResultType, queries,
        { selectedType: call.sourceResultType, contextualCall: call }, depth, occurrenceBindings(node, queries, { selectedType: call.sourceResultType, contextualCall: call }));
    }
    const literal = literals.get(node);
    if (literal?.form === "numeric" || literal?.form === "prefix-unary" || literal?.form === "parenthesized" || literal?.form === "binary") {
      if (literal.numeric?.kind === "authored") return { kind: "primitive", primitive: sourceTypeFlowNumericLiteralKind(literal) };
      if (literal.numeric?.kind === "checked-float64") return { kind: "primitive", primitive: "float64" };
    }
    if (literal?.form === "true" || literal?.form === "false") return { kind: "primitive", primitive: "bool" };
    if (literal?.form === "string" || literal?.form === "template") return { kind: "string" };
    if (ast.is.IsArrayLiteralExpression(node)) {
      let selected: SourceTypeDescriptor | undefined;
      for (const element of ast.elements(node)) {
        const value = element === undefined ? undefined : describe(element, undefined, depth + 1);
        if (value === undefined || selected !== undefined && !sourceTypeDescriptorsEqual(selected, value)) return undefined;
        selected = value;
      }
      return selected === undefined ? undefined : { kind: "array", readonly: false, element: selected };
    }
    if (ast.is.IsObjectLiteralExpression(node)) {
      const queries = semantics.forNode(node);
      const selectedType = queries.types.expressionType(node);
      if (selectedType === undefined) return undefined;
      const selectedMembers = queries.types.propertyInfos(selectedType);
      const members: SourceTypeDescriptorMember[] = [];
      for (const property of ast.properties(node)) {
        if (property === undefined) return undefined;
        const nameNode = ast.name(property);
        if (nameNode === undefined || ast.is.IsComputedPropertyName(nameNode)) return undefined;
        const initializer = (ast.is.IsPropertyAssignment(property) ? ast.as.AsPropertyAssignment(property)?.Initializer : undefined) ??
          (ast.is.IsShorthandPropertyAssignment(property) ? nameNode : undefined);
        const value = initializer === undefined ? undefined : describe(initializer, undefined, depth + 1);
        if (value === undefined) return undefined;
        const name = queries.propertyNames.get(nameNode);
        const symbol = queries.operations.objectLiteralElement(property)?.sourceElementSymbol;
        const selected = name?.kind !== "resolved" || symbol === undefined ? undefined : selectedMembers.find(member => member.symbol === symbol);
        if (selected === undefined) return undefined;
        members.push({ name: selected.name, optional: selected.optional, type: value, origin: { kind: "declared", declaration: property } });
      }
      return members.length === 0 ? undefined : { kind: "shape", members, indexes: [], calls: [], constructs: [] };
    }
    return undefined;
  }

  function describe(node: Node, component?: SourceTypeComponentEvidence, depth = 0,
    consumer?: SourceFileSemantics, arguments_: readonly SourceEffectiveTypeArgument[] = []): SourceTypeDescriptor | undefined {
    if (active.has(node) || descriptorRefusals.has(node)) return undefined;
    const owner = navigation.sourceReferenceFor(node)?.declaration ?? node;
    const initializer = initializerOf(owner);
    if (signatureRefusals.has(owner) || initializer !== undefined && signatureRefusals.has(initializer)) return undefined;
    if (component === undefined && arguments_.length === 0) {
      const cached = cache.get(node);
      if (cached !== undefined) return cached;
    }
    const file = ast.getSourceFile(node);
    const queries = consumer ?? (file !== undefined && semantics.includes(file) ? semantics.forFile(file) : declarationQueries.get(node));
    if (queries === undefined) return undefined;
    if (component === undefined && ast.is.IsCallExpression(node)) {
      const call = queries.operations.call(node);
      const returned = call === undefined ? undefined : queries.operations.callResult(call);
      if (call !== undefined && returned?.authoredTypeNode !== undefined) {
        const declaration = queries.declarations.signatureDeclaration(call.selectedSignature);
        component = { selectedType: returned.resultType, contextualCall: call, authoredTypeNode: returned.authoredTypeNode,
          ...(declaration === undefined ? {} : { declaration }) };
      }
    }
    const contextual = component === undefined && (ast.is.IsArrowFunction(node) || ast.is.IsFunctionExpression(node) ||
      ast.is.IsMethodDeclaration(node)) && ast.typeNode(node) === undefined ? declaredSlots.callable(node, queries) : undefined;
    active.add(node);
    describing.push(node);
    const bindings = new Map(occurrenceBindings(node, queries, component));
    for (const argument of arguments_) bindings.set(argument.declaration, argument.type);
    let result: SourceTypeDescriptor | undefined;
    if (contextual !== undefined) {
      const signature = queries.types.declarationSignatureInfo(node);
      const parameters = signature?.parameters.map((parameter, index) => {
        const declaration = parameter.declaration;
        const type = declaration === undefined ? undefined : describe(declaration, undefined, depth, queries, arguments_);
        return type === undefined ? undefined : { kind: contextual.signature.parameters[index]?.kind ?? parameter.parameterKind,
          type, ...(declaration === undefined ? {} : { declaration }) };
      });
      if (parameters !== undefined && parameters.every(parameter => parameter !== undefined)) {
        result = { ...contextual.type, calls: [{ declaration: node, typeParameters: sourceTypeFlowTypeParameters(ast, node),
          parameters: parameters.filter((parameter): parameter is NonNullable<typeof parameter> => parameter !== undefined),
          result: contextual.signature.result }] };
      }
    }
    const rule = file !== undefined && semantics.includes(file) ? fixedRule(node) : undefined;
    if (rule !== undefined && (component === undefined || component.declaration === rule.declaration)) {
      result = { kind: "primitive", primitive: "int64" };
    }
    const declaration = component?.declaration ?? declarationFor(node);
    if (result === undefined && component === undefined && (ast.is.IsFunctionDeclaration(node) || ast.is.IsFunctionExpression(node) ||
      ast.is.IsArrowFunction(node) || ast.is.IsMethodDeclaration(node) || ast.is.IsMethodSignatureDeclaration(node))) {
      const selectedType = queries.types.expressionType(node) ?? queries.declarations.declaredValueType(node);
      if (selectedType !== undefined) result = describeType(selectedType, queries, { selectedType, declaration: node }, depth, bindings);
    }
    if (result === undefined && component === undefined && (ast.is.IsFunctionTypeNode(node) || ast.is.IsConstructorTypeNode(node))) {
      const selectedType = queries.types.authoredType(node);
      if (selectedType !== undefined) result = describeType(selectedType, queries, { selectedType, declaration: node }, depth, bindings);
    }
    if (result === undefined && component === undefined && ast.is.IsPropertyAccessExpression(node)) {
      const access = queries.operations.propertyAccess(node);
      const receiver = access?.receiver.expression;
      const receiverType = receiver === undefined ? undefined : describe(receiver, undefined, depth, queries);
      const descriptor = receiverType === undefined ? undefined : sourceTypeDescriptorStructure(receiverType);
      const selectedDeclaration = access?.selectedReadDeclaration ?? access?.selectedDeclaration;
      if (selectedDeclaration !== undefined && descriptor?.kind === "shape") {
        result = descriptor.members.find(member => member.origin.kind === "declared" && member.origin.declaration === selectedDeclaration)?.type;
      }
      // A property read with no declared member reads the string index signature (e.g. a Record<string, T> receiver).
      if (result === undefined && descriptor?.kind === "shape" && descriptor.indexes.length > 0 &&
        !descriptor.members.some(member => member.name === ast.text(ast.name(node)))) {
        result = sourceTypeDescriptorIndexValue(descriptor, "string");
      }
    }
    if (result === undefined && component === undefined && ast.is.IsElementAccessExpression(node)) {
      const access = queries.operations.elementAccess(node);
      const receiver = access?.receiver.expression;
      const receiverType = receiver === undefined ? undefined : describe(receiver, undefined, depth, queries);
      const descriptor = receiverType === undefined ? undefined : sourceTypeDescriptorStructure(receiverType);
      const index = ast.as.AsElementAccessExpression(node)?.ArgumentExpression;
      const literal = index === undefined ? undefined : literals.get(index);
      const position = literal?.integerConstant ?? literal?.integer;
      if (descriptor?.kind === "array") result = descriptor.element;
      else if (descriptor?.kind === "tuple" && position !== undefined && position >= 0n && position <= BigInt(Number.MAX_SAFE_INTEGER)) {
        result = sourceTypeDescriptorTupleValue(descriptor, Number(position));
      }
      else if (descriptor?.kind === "shape" && descriptor.indexes.length > 0 && index !== undefined) {
        const keyType = queries.types.expressionType(index);
        const key = keyType === undefined ? undefined : queries.types.isNumberLike(keyType) ? "number" as const
          : queries.types.isStringLike(keyType) ? "string" as const : queries.types.isSymbolLike(keyType) ? "symbol" as const : undefined;
        if (key !== undefined) result = sourceTypeDescriptorIndexValue(descriptor, key);
      }
    }
    const annotation = component?.authoredTypeNode ?? (declaration === undefined ? undefined : ast.typeNode(declaration));
    if (result === undefined && annotation !== undefined) result = describeSyntax(annotation, queries, depth, bindings);
    if (result === undefined && annotation !== undefined) {
      active.delete(node);
      describing.pop();
      return undefined;
    }
    if (result === undefined && declaration !== undefined && ast.is.IsParameterDeclaration(declaration)) {
      result = declaredSlots.parameter(declaration, queries);
    }
    if (result === undefined) result = primitive([...(component === undefined ? [node] : []),
      ...queries.facts.selectedSubjects(undefined, declaration),
      ...(component === undefined ? [] : queries.facts.typeSubjects(component.selectedType))]);
    const declarationFile = declaration === undefined ? undefined : ast.getSourceFile(declaration);
    const includedDeclaration = declarationFile !== undefined && semantics.includes(declarationFile);
    if (result === undefined && component === undefined && declaration !== undefined && declaration !== node && includedDeclaration) {
      result = describe(declaration, undefined, depth, queries);
    }
    if (result === undefined && component === undefined) {
      const initializer = initializerOf(node);
      if (initializer !== undefined) result = describe(initializer, undefined, depth, queries);
      else result = ownLiteral(node, depth);
    }
    if (result === undefined && annotation === undefined && component?.declaration !== undefined &&
      component.declaration === declarationFor(node) && includedDeclaration) {
      const initializer = initializerOf(component.declaration);
      if (initializer !== undefined) result = describe(initializer, undefined, depth, queries);
    }
    if (result === undefined) {
      const type = component?.selectedType ?? queries.types.expressionType(node) ??
        (declaration === undefined ? undefined : queries.declarations.declaredValueType(declaration));
      if (type !== undefined) result = describeType(type, queries, component ?? { selectedType: type,
        ...(declaration === undefined ? {} : { declaration }) }, depth, bindings);
    }
    // A declared alias whose definition already carries absence (type T = U | undefined) is not wrapped again.
    if (result !== undefined && sourceTypeDescriptorStructure(result).kind !== "optional" && declaration !== undefined && ast.questionToken(declaration) !== undefined) {
      const type = component?.selectedType ?? queries.types.expressionType(node);
      if (node === declaration || type !== undefined && queries.types.isUnion(type)) result = { kind: "optional", value: result };
    }
    // An optional-chain read (a?.b, a?.[i], a?.f()) is absent when its chain short-circuits: its value carries absence
    // even though the selected member's own declared type does not.
    if (result !== undefined && sourceTypeDescriptorStructure(result).kind !== "optional" && component === undefined &&
      sourceTypeFlowOptionalChainRead(node, queries)) {
      const type = queries.types.expressionType(node);
      if (type !== undefined && queries.types.isUnion(type) &&
        queries.types.unionOrIntersectionTypes(type).some(part => queries.types.isNullish(part))) result = { kind: "optional", value: result };
    }
    if (result !== undefined && sourceTypeDescriptorStructure(result).kind !== "optional" && component !== undefined &&
      queries.types.isUnion(component.selectedType) && queries.types.unionOrIntersectionTypes(component.selectedType)
        .some(type => queries.types.isNullish(type))) {
      result = { kind: "optional", value: result };
    }
    if (result?.kind === "optional" && declaration !== undefined && node !== declaration &&
      declaration === declarationFor(node)) {
      const selected = component?.selectedType ?? queries.types.expressionType(node);
      if (selected !== undefined && !queries.types.isUnion(selected) && !queries.types.isNullish(selected)) result = result.value;
    }
    active.delete(node);
    describing.pop();
    if (descriptorRefusals.has(node)) return undefined;
    if (result === undefined) return undefined;
    const frozen = freezeSourceTypeDescriptor(result);
    if (component === undefined && arguments_.length === 0) cache.set(node, frozen);
    return frozen;
  }

  function hasDeclaredSourceType(node: Node): boolean {
    const declaration = declarationFor(node);
    const annotation = declaration === undefined ? undefined : ast.typeNode(declaration);
    const queries = semantics.forNode(node);
    return primitive([node, ...queries.facts.selectedSubjects(undefined, declaration),
      ...(annotation === undefined ? [] : queries.facts.authoredTypeSubjects(annotation))]) !== undefined;
  }

  const context: SourceTypeFlowAnalysisContext = Object.freeze({ source,
    describe: (node: Node, component?: SourceTypeComponentEvidence, arguments_?: readonly SourceEffectiveTypeArgument[]) =>
      describe(node, component, 0, undefined, arguments_),
    literal: (node: Node) => literals.get(node),
    order: (node: Node) => {
      const range = ast.authoredRange(node);
      return { start: range.kind === "authored" ? range.start : ast.pos(node), preorder: ordinals.get(node) ?? nodes.length };
    } });
  declaredSlots = createSourceTypeFlowDeclaredSlotReader(context);
  return Object.freeze({ context, nodes: Object.freeze(nodes), values: Object.freeze(values), signatureRefusals, descriptorRefusals, declaredSlots,
    fixedRule, hasDeclaredSourceType });
}

export function sourceTypeFlowNumericLiteralKind(literal: SourceLiteralValue): "int32" | "float64" {
  const numeric = literal.numeric;
  const integer = literal.integerConstant ?? literal.integer;
  return numeric?.kind === "checked-float64" || numeric?.kind === "authored" &&
    (numeric.token.negative && numeric.token.coefficient === 0n || /[.eE]/u.test(numeric.token.decimalText)) ||
    integer !== undefined && !sourceTypeFlowIntegerFits(integer, "int32")
    ? "float64" : "int32";
}

export function sourceTypeFlowIntegerFits(value: bigint, kind: SourcePrimitiveKind): boolean {
  switch (kind) {
    case "int8": return value >= -128n && value <= 127n;
    case "uint8": return value >= 0n && value <= 255n;
    case "int16": return value >= -32768n && value <= 32767n;
    case "uint16": case "char": return value >= 0n && value <= 65535n;
    case "int32": return value >= -2147483648n && value <= 2147483647n;
    case "uint32": return value >= 0n && value <= 4294967295n;
    case "int64": return value >= -9223372036854775808n && value <= 9223372036854775807n;
    case "uint64": return value >= 0n && value <= 18446744073709551615n;
    case "float32": return Number.isFinite(Math.fround(Number(value)));
    case "float64": return Number.isFinite(Number(value));
    case "decimal": return value >= -79228162514264337593543950335n && value <= 79228162514264337593543950335n;
    default: return false;
  }
}

// An index read takes the value of the one index signature whose key kind accepts the key: a number key reads a
// numeric index, or else the string index (number keys are converted to strings); a string key reads the string index;
// a symbol key reads the symbol index. Zero or several candidate indexes give no value.
function sourceTypeDescriptorIndexValue(descriptor: Extract<SourceTypeDescriptor, { readonly kind: "shape" }>,
  key: "number" | "string" | "symbol"): SourceTypeDescriptor | undefined {
  const kindOf = (selected: SourceTypeDescriptor): "number" | "string" | "symbol" | undefined => selected.kind === "string" ? "string"
    : selected.kind === "primitive" ? "number" : selected.kind === "intrinsic" && selected.intrinsic === "symbol" ? "symbol" : undefined;
  let selected = descriptor.indexes.filter(index => kindOf(index.key) === key);
  if (selected.length === 0 && key === "number") selected = descriptor.indexes.filter(index => kindOf(index.key) === "string");
  return selected.length === 1 ? selected[0]!.value : undefined;
}
