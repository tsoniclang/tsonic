import type { Node } from "@tsonic/tsts";
import { analyzeSourceLiteralValues } from "../literal-values.js";
import type { SourceLiteralValue } from "../literal-values-model.js";
import { freezeSourceTypeDescriptor, sourceTypeDescriptorOptional, sourceTypeDescriptorUnion, sourceTypeDescriptorStructure, sourceTypeDescriptorTupleValue,
  sourceTypeDescriptorsEqual } from "./terms.js";
import type { SourceTypeDescriptorUnions } from "./terms.js";
import { createSourceTypeDescriptorReader, type SourceTypeDescriptorReadResult } from "./descriptors.js";
import { createSourceTypeFlowRefusal } from "./refusals.js";
import { sourceTypeFlowDiscardedValue, sourceTypeFlowTypeSyntax, sourceTypeFlowValueSyntax } from "./value-syntax.js";
import { sourceTypeFlowRecursiveSignatures } from "./callable-returns.js";
import { createSourceTypeFlowDeclaredSlotReader } from "./declared-slots.js";
import { sourcePrimitiveOperatorLiteralFits } from "./operator-decisions.js";
import { isSourceCallableBodyBoundary, isSourceCallableSignatureDeclaration, sourceEnclosing, sourceNodeHasRole } from "../../source-model/callable-boundaries.js";
import { Node_Expression } from "../../source-model/ast.js";
import { sourceReceiverOwner } from "../../source-navigation/receiver-owner.js";
import { isTypeSyntaxNode } from "../../source-model/syntax.js";
import type { SourceHostInput } from "../../host-input/index.js";
import type { SourceHostComponent, SourceHostQueries, SourceHostType } from "../../host-input/queries.js";
import { sourceTypeDescriptorIndexValue, sourceTypeDescriptorKeyKind } from "./element-selection.js";
import { sourceTypeFlowOptionalChainCallResult } from "./presence.js";
import { sourceTypeFlowReceiverBinderValues } from "./instantiation.js";
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
  // E13 type-parameter-owner: the one role classifier (callable-boundaries.ts), F2-1.
  const owner = sourceNodeHasRole(ast, declaration, "type-parameter-owner");
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

  // The file view that reads a declaration: its own program file; else, for a library or provider declaration, the view
  // of the use that selected it or that selected its nearest enclosing declaration (a parameter, type parameter or member
  // of a selected signature or type); else the program view (provider declarations are declaration input, R3).
  function declarationView(node: Node): SourceHostQueries | undefined {
    const own = input.file(node);
    if (own !== undefined) return own;
    for (let current: Node | undefined = node; current !== undefined && !ast.is.IsSourceFile(current); current = ast.parent(current)) {
      const selected = declarationQueries.get(current);
      if (selected !== undefined) return selected;
    }
    return input.program();
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

  const descriptor = createSourceTypeDescriptorReader(source, unions,
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
  // The receiver binder values of a member call (instantiation.ts, the one rule, R1 #5). A `this` read inside the owner
  // is the owner applied to its own binders; any other receiver is its Host default description.
  function receiverBinderValues(expression: Node, binders: readonly Node[]): readonly SourceTypeDescriptor[] | undefined {
    const owner = ast.parent(binders[0]!);
    if (owner === undefined || binders.some(binder => ast.parent(binder) !== owner)) return undefined;
    if (ast.kindName(expression) === "KindThisKeyword") {
      let enclosing = ast.parent(expression);
      while (enclosing !== undefined && enclosing !== owner && !ast.is.IsSourceFile(enclosing)) enclosing = ast.parent(enclosing);
      if (enclosing === owner) return binders.map(declaration =>
        Object.freeze({ kind: "declared" as const, declaration, typeArguments: Object.freeze([]) }));
    }
    return sourceTypeFlowReceiverBinderValues({ unions, navigation }, describe(expression), owner, binders);
  }

  // The value of a `this` read from its receiver binder's declaration (declaration input only, R3; never the checked
  // type of the `this` expression). The binder is the nearest receiver owner (arrows are transparent):
  // - a callable with an explicit `this` parameter: that parameter's authored type;
  // - a class member (method, accessor, constructor, field initializer, static block): the class instance type, or the
  //   class constructor value for a static member and a static block;
  // - anything else (an object-literal method, whose receiver is the literal's own construction group in the flow
  //   graph; a free function; module scope): no description here.
  function receiverValue(node: Node, queries: SourceHostQueries, depth: number,
    bindings: ReadonlyMap<Node, SourceTypeDescriptor>): SourceTypeDescriptor | undefined {
    const owner = sourceReceiverOwner(node, ast, "lexical-capture");
    if (owner === undefined || ast.is.IsSourceFile(owner)) return undefined;
    if (isSourceCallableBodyBoundary(ast, owner)) {
      const explicit = ast.parameters(owner).find(parameter => {
        const name = parameter === undefined ? undefined : ast.name(parameter);
        return name !== undefined && ast.is.IsIdentifier(name) && ast.text(name) === "this";
      });
      if (explicit !== undefined) {
        const annotation = ast.typeNode(explicit);
        return annotation === undefined ? undefined : describeSyntax(annotation, queries, depth, bindings);
      }
    }
    // The receiver owner is a class member exactly when its parent is the nearest enclosing class scope (role model).
    const owningClass = sourceEnclosing(ast, owner, "class-scope");
    if (owningClass === undefined || ast.parent(owner) !== owningClass) return undefined;
    if (ast.is.IsClassStaticBlockDeclaration(owner) || ast.hasModifierKind(owner, "static")) {
      return describe(owningClass, undefined, depth, queries);
    }
    const instance = queries.declaredType(owningClass);
    return instance === undefined ? undefined
      : describeType({ selectedType: instance, declaration: owningClass }, queries, depth, bindings);
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

  // The Host rule of a value whose own syntax states its type (V1, total publication; declaration and syntax input
  // only, R3): `null`, the global `undefined` and `void e` are absence; a bigint literal is bigint; `delete e` is bool; a
  // regular expression literal is the library RegExp declaration it constructs (declaration witness); `typeof e` and a
  // template are strings (descriptors carry no literal types); parentheses and `satisfies` are transparent; `e!` is its
  // operand without the absence arm; `super` in an instance member is the declared base-class instance.
  function intrinsicValue(node: Node, depth: number): SourceTypeDescriptor | undefined {
    const kind = ast.kindName(node);
    if (kind === "KindNullKeyword" || ast.is.IsVoidExpression(node) ||
      ast.is.IsIdentifier(node) && ast.text(node) === "undefined" && navigation.sourceReferenceFor(node)?.declaration === undefined) {
      return { kind: "intrinsic", intrinsic: "absence" };
    }
    if (ast.is.IsBigIntLiteral(node)) return { kind: "intrinsic", intrinsic: "bigint" };
    if (ast.is.IsDeleteExpression(node)) return { kind: "primitive", primitive: "bool" };
    // A class expression is its constructor value: the declared value type of its own declaration (declaration input),
    // as for a function declaration read as a value.
    if (ast.is.IsClassExpression(node)) {
      const queries = input.at(node);
      const selectedType = queries.declaredValueType(node);
      return selectedType === undefined ? undefined : describeType({ selectedType, declaration: node }, queries, depth);
    }
    if (kind === "KindRegularExpressionLiteral") {
      const queries = input.at(node);
      const component = input.regularExpressionComponent(node);
      return component === undefined ? undefined : describeType(component, queries, depth);
    }
    if (ast.is.IsTypeOfExpression(node) || ast.is.IsTemplateExpression(node) || kind === "KindNoSubstitutionTemplateLiteral") {
      return { kind: "string" };
    }
    // `e as const` is its operand under the const rule (the operand's own literal rule reads constAsserted); `e as T` /
    // `<T>e` is the authored T.
    if (ast.isConstAssertion(node)) {
      const operand = Node_Expression(ast, node);
      return operand === undefined ? undefined : describe(operand, undefined, depth);
    }
    if (ast.is.IsAsExpression(node) || ast.is.IsTypeAssertion(node)) {
      const annotation = ast.typeNode(node);
      return annotation === undefined ? undefined : describeSyntax(annotation, input.at(node), depth);
    }
    if (ast.is.IsParenthesizedExpression(node) || ast.is.IsSatisfiesExpression(node)) {
      const operand = Node_Expression(ast, node);
      return operand === undefined ? undefined : describe(operand, undefined, depth);
    }
    if (ast.is.IsNonNullExpression(node)) {
      const operand = Node_Expression(ast, node);
      const value = operand === undefined ? undefined : describe(operand, undefined, depth);
      return value === undefined ? undefined : presentPart(value);
    }
    if (kind === "KindSuperKeyword") {
      const owner = sourceReceiverOwner(node, ast, "lexical-capture");
      const owningClass = owner === undefined || ast.is.IsSourceFile(owner) ? undefined : sourceEnclosing(ast, owner, "class-scope");
      if (owningClass === undefined || ast.parent(owner!) !== owningClass) return undefined;
      const queries = input.at(node);
      const instance = queries.declaredType(owningClass);
      const base = instance === undefined ? undefined : queries.instantiatedBaseTypes(instance)?.[0];
      const declaration = base === undefined ? undefined : queries.typeDeclaration(base);
      // In a static member or static block `super` is the base class constructor value, described as receiverValue
      // describes a static `this` (the class declaration's value).
      if (ast.hasModifierKind(owner!, "static") || ast.is.IsClassStaticBlockDeclaration(owner!)) {
        return declaration === undefined ? undefined : describe(declaration, undefined, depth, queries);
      }
      return base === undefined ? undefined
        : describeType({ selectedType: base, ...(declaration === undefined ? {} : { declaration }) }, queries, depth);
    }
    return undefined;
  }

  // A value without its absence arm (`e!`): an optional value's value, a union's present arms.
  function presentPart(type: SourceTypeDescriptor): SourceTypeDescriptor | undefined {
    const structure = sourceTypeDescriptorStructure(type);
    if (structure.kind === "optional") return structure.value;
    if (structure.kind !== "union") return type;
    const present = structure.types.filter(arm => !(arm.kind === "intrinsic" && arm.intrinsic === "absence"));
    return present.length === structure.types.length ? type : present.length === 1 ? present[0] : sourceTypeDescriptorUnion(unions, present);
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
    const intrinsic = intrinsicValue(node, depth);
    if (intrinsic !== undefined) return intrinsic;
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
    const queries = consumer ?? declarationView(node);
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
    // An identifier read narrowed to one project class (instanceof): the class's own declared instance type
    // (declaration input); the narrowing witness names only the class (R3).
    const narrowedClass = component === undefined || component.declaration === declarationFor(node)
      ? input.narrowedClass(node) : undefined;
    const narrowedInstance = narrowedClass === undefined ? undefined : queries.declaredType(narrowedClass);
    const nominal = narrowedClass === undefined || narrowedInstance === undefined ? undefined
      : { selectedType: narrowedInstance, declaration: narrowedClass };
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
    if (result === undefined && component === undefined && ast.kindName(node) === "KindThisKeyword") {
      result = receiverValue(node, queries, depth, bindings);
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
      // A receiver whose Host structure has no member inventory (array, tuple, string, primitive, a declared reference
      // without definition) reads the selected member declaration's declared value under this access's receiver binder
      // bindings (receiverBinderValues: an array's element, the owner's declared application). Declaration input only.
      if (result === undefined && selectedDeclaration !== undefined && descriptor !== undefined && descriptor.kind !== "shape") {
        result = describe(selectedDeclaration, undefined, depth, queries, [...bindings].map(([declaration, type]) => ({ declaration, type })));
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
        const key = keyType === undefined ? undefined : sourceTypeDescriptorKeyKind(keyType, { ast, literal: selected => literals.get(selected) });
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
      if (call?.call === node) result = sourceTypeFlowOptionalChainCallResult(unions, input, call, result);
    }
    // A read of the component's own declaration takes its presence at the read (flow witness); any other component
    // carries its own declared presence.
    const ownRead = component !== undefined && component.declaration !== undefined && node !== component.declaration &&
      component.declaration === declarationFor(node);
    const presenceAt = () => component === undefined || ownRead ? input.presence(node) : input.componentPresence(component, node);
    // A declared alias whose definition already carries absence (type T = U | undefined) is not wrapped again.
    if (result !== undefined && sourceTypeDescriptorStructure(result).kind !== "optional" && declaration !== undefined && ast.questionToken(declaration) !== undefined) {
      const presence = presenceAt();
      if (node === declaration || presence !== undefined && presence !== "present") result = sourceTypeDescriptorOptional(result);
    }
    // An optional-chain read (a?.b, a?.[i], a?.f()) is absent when its chain short-circuits: its value carries absence
    // even though the selected member's own declared type does not.
    if (result !== undefined && sourceTypeDescriptorStructure(result).kind !== "optional" && component === undefined &&
      sourceTypeFlowOptionalChainRead(node, queries)) {
      if (input.presence(node) === "possibly-absent") result = sourceTypeDescriptorOptional(result);
    }
    if (result !== undefined && sourceTypeDescriptorStructure(result).kind !== "optional" && component !== undefined &&
      presenceAt() === "possibly-absent") {
      result = sourceTypeDescriptorOptional(result);
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
    return outer.kind === "optional" && witness.absent ? sourceTypeDescriptorOptional(narrowed) : narrowed;
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
    const queries = declarationView(node);
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

