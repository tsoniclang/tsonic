import type { Node } from "@tsonic/tsts";
import { analyzeSourceLiteralValues } from "../literal-values.js";
import type { SourceLiteralValue } from "../literal-values-model.js";
import { freezeSourceTypeDescriptor, sourceTypeDescriptorUnion, sourceTypeDescriptorStructure, sourceTypeDescriptorTupleValue,
  sourceTypeDescriptorsEqual } from "./terms.js";
import type { SourceTypeDescriptorUnions } from "./terms.js";
import type { SourceTypeDescriptorReadResult } from "../../host-input/descriptors.js";
import { createSourceTypeFlowRefusal } from "./refusals.js";
import { sourceTypeFlowDiscardedValue, sourceTypeFlowTypeSyntax, sourceTypeFlowValueSyntax } from "./value-syntax.js";
import { sourceTypeFlowRecursiveSignatures } from "./callable-returns.js";
import { createSourceTypeFlowDeclaredSlotReader } from "./declared-slots.js";
import { sourcePrimitiveOperatorLiteralFits } from "./operator-decisions.js";
import { isSourceCallableSignatureDeclaration } from "../../source-navigation/callable-boundaries.js";
import { isTypeSyntaxNode } from "../../source-navigation/syntax.js";
import type { SourceHostComponent, SourceHostInput, SourceHostQueries, SourceHostType } from "../../host-input/index.js";
import type {
  SourceEffectiveTypeArgument, SourceTypeDescriptor, SourceTypeDescriptorMember, SourceTypeFlowAnalysisContext,
  SourceTypeFlowFixedRule, SourceTypeFlowInheritedBinding, SourceTypeFlowRefusal, SourceTypeFlowSource,
} from "./types.js";

export interface SourceTypeFlowDefaults {
  readonly unionComponents: ReadonlyMap<Node, SourceTypeDescriptor>;
  readonly numberOrigins: ReadonlyMap<Node, SourceLiteralValue>;
  readonly context: SourceTypeFlowAnalysisContext;
  readonly nodes: readonly Node[];
  readonly values: readonly Node[];
  readonly signatureRefusals: ReadonlyMap<Node, SourceTypeFlowRefusal>;
  readonly descriptorRefusals: ReadonlyMap<Node, SourceTypeFlowRefusal>;
  readonly declaredSlots: ReturnType<typeof createSourceTypeFlowDeclaredSlotReader>;
  numericCreationRefusal(site: Node, reason: string): SourceTypeFlowRefusal;
  fixedRule(node: Node): SourceTypeFlowFixedRule | undefined;
  hasDeclaredSourceType(node: Node): boolean;
  /**
   * The Host descriptor of an authored type node (annotation, constraint, type argument, provider or marker type syntax):
   * the authored-syntax translation, or its refusal. undefined only for a node that is not type syntax.
   */
  typeSyntax(node: Node): SourceTypeDescriptor | SourceTypeFlowRefusal | undefined;
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

function sourceTypeFlowOptionalChainRead(node: Node, queries: SourceHostQueries): boolean {
  return queries.propertyAccess(node)?.optionalChain === true || queries.elementAccess(node)?.optionalChain === true ||
    queries.call(node)?.optionalChain === true;
}

export function createSourceTypeFlowAnalysisContext(source: SourceTypeFlowSource, unions: SourceTypeDescriptorUnions,
  input: SourceHostInput): SourceTypeFlowDefaults {
  const { ast, navigation } = source;
  function constAsserted(node: Node): boolean {
    let selected = node;
    for (let parent = ast.parent(selected); parent !== undefined; parent = ast.parent(selected)) {
      if (ast.is.IsParenthesizedExpression(parent)) { selected = parent; continue; }
      return ast.isConstAssertion(parent);
    }
    return false;
  }
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
    if (!typeOnly && sourceTypeFlowValueSyntax(ast, node) && !sourceTypeFlowDiscardedValue(source, node)) values.push(node);
    const children = ast.children(node);
    for (let index = children.length - 1; index >= 0; index -= 1) {
      const child = children[index];
      if (child !== undefined) pending.push({ node: child, typeOnly });
    }
  }
  const numberOrigins = new Map<Node, SourceLiteralValue>();
  for (const node of nodes) {
    const literal = literals.get(node);
    if (literal?.numeric !== undefined) numberOrigins.set(node, literal);
  }
  const cache = new WeakMap<Node, SourceTypeDescriptor>();
  const signatureRefusals = sourceTypeFlowRecursiveSignatures(source, input, nodes);
  const descriptorRefusals = new Map<Node, SourceTypeFlowRefusal>();
  function numericCreationRefusal(site: Node, reason: string): SourceTypeFlowRefusal {
    const existing = descriptorRefusals.get(site);
    if (existing !== undefined) return existing;
    const refusal = Object.freeze({ ...createSourceTypeFlowRefusal("TSONIC_LOCAL_TYPE_UNSUPPORTED", site), reason });
    descriptorRefusals.set(site, refusal);
    return refusal;
  }
  const describing: Node[] = [];
  const active = new Set<Node>();
  let declaredSlots: ReturnType<typeof createSourceTypeFlowDeclaredSlotReader>;
  // A library declaration (outside the program files) is read through the file of the use that selected it.
  const declarationQueries = new WeakMap<Node, SourceHostQueries>();
  for (const node of nodes) {
    if (!(ast.is.IsPropertyAccessExpression(node) || ast.is.IsElementAccessExpression(node) ||
      ast.is.IsCallExpression(node) || ast.is.IsNewExpression(node))) continue;
    const queries = input.at(node);
    const access = ast.is.IsPropertyAccessExpression(node) ? queries.propertyAccess(node)
      : ast.is.IsElementAccessExpression(node) ? queries.elementAccess(node) : undefined;
    const call = ast.is.IsCallExpression(node) || ast.is.IsNewExpression(node) ? queries.call(node) : undefined;
    for (const declaration of [access?.selectedDeclaration, call === undefined ? undefined : queries.callSignature(call)]) {
      if (declaration !== undefined) declarationQueries.set(declaration, queries);
    }
  }

  function primitive(queries: SourceHostQueries, subjects: Parameters<SourceHostQueries["primitive"]>[0]): SourceTypeDescriptor | undefined {
    const kind = queries.primitive(subjects);
    return kind === undefined ? undefined : { kind: "primitive", primitive: kind };
  }

  function declarationFor(node: Node): Node | undefined {
    if (ast.is.IsPropertyAccessExpression(node)) {
      const access = input.at(node).propertyAccess(node);
      const declaration = access?.selectedReadDeclaration ?? access?.selectedDeclaration;
      return declaration !== undefined && (ast.is.IsMethodDeclaration(declaration) || ast.is.IsMethodSignatureDeclaration(declaration))
        ? undefined : declaration;
    }
    if (ast.is.IsElementAccessExpression(node)) return input.at(node).elementAccess(node)?.selectedDeclaration;
    const declaration = navigation.sourceReferenceFor(node)?.declaration;
    if (declaration !== undefined && (ast.is.IsFunctionDeclaration(declaration) || ast.is.IsFunctionExpression(declaration) ||
      ast.is.IsArrowFunction(declaration) || ast.is.IsMethodDeclaration(declaration) ||
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

  const descriptor = input.descriptors(unions,
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

  function occurrenceBindings(node: Node, queries: SourceHostQueries,
    component?: SourceHostComponent): ReadonlyMap<Node, SourceTypeDescriptor> {
    const bindings = new Map<Node, SourceTypeDescriptor>();
    const call = component?.contextualCall ?? ((ast.is.IsCallExpression(node) || ast.is.IsNewExpression(node))
      ? queries.call(node) : undefined);
    const receiver = call === undefined ? ast.is.IsPropertyAccessExpression(node)
      ? queries.propertyAccess(node)?.receiver : ast.is.IsElementAccessExpression(node)
        ? queries.elementAccess(node)?.receiver : undefined : call.sourceReceiver ?? call.sourceCallee;
    if (receiver !== undefined && receiver.expression !== node) {
      // The receiver's binders take their values from the receiver's Host descriptor only (R3/R4): the declared
      // application of the binders' owner (through aliases and absence), or an array's element. The checker's type
      // arguments of the receiver expression are never a fallback. A receiver whose Host descriptor does not state
      // them refuses this occurrence (TSONIC_LOCAL_TYPE_GENERIC).
      const binders = (queries.typeArgumentBindings(receiver.type) ?? []).map(binding => binding.declaration);
      const values = binders.length === 0 ? [] : receiverBinderValues(receiver.expression, binders);
      if (values === undefined) {
        if (!descriptorRefusals.has(node)) descriptorRefusals.set(node, Object.freeze({
          ...createSourceTypeFlowRefusal("TSONIC_LOCAL_TYPE_GENERIC", node, receiver.expression),
          reason: "The receiver's Source type does not state the type arguments of the selected member's owner. Annotate the receiver.",
        }));
        return bindings;
      }
      binders.forEach((declaration, index) => bindings.set(declaration, values[index]!));
      for (const [declaration, binding] of descriptor.inheritedBindings(receiver.type, queries, bindings)) bindings.set(declaration, binding.value);
    }
    for (const selected of call?.sourceSelectedMethodTypeArguments ?? []) {
      const declaration = call === undefined ? undefined : queries.callTypeParameter(node, call, selected);
      const component = queries.methodTypeArgumentComponent(selected);
      const descriptor = component.authoredTypeNode === undefined
        ? describeType(component, queries, 0, bindings)
        : describeSyntax(component.authoredTypeNode, queries, 0, bindings);
      if (declaration !== undefined && descriptor !== undefined) bindings.set(declaration, descriptor);
    }
    if (call !== undefined && ast.is.IsNewExpression(node)) {
      const owner = queries.typeDeclaration(call.sourceResultType);
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

  // The values of a receiver's binders from its Host descriptor: `this` inside the binders' owner binds each binder to
  // itself; otherwise the descriptor (absence removed, aliases expanded) must be the owner's declared application with
  // one argument per binder, or an array for a one-binder owner. undefined: the Host descriptor does not state them.
  function receiverBinderValues(expression: Node, binders: readonly Node[]): readonly SourceTypeDescriptor[] | undefined {
    const owner = ast.parent(binders[0]!);
    if (owner === undefined || binders.some(binder => ast.parent(binder) !== owner)) return undefined;
    if (ast.kindName(expression) === "KindThisKeyword") {
      let enclosing = ast.parent(expression);
      while (enclosing !== undefined && enclosing !== owner && !ast.is.IsSourceFile(enclosing)) enclosing = ast.parent(enclosing);
      if (enclosing === owner) return binders.map(declaration =>
        Object.freeze({ kind: "declared" as const, declaration, typeArguments: Object.freeze([]) }));
    }
    let selected = describe(expression);
    const seen = new Set<SourceTypeDescriptor>();
    while (selected !== undefined && !seen.has(selected)) {
      seen.add(selected);
      if (selected.kind === "optional") { selected = selected.value; continue; }
      if (selected.kind === "array") return binders.length === 1 ? [selected.element] : undefined;
      // A tuple read as its array view: the one element binder is the union of its element types (Host order).
      if (selected.kind === "tuple") {
        if (binders.length !== 1) return undefined;
        const elements = selected.elements.map(element => {
          if (element.kind !== "rest") return element.type;
          const rest = sourceTypeDescriptorStructure(element.type);
          return rest.kind === "array" ? rest.element : element.type;
        });
        const element = sourceTypeDescriptorUnion(unions, elements);
        return element === undefined ? undefined : [element];
      }
      if (selected.kind !== "declared") return undefined;
      if (selected.declaration === owner) return selected.typeArguments.length === binders.length ? selected.typeArguments : undefined;
      selected = selected.definition;
    }
    return undefined;
  }

  function numericCreationLiteral(node: Node): SourceLiteralValue | undefined {
    let selected = node;
    let literal = literals.get(selected);
    if (literal?.form !== "numeric" && literal?.form !== "prefix-unary" &&
      literal?.form !== "parenthesized" && literal?.form !== "binary") return undefined;
    for (;;) {
      const parent = ast.parent(selected);
      const operator = parent === undefined ? undefined : ast.operatorKindName(parent);
      const encloses = parent !== undefined && (ast.is.IsParenthesizedExpression(parent) &&
        ast.as.AsParenthesizedExpression(parent)?.Expression === selected ||
        ast.is.IsPrefixUnaryExpression(parent) && (operator === "KindPlusToken" || operator === "KindMinusToken") &&
        ast.as.AsPrefixUnaryExpression(parent)?.Operand === selected);
      const enclosing = !encloses || parent === undefined ? undefined : literals.get(parent);
      if (parent === undefined || enclosing === undefined) return literal;
      selected = parent;
      literal = enclosing;
    }
  }

  function ownLiteral(node: Node, depth: number): SourceTypeDescriptor | undefined {
    if (depth > 4) return undefined;
    if (ast.is.IsNewExpression(node)) {
      const queries = input.at(node);
      const call = queries.call(node);
      if (call?.sourceSelectedSignatureKind === "resolved") {
        const component: SourceHostComponent = { selectedType: call.sourceResultType, contextualCall: call };
        return describeType(component, queries, depth, occurrenceBindings(node, queries, component));
      }
    }
    const literal = literals.get(node);
    if (literal?.form === "numeric" || literal?.form === "prefix-unary" || literal?.form === "parenthesized" || literal?.form === "binary") {
      if (literal.numeric?.kind === "authored" || literal.integerConstant !== undefined) {
        const decision = sourceTypeFlowNumericLiteralKind(numericCreationLiteral(node) ?? literal);
        return decision.kind === "resolved" ? { kind: "primitive", primitive: decision.primitive } : undefined;
      }
      if (literal.numeric?.kind === "checked-float64") return { kind: "primitive", primitive: "float64" };
    }
    if (literal?.form === "true" || literal?.form === "false") return { kind: "primitive", primitive: "bool" };
    if (literal?.form === "string" || literal?.form === "template") return { kind: "string" };
    if (ast.is.IsArrayLiteralExpression(node)) {
      const elements: SourceTypeDescriptor[] = [];
      for (const element of ast.elements(node)) {
        const value = element === undefined ? undefined : describe(element, undefined, depth + 1);
        if (value === undefined) return undefined;
        elements.push(value);
      }
      // Authored syntax decides the shape (R3): `[...] as const` is a readonly tuple of its elements; any other array
      // literal without a destination component is an array of the union of its elements.
      if (constAsserted(node)) {
        if (ast.elements(node).some(element => element !== undefined && ast.is.IsSpreadElement(element))) return undefined;
        return { kind: "tuple", readonly: true, elements: elements.map(type => ({ kind: "required" as const, type })) };
      }
      const selected = sourceTypeDescriptorUnion(unions, elements);
      return selected === undefined ? undefined : { kind: "array", readonly: false, element: selected };
    }
    if (ast.is.IsObjectLiteralExpression(node)) {
      const queries = input.at(node);
      const members: SourceTypeDescriptorMember[] = [];
      for (const property of ast.properties(node)) {
        if (property === undefined) return undefined;
        const nameNode = ast.name(property);
        if (nameNode === undefined || ast.is.IsComputedPropertyName(nameNode)) return undefined;
        const initializer = (ast.is.IsPropertyAssignment(property) ? ast.as.AsPropertyAssignment(property)?.Initializer : undefined) ??
          (ast.is.IsShorthandPropertyAssignment(property) ? nameNode : undefined);
        const value = initializer === undefined ? undefined : describe(initializer, undefined, depth + 1);
        if (value === undefined) return undefined;
        const name = queries.propertyName(nameNode);
        const element = queries.objectLiteralElement(property);
        const selected = name?.kind !== "resolved" || element?.objectLiteral !== node || element.element !== property
          ? undefined : queries.objectLiteralProperty(element);
        if (selected === undefined) return undefined;
        members.push({ name: selected.name, optional: selected.optional, type: value, origin: { kind: "declared", declaration: property } });
      }
      return members.length === 0 ? undefined : { kind: "shape", members, indexes: [], calls: [], constructs: [] };
    }
    return undefined;
  }

  function describe(node: Node, component?: SourceHostComponent, depth = 0,
    consumer?: SourceHostQueries, arguments_: readonly SourceEffectiveTypeArgument[] = []): SourceTypeDescriptor | undefined {
    if (active.has(node) || descriptorRefusals.has(node)) return undefined;
    const owner = navigation.sourceReferenceFor(node)?.declaration ?? node;
    const initializer = initializerOf(owner);
    if (signatureRefusals.has(owner) || initializer !== undefined && signatureRefusals.has(initializer)) return undefined;
    if (component === undefined && arguments_.length === 0) {
      const cached = cache.get(node);
      if (cached !== undefined) return cached;
    }
    const inProgram = input.includes(node);
    const queries = consumer ?? input.file(node) ?? declarationQueries.get(node);
    if (queries === undefined) return undefined;
    if (component === undefined && ast.is.IsCallExpression(node)) {
      const call = queries.call(node);
      const returned = call === undefined ? undefined : queries.callResult(call);
      if (call !== undefined && returned?.authoredTypeNode !== undefined) {
        const declaration = queries.callSignature(call);
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
    const nominal = component === undefined || component.declaration === declarationFor(node)
      ? input.nominalReadComponent(node) : undefined;
    let result = nominal === undefined ? undefined : describeType(nominal, queries, depth, bindings);
    if (contextual !== undefined) {
      const signature = queries.declarationSignature(node);
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
    const rule = inProgram ? fixedRule(node) : undefined;
    if (rule !== undefined && (component === undefined || component.declaration === rule.declaration)) {
      result = { kind: "primitive", primitive: "int64" };
    }
    const declaration = component?.declaration ?? declarationFor(node);
    if (result === undefined && component?.declaration === node && ast.is.IsTypeAliasDeclaration(node)) {
      result = describeType(component, queries, depth, bindings);
    }
    if (result === undefined && component === undefined && (ast.is.IsFunctionDeclaration(node) || ast.is.IsFunctionExpression(node) ||
      ast.is.IsArrowFunction(node) || ast.is.IsMethodDeclaration(node) || ast.is.IsMethodSignatureDeclaration(node))) {
      const selectedType = queries.declaredValueType(node);
      if (selectedType !== undefined) result = describeType({ selectedType, declaration: node }, queries, depth, bindings);
    }
    if (result === undefined && component === undefined && (ast.is.IsFunctionTypeNode(node) || ast.is.IsConstructorTypeNode(node))) {
      const selectedType = queries.authoredType(node);
      if (selectedType !== undefined) result = describeType({ selectedType, declaration: node }, queries, depth, bindings);
    }
    if (result === undefined && component === undefined && ast.is.IsPropertyAccessExpression(node)) {
      const access = queries.propertyAccess(node);
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
      const access = queries.elementAccess(node);
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
        // The key kind comes from the Host descriptor of the index expression (R3), not from its checked type.
        const keyType = describe(index, undefined, depth, queries);
        const keyStructure = keyType === undefined ? undefined : sourceTypeDescriptorStructure(keyType);
        const key = keyStructure?.kind === "string" || keyStructure?.kind === "primitive" && keyStructure.primitive === "char" ? "string" as const
          : keyStructure?.kind === "primitive" && keyStructure.primitive !== "bool" ? "number" as const
          : keyStructure?.kind === "intrinsic" && keyStructure.intrinsic === "symbol" ? "symbol" as const : undefined;
        if (key !== undefined) result = sourceTypeDescriptorIndexValue(descriptor, key);
      }
    }
    const annotation = component?.authoredTypeNode ?? (declaration === undefined ? undefined : ast.typeNode(declaration));
    if (result === undefined && annotation !== undefined) {
      // Authored narrowing (a narrowed-arms witness, R3): the annotation arms that remain at a narrowed identifier read,
      // each described from its own authored syntax.
      const selected = declaration !== undefined && node !== declaration && declaration === declarationFor(node) &&
        annotation === ast.typeNode(declaration) ? input.authoredNarrowing(node, declaration, annotation) : undefined;
      if (selected !== undefined) {
        const members = selected.nodes.map(member => describeSyntax(member, queries, depth, bindings));
        if (members.every((member): member is SourceTypeDescriptor => member !== undefined)) {
          result = sourceTypeDescriptorUnion(unions, [...members,
            ...Array.from({ length: selected.nullishCount }, () => ({ kind: "intrinsic", intrinsic: "absence" }) as const)]);
        }
      } else result = describeSyntax(annotation, queries, depth, bindings);
    }
    if (result === undefined && annotation !== undefined) {
      active.delete(node);
      describing.pop();
      return undefined;
    }
    if (result === undefined && declaration !== undefined && ast.is.IsParameterDeclaration(declaration)) {
      result = declaredSlots.parameter(declaration, queries);
    }
    if (result === undefined) result = primitive(queries, { ...(component === undefined ? { node } : { type: component.selectedType }),
      ...(declaration === undefined ? {} : { declaration }) });
    const includedDeclaration = declaration !== undefined && input.includes(declaration);
    if (result === undefined && component === undefined && declaration !== undefined && declaration !== node && includedDeclaration) {
      result = describe(declaration, undefined, depth, queries);
      const refusal = descriptorRefusals.get(declaration);
      if (refusal !== undefined) descriptorRefusals.set(node, refusal);
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
    if (result === undefined && annotation === undefined && component === undefined) {
      const producer = initializerOf(declaration ?? node) ?? node;
      const literal = numericCreationLiteral(producer);
      const creation = literal === undefined ? undefined : sourceTypeFlowNumericLiteralKind(literal);
      const failure = creation?.kind === "refused" ? creation : undefined;
      if (failure !== undefined) {
        let enclosing = declaration === undefined ? undefined : ast.parent(declaration);
        while (enclosing !== undefined && !ast.is.IsSourceFile(enclosing) && !isSourceCallableSignatureDeclaration(ast, enclosing)) {
          enclosing = ast.parent(enclosing);
        }
        if (declaration !== undefined && initializerOf(declaration) !== undefined &&
          (ast.is.IsPropertyDeclaration(declaration) || enclosing !== undefined && ast.is.IsSourceFile(enclosing))) {
          const refusal = descriptorRefusals.get(declaration) ?? numericCreationRefusal(producer, failure.reason);
          descriptorRefusals.set(declaration, refusal);
          descriptorRefusals.set(producer, refusal);
          descriptorRefusals.set(node, refusal);
        }
        active.delete(node);
        describing.pop();
        return undefined;
      }
    }
    if (result === undefined) {
      // Declaration input only (R3, defaults.ts:520 at baseline): the selected component or the declaration's declared type.
      // A value with neither has no Host description here; the solver refuses it (TSONIC_LOCAL_TYPE_UNSUPPORTED, I4).
      const type = component?.selectedType ??
        (declaration === undefined ? undefined : queries.declaredValueType(declaration));
      if (type !== undefined) result = describeType(component ?? { selectedType: type,
        ...(declaration === undefined ? {} : { declaration }) }, queries, depth, bindings);
    }
    // A narrowed read of an inferred union keeps the Host arms its narrowed-arms witness selects (R3).
    if (result !== undefined && annotation === undefined && declaration !== undefined && node !== declaration &&
      declaration === declarationFor(node)) result = narrowedArms(node, result, queries, depth);
    if (result !== undefined && ast.is.IsCallExpression(node)) {
      const call = component?.contextualCall ?? (component === undefined ? queries.call(node) : undefined);
      if (call?.call === node) result = queries.callResultType(unions, call, result);
    }
    // A read of the component's own declaration takes its presence at the read (flow witness); any other component
    // carries its own declared presence.
    const ownRead = component !== undefined && component.declaration !== undefined && node !== component.declaration &&
      component.declaration === declarationFor(node);
    const presenceAt = () => component === undefined || ownRead ? input.presence(node) : input.componentPresence(component, node);
    // A declared alias whose definition already carries absence (type T = U | undefined) is not wrapped again.
    if (result !== undefined && sourceTypeDescriptorStructure(result).kind !== "optional" && declaration !== undefined && ast.questionToken(declaration) !== undefined) {
      const presence = presenceAt();
      if (node === declaration || presence !== undefined && presence !== "present") result = { kind: "optional", value: result };
    }
    // An optional-chain read (a?.b, a?.[i], a?.f()) is absent when its chain short-circuits: its value carries absence
    // even though the selected member's own declared type does not.
    if (result !== undefined && sourceTypeDescriptorStructure(result).kind !== "optional" && component === undefined &&
      sourceTypeFlowOptionalChainRead(node, queries)) {
      if (input.presence(node) === "possibly-absent") result = { kind: "optional", value: result };
    }
    if (result !== undefined && sourceTypeDescriptorStructure(result).kind !== "optional" && component !== undefined &&
      presenceAt() === "possibly-absent") {
      result = { kind: "optional", value: result };
    }
    const structure = result === undefined ? undefined : sourceTypeDescriptorStructure(result);
    if (structure?.kind === "optional" && declaration !== undefined && node !== declaration &&
      declaration === declarationFor(node)) {
      if (presenceAt() === "present") result = structure.value;
    }
    active.delete(node);
    describing.pop();
    if (descriptorRefusals.has(node)) return undefined;
    if (result === undefined) return undefined;
    const frozen = freezeSourceTypeDescriptor(unions, result);
    if (component === undefined && arguments_.length === 0) cache.set(node, frozen);
    return frozen;
  }

  // The narrowed-arms witness selects arms of the Host's own union: every narrowed constituent must describe to exactly
  // one Host arm; otherwise the read keeps its declared descriptor.
  function narrowedArms(node: Node, type: SourceTypeDescriptor, queries: SourceHostQueries, depth: number): SourceTypeDescriptor {
    const outer = sourceTypeDescriptorStructure(type);
    const value = outer.kind === "optional" ? outer.value : type;
    const structure = sourceTypeDescriptorStructure(value);
    if (structure.kind !== "union") return type;
    const witness = input.narrowedMembers(node);
    if (witness === undefined) return type;
    const kept = new Set<number>();
    for (const member of witness.members) {
      const described = describeType(member, queries, depth);
      const matches = described === undefined ? [] : structure.types.flatMap((arm, index) =>
        sourceTypeDescriptorsEqual(arm, described) ? [index] : []);
      if (matches.length !== 1) return type;
      kept.add(matches[0]!);
    }
    if (kept.size === 0 || kept.size === structure.types.length) return type;
    const arms = structure.types.filter((_, index) => kept.has(index));
    const narrowed = arms.length === 1 ? arms[0]! : sourceTypeDescriptorUnion(unions, arms);
    if (narrowed === undefined) return type;
    return outer.kind === "optional" && witness.absent ? { kind: "optional", value: narrowed } : narrowed;
  }

  function hasDeclaredSourceType(node: Node): boolean {
    const declaration = declarationFor(node);
    const annotation = declaration === undefined ? undefined : ast.typeNode(declaration);
    return primitive(input.at(node), { node, ...(declaration === undefined ? {} : { declaration }),
      ...(annotation === undefined ? {} : { annotation }) }) !== undefined;
  }

  const context: SourceTypeFlowAnalysisContext = Object.freeze({ source, unions, input,
    describe: (node: Node, component?: SourceHostComponent, arguments_?: readonly SourceEffectiveTypeArgument[]) =>
      describe(node, component, 0, undefined, arguments_),
    authoredInheritedBindings: (type: SourceHostType, queries: SourceHostQueries, bindings: ReadonlyMap<Node, SourceTypeDescriptor>) => {
      const selected = new Map<Node, Required<SourceTypeFlowInheritedBinding>>();
      for (const [declaration, binding] of descriptor.inheritedBindings(type, queries, bindings, bindings)) {
        if (binding.authoredComponent !== undefined) selected.set(declaration, Object.freeze({
          value: freezeSourceTypeDescriptor(unions, binding.value), authoredComponent: binding.authoredComponent,
        }));
      }
      return selected;
    },
    literal: (node: Node) => literals.get(node),
    order: (node: Node) => {
      const range = ast.authoredRange(node);
      return { start: range.kind === "authored" ? range.start : ast.pos(node), preorder: ordinals.get(node) ?? nodes.length };
    } });
  declaredSlots = createSourceTypeFlowDeclaredSlotReader(context);
  const unionComponents = new Map<Node, SourceTypeDescriptor>();
  const syntaxNodes: Node[] = [...unions.files].reverse();
  const programQueries = input.program();
  while (syntaxNodes.length > 0 && programQueries !== undefined) {
    const node = syntaxNodes.pop()!;
    if (ast.is.IsSourceFile(node) && programQueries.isDefaultLibrary(node)) continue;
    if (ast.is.IsUnionTypeNode(node)) {
      const queries = input.file(node) ?? programQueries;
      const read = descriptor.syntax(node, queries);
      if (read.kind === "resolved" && read.type !== undefined) unionComponents.set(node, read.type);
    }
    const children = ast.children(node);
    for (let index = children.length - 1; index >= 0; index -= 1) if (children[index] !== undefined) syntaxNodes.push(children[index]!);
  }
  const typeSyntaxResults = new Map<Node, SourceTypeDescriptor | SourceTypeFlowRefusal>();
  function typeSyntax(node: Node): SourceTypeDescriptor | SourceTypeFlowRefusal | undefined {
    if (!isTypeSyntaxNode(ast, node)) return undefined;
    const existing = typeSyntaxResults.get(node);
    if (existing !== undefined) return existing;
    const queries = input.file(node) ?? declarationQueries.get(node) ?? input.program();
    const read = queries === undefined ? undefined : descriptor.syntax(node, queries);
    const result: SourceTypeDescriptor | SourceTypeFlowRefusal = read?.kind === "refused"
      ? Object.freeze({ ...createSourceTypeFlowRefusal(read.code, node, read.owner),
        reason: `Mapped property ${JSON.stringify(read.name)} requires one checked string literal, number literal or unique symbol key.` })
      : read?.type !== undefined ? freezeSourceTypeDescriptor(unions, read.type)
      : Object.freeze({ ...createSourceTypeFlowRefusal("TSONIC_LOCAL_TYPE_UNSUPPORTED", node),
        reason: "This type syntax has no Host description. Write it with a supported type form." });
    typeSyntaxResults.set(node, result);
    return result;
  }
  return Object.freeze({ context, nodes: Object.freeze(nodes), values: Object.freeze(values), signatureRefusals, descriptorRefusals, declaredSlots, unionComponents, numberOrigins,
    fixedRule, hasDeclaredSourceType, numericCreationRefusal, typeSyntax });
}

export type SourceTypeFlowNumericLiteralDecision =
  | { readonly kind: "resolved"; readonly primitive: "int64" | "float64" }
  | { readonly kind: "refused"; readonly reason: string };

export function sourceTypeFlowNumericLiteralKind(literal: SourceLiteralValue): SourceTypeFlowNumericLiteralDecision {
  const numeric = literal.numeric;
  if (numeric?.kind === "checked-float64" || numeric?.kind === "authored" && /[.eE]/u.test(numeric.token.decimalText)) {
    return Object.freeze({ kind: "resolved", primitive: "float64" });
  }
  if (sourcePrimitiveOperatorLiteralFits(literal, "int64")) {
    return Object.freeze({ kind: "resolved", primitive: "int64" });
  }
  return Object.freeze({ kind: "refused",
    reason: "An unbound integer literal is outside the exact 'int64' range. Annotate it with an exact native type or use bigint." });
}

// An index read takes the value of the one index signature whose key kind accepts the key: a number key reads a
// numeric index, or else the string index (number keys are converted to strings); a string key reads the string index;
// a symbol key reads the symbol index. Zero or several candidate indexes give no value.
export function sourceTypeDescriptorIndexValue(descriptor: Extract<SourceTypeDescriptor, { readonly kind: "shape" }>,
  key: "number" | "string" | "symbol"): SourceTypeDescriptor | undefined {
  const kindOf = (selected: SourceTypeDescriptor): "number" | "string" | "symbol" | undefined => selected.kind === "string" ? "string"
    : selected.kind === "primitive" ? "number" : selected.kind === "intrinsic" && selected.intrinsic === "symbol" ? "symbol" : undefined;
  let selected = descriptor.indexes.filter(index => kindOf(index.key) === key);
  if (selected.length === 0 && key === "number") selected = descriptor.indexes.filter(index => kindOf(index.key) === "string");
  return selected.length === 1 ? selected[0]!.value : undefined;
}
