import type { AstReader, Node, Type } from "@tsonic/tsts";
import {
  BindingElement_IsRest, BindingElement_PropertyName, Node_Expression, Node_Initializer,
  ObjectLiteralProperty_Value, SpreadAssignment_Expression, sourceTransparentExpressionOperand,
} from "../../source-navigation/ast.js";
import type { ResolvedSourceCallInfo } from "../../source-navigation/call-info.js";
import { isTypeSyntaxNode } from "../../source-navigation/syntax.js";
import { sourceLiteralToken } from "../literal-token.js";
import { sourceArrayElementType } from "../array-types.js";
import type { SourceFileSemantics, SourceFinalTypeQueries, SourceTypeComponentEvidence } from "../types.js";
import { sourceTypeDescriptorIndexValue, sourceTypeFlowNominalReadComponent, sourceTypeFlowTypeDeclaration, sourceTypeFlowTypeParameters } from "./defaults.js";
import { selectSourcePropertyDeclaration, selectedSourcePropertyDeclarations } from "../selected-property-declarations.js";
import { createSourceTypeFlowDeclaredSlotReader } from "./declared-slots.js";
import { sourceTypeFlowHomomorphicInput } from "./mapped-types.js";
import { sourceTypeFlowConstructionSlot } from "./construction-slots.js";
import { sourceTypeFlowAssignmentPattern, sourceTypeFlowDiscardedValue, sourceTypeFlowTypeSyntax, sourceTypeFlowValueSyntax } from "./value-syntax.js";
import { createSourceTypeFlowRefusal } from "./refusals.js";
import { sourceTypeFlowLinkAdjacency, sourceTypeFlowReachableVariables } from "./links.js";
import { sourceTypeDescriptorStructure, sourceTypeDescriptorTupleValue } from "./terms.js";
import { sourceTypeDescriptorMemberOrigin, sourceTypeDescriptorMemberOriginsEqual } from "./member-origins.js";
import { sourceTypeFlowBinaryOperators, sourceTypeFlowUnaryOperators } from "./operators.js";
import type {
  SourceTypeDescriptor, SourceTypeFlowAnalysisContext, SourceTypeFlowArgumentPlace, SourceTypeFlowAssociation,
  SourceTypeFlowBinder, SourceTypeFlowCall, SourceTypeFlowDerived, SourceTypeFlowGraph,
  SourceTypeFlowLink, SourceTypeFlowNode, SourceTypeFlowOperator, SourceTypeFlowPathPart,
  SourceTypeFlowRefusal, SourceTypeFlowTerm, SourceTypeFlowVariable,
} from "./types.js";

export function collectSourceTypeFlowEdges(context: SourceTypeFlowAnalysisContext): SourceTypeFlowGraph {
  const { ast, navigation, semantics } = context.source;
  const roots: Node[] = [];
  const rootOf = new Map<Node, Node>();
  const typeOnly = new Set<Node>();
  const syntax: Node[] = [];
  const nodes = new Map<Node, SourceTypeFlowNode>();
  const links: SourceTypeFlowLink[] = [];
  const derived = new Map<Node, SourceTypeFlowDerived>();
  const calls = new Map<Node, SourceTypeFlowCall>();
  const refusals: SourceTypeFlowRefusal[] = [];
  const refusedOperations = new WeakMap<Node, SourceTypeFlowRefusal>();
  const active = new Set<Node>();
  const literalReceiverValues = new Set<SourceTypeFlowVariable>();
  const openValues = new Set<Node>();
  const building = new Set<Node>();
  const patterns = new Set<Node>();
  const pairs = new Set<Node>();
  const fixedAliases = new Map<SourceTypeFlowVariable, SourceTypeFlowVariable>();
  const projections = new Map<SourceTypeFlowVariable, Map<SourceTypeFlowPathPart, SourceTypeFlowVariable>>();
  const memberParts = new Map<string, SourceTypeFlowPathPart>();
  const binderParts = new Map<Node, SourceTypeFlowPathPart>();
  const elementPart: SourceTypeFlowPathPart = Object.freeze({ kind: "element" });
  const optionalValuePart: SourceTypeFlowPathPart = Object.freeze({ kind: "optional-value" });
  const tupleParts = new Map<number, SourceTypeFlowPathPart>();
  const terms = new Map<SourceTypeFlowVariable, SourceTypeFlowTerm>();
  const positions = new Map<SourceTypeFlowVariable, SourceTypeFlowNode>();
  const declaredSlots = createSourceTypeFlowDeclaredSlotReader(context);

  for (const sourceFile of context.source.sourceFiles) {
    if (ast.isDeclarationFile(sourceFile)) continue;
    roots.push(sourceFile);
    const pending: { readonly node: Node; readonly root: Node; readonly typeOnly: boolean }[] = [
      { node: sourceFile, root: sourceFile, typeOnly: false },
    ];
    while (pending.length !== 0) {
      const entry = pending.pop()!;
      const inType = entry.typeOnly || sourceTypeFlowTypeSyntax(ast, entry.node);
      if (inType) typeOnly.add(entry.node);
      let root = entry.root;
      if (isCallable(ast, entry.node) && ast.body(entry.node) !== undefined && !isInlineArgument(ast, entry.node)) {
        root = entry.node;
        roots.push(root);
      }
      rootOf.set(entry.node, root);
      syntax.push(entry.node);
      const children = ast.children(entry.node);
      for (let index = children.length - 1; index >= 0; index--) {
        const child = children[index];
        if (child !== undefined) pending.push({ node: child, root, typeOnly: inType });
      }
    }
  }

  for (const node of syntax) {
    if (!ast.is.IsParameterDeclaration(node) || typeOnly.has(node)) continue;
    const owner = ast.parent(node);
    if (owner === undefined || !isCallable(ast, owner) || ast.body(owner) === undefined) continue;
    const query = semantics.forNode(node);
    const projected = declaredSlots.parameter(node, query);
    if (ast.typeNode(node) === undefined && (projected === undefined || isInlineArgument(ast, owner)) && Node_Initializer(ast, node) === undefined &&
      owner !== undefined && (ast.is.IsArrowFunction(owner) || ast.is.IsFunctionExpression(owner)) &&
      query.types.contextualType(owner) !== undefined) continue;
    const type = projected ?? context.describe(node);
    if (type === undefined) continue;
    const component = declaredComponent(node, query);
    fixed(node, component, type);
    const name = ast.name(node);
    if (name !== undefined && (ast.is.IsObjectBindingPattern(name) || ast.is.IsArrayBindingPattern(name))) {
      patterns.add(node);
      declaredPattern(name, component, query, type);
    }
  }
  for (const node of syntax) {
    if (typeOnly.has(node)) continue;
    if (ast.is.IsVariableDeclaration(node) || ast.is.IsBindingElement(node) || ast.is.IsPropertyDeclaration(node)) declaration(node);
    if (ast.is.IsForOfStatement(node)) iteration(node);
    if (sourceTypeFlowValueSyntax(ast, node)) value(node);
  }
  for (const entry of [...nodes.values()]) {
    if (entry.declaration !== entry.node) continue;
    for (const use of navigation.declarationUses(entry.node)) {
      if (use.kind !== "type-only" && use.kind !== "source-linkage") value(use.reference);
    }
  }
  const constructionFamilies = new Map<Node, { readonly source: SourceTypeFlowVariable; readonly target: SourceTypeFlowVariable }[]>();
  for (const [target, source] of fixedAliases) {
    const origin = fixedAggregateOrigin(source);
    if (origin === undefined || declaredSlots.get(origin.node)?.authority === "declared") continue;
    let family = constructionFamilies.get(origin.node);
    if (family === undefined) constructionFamilies.set(origin.node, family = []);
    family.push({ source, target });
  }
  const declaredFills = sourceTypeFlowReachableVariables([...nodes.values()].filter(record => {
    const slot = declaredSlots.get(record.node);
    return slot?.authority === "declared" && slot.type !== undefined;
  }).map(record => record.variable), sourceTypeFlowLinkAdjacency(links));
  for (const family of constructionFamilies.values()) {
    if (!family.some(pair => declaredFills.has(pair.target))) continue;
    for (const pair of family) link(pair.source, pair.target, pair.target.node);
  }
  return Object.freeze({
    roots: Object.freeze(roots), nodes: Object.freeze([...nodes.values(), ...positions.values()]),
    links: Object.freeze(links), derived: Object.freeze([...derived.values()]),
    calls: Object.freeze([...calls.values()]), refusals: Object.freeze(refusals),
  });

  function refuse(code: SourceTypeFlowRefusal["code"], site: Node, related?: Node): void {
    const refusal = createSourceTypeFlowRefusal(code, site, related);
    refusals.push(refusal);
    refusedOperations.set(site, refusal);
  }

  function fixedAggregateOrigin(variable: SourceTypeFlowVariable): SourceTypeFlowVariable | undefined {
    const seen = new Set<SourceTypeFlowVariable>();
    let current: SourceTypeFlowVariable | undefined = variable;
    while (current !== undefined && !seen.has(current)) {
      seen.add(current);
      if (ast.is.IsArrayLiteralExpression(current.node) || ast.is.IsObjectLiteralExpression(current.node)) {
        return nodes.get(current.node)?.term?.kind === "fixed" ? current : undefined;
      }
      const term = terms.get(current);
      if (term?.kind === "fixed" && (ast.is.IsArrayLiteralExpression(term.site) || ast.is.IsObjectLiteralExpression(term.site))) {
        const origin = nodes.get(term.site);
        if (origin?.term?.kind === "fixed") return origin.variable;
      }
      // `[...] as const` / `<const>[...]`: the asserted aggregate literal is the fixed origin.
      if ((ast.is.IsAsExpression(current.node) || ast.is.IsTypeAssertion(current.node)) && ast.isConstAssertion(current.node)) {
        const inner = Node_Expression(ast, current.node);
        const asserted = inner === undefined ? undefined : nodes.get(inner)?.variable;
        if (asserted !== undefined) { current = asserted; continue; }
      }
      current = fixedAliases.get(current);
    }
    return undefined;
  }

  function record(node: Node, kind: SourceTypeFlowNode["kind"], term?: SourceTypeFlowTerm,
    declarationNode?: Node, association?: SourceTypeFlowAssociation): SourceTypeFlowVariable | undefined {
    const previous = nodes.get(node);
    if (previous !== undefined) return previous.variable;
    const root = rootOf.get(node);
    if (root === undefined) return undefined;
    const construction = (kind === "value" || kind === "fixed" || kind === "read") && (ast.is.IsArrayLiteralExpression(node) || ast.is.IsObjectLiteralExpression(node) ||
      context.literal(node) !== undefined)
      ? declaredLiteralSlot(node) : undefined;
    if (construction?.refusal !== undefined) refusals.push(construction.refusal);
    const sourceFile = ast.getSourceFile(node);
    const selectedAssociation = construction === undefined || sourceFile === undefined ? association
      : Object.freeze({ occurrence: node, sourceFile,
        ...(construction.component === undefined ? {} : { component: construction.component }) });
    const variable = Object.freeze({ node, path: Object.freeze([]) });
    nodes.set(node, Object.freeze({ node, root, variable, kind: construction === undefined ? kind : "fixed",
      publish: true,
      ...(term === undefined ? {} : { term }),
      ...(declarationNode === undefined ? {} : { declaration: declarationNode }),
      ...(construction?.type === undefined ? {} : { declaredType: construction.type }),
      ...(construction?.refusal === undefined ? {} : { declaredSlotRefusal: construction.refusal }),
      ...(selectedAssociation === undefined ? {} : { association: selectedAssociation }) }));
    if (term !== undefined) terms.set(variable, term);
    return variable;
  }

  function replace(node: Node, changes: Partial<Pick<SourceTypeFlowNode, "kind" | "term" | "initializer" | "association" | "publish">>): void {
    const previous = nodes.get(node);
    if (previous !== undefined) {
      nodes.set(node, Object.freeze({ ...previous, ...changes }));
      if (changes.term !== undefined) terms.set(previous.variable, changes.term);
    }
  }

  function project(variable: SourceTypeFlowVariable, part: SourceTypeFlowPathPart): SourceTypeFlowVariable {
    let canonical = part.kind === "element" ? elementPart : part.kind === "optional-value" ? optionalValuePart
      : part.kind === "tuple" ? tupleParts.get(part.index)
      : part.kind === "member" ? memberParts.get(part.name) : binderParts.get(part.declaration);
    if (canonical === undefined) {
      canonical = Object.freeze(part);
      if (part.kind === "member") memberParts.set(part.name, canonical);
      if (part.kind === "binder") binderParts.set(part.declaration, canonical);
      if (part.kind === "tuple") tupleParts.set(part.index, canonical);
    }
    let positions = projections.get(variable);
    if (positions === undefined) { positions = new Map(); projections.set(variable, positions); }
    let result = positions.get(canonical);
    if (result === undefined) {
      result = Object.freeze({ node: variable.node, path: Object.freeze([...variable.path, canonical]) });
      positions.set(canonical, result);
      if (literalReceiverValues.has(variable)) literalReceiverValues.add(result);
      const parentTerm = terms.get(variable);
      const parentType = parentTerm?.kind === "fixed" ? parentTerm.type : undefined;
      const childType = parentType === undefined ? undefined : sourceTypeFlowDescriptorPart(context, variable.node, parentType, canonical);
      if (childType !== undefined) putTerm(result, Object.freeze({ kind: "fixed", site: variable.node, type: childType }));
    }
    return result;
  }

  function putTerm(variable: SourceTypeFlowVariable, term: SourceTypeFlowTerm): void {
    if (terms.has(variable)) return;
    terms.set(variable, term);
    const top = nodes.get(variable.node);
    if (top === undefined) return;
    if (top.variable === variable) replace(variable.node, { term });
    else positions.set(variable, Object.freeze({ node: variable.node, root: top.root, variable,
      kind: "value", publish: false, term }));
  }

  function shareStructure(source: SourceTypeFlowVariable, target: SourceTypeFlowVariable, depth = 0): void {
    const term = terms.get(source);
    if (depth > 4 || term === undefined || terms.has(target) || term.kind === "numeric") return;
    if (term.kind === "fixed") putTerm(target, term);
    else if (term.kind === "array") putTerm(target, Object.freeze({ ...term, element: project(target, { kind: "element" }) }));
    else if (term.kind === "tuple") putTerm(target, Object.freeze({ ...term,
      elements: Object.freeze(term.elements.map((element, index) => Object.freeze({ ...element,
        variable: project(target, { kind: "tuple", index }) }))) }));
    else if (term.kind === "shape") putTerm(target, Object.freeze({ ...term, members: Object.freeze(term.members.map(member =>
      Object.freeze({ ...member, variable: project(target, { kind: "member", name: member.name }) }))) }));
    else if (term.kind === "declared") putTerm(target, Object.freeze({ ...term,
      typeArguments: Object.freeze(term.typeArguments.map((argument, index) => {
        const part = argument.path[argument.path.length - 1];
        return part?.kind === "binder" ? project(target, part) : term.typeArguments[index]!;
      })) }));
    else if (term.kind === "optional") putTerm(target, Object.freeze({ ...term, value: project(target, optionalValuePart) }));
    const copied = terms.get(target);
    if (term.kind === "array" && copied?.kind === "array") shareStructure(term.element, copied.element, depth + 1);
    if (term.kind === "optional" && copied?.kind === "optional") shareStructure(term.value, copied.value, depth + 1);
    if (term.kind === "tuple" && copied?.kind === "tuple") {
      term.elements.forEach((element, index) => {
        const selected = copied.elements[index];
        if (selected !== undefined) shareStructure(element.variable, selected.variable, depth + 1);
      });
    }
    if (term.kind === "shape" && copied?.kind === "shape") for (const [index, member] of term.members.entries()) {
      const selected = copied.members[index];
      if (selected !== undefined) shareStructure(member.variable, selected.variable, depth + 1);
    }
  }

  function link(source: SourceTypeFlowVariable | undefined, target: SourceTypeFlowVariable | undefined, site: Node): void {
    if (source === undefined || target === undefined || source === target) return;
    if (rootOf.get(source.node) !== rootOf.get(target.node)) {
      refuse("TSONIC_LOCAL_TYPE_SELF_REFERENCE", site, source.node);
      return;
    }
    links.push(Object.freeze({ source, target, site }));
    if (literalReceiverValues.has(source) || literalReceiverValues.has(target)) {
      literalReceiverValues.add(source);
      literalReceiverValues.add(target);
    }
    shareStructure(source, target);
    shareStructure(target, source);
    if (active.has(source.node) || active.has(target.node)) { active.add(source.node); active.add(target.node); }
    if (openValues.has(source.node) || openValues.has(target.node)) {
      if (!declaredConstruction(source.node)) openValues.add(source.node);
      if (!declaredConstruction(target.node)) openValues.add(target.node);
    }
    const dependency = derived.get(source.node) ?? derived.get(target.node);
    if (dependency !== undefined) derived.set(dependency.node, Object.freeze({ ...dependency, required: true }));
  }

  function fixed(node: Node, component?: SourceTypeComponentEvidence,
    described?: SourceTypeDescriptor): SourceTypeFlowVariable | undefined {
    const literal = ast.is.IsArrayLiteralExpression(node) || ast.is.IsObjectLiteralExpression(node);
    const slot = literal ? declaredSlots.get(node) : undefined;
    const type = slot?.type ?? described ?? context.describe(node, slot?.component ?? component);
    if (literal && type !== undefined) declaredSlots.retainFixedConstruction(node, type, component);
    const sourceFile = ast.getSourceFile(node);
    const declarationNode = ast.is.IsVariableDeclaration(node) || ast.is.IsParameterDeclaration(node) ||
      ast.is.IsBindingElement(node) || ast.is.IsPropertyDeclaration(node) ? node : component?.declaration;
    const variable = type === undefined ? undefined : record(node, "fixed", Object.freeze({ kind: "fixed", site: node, type }),
      declarationNode, sourceFile === undefined ? undefined : Object.freeze({ occurrence: node, sourceFile,
        ...(component === undefined ? {} : { component }) }));
    if (type !== undefined && declaredWidth(type)) active.add(node);
    return variable;
  }

  function declaredWidth(type: SourceTypeDescriptor): boolean {
    return type.kind === "primitive" ? type.primitive !== "float64" && type.primitive !== "bool"
      : type.kind === "union" ? type.types.some(declaredWidth)
      : type.kind === "callable" ? [...type.calls, ...type.constructs].some(signature =>
        declaredWidth(signature.result) || signature.parameters.some(parameter => declaredWidth(parameter.type)))
      : type.kind === "array" ? declaredWidth(type.element)
      : type.kind === "optional" ? declaredWidth(type.value)
      // An aliased union is published as its alias (C-2263); its width is its union arms'.
      : type.kind === "declared" ? type.typeArguments.some(declaredWidth) ||
        ast.is.IsTypeAliasDeclaration(type.declaration) && (type.definition?.kind === "union" || type.definition?.kind === "optional") &&
          declaredWidth(type.definition)
      : type.kind === "tuple" ? type.elements.some(element => declaredWidth(element.type))
      : type.kind === "shape" && type.members.some(member => declaredWidth(member.type));
  }

  function declaration(node: Node): SourceTypeFlowVariable | undefined {
    const previous = nodes.get(node);
    if (previous !== undefined) return previous.variable;
    const root = rootOf.get(node);
    if (root === undefined) return undefined;
    const query = semantics.forNode(node);
    if (building.has(node)) { refuse("TSONIC_LOCAL_TYPE_SELF_REFERENCE", node); return undefined; }
    if (ast.is.IsParameterDeclaration(node)) {
      const owner = ast.parent(node);
      if (owner === undefined || ast.body(owner) === undefined) return undefined;
    }
    if (ast.is.IsBindingElement(node)) {
      let owner = ast.parent(node);
      while (owner !== undefined && (ast.is.IsArrayBindingPattern(owner) || ast.is.IsObjectBindingPattern(owner) ||
        ast.is.IsBindingElement(owner))) owner = ast.parent(owner);
      if (owner !== undefined && !patterns.has(owner)) declaration(owner);
      return nodes.get(node)?.variable;
    }
    const name = ast.name(node);
    const initializer = Node_Initializer(ast, node);
    const ownType = ast.typeNode(node);
    const parent = ast.parent(node);
    const isLoop = parent !== undefined && ast.is.IsVariableDeclarationList(parent) &&
      ast.parent(parent) !== undefined && ast.is.IsForStatement(ast.parent(parent));
    const open = isCallable(ast, root) && ownType === undefined && !isLoop &&
      (ast.variableDeclarationKind(node) === "const" || ast.variableDeclarationKind(node) === "let") &&
      !ast.hasModifierKind(node, "export");
    if (name !== undefined && (ast.is.IsArrayBindingPattern(name) || ast.is.IsObjectBindingPattern(name))) {
      if (patterns.has(node)) return undefined;
      patterns.add(node);
      const source = initializer === undefined ? undefined : value(initializer, true);
      if (open && source !== undefined && openValues.has(source.node)) pattern(name, source, node);
      else {
        const selectedType = initializer === undefined ? undefined : query.types.expressionType(initializer);
        const component = ownType === undefined && selectedType !== undefined
          ? Object.freeze({ selectedType }) : declaredComponent(node, query);
        const described = ownType === undefined && initializer !== undefined ? context.describe(initializer)
          : component === undefined ? undefined : context.describe(node, component);
        declaredPattern(name, component, query, described, ownType === undefined ? initializer : undefined);
      }
      return nodes.get(node)?.variable;
    }
    if (!open || initializer === undefined || ast.isConstAssertion(initializer) || ast.is.IsBigIntLiteral(initializer)) {
      return fixed(node, declaredComponent(node, query));
    }
    building.add(node);
    const source = value(initializer, true);
    building.delete(node);
    if (source === undefined && refusedOperations.has(initializer)) {
      const result = record(node, "derived-local", undefined, node);
      replace(node, { initializer });
      return result;
    }
    if (source === undefined) return fixed(node, declaredComponent(node, query));
    const sourceNode = nodes.get(source.node);
    if (!active.has(source.node) && !derived.has(source.node)) {
      if (sourceNode?.term?.kind !== "fixed") return fixed(node, declaredComponent(node, query));
      const result = record(node, "fixed", sourceNode.term, node, sourceNode.association);
      replace(node, { publish: sourceNode.publish });
      if (result !== undefined) fixedAliases.set(result, source);
      return result;
    }
    const kind = derived.has(source.node) ? "derived-local" : openValues.has(source.node) ? "open-local" : "read";
    const result = record(node, kind, undefined, node);
    replace(node, { initializer });
    active.add(node);
    link(source, result, initializer);
    if (name !== undefined && result !== undefined) {
      const named = record(name, "read", undefined, node);
      link(result, named, name);
    }
    return result;
  }

  function declaredComponent(node: Node, query: SourceFileSemantics): SourceTypeComponentEvidence | undefined {
    const authoredTypeNode = ast.typeNode(node);
    const selectedType = authoredTypeNode === undefined ? query.declarations.declaredValueType(node)
      : query.types.authoredType(authoredTypeNode);
    if (selectedType === undefined) return undefined;
    return Object.freeze({ selectedType, declaration: node,
      ...(authoredTypeNode === undefined ? {} : { authoredTypeNode }) });
  }

  function declaredConstruction(node: Node): boolean {
    return nodes.get(node)?.kind === "fixed" && (ast.is.IsArrayLiteralExpression(node) || ast.is.IsObjectLiteralExpression(node));
  }

  function declaredLiteralSlot(node: Node) {
    return declaredSlots.get(node);
  }

  function declaredPattern(node: Node, component: SourceTypeComponentEvidence | undefined, query: SourceFileSemantics,
    described: SourceTypeDescriptor | undefined, initializer?: Node): void {
    for (const binding of sourceTypeFlowDeclaredPatternBindings(context, node, component, query, described, initializer)) {
      if (binding.kind === "refused") refuse("TSONIC_LOCAL_TYPE_UNSUPPORTED", binding.node);
      else fixed(binding.node, binding.component, binding.type);
    }
  }

  function referenceComponent(node: Node, declarationNode: Node): SourceTypeComponentEvidence | undefined {
    const query = semantics.forNode(node);
    const kept = nodes.get(declarationNode)?.association?.component ?? declaredComponent(declarationNode, query);
    const selectedType = query.types.expressionType(node);
    return kept === undefined || selectedType === undefined ? kept : Object.freeze({ ...kept, selectedType });
  }

  function value(node: Node, initializer = false, depth = 0): SourceTypeFlowVariable | undefined {
    const previous = nodes.get(node);
    if (previous !== undefined) return previous.variable;
    if (!rootOf.has(node) || typeOnly.has(node)) return undefined;
    if (refusedOperations.has(node)) return undefined;
    if (sourceTypeFlowDiscardedValue(context.source, node)) {
      const conditional = ast.is.IsConditionalExpression(node) ? ast.as.AsConditionalExpression(node) : undefined;
      const binary = ast.is.IsBinaryExpression(node) ? ast.as.AsBinaryExpression(node) : undefined;
      const wrapped = sourceTransparentExpressionOperand(ast, node);
      for (const operand of wrapped !== undefined ? [wrapped] : conditional === undefined ? [binary?.Left, binary?.Right]
        : [conditional.Condition, conditional.WhenTrue, conditional.WhenFalse]) {
        if (operand !== undefined) value(operand, false, depth);
      }
      return undefined;
    }
    if (sourceTypeFlowObjectLiteralReceiver(ast, node) !== undefined) {
      const result = record(node, "read");
      if (result !== undefined) literalReceiverValues.add(result);
      active.add(node);
      return result;
    }
    // B6: an open (unannotated) literal deeper than four levels is refused. A declared slot's structure has full
    // depth (C34); only the shared C-2269 expansion budget bounds it.
    if (depth > 4 && declaredSlots.get(node)?.authority !== "declared") { refuse("TSONIC_LOCAL_TYPE_LIMIT", node); return undefined; }
    if (building.has(node)) { refuse("TSONIC_LOCAL_TYPE_SELF_REFERENCE", node); return undefined; }
    if (ast.is.IsIdentifier(node)) {
      const selected = navigation.sourceReferenceFor(node)?.declaration;
      if (selected === undefined) return fixed(node);
      if (selected === node || ast.name(selected) === node) return undefined;
      if (isCallable(ast, selected)) return fixed(node);
      const source = declaration(selected);
      if (rootOf.get(selected) !== rootOf.get(node)) {
        if (openValues.has(selected) || derived.has(selected)) {
          const root = rootOf.get(node);
          if (root !== undefined && (ast.is.IsArrowFunction(root) || ast.is.IsFunctionExpression(root)) &&
            navigation.expressionResultDisposition(root).kind !== "discarded") {
            refuse("TSONIC_LOCAL_TYPE_SELF_REFERENCE", node, selected);
          }
          if (source !== undefined && root !== undefined && (ast.is.IsFunctionDeclaration(root) ||
            (ast.is.IsArrowFunction(root) || ast.is.IsFunctionExpression(root)) &&
              navigation.expressionResultDisposition(root).kind === "discarded")) {
            const result = record(node, "read", undefined, selected);
            if (result !== undefined) {
              const term = terms.get(source);
              if (literalReceiverValues.has(source) || term?.kind === "shape" || term?.kind === "array" || term?.kind === "tuple") {
                literalReceiverValues.add(result);
              }
              active.add(node);
            }
            return result;
          }
          return undefined;
        }
        return fixed(node, referenceComponent(node, selected));
      }
      const selectedNode = nodes.get(selected);
      if (source === undefined) return fixed(node, referenceComponent(node, selected));
      if (selectedNode?.term?.kind === "fixed") {
        const nominal = sourceTypeFlowNominalReadComponent(context.source, node);
        const component = nominal ?? referenceComponent(node, selected);
        const type = selectedNode.term.type;
        const structure = sourceTypeDescriptorStructure(type);
        const narrowed = nominal !== undefined ? context.describe(node, nominal) : structure.kind === "optional" && component !== undefined &&
          !semantics.forNode(node).types.isUnion(component.selectedType) &&
          !semantics.forNode(node).types.isNullish(component.selectedType) ? structure.value : type;
        if (narrowed !== type || !(ast.is.IsArrayLiteralExpression(selectedNode.term.site) ||
          ast.is.IsObjectLiteralExpression(selectedNode.term.site))) {
          const result = fixed(node, component, narrowed);
          if (narrowed === type && result !== undefined) fixedAliases.set(result, source);
          return result;
        }
        const sourceFile = ast.getSourceFile(node);
        const result = record(node, "fixed", undefined, selected, sourceFile === undefined ? undefined : Object.freeze({
          occurrence: node, sourceFile, ...(component === undefined ? {} : { component }),
        }));
        link(source, result, node);
        if (result !== undefined) fixedAliases.set(result, source);
        return result;
      }
      const result = record(node, selectedNode?.kind === "fixed" ? "fixed" : "read", undefined, selected);
      link(source === undefined ? undefined : narrowedRead(source, node), result, node);
      return result;
    }
    if (ast.isConstAssertion(node) || ast.is.IsBigIntLiteral(node)) return fixed(node);
    if (ast.is.IsAsExpression(node) || ast.is.IsSatisfiesExpression(node) || ast.is.IsTypeAssertion(node)) {
      return fixed(node, declaredComponent(node, semantics.forNode(node)));
    }
    if (ast.is.IsSpreadElement(node)) {
      const operand = Node_Expression(ast, node);
      return operand === undefined ? undefined : value(operand, initializer, depth);
    }
    let numericTerm: Extract<SourceTypeFlowTerm, { kind: "numeric" }> | undefined;
    const literal = context.literal(node);
    if (!ast.is.IsParenthesizedExpression(node) && literal !== undefined && (literal.form === "numeric" || literal.numeric !== undefined ||
      literal.integerConstant !== undefined) && numericLeaves(ast, node)) {
      const token = sourceLiteralToken(ast, node);
      const text = token.kind === "authored" ? token.text : ast.text(node);
      const fractional = literal.integerConstant === undefined && !/^[-+]?0[xob]/iu.test(text) && /[.eE]/u.test(text);
      numericTerm = Object.freeze({ kind: "numeric", site: node, form: fractional ? "fractional" : "integer", literal });
      if (!ast.is.IsPrefixUnaryExpression(node) && !ast.is.IsBinaryExpression(node)) {
        const variable = record(node, "value", numericTerm);
        active.add(node);
        openValues.add(node);
        return variable;
      }
    }
    if (ast.is.IsArrayLiteralExpression(node) || ast.is.IsObjectLiteralExpression(node)) {
      if (sourceTypeFlowAssignmentPattern(ast, node)) return undefined;
      return ast.is.IsArrayLiteralExpression(node) ? array(node, depth) : object(node, depth);
    }
    if (ast.is.IsCallExpression(node) || ast.is.IsNewExpression(node)) return collectInvocation(node, depth);
    const closure = inlineCallable(ast, node);
    if (closure !== undefined) {
      const result = record(closure, "value");
      for (const returned of inlineReturns(ast, closure)) {
        if (context.literal(returned) !== undefined || navigation.sourceReferenceFor(returned) !== undefined) active.add(closure);
      }
      return result;
    }
    if (ast.is.IsPropertyAccessExpression(node) || ast.is.IsElementAccessExpression(node)) return read(node, depth);
    if (ast.is.IsAwaitExpression(node)) {
      const operand = Node_Expression(ast, node);
      return operand === undefined ? undefined : operationNode(node, "await", [operand], initializer, depth);
    }
    if (ast.is.IsParenthesizedExpression(node) || ast.is.IsNonNullExpression(node) ||
      ast.is.IsAsExpression(node) || ast.is.IsSatisfiesExpression(node) || ast.is.IsTypeAssertion(node)) {
      const operand = Node_Expression(ast, node);
      const source = operand === undefined ? undefined : value(operand, initializer, depth);
      if (operand !== undefined && source === undefined && refusedOperations.has(operand)) {
        refusedOperations.set(node, refusedOperations.get(operand)!);
        return undefined;
      }
      if (source === undefined || !active.has(source.node)) return fixed(node,
        ast.is.IsAsExpression(node) || ast.is.IsTypeAssertion(node)
          ? declaredComponent(node, semantics.forNode(node)) : undefined);
      const result = record(node, "read");
      link(narrowedRead(source, node), result, node);
      return result;
    }
    if (ast.is.IsConditionalExpression(node)) {
      const conditional = ast.as.AsConditionalExpression(node);
      return conditional?.WhenTrue === undefined || conditional.WhenFalse === undefined ? fixed(node)
        : operationNode(node, "conditional", [conditional.WhenTrue, conditional.WhenFalse], initializer, depth);
    }
    if (ast.is.IsBinaryExpression(node)) {
      const binary = ast.as.AsBinaryExpression(node);
      const operator = ast.operatorKindName(node);
      if (binary?.Left !== undefined && binary.Right !== undefined) {
        if (operator === "KindEqualsToken") {
          value(binary.Left, false, depth);
          return operationNode(node, "identity", [binary.Right], initializer, depth);
        }
        if (operator === "KindInKeyword" || operator === "KindInstanceOfKeyword") {
          value(binary.Left, false, depth);
          value(binary.Right, false, depth);
          return record(node, "value", Object.freeze({ kind: "fixed", site: node,
            type: Object.freeze({ kind: "primitive", primitive: "bool" }) }));
        }
      }
      const operation = operator === undefined ? undefined : sourceTypeFlowBinaryOperators.get(operator);
      if (operation !== undefined && binary?.Left !== undefined && binary.Right !== undefined) {
        if (operation === "sequence") {
          value(binary.Left, false, depth);
          return operationNode(node, operation, [binary.Right], initializer, depth);
        }
        return operationNode(node, operation, [binary.Left, binary.Right], initializer, depth, numericTerm);
      }
      return undefined;
    }
    if (ast.is.IsPrefixUnaryExpression(node) || ast.is.IsPostfixUnaryExpression(node)) {
      const operator = ast.operatorKindName(node);
      const operand = ast.is.IsPrefixUnaryExpression(node) ? ast.as.AsPrefixUnaryExpression(node)?.Operand : ast.as.AsPostfixUnaryExpression(node)?.Operand;
      const operation = operator === undefined ? undefined : sourceTypeFlowUnaryOperators.get(operator);
      if (operation !== undefined && operand !== undefined) return operationNode(node, operation, [operand], initializer, depth, numericTerm);
    }
    return fixed(node);
  }

  function array(node: Node, depth: number): SourceTypeFlowVariable | undefined {
    const elements = ast.elements(node);
    if (elements.some(element => element === undefined || ast.is.IsOmittedExpression(element))) return fixed(node);
    if (!pairs.has(node) && mixedArrayKinds(node)) return fixed(node);
    const result = record(node, "value");
    if (result === undefined) return undefined;
    active.add(node);
    if (!declaredConstruction(node)) openValues.add(node);
    if (pairs.has(node) && elements.length === 2 && elements[0] !== undefined && elements[1] !== undefined) {
      const first = project(result, { kind: "tuple", index: 0 });
      const second = project(result, { kind: "tuple", index: 1 });
      replace(node, { term: Object.freeze({ kind: "tuple", site: node, elements: Object.freeze([
        Object.freeze({ kind: "required" as const, variable: first }),
        Object.freeze({ kind: "required" as const, variable: second }),
      ]), readonly: true }) });
      link(value(elements[0], true, depth + 1), first, elements[0]);
      link(value(elements[1], true, depth + 1), second, elements[1]);
      return result;
    }
    const element = project(result, { kind: "element" });
    replace(node, { term: Object.freeze({ kind: "array", site: node, element, readonly: false }) });
    for (const child of elements) {
      if (child === undefined) continue;
      const spread = ast.is.IsSpreadElement(child) ? Node_Expression(ast, child) : undefined;
      const source = value(spread ?? child, true, depth + 1);
      link(source === undefined || spread === undefined ? source : project(source, { kind: "element" }), element, child);
    }
    return result;
  }

  function mixedArrayKinds(node: Node): boolean {
    const elements = ast.elements(node);
    if (elements.length > 0 && elements.every(element => {
      if (element === undefined) return false;
      const spread = ast.is.IsSpreadElement(element);
      const operand = spread ? Node_Expression(ast, element) : element;
      if (!spread && operand !== undefined && context.literal(operand) !== undefined && numericLeaves(ast, operand)) return true;
      const descriptor = operand === undefined ? undefined : context.describe(operand);
      const contributions = !spread ? descriptor === undefined ? [] : [descriptor]
        : descriptor?.kind === "array" ? [descriptor.element]
          : descriptor?.kind === "tuple" ? descriptor.elements.map(element => element.type) : [];
      return contributions.length > 0 && contributions.every(type => type.kind === "primitive" &&
        type.primitive !== "bool" && type.primitive !== "char");
    })) return false;
    const query = semantics.forNode(node);
    const type = query.types.expressionType(node);
    const element = type === undefined ? undefined : sourceArrayElementType(type, query);
    const pending = type !== undefined && query.types.isTuple(type) ? [...query.types.tupleElementTypes(type)]
      : element === undefined ? [] : [element];
    if (pending.length === 0) return false;
    const kinds = new Set<string | Type>();
    while (pending.length !== 0) {
      const selected = pending.pop()!;
      if (query.types.isUnion(selected)) {
        pending.push(...query.types.unionOrIntersectionTypes(selected));
      } else if (query.types.isNumberLike(selected)) kinds.add("number");
      else if (query.types.isBigIntLike(selected)) kinds.add("bigint");
      else if (query.types.isStringLike(selected)) kinds.add("string");
      else if (query.types.isBooleanLike(selected)) kinds.add("bool");
      else if (query.types.isNullish(selected)) kinds.add("absence");
      else if (query.types.isArrayLike(selected)) kinds.add("array");
      else kinds.add(selected);
      if (kinds.size > 1) return true;
    }
    return false;
  }

  function object(node: Node, depth: number): SourceTypeFlowVariable | undefined {
    const properties = ast.properties(node);
    if (properties.some(property => property === undefined || !(ast.is.IsPropertyAssignment(property) ||
      ast.is.IsShorthandPropertyAssignment(property) || ast.is.IsSpreadAssignment(property) ||
      ast.is.IsMethodDeclaration(property) || ast.is.IsGetAccessorDeclaration(property) ||
      ast.is.IsSetAccessorDeclaration(property)))) return fixed(node);
    const query = semantics.forNode(node);
    const result = record(node, "value");
    if (result === undefined) return undefined;
    active.add(node);
    if (!declaredConstruction(node)) openValues.add(node);
    const members = new Map<string, { readonly source?: SourceTypeFlowVariable; readonly type?: SourceTypeDescriptor;
      readonly site: Node; readonly declaration?: Node; readonly optional: boolean; readonly readonly?: boolean }>();
    for (const property of properties) {
      if (property === undefined) continue;
      const spread = SpreadAssignment_Expression(ast, property);
      if (spread !== undefined) {
        const source = value(spread, true, depth + 1);
        if (source === undefined) continue;
        const term = nodes.get(source.node)?.term;
        const descriptor = context.describe(spread);
        const described = descriptor === undefined ? undefined : sourceTypeDescriptorStructure(descriptor);
        const selected = term?.kind === "shape" ? term.members : described?.kind === "shape" ? described.members : undefined;
        if (selected === undefined) { refuse("TSONIC_LOCAL_TYPE_UNSUPPORTED", property); continue; }
        for (const member of selected) {
          const declaration = "origin" in member ? member.origin.kind === "declared" ? member.origin.declaration : undefined : member.declaration;
          members.set(member.name, { source: project(source, { kind: "member", name: member.name }), site: property,
            optional: member.optional, ...(declaration === undefined ? {} : { declaration }),
            ...(member.readonly === undefined ? {} : { readonly: member.readonly }) });
        }
        continue;
      }
      const element = query.operations.objectLiteralElement(property);
      const selected = element?.objectLiteral === node && element.element === property && element.sourceElementSymbol !== undefined
        ? query.types.propertyInfos(element.objectLiteralType).find(member => member.symbol === element.sourceElementSymbol) : undefined;
      if (element === undefined || selected === undefined) { refuse("TSONIC_LOCAL_TYPE_UNSUPPORTED", property); continue; }
      if (ast.is.IsMethodDeclaration(property) || ast.is.IsGetAccessorDeclaration(property) || ast.is.IsSetAccessorDeclaration(property)) {
        const declarations = selectedSourcePropertyDeclarations(query, undefined, selected.symbol, [element.objectLiteralType]);
        const declaration = declarations === undefined ? undefined : selectSourcePropertyDeclaration(ast, declarations, "read")
          ?? selectSourcePropertyDeclaration(ast, declarations, "write");
        let type: SourceTypeDescriptor | undefined;
        if (declaration !== undefined && ast.is.IsMethodDeclaration(declaration)) type = context.describe(declaration);
        else if (declaration !== undefined && ast.is.IsGetAccessorDeclaration(declaration)) {
          const signature = query.types.declarationSignatureInfo(declaration);
          const authoredTypeNode = ast.typeNode(declaration);
          type = declaredSlots.returned(declaration, query) ?? (signature?.returnType === undefined ? undefined
            : context.describe(declaration, { selectedType: signature.returnType, declaration,
              ...(authoredTypeNode === undefined ? {} : { authoredTypeNode }) }));
        } else if (declaration !== undefined && ast.is.IsSetAccessorDeclaration(declaration)) {
          const parameter = ast.parameters(declaration)[0];
          type = parameter === undefined ? undefined : declaredSlots.parameter(parameter, query) ?? context.describe(parameter);
        }
        if (declaration === undefined || type === undefined) { refuse("TSONIC_LOCAL_TYPE_UNSUPPORTED", property); continue; }
        members.set(selected.name, { type, site: property, declaration, optional: selected.optional,
          ...(selected.readonly ? { readonly: true } : {}) });
        continue;
      }
      const initializer = ObjectLiteralProperty_Value(ast, property);
      const source = initializer === undefined ? undefined : value(initializer, true, depth + 1);
      if (source === undefined) { refuse("TSONIC_LOCAL_TYPE_UNSUPPORTED", property); continue; }
      members.set(selected.name, { source, site: property, declaration: property, optional: selected.optional,
        ...(selected.readonly ? { readonly: true } : {}) });
    }
    const shape = [];
    for (const [name, member] of members) {
      const variable = project(result, { kind: "member", name });
      if (member.type === undefined) link(member.source, variable, member.site);
      else putTerm(variable, Object.freeze({ kind: "fixed", site: member.site, type: member.type }));
      shape.push(Object.freeze({ name, variable, optional: member.optional,
        ...(member.declaration === undefined ? {} : { declaration: member.declaration }),
        ...(member.readonly === undefined ? {} : { readonly: member.readonly }) }));
    }
    replace(node, { term: Object.freeze({ kind: "shape", site: node, members: Object.freeze(shape) }) });
    return result;
  }

  function read(node: Node, depth: number): SourceTypeFlowVariable | undefined {
    const receiver = Node_Expression(ast, node);
    const source = receiver === undefined ? undefined : value(receiver, false, depth);
    if (!isWriteTarget(ast, node)) {
      const query = semantics.forNode(node);
      const property = ast.is.IsPropertyAccessExpression(node) ? query.operations.propertyAccess(node) : undefined;
      const element = ast.is.IsElementAccessExpression(node) ? query.operations.elementAccess(node) : undefined;
      const declaration = property?.selectedReadDeclaration ?? property?.selectedDeclaration ?? element?.selectedDeclaration;
      if ((property ?? element)?.optionalChain !== true && declaration !== undefined && ast.questionToken(declaration) === undefined &&
        (ast.is.IsPropertyDeclaration(declaration) || ast.is.IsPropertySignatureDeclaration(declaration) ||
        ast.is.IsGetAccessorDeclaration(declaration))) {
        const component = declaredComponent(declaration, query);
        if (component?.authoredTypeNode !== undefined && !query.types.couldContainTypeVariables(component.selectedType)) {
          const readComponent = referenceComponent(node, declaration);
          if (readComponent !== undefined) return fixed(node, readComponent);
        }
      }
    }
    if (source === undefined || !active.has(source.node)) return fixed(node);
    const sourceTerm = terms.get(source);
    const structure = sourceTerm?.kind === "fixed" ? sourceTypeDescriptorStructure(sourceTerm.type) : undefined;
    if (structure?.kind === "shape" && structure.indexes.length > 0) {
      const query = semantics.forNode(node);
      const property = ast.is.IsPropertyAccessExpression(node) ? query.operations.propertyAccess(node) : undefined;
      const access = ast.is.IsElementAccessExpression(node) ? query.operations.elementAccess(node) : undefined;
      const key = ast.is.IsPropertyAccessExpression(node) ? "string" : access === undefined ? undefined
        : query.types.isNumberLike(access.argument.type) ? "number" : query.types.isStringLike(access.argument.type) ? "string"
          : query.types.isSymbolLike(access.argument.type) ? "symbol" : undefined;
      const selected = key === undefined || (property ?? access)?.selectedSymbol !== undefined ? undefined
        : sourceTypeDescriptorIndexValue(structure, key);
      if (selected !== undefined) return fixed(node, undefined, selected);
    }
    let part: SourceTypeFlowPathPart | undefined;
    const selection = !literalReceiverValues.has(source) || receiver === undefined ? undefined : ast.is.IsPropertyAccessExpression(node)
      ? semantics.forNode(node).operations.propertyAccess(node) : semantics.forNode(node).operations.elementAccess(node);
    const receiverType = selection?.receiver.type;
    const selectedMember = receiverType === undefined || semantics.forNode(node).types.isArrayLike(receiverType) ||
      semantics.forNode(node).types.isStringLike(receiverType) || selection?.selectedSymbol === undefined ? undefined
      : semantics.forNode(node).types.propertyInfos(receiverType).find(member => member.symbol === selection.selectedSymbol ||
        member.rootSymbols.includes(selection.selectedSymbol!));
    if (selectedMember !== undefined) part = { kind: "member", name: selectedMember.name };
    else if (ast.is.IsPropertyAccessExpression(node)) {
      const name = ast.name(node);
      const term = nodes.get(source.node)?.term;
      const descriptor = receiver === undefined ? undefined : context.describe(receiver);
      if (name !== undefined && (term?.kind === "shape" || descriptor !== undefined &&
        sourceTypeDescriptorStructure(descriptor).kind === "shape")) {
        part = { kind: "member", name: ast.text(name) };
      }
    } else {
      const access = ast.as.AsElementAccessExpression(node);
      const index = access?.ArgumentExpression;
      const name = index === undefined ? undefined : context.literal(index);
      const term = nodes.get(source.node)?.term;
      const tuple = term?.kind === "tuple" ? term : structure?.kind === "tuple" ? structure : undefined;
      if (term?.kind === "shape" && name?.text !== undefined) part = { kind: "member", name: name.text };
      else if (tuple !== undefined && name?.integer !== undefined && name.integer >= 0n && name.integer < BigInt(tuple.elements.length)) {
        part = { kind: "tuple", index: Number(name.integer) };
      } else part = { kind: "element" };
    }
    if (part === undefined) return fixed(node);
    const projected = project(source, part);
    const selected = isWriteTarget(ast, node) ? projected : narrowedRead(projected, node);
    const selectedTerm = terms.get(selected);
    const result = record(node, selectedTerm?.kind === "fixed" ? "fixed" : "read", selectedTerm?.kind === "fixed" ? selectedTerm : undefined);
    if (isWriteTarget(ast, node)) {
      const previous = nodes.get(node);
      if (previous !== undefined) nodes.set(node, Object.freeze({ ...previous, variable: selected }));
      return selected;
    }
    link(selected, result, node);
    return result;
  }

  function narrowedRead(source: SourceTypeFlowVariable, occurrence: Node): SourceTypeFlowVariable {
    const term = terms.get(source);
    const query = semantics.forNode(occurrence);
    const types = query.types;
    const declared = term?.kind === "declared" ? query.declarations.declaredType(term.declaration) : undefined;
    if (term?.kind !== "optional" && (declared === undefined || !types.isUnion(declared) ||
      !types.unionOrIntersectionTypes(declared).some(member => types.isNullish(member)))) return source;
    const selected = types.expressionType(occurrence);
    if (selected === undefined || types.isNullish(selected) || types.isUnion(selected) &&
      types.unionOrIntersectionTypes(selected).some(member => types.isNullish(member))) return source;
    return term?.kind === "optional" ? term.value : project(source, optionalValuePart);
  }

  function pattern(node: Node, source: SourceTypeFlowVariable, site: Node): void {
    const retained = terms.get(source);
    if (retained?.kind === "fixed") {
      declaredPattern(node, nodes.get(source.node)?.association?.component, semantics.forNode(node), retained.type);
    }
    const structure = retained?.kind === "fixed" ? sourceTypeDescriptorStructure(retained.type) : undefined;
    const arrayPattern = ast.is.IsArrayBindingPattern(node);
    const elements = ast.elements(node);
    for (const [index, element] of elements.entries()) {
      if (element === undefined || ast.is.IsOmittedExpression(element)) continue;
      const name = ast.name(element);
      if (name === undefined) continue;
      if (BindingElement_IsRest(ast, element) && retained?.kind === "fixed") {
        const result = nodes.get(element)?.variable;
        const type = result === undefined ? undefined : terms.get(result);
        const rest = type?.kind === "fixed" ? sourceTypeDescriptorStructure(type.type) : undefined;
        if (result !== undefined && structure?.kind === "tuple" && rest?.kind === "tuple") rest.elements.forEach((_, offset) =>
          link(project(source, { kind: "tuple", index: index + offset }), project(result, { kind: "tuple", index: offset }), site));
        if (result !== undefined && structure?.kind === "shape" && rest?.kind === "shape") for (const member of rest.members) {
          link(project(source, { kind: "member", name: member.name }), project(result, { kind: "member", name: member.name }), site);
        }
        continue;
      }
      if (!arrayPattern && BindingElement_IsRest(ast, element)) { refuse("TSONIC_LOCAL_TYPE_UNSUPPORTED", element); continue; }
      const property = BindingElement_PropertyName(ast, element) ?? name;
      const term = nodes.get(source.node)?.term;
      let part: SourceTypeFlowPathPart;
      if (arrayPattern) {
        const tuple = term?.kind === "tuple" ? term : structure?.kind === "tuple" ? structure : undefined;
        part = tuple !== undefined && index < tuple.elements.length ? { kind: "tuple", index } : { kind: "element" };
      } else {
        const selection = semantics.forNode(element).propertyNames.get(property);
        if (selection?.kind !== "resolved") { refuse("TSONIC_LOCAL_TYPE_UNSUPPORTED", element); continue; }
        part = { kind: "member", name: selection.name };
      }
      const result = record(element, "open-local", undefined, element);
      if (result === undefined) continue;
      active.add(element);
      if (arrayPattern && BindingElement_IsRest(ast, element)) {
        const variable = project(result, { kind: "element" });
        replace(element, { term: Object.freeze({ kind: "array", site: element, element: variable, readonly: false }) });
        link(project(source, { kind: "element" }), variable, site);
      } else link(project(source, part), result, site);
      if (ast.is.IsArrayBindingPattern(name) || ast.is.IsObjectBindingPattern(name)) pattern(name, result, site);
      else link(result, record(name, "read", undefined, element), name);
    }
  }

  function iteration(node: Node): void {
    const statement = ast.as.AsForInOrOfStatement(node);
    const expression = statement?.Expression;
    const initializer = statement?.Initializer;
    if (expression === undefined || initializer === undefined || !ast.is.IsVariableDeclarationList(initializer)) return;
    const declarations = ast.as.AsVariableDeclarationList(initializer)?.Declarations?.Nodes;
    const selected = declarations?.length === 1 ? declarations[0] : undefined;
    const source = value(expression);
    if (selected === undefined || source === undefined) return;
    const name = ast.name(selected);
    const element = project(source, { kind: "element" });
    const query = semantics.forNode(node);
    const iteration = query.operations.iteration(node);
    const sourceFile = ast.getSourceFile(selected);
    const association = iteration?.subject.node !== node || sourceFile === undefined ? undefined
      : Object.freeze({ occurrence: selected, sourceFile, component: Object.freeze({ selectedType: iteration.sourceElementType }) });
    const result = record(selected, "read", undefined, selected, association);
    if (result === undefined) return;
    active.add(selected);
    link(element, result, node);
    if (name !== undefined && (ast.is.IsArrayBindingPattern(name) || ast.is.IsObjectBindingPattern(name))) pattern(name, result, node);
    else if (name !== undefined) link(result, record(name, "read", undefined, selected), name);
  }

  function operationNode(node: Node, operator: SourceTypeFlowOperator, operands: readonly Node[], required: boolean,
    depth: number, numericTerm?: Extract<SourceTypeFlowTerm, { kind: "numeric" }>): SourceTypeFlowVariable | undefined {
    const selected = operands.map(operand => value(operand, false, depth));
    const inputs = selected.filter((operand): operand is SourceTypeFlowVariable => operand !== undefined);
    if (inputs.length !== selected.length) {
      const refusal = operands.map(operand => refusedOperations.get(operand)).find(issue => issue !== undefined);
      if (refusal === undefined) refuse("TSONIC_LOCAL_TYPE_UNSUPPORTED", node);
      else refusedOperations.set(node, refusal);
      return undefined;
    }
    if (operator === "sequence" && inputs.length === 1 && openValues.has(inputs[0]!.node) && !derived.has(inputs[0]!.node)) {
      const result = record(node, "read");
      link(inputs[0], result, node);
      return result;
    }
    const aggregates = inputs.map(input => terms.get(input));
    if (required && (operator === "conditional" || operator === "coalesce") && inputs.some(operand => openValues.has(operand.node)) &&
      aggregates.length === 2 && aggregates.every(term => term?.kind === aggregates[0]?.kind &&
        (term?.kind === "array" || term?.kind === "shape" || term?.kind === "tuple"))) {
      const result = record(node, "value");
      for (const input of inputs) link(input, result, node);
      return result;
    }
    const result = record(node, "value", numericTerm);
    if (result === undefined) return undefined;
    derived.set(node, Object.freeze({ node, result, operator, operands: Object.freeze(inputs), required }));
    active.add(node);
    if (numericTerm !== undefined || inputs.some(operand => openValues.has(operand.node))) openValues.add(node);
    return result;
  }

  function collectInvocation(node: Node, depth: number): SourceTypeFlowVariable | undefined {
    const query = semantics.forNode(node);
    const source = query.operations.call(node);
    if (source === undefined || source.sourceSelectedSignatureKind !== "resolved") return fixed(node);
    preparePairs(source, query);
    const arguments_ = source.sourceArguments.map(argument => value(argument.expression, false, depth));
    const directCallee = source.sourceReceiver === undefined ? nominalCallee(source, query) : undefined;
    const receiverEvidence = source.sourceReceiver ?? directCallee;
    const receiver = receiverEvidence === undefined ? undefined : value(receiverEvidence.expression, false, depth);
    const receiverType = receiverEvidence === undefined ? undefined : context.describe(receiverEvidence.expression);
    if (receiver !== undefined && receiverType !== undefined && declaredWidth(receiverType)) active.add(receiver.node);
    for (const argument of arguments_) {
      const type = argument === undefined ? undefined : context.describe(argument.node);
      if (argument !== undefined && type !== undefined && declaredWidth(type)) active.add(argument.node);
    }
    const genericConstruction = ast.is.IsNewExpression(node) && (source.sourceSelectedMethodTypeArguments?.length ?? 0) > 0;
    const selectedDeclaration = query.declarations.signatureDeclaration(source.selectedSignature);
    const bodyResult = ast.is.IsCallExpression(node) && selectedDeclaration !== undefined &&
      ast.body(selectedDeclaration) !== undefined && ast.typeNode(selectedDeclaration) === undefined;
    const genericAggregate = source.sourceArgumentBindings.some(binding => {
      const argument = arguments_[binding.sourceArgumentIndex];
      if (argument === undefined || fixedAggregateOrigin(argument) === undefined) return false;
      const parameter = source.sourceSelectedSignatureParameters[binding.sourceParameterIndex];
      const component = parameter?.parameterDeclaration === undefined ? undefined : declaredComponent(parameter.parameterDeclaration, query);
      if (component === undefined) return false;
      const formal = sourceTypeFlowHomomorphicInput(context.source, query, component.selectedType, component.authoredTypeNode) ?? component.selectedType;
      const declaration = sourceTypeFlowTypeDeclaration(context.source, query, formal);
      return declaration !== undefined && ast.is.IsTypeParameterDeclaration(declaration) &&
        (source.sourceSelectedMethodTypeArguments ?? []).some(argument =>
          sourceTypeFlowTypeDeclaration(context.source, query, argument.typeParameter) === declaration);
    });
    const inlineArgument = source.sourceArguments.some(argument => inlineCallable(ast, argument.expression) !== undefined);
    if (!bodyResult && !genericConstruction && !genericAggregate && !inlineArgument && directCallee === undefined && !arguments_.some(argument => argument !== undefined && active.has(argument.node)) &&
      (receiver === undefined || !active.has(receiver.node))) {
      const result = query.operations.callResult(source);
      const declaration = query.declarations.signatureDeclaration(source.selectedSignature);
      return result === undefined ? fixed(node) : fixed(node, Object.freeze({ selectedType: result.resultType, contextualCall: source,
        ...(declaration === undefined ? {} : { declaration }),
        ...(result.authoredTypeNode === undefined ? {} : { authoredTypeNode: result.authoredTypeNode }) }));
    }
    return genericInvocation(node, source, arguments_, receiver, receiverEvidence, query, depth);
  }

  function nominalCallee(call: ResolvedSourceCallInfo, query: SourceFileSemantics): ResolvedSourceCallInfo["sourceCallee"] | undefined {
    if (!ast.is.IsCallExpression(call.call)) return undefined;
    const declaration = query.declarations.signatureDeclaration(call.selectedSignature);
    let owner = declaration === undefined ? undefined : ast.parent(declaration);
    while (owner !== undefined && !ast.is.IsClassDeclaration(owner) && !ast.is.IsClassExpression(owner) && !ast.is.IsInterfaceDeclaration(owner)) {
      if (ast.is.IsSourceFile(owner)) return undefined;
      owner = ast.parent(owner);
    }
    return owner !== undefined && (query.types.typeArgumentBindings(call.sourceCallee.type)?.length ?? 0) > 0 ? call.sourceCallee : undefined;
  }

  function preparePairs(source: ResolvedSourceCallInfo, caller: SourceFileSemantics): void {
    for (const binding of source.sourceArgumentBindings) {
      const parameter = source.sourceSelectedSignatureParameters[binding.sourceParameterIndex];
      const argument = source.sourceArguments[binding.sourceArgumentIndex]?.expression;
      const component = parameter?.parameterDeclaration === undefined ? undefined : declaredComponent(parameter.parameterDeclaration, caller);
      if (component === undefined || argument === undefined || !ast.is.IsArrayLiteralExpression(argument)) continue;
      const query = caller.types;
      const pending = [{ type: component.selectedType, depth: 0 }];
      while (pending.length !== 0) {
        const selected = pending.pop()!;
        if (selected.depth > 4) continue;
        if (query.isTuple(selected.type) && query.tupleElementInfos(selected.type).length === 2) {
          if (selected.depth === 0) pairs.add(argument);
          else for (const child of ast.elements(argument)) if (child !== undefined && ast.is.IsArrayLiteralExpression(child) && ast.elements(child).length === 2) pairs.add(child);
          break;
        }
        const children = query.isUnion(selected.type) ? query.unionOrIntersectionTypes(selected.type).filter(type => !query.isNullish(type))
          : query.typeArguments(selected.type);
        for (const type of children) pending.push({ type, depth: selected.depth + 1 });
      }
    }
  }

  function genericInvocation(node: Node, source: ResolvedSourceCallInfo,
    arguments_: readonly (SourceTypeFlowVariable | undefined)[], receiver: SourceTypeFlowVariable | undefined,
    receiverEvidence: ResolvedSourceCallInfo["sourceCallee"] | undefined,
    query: SourceFileSemantics, depth: number): SourceTypeFlowVariable | undefined {
    const result = record(node, "value");
    if (result === undefined) return undefined;
    const receiverBinders: SourceTypeFlowBinder[] = [];
    const methodBinders: SourceTypeFlowBinder[] = [];
    const argumentPlaces: SourceTypeFlowArgumentPlace[] = [];
    const binders = new Map<Node, SourceTypeFlowVariable>();
    const seeds = new Set<Node>();
    const authoredBinders = new Set<Node>();
    const inheritedReceiverArguments = new Map<Node, Type>();
    let argumentPlace: Pick<SourceTypeFlowArgumentPlace, "binding" | "parameter"> | undefined;
    let receiverOnly = false;
    const receiverArguments = receiverParameters(source);
    for (const declaration of receiverArguments) addBinder(declaration, receiverBinders);
    for (const selected of source.sourceSelectedMethodTypeArguments ?? []) {
      const symbol = query.declarations.typeSymbol(selected.typeParameter);
      const declaration = symbol === undefined ? undefined : query.declarations.primarySymbolDeclaration(symbol);
      if (declaration === undefined || !ast.is.IsTypeParameterDeclaration(declaration)) {
        refuse("TSONIC_LOCAL_TYPE_GENERIC", node); continue;
      }
      const variable = addBinder(declaration, methodBinders);
      if (selected.explicitTypeNode !== undefined) {
        authoredBinders.add(declaration);
        const type = query.types.authoredType(selected.explicitTypeNode);
        const component = type === undefined ? undefined : Object.freeze({ selectedType: type, authoredTypeNode: selected.explicitTypeNode });
        const explicit = component === undefined ? undefined : fixed(selected.explicitTypeNode, component);
        link(explicit, variable, selected.explicitTypeNode);
      }
    }
    for (const declaration of receiverArguments) {
      if (receiver === undefined) break;
      const authored = declaredSlots.authoredBinding(node, new Set([declaration]))?.get(declaration);
      if (authored !== undefined) {
        putTerm(binders.get(declaration)!, Object.freeze({ kind: "fixed", site: node, type: authored.type }));
        seeds.add(declaration);
        continue;
      }
      const inherited = inheritedReceiverArguments.get(declaration);
      if (inherited !== undefined) {
        const destination = binders.get(declaration)!;
        const component = Object.freeze({ selectedType: inherited });
        if (mentionedBinders(inherited, query.types, 0).size > 0) join(inherited, destination, node, component, 0, "result");
        else {
          const descriptor = context.describe(node, component);
          if (descriptor === undefined) refuse("TSONIC_LOCAL_TYPE_GENERIC", node, declaration);
          else putTerm(destination, Object.freeze({ kind: "fixed", site: node, type: descriptor }));
        }
        seeds.add(declaration);
        continue;
      }
      const term = nodes.get(receiver.node)?.term;
      const descriptor = context.describe(receiver.node);
      const part: SourceTypeFlowPathPart = term?.kind === "array" || descriptor?.kind === "array" ? { kind: "element" }
        : { kind: "binder", declaration };
      link(project(receiver, part), binders.get(declaration), node);
      seeds.add(declaration);
    }
    for (const binding of source.sourceArgumentBindings) {
      const parameter = source.sourceSelectedSignatureParameters[binding.sourceParameterIndex];
      const selected = source.sourceArguments[binding.sourceArgumentIndex];
      const component = parameter?.parameterDeclaration === undefined ? undefined : declaredComponent(parameter.parameterDeclaration, query);
      if (component === undefined || selected === undefined || inlineCallable(ast, selected.expression) !== undefined) continue;
      const symbol = query.declarations.typeSymbol(component.selectedType);
      const declared = symbol === undefined ? undefined : query.declarations.primarySymbolDeclaration(symbol);
      if (declared !== undefined && binders.has(declared)) seeds.add(declared);
    }
    for (const binding of source.sourceArgumentBindings) {
      const argument = arguments_[binding.sourceArgumentIndex];
      const parameter = source.sourceSelectedSignatureParameters[binding.sourceParameterIndex];
      const selected = source.sourceArguments[binding.sourceArgumentIndex];
      if (argument === undefined || parameter === undefined || selected === undefined) continue;
      const declared = parameter.parameterDeclaration;
      const component = declared === undefined ? undefined : declaredComponent(declared, query);
      if (component === undefined) continue;
      argumentPlace = inlineCallable(ast, selected.expression) === undefined ? { binding, parameter } : undefined;
      const mentioned = mentionedBinders(component.selectedType, query.types, 0);
      receiverOnly = receiverEvidence !== undefined && mentioned.size > 0 &&
        [...mentioned].every(declaration => receiverBinders.some(binder => binder.declaration === declaration));
      const input = binding.sourceForm === "spread-sequence" ? project(argument, { kind: "element" })
        : binding.sourceForm === "spread-element" && binding.spreadElementIndex !== undefined
          ? project(argument, { kind: "tuple", index: binding.spreadElementIndex }) : argument;
      const formal = binding.sourceParameterForm === "rest-element" || binding.sourceParameterForm === "rest-sequence"
        ? query.types.typeArguments(component.selectedType)[0] ?? component.selectedType
        : component.selectedType;
      const actual = terms.get(input);
      const absence = actual?.kind === "fixed" && actual.type.kind === "intrinsic" && actual.type.intrinsic === "absence";
      if (absence && (parameter.acceptsOmission || query.types.isNullish(formal) || query.types.isUnion(formal) &&
        query.types.unionOrIntersectionTypes(formal).some(type => query.types.isNullish(type)))) {
        argumentPlace = undefined;
        receiverOnly = false;
        continue;
      }
      join(formal, input, selected.expression, Object.freeze({ ...component, selectedType: formal }), 0, "argument");
      argumentPlace = undefined;
      receiverOnly = false;
    }
    const declaration = query.declarations.signatureDeclaration(source.selectedSignature);
    const signature = declaration === undefined ? undefined : query.types.declarationSignatureInfo(declaration);
    const bodyResult = ast.is.IsCallExpression(node) && declaration !== undefined &&
      ast.body(declaration) !== undefined && ast.typeNode(declaration) === undefined;
    const dependentResult = signature?.returnType !== undefined && mentionedBinders(signature.returnType, query.types, 0,
      new Set(), declaration === undefined ? undefined : ast.typeNode(declaration)).size > 0;
    if (!bodyResult && signature?.returnType !== undefined && dependentResult) join(signature.returnType, result, node,
      Object.freeze({ selectedType: source.sourceResultType, contextualCall: source, ...(declaration === undefined ? {} : { declaration }),
        ...(declaration === undefined || ast.typeNode(declaration) === undefined ? {} : { authoredTypeNode: ast.typeNode(declaration)! }) }), 0, "result");
    const resultType = source.sourceResultType;
    if (!bodyResult && !dependentResult && terms.get(result) === undefined && !derived.has(node)) {
      const type = context.describe(node, Object.freeze({ selectedType: resultType, contextualCall: source,
        ...(declaration === undefined ? {} : { declaration }),
        ...(declaration === undefined || ast.typeNode(declaration) === undefined ? {} : { authoredTypeNode: ast.typeNode(declaration)! }) }));
      if (type !== undefined) replace(node, { term: Object.freeze({ kind: "fixed", site: node, type }) });
    }
    const resultTerm = terms.get(result);
    const publishResult = !query.types.isVoidLike(source.sourceResultType) &&
      (bodyResult || dependentResult || resultTerm?.kind === "fixed" && declaredWidth(resultTerm.type));
    replace(node, { publish: publishResult, ...(publishResult ? {} : { kind: "fixed" }) });
    calls.set(node, Object.freeze({ node, source, receiver: Object.freeze(receiverBinders), method: Object.freeze(methodBinders),
      argumentPlaces: Object.freeze(argumentPlaces), ...(publishResult ? { result } : {}) }));
    if (publishResult) active.add(node);
    else { active.delete(node); openValues.delete(node); }
    return result;

    function receiverParameters(call: ResolvedSourceCallInfo): readonly Node[] {
      if (receiverEvidence === undefined) return [];
      const selected = call.sourceCalleeAccess?.selectedDeclaration ?? query.declarations.signatureDeclaration(call.selectedSignature);
      let owner = selected === undefined ? undefined : ast.parent(selected);
      while (owner !== undefined && !ast.is.IsClassDeclaration(owner) && !ast.is.IsClassExpression(owner) && !ast.is.IsInterfaceDeclaration(owner)) {
        if (ast.is.IsSourceFile(owner)) return [];
        owner = ast.parent(owner);
      }
      if (owner === undefined) return [];
      const symbol = query.declarations.typeSymbol(receiverEvidence.type);
      const receiverDeclarations = symbol === undefined ? [] : query.declarations.symbolDeclarations(symbol);
      const receiverOwner = receiverDeclarations.includes(owner) ? owner : receiverDeclarations.find(declaration =>
        ast.is.IsClassDeclaration(declaration) || ast.is.IsClassExpression(declaration) || ast.is.IsInterfaceDeclaration(declaration));
      if (receiverOwner === undefined) {
        refuse("TSONIC_LOCAL_TYPE_GENERIC", node, owner);
        return [];
      }
      if (receiverOwner !== owner) {
        const declared = query.declarations.declaredType(receiverOwner);
        const pending = declared === undefined ? [] : [{ type: declared, depth: 0 }];
        const visited = new Set<Type>();
        let selected: Type | undefined;
        while (pending.length > 0) {
          const current = pending.pop()!;
          if (visited.has(current.type) || current.depth > 4) continue;
          visited.add(current.type);
          const symbol = query.declarations.typeSymbol(current.type);
          if (symbol !== undefined && query.declarations.symbolDeclarations(symbol).includes(owner)) {
            if (selected !== undefined && !query.types.isIdentical(selected, current.type)) {
              refuse("TSONIC_LOCAL_TYPE_GENERIC", node, owner);
              return [];
            }
            selected = current.type;
          } else for (const type of query.types.instantiatedBaseTypes(current.type) ?? []) {
            pending.push({ type, depth: current.depth + 1 });
          }
        }
        const arguments_ = selected === undefined ? undefined : query.types.typeArgumentBindings(selected);
        if (arguments_ === undefined || receiver === undefined) {
          refuse("TSONIC_LOCAL_TYPE_GENERIC", node, owner);
          return [];
        }
        for (const argument of declared === undefined ? [] : query.types.typeArgumentBindings(declared) ?? []) {
          binders.set(argument.declaration, project(receiver, { kind: "binder", declaration: argument.declaration }));
        }
        for (const argument of arguments_) inheritedReceiverArguments.set(argument.declaration, argument.argumentType);
      }
      const ownerType = query.declarations.declaredType(owner);
      const parameters = ownerType === undefined ? sourceTypeFlowTypeParameters(ast, owner) :
        query.types.typeArgumentBindings(ownerType)?.map(binding => binding.declaration) ?? sourceTypeFlowTypeParameters(ast, owner);
      const arguments_ = query.types.typeArguments(receiverEvidence.type);
      if (receiverOwner === owner && arguments_.length < parameters.length) { refuse("TSONIC_LOCAL_TYPE_GENERIC", node, owner); return []; }
      const declarations: Node[] = [];
      for (const parameter of parameters) {
        if (parameter === undefined) { refuse("TSONIC_LOCAL_TYPE_GENERIC", node); continue; }
        const type = query.declarations.declaredType(parameter);
        const symbol = type === undefined ? undefined : query.declarations.typeSymbol(type);
        const declaration = symbol === undefined ? undefined : query.declarations.primarySymbolDeclaration(symbol);
        if (declaration === undefined || !ast.is.IsTypeParameterDeclaration(declaration)) {
          refuse("TSONIC_LOCAL_TYPE_GENERIC", node, parameter);
        } else declarations.push(declaration);
      }
      return declarations;
    }

    function addBinder(declaration: Node, destination: SourceTypeFlowBinder[]): SourceTypeFlowVariable {
      const previous = binders.get(declaration);
      if (previous !== undefined) return previous;
      const variable = project(result!, { kind: "binder", declaration });
      const constraint = ast.as.AsTypeParameterDeclaration(declaration)?.Constraint;
      const selectedType = constraint === undefined ? undefined : query.types.authoredType(constraint);
      destination.push(Object.freeze({ declaration, variable, ...(selectedType === undefined || constraint === undefined ? {}
        : { constraint: Object.freeze({ selectedType, declaration, authoredTypeNode: constraint }) }) }));
      binders.set(declaration, variable);
      return variable;
    }

    function join(formal: Type, variable: SourceTypeFlowVariable, occurrence: Node,
      component: SourceTypeComponentEvidence, level: number, role: "argument" | "callback" | "result" = "argument"): void {
      if (level > 4) { refuse("TSONIC_LOCAL_TYPE_LIMIT", occurrence); return; }
      const formalQuery = query;
      const homomorphic = role === "result" ? undefined
        : sourceTypeFlowHomomorphicInput(context.source, formalQuery, formal, component.authoredTypeNode);
      if (homomorphic !== undefined) {
        const { authoredTypeNode, ...inputComponent } = component;
        join(homomorphic, variable, occurrence, Object.freeze({ ...inputComponent, selectedType: homomorphic }), level + 1, role);
        return;
      }
      const declaration = sourceTypeFlowTypeDeclaration(context.source, formalQuery, formal);
      const binder = declaration === undefined ? undefined : binders.get(declaration);
      if (binder !== undefined) {
        if (role === "argument" && argumentPlace !== undefined && declaration !== undefined) {
          argumentPlaces.push(Object.freeze({ ...argumentPlace, binder: declaration, value: variable }));
        }
        if (role === "result" || !authoredBinders.has(declaration!) && (role !== "argument" || !receiverOnly)) link(variable, binder, occurrence);
        const operation = derived.get(variable.node);
        if (role === "callback" && operation !== undefined && declaration !== undefined && seeds.has(declaration)) {
          derived.set(operation.node, Object.freeze({ ...operation, accumulator: binder, required: true }));
        }
        return;
      }
      if (role === "result" && declaration !== undefined && ast.is.IsTypeParameterDeclaration(declaration)) {
        const type = context.describe(occurrence, Object.freeze({ selectedType: formal, declaration }));
        if (type?.kind === "declared" && type.declaration === declaration && type.typeArguments.length === 0) {
          putTerm(variable, Object.freeze({ kind: "fixed", site: occurrence, type }));
        } else refuse("TSONIC_LOCAL_TYPE_GENERIC", occurrence, declaration);
        return;
      }
      if (role === "argument" && declaration !== undefined && ast.is.IsTypeParameterDeclaration(declaration)) {
        const actual = formalQuery.types.expressionType(occurrence);
        if (actual !== undefined && formalQuery.types.isIdentical(actual, formal)) return;
      }
      if (declaration !== undefined && ast.is.IsTypeAliasDeclaration(declaration)) {
        const application = formalQuery.types.aliasApplication(formal);
        const arguments_ = application?.declaration === declaration ? application.bindings.map(binding =>
          ({ declaration: binding.declaration, argumentType: binding.argument })) : formalQuery.types.typeArgumentBindings(formal);
        const term = terms.get(variable);
        const actual = role === "result" ? undefined : term?.kind === "fixed" ? term.type : context.describe(variable.node);
        if (arguments_ !== undefined && arguments_.length > 0 && (role === "result" || actual?.kind === "declared" &&
          actual.declaration === declaration && actual.typeArguments.length === arguments_.length)) {
          const variables = arguments_.map(argument => project(variable, { kind: "binder", declaration: argument.declaration }));
          if (role === "result" && terms.get(variable) === undefined) putTerm(variable, Object.freeze({ kind: "declared", site: occurrence,
            declaration, typeArguments: Object.freeze(variables), source: component }));
          for (const [index, argument] of arguments_.entries()) join(argument.argumentType, variables[index]!, occurrence,
            Object.freeze({ selectedType: argument.argumentType,
              ...(component.declaration === undefined ? {} : { declaration: component.declaration }) }), level + 1, role);
          return;
        }
      }
      if (formalQuery.types.isUnion(formal) || formalQuery.types.isIntersection(formal)) {
        const members = formalQuery.types.unionOrIntersectionTypes(formal);
        const values = members.filter(member => !formalQuery.types.isNullish(member));
        if (role === "result" && formalQuery.types.isUnion(formal) && values.length === 1 && values.length < members.length) {
          if (receiver !== undefined && openValues.has(receiver.node) && terms.get(receiver)?.kind !== "declared") {
            refuse("TSONIC_LOCAL_TYPE_UNION", occurrence); return;
          }
          const valueType = values[0]!;
          const valueComponent = presentFormalComponent(valueType, component, formalQuery);
          if (valueComponent === undefined) { refuse("TSONIC_LOCAL_TYPE_GENERIC", occurrence); return; }
          const child = project(variable, optionalValuePart);
          putTerm(variable, Object.freeze({ kind: "optional", site: occurrence, value: child, source: component }));
          if (mentionedBinders(valueType, formalQuery.types, level + 1).size > 0) {
            join(valueType, child, occurrence, valueComponent, level + 1, role);
          } else {
            const type = context.describe(occurrence, valueComponent);
            if (type !== undefined) putTerm(child, Object.freeze({ kind: "fixed", site: occurrence, type }));
            else refuse("TSONIC_LOCAL_TYPE_UNSUPPORTED", occurrence);
          }
          return;
        }
        if (role === "argument" && values.length === 1 && values.length < members.length) {
          const valueComponent = presentFormalComponent(values[0]!, component, formalQuery);
          if (valueComponent === undefined) { refuse("TSONIC_LOCAL_TYPE_GENERIC", occurrence); return; }
          join(values[0]!, variable, occurrence, valueComponent, level, role);
          return;
        }
        const arrayFormal = role === "argument" && formalQuery.types.isUnion(formal)
          ? arrayArgumentFormal(values, variable, occurrence, component) : undefined;
        if (arrayFormal !== undefined) {
          const { authoredTypeNode, ...inputComponent } = component;
          join(arrayFormal, variable, occurrence, Object.freeze({ ...inputComponent, selectedType: arrayFormal }), level + 1, role);
          return;
        }
        // Only a union that mentions one of this call's binders is a generic join; a closed union formal (its checker
        // type may still report "could contain type variables" for anonymous object members) is chosen by the one C30
        // kind selector at the construction (uses.ts), not refused here.
        if (mentionedBinders(formal, formalQuery.types, level).size > 0) refuse("TSONIC_LOCAL_TYPE_GENERIC", occurrence);
        return;
      }
      if (formalQuery.types.isTuple(formal)) {
        const elements = formalQuery.types.tupleElementInfos(formal);
        if (role === "result" && terms.get(variable) === undefined) putTerm(variable, Object.freeze({ kind: "tuple",
          site: occurrence, readonly: formalQuery.types.indexInfos(formal).some(index => index.readonly),
          elements: Object.freeze(elements.map((element, index) => Object.freeze({
            kind: element.elementKind === "variadic" ? "rest" as const : element.elementKind,
            variable: project(variable, { kind: "tuple", index }),
            ...(element.declaration === undefined ? {} : { declaration: element.declaration }),
          }))) }));
        for (const [index, element] of elements.entries()) {
          join(element.type, project(variable, { kind: "tuple", index }), occurrence,
            Object.freeze({ selectedType: element.type, ...(element.declaration === undefined ? {} : { declaration: element.declaration }) }), level + 1, role);
        }
        return;
      }
      if (formalQuery.types.isArrayLike(formal)) {
        const element = formalQuery.types.typeArguments(formal)[0];
        if (role === "result" && terms.get(variable) === undefined) putTerm(variable, Object.freeze({ kind: "array", site: occurrence,
          element: project(variable, { kind: "element" }), readonly: formalQuery.types.indexInfos(formal).some(index => index.readonly) }));
        if (element !== undefined) join(element, project(variable, { kind: "element" }), occurrence,
          Object.freeze({ selectedType: element, ...(component.declaration === undefined ? {} : { declaration: component.declaration }) }), level + 1, role);
        return;
      }
      const callable = formalQuery.types.callable(formal);
      const closure = inlineCallable(ast, occurrence);
      if (callable !== undefined && closure !== undefined) {
        const parameters = ast.parameters(closure);
        for (const [index, parameter] of callable.parameters.entries()) {
          const actual = parameters[index];
          if (actual === undefined) continue;
          const association = Object.freeze({ selectedType: parameter.type,
            ...(parameter.declaration === undefined ? {} : { declaration: parameter.declaration }),
            ...(parameter.declaration === undefined || ast.typeNode(parameter.declaration) === undefined ? {}
              : { authoredTypeNode: ast.typeNode(parameter.declaration)! }) });
          const parameterVariable = record(actual, "parameter", undefined, actual);
          if (parameterVariable === undefined) continue;
          const parameterSymbol = formalQuery.declarations.typeSymbol(parameter.type);
          const parameterDeclaration = parameterSymbol === undefined ? undefined : formalQuery.declarations.primarySymbolDeclaration(parameterSymbol);
          const projected = declaredSlots.parameter(actual, query);
          if (projected !== undefined) replace(actual, { term: Object.freeze({ kind: "fixed", site: actual, type: projected }) });
          else if (parameterDeclaration !== undefined && binders.has(parameterDeclaration)) active.add(actual);
          else {
            const actualType = ast.typeNode(actual) === undefined ? association : declaredComponent(actual, query) ?? association;
            const type = context.describe(actual, actualType);
            if (type !== undefined) replace(actual, { term: Object.freeze({ kind: "fixed", site: actual, type }) });
          }
          const sourceFile = ast.getSourceFile(actual);
          if (sourceFile !== undefined) replace(actual, { association: Object.freeze({ occurrence: actual, sourceFile, component: association, call: source }) });
          join(parameter.type, parameterVariable, actual, association, level, "callback");
        }
        for (const returned of inlineReturns(ast, closure)) {
          const returnedVariable = value(returned, true, depth);
          if (returnedVariable !== undefined) join(callable.result.selectedType, returnedVariable, returned, callable.result, level, "callback");
        }
        return;
      }
      const arguments_ = formalQuery.types.typeArgumentBindings(formal);
      if (declaration !== undefined && arguments_ !== undefined && arguments_.length > 0) {
        if (nodes.get(variable.node)?.term?.kind === "array" && arguments_.length === 1 && formalQuery.types.isTuple(arguments_[0]!.argumentType)) {
          join(arguments_[0]!.argumentType, project(variable, { kind: "element" }), occurrence,
            Object.freeze({ selectedType: arguments_[0]!.argumentType, ...(component.declaration === undefined ? {} : { declaration: component.declaration }) }), level + 1, role);
          return;
        }
        const variables = arguments_.map(argument => project(variable, { kind: "binder", declaration: argument.declaration }));
        if (role === "result" && terms.get(variable) === undefined) putTerm(variable, Object.freeze({ kind: "declared", site: occurrence,
          declaration, typeArguments: Object.freeze(variables), source: component }));
        for (const [index, argument] of arguments_.entries()) join(argument.argumentType, variables[index]!, occurrence,
          Object.freeze({ selectedType: argument.argumentType, ...(component.declaration === undefined ? {} : { declaration: component.declaration }) }), level + 1, role);
        return;
      }
      if (declaration !== undefined && ast.is.IsTypeLiteralNode(declaration)) {
        const properties = formalQuery.types.propertyInfos(formal);
        // A result whose formal is a type literal is structured by its members, like the array, tuple and declared forms.
        if (role === "result" && terms.get(variable) === undefined) putTerm(variable, Object.freeze({ kind: "shape", site: occurrence,
          members: Object.freeze(properties.map(property => {
            const member = formalQuery.declarations.primarySymbolDeclaration(property.symbol);
            return Object.freeze({ name: property.name, optional: property.optional, variable: project(variable, { kind: "member", name: property.name }),
              ...(member === undefined ? {} : { declaration: member }), ...(property.readonly ? { readonly: true } : {}) });
          })) }));
        for (const property of properties) {
          const member = formalQuery.declarations.primarySymbolDeclaration(property.symbol);
          join(property.type, project(variable, { kind: "member", name: property.name }), occurrence,
            Object.freeze({ selectedType: property.type, ...(member === undefined ? {} : { declaration: member,
              ...(ast.typeNode(member) === undefined ? {} : { authoredTypeNode: ast.typeNode(member)! }) }) }), level + 1, role);
        }
        return;
      }
      if (mentionedBinders(formal, formalQuery.types, level).size > 0 || formalQuery.types.couldContainTypeVariables(formal)) {
        refuse("TSONIC_LOCAL_TYPE_GENERIC", occurrence);
      }
    }

    function presentFormalComponent(type: Type, component: SourceTypeComponentEvidence,
      queries: SourceFileSemantics): SourceTypeComponentEvidence | undefined {
      const annotation = component.authoredTypeNode ?? (component.declaration === undefined ? undefined : ast.typeNode(component.declaration));
      const selection = annotation === undefined ? undefined : queries.types.authoredSelection(annotation, type);
      if (annotation !== undefined && (selection?.kind !== "authored-members" || selection.nodes.length !== 1 ||
        selection.selectedNullishTypes.length !== 0)) return undefined;
      const authoredTypeNode = selection?.kind === "authored-members" ? selection.nodes[0] : undefined;
      const declaration = sourceTypeFlowTypeDeclaration(context.source, queries, type, authoredTypeNode);
      return Object.freeze({ selectedType: type, ...(declaration === undefined ? {} : { declaration }),
        ...(authoredTypeNode === undefined ? {} : { authoredTypeNode }) });
    }

    function arrayArgumentFormal(alternatives: readonly Type[], variable: SourceTypeFlowVariable, occurrence: Node,
      component: SourceTypeComponentEvidence): Type | undefined {
      const term = terms.get(variable);
      if (term === undefined || !(term.kind === "array" ||
        term.kind === "fixed" && sourceTypeDescriptorStructure(term.type).kind === "array")) return undefined;
      if (alternatives.some(type => {
        const declaration = sourceTypeFlowTypeDeclaration(context.source, query, type);
        return query.types.isAny(type) || query.types.isUnknown(type) || query.types.isNonPrimitive(type) ||
          declaration !== undefined && ast.is.IsTypeParameterDeclaration(declaration);
      })) return undefined;
      const arrays = alternatives.filter(type => query.types.isArrayLike(type) || query.types.isTuple(type));
      if (arrays.length !== 1 || query.types.isTuple(arrays[0]!)) return undefined;
      const descriptor = context.describe(occurrence, component);
      if (descriptor === undefined) return undefined;
      const pending = [descriptor];
      const seen = new Set<SourceTypeDescriptor>();
      while (pending.length > 0) {
        const selected = pending.pop()!;
        if (seen.has(selected)) continue;
        seen.add(selected);
        if (selected.kind === "declared") {
          if (ast.is.IsTypeParameterDeclaration(selected.declaration)) return undefined;
          if (selected.definition !== undefined) pending.push(selected.definition);
        } else if (selected.kind === "optional") pending.push(selected.value);
        else if (selected.kind === "union") pending.push(...selected.types);
        else if (selected.kind === "intrinsic" && ["any", "unknown", "object"].includes(selected.intrinsic)) return undefined;
        else if (selected.kind === "shape" && selected.members.length === 0 && selected.indexes.length === 0 &&
          selected.calls.length === 0 && selected.constructs.length === 0) return undefined;
      }
      if (!ast.is.IsArrayLiteralExpression(term.site)) return arrays[0];
      const slot = sourceTypeFlowConstructionSlot(ast, term.site, descriptor, "inferred");
      return slot.type !== undefined && sourceTypeDescriptorStructure(slot.type).kind === "array" ? arrays[0] : undefined;
    }

    function mentionedBinders(type: Type, types: SourceFinalTypeQueries,
      level: number, seen = new Set<Type>(), authoredTypeNode?: Node): ReadonlySet<Node> {
      if (level > 4 || seen.has(type)) return new Set();
      seen.add(type);
      const homomorphic = sourceTypeFlowHomomorphicInput(context.source, query, type, authoredTypeNode);
      if (homomorphic !== undefined) return mentionedBinders(homomorphic, types, level + 1, seen);
      const declaration = sourceTypeFlowTypeDeclaration(context.source, query, type);
      if (declaration !== undefined && binders.has(declaration)) return new Set([declaration]);
      const children = types.isTuple(type) ? types.tupleElementTypes(type) : types.isUnion(type) || types.isIntersection(type)
        ? types.unionOrIntersectionTypes(type) : types.typeArguments(type);
      const mentioned = new Set<Node>();
      for (const child of children) for (const binder of mentionedBinders(child, types, level + 1, seen)) mentioned.add(binder);
      const callable = types.callable(type);
      if (callable !== undefined) for (const child of [...callable.parameters.map(parameter => parameter.type), callable.result.selectedType]) {
        for (const binder of mentionedBinders(child, types, level + 1, seen)) mentioned.add(binder);
      }
      if (declaration !== undefined && ast.is.IsTypeLiteralNode(declaration)) for (const property of types.propertyInfos(type)) {
        for (const binder of mentionedBinders(property.type, types, level + 1, seen)) mentioned.add(binder);
      }
      return mentioned;
    }
  }
}

function isCallable(ast: AstReader, node: Node): boolean {
  return ast.is.IsFunctionDeclaration(node) || ast.is.IsFunctionExpression(node) || ast.is.IsArrowFunction(node) ||
    ast.is.IsMethodDeclaration(node) || ast.is.IsConstructorDeclaration(node) ||
    ast.is.IsGetAccessorDeclaration(node) || ast.is.IsSetAccessorDeclaration(node);
}

function isInlineArgument(ast: AstReader, node: Node): boolean {
  if (!ast.is.IsArrowFunction(node) && !ast.is.IsFunctionExpression(node)) return false;
  let current = node;
  let parent = ast.parent(current);
  while (parent !== undefined && (ast.is.IsParenthesizedExpression(parent) || ast.is.IsAsExpression(parent) || ast.is.IsSatisfiesExpression(parent))) {
    current = parent; parent = ast.parent(parent);
  }
  return parent !== undefined && (ast.is.IsCallExpression(parent) || ast.is.IsNewExpression(parent)) && ast.arguments(parent).includes(current);
}

function inlineCallable(ast: AstReader, node: Node): Node | undefined {
  let current = node;
  while (ast.is.IsParenthesizedExpression(current) || ast.is.IsAsExpression(current) || ast.is.IsSatisfiesExpression(current)) {
    const operand = Node_Expression(ast, current);
    if (operand === undefined) return undefined;
    current = operand;
  }
  return isInlineArgument(ast, current) ? current : undefined;
}

function inlineReturns(ast: AstReader, closure: Node): readonly Node[] {
  const body = ast.body(closure);
  if (body === undefined) return [];
  if (!ast.is.IsBlock(body)) return [body];
  const returns: Node[] = [];
  const pending = [body];
  while (pending.length !== 0) {
    const node = pending.pop()!;
    if (isCallable(ast, node)) continue;
    if (ast.is.IsReturnStatement(node)) {
      const expression = Node_Expression(ast, node);
      if (expression !== undefined) returns.push(expression);
    } else for (const child of ast.children(node)) if (child !== undefined) pending.push(child);
  }
  return returns;
}

function numericLeaves(ast: AstReader, root: Node): boolean {
  const pending = [root];
  while (pending.length !== 0) {
    const node = pending.pop()!;
    if (ast.is.IsNumericLiteral(node)) continue;
    if (ast.is.IsParenthesizedExpression(node)) {
      const operand = Node_Expression(ast, node);
      if (operand === undefined) return false;
      pending.push(operand);
    } else if (ast.is.IsPrefixUnaryExpression(node)) {
      const operator = ast.operatorKindName(node);
      const operand = ast.as.AsPrefixUnaryExpression(node)?.Operand;
      if (operand === undefined || operator !== "KindPlusToken" && operator !== "KindMinusToken") return false;
      pending.push(operand);
    } else if (ast.is.IsBinaryExpression(node)) {
      const binary = ast.as.AsBinaryExpression(node);
      const operator = ast.operatorKindName(node);
      if (binary?.Left === undefined || binary.Right === undefined || !["KindPlusToken", "KindMinusToken", "KindAsteriskToken", "KindSlashToken", "KindPercentToken"].includes(operator ?? "")) return false;
      pending.push(binary.Left, binary.Right);
    } else return false;
  }
  return true;
}

export function sourceTypeFlowDeclaredPatternBindings(context: SourceTypeFlowAnalysisContext, node: Node,
  component: SourceTypeComponentEvidence | undefined, query: SourceFileSemantics, described: SourceTypeDescriptor | undefined,
  initializer?: Node): readonly ({ readonly kind: "resolved"; readonly node: Node; readonly component?: SourceTypeComponentEvidence;
    readonly type?: SourceTypeDescriptor } | { readonly kind: "refused"; readonly node: Node })[] {
  const { ast } = context.source;
  const bindings: ({ readonly kind: "resolved"; readonly node: Node; readonly component?: SourceTypeComponentEvidence;
    readonly type?: SourceTypeDescriptor } | { readonly kind: "refused"; readonly node: Node })[] = [];
  visit(node, component, described, initializer);
  return bindings;

  function visit(pattern: Node, component: SourceTypeComponentEvidence | undefined, described: SourceTypeDescriptor | undefined,
    initializer?: Node): void {
    const arrayPattern = ast.is.IsArrayBindingPattern(pattern);
    const tuple = component !== undefined && query.types.isTuple(component.selectedType)
      ? query.types.tupleElementInfos(component.selectedType) : undefined;
    const elements = ast.elements(pattern);
    for (const [index, element] of elements.entries()) {
      if (element === undefined || ast.is.IsOmittedExpression(element)) continue;
      const name = ast.name(element);
      if (name === undefined) continue;
      const selectedType = query.declarations.declaredValueType(element);
      let selected: SourceTypeComponentEvidence | undefined = selectedType === undefined ? undefined : { selectedType, declaration: element };
      let projected: SourceTypeDescriptor | undefined;
      if (arrayPattern && described?.kind === "array") projected = BindingElement_IsRest(ast, element) ? described : described.element;
      else if (arrayPattern && described?.kind === "tuple" && !BindingElement_IsRest(ast, element)) projected = sourceTypeDescriptorTupleValue(described, index);
      else if (arrayPattern && described?.kind === "tuple" && BindingElement_IsRest(ast, element)) {
        projected = { ...described, elements: described.elements.slice(index) };
      } else if (!arrayPattern && BindingElement_IsRest(ast, element) && selectedType !== undefined && described !== undefined) {
        const structure = sourceTypeDescriptorStructure(described);
        if (structure.kind === "shape") {
          const members = [];
          let complete = query.types.indexInfos(selectedType).length === structure.indexes.length;
          for (const property of query.types.propertyInfos(selectedType)) {
            const origin = sourceTypeDescriptorMemberOrigin(context.source, query, property, selectedType);
            const matches = origin?.kind !== "resolved" ? [] : structure.members.filter(member =>
              sourceTypeDescriptorMemberOriginsEqual(member.origin, origin.origin));
            if (matches.length !== 1) { complete = false; break; }
            members.push(matches[0]!);
          }
          if (!complete) { bindings.push({ kind: "refused", node: element }); continue; }
          projected = { kind: "shape", members, indexes: structure.indexes, calls: [], constructs: [] };
        }
      }
      if (component !== undefined && !BindingElement_IsRest(ast, element)) {
        let slot: { readonly type: Type; readonly declaration?: Node } | undefined;
        if (arrayPattern) slot = tuple?.[index];
        else {
          const propertyName = BindingElement_PropertyName(ast, element) ?? name;
          const selection = query.propertyNames.get(propertyName);
          if (selection?.kind !== "resolved") { bindings.push({ kind: "refused", node: element }); continue; }
          const property = query.types.propertyInfos(component.selectedType).find(property => property.name === selection.name);
          const structure = described === undefined ? undefined : sourceTypeDescriptorStructure(described);
          if (structure?.kind === "shape") projected = structure.members.find(member => member.name === selection.name)?.type;
          const assignment = initializer !== undefined && ast.is.IsObjectLiteralExpression(initializer)
            ? ast.properties(initializer).find(candidate => candidate !== undefined && ast.is.IsPropertyAssignment(candidate) &&
              query.propertyNames.get(ast.name(candidate)!)?.kind === "resolved" &&
              (query.propertyNames.get(ast.name(candidate)!) as { readonly name: string }).name === selection.name) : undefined;
          const memberValue = assignment === undefined ? undefined : ast.as.AsPropertyAssignment(assignment)?.Initializer;
          const valueDescriptor = memberValue === undefined ? undefined : context.describe(memberValue);
          if (valueDescriptor !== undefined) projected = valueDescriptor;
          if (property !== undefined) {
            const declaration = query.declarations.primarySymbolDeclaration(property.symbol);
            slot = { type: property.type, ...(declaration === undefined ? {} : { declaration }) };
          }
        }
        if (slot !== undefined) {
          const method = slot.declaration !== undefined &&
            (ast.is.IsMethodDeclaration(slot.declaration) || ast.is.IsMethodSignatureDeclaration(slot.declaration));
          const annotation = slot.declaration === undefined || method ? undefined : isTypeSyntaxNode(ast, slot.declaration)
            ? slot.declaration : ast.typeNode(slot.declaration);
          selected = Object.freeze({ selectedType: selected?.selectedType ?? slot.type,
            ...(slot.declaration === undefined || method ? {} : { declaration: slot.declaration }),
            ...(annotation === undefined ? {} : { authoredTypeNode: annotation }) });
        }
      }
      if (projected?.kind === "optional" && Node_Initializer(ast, element) !== undefined && selected !== undefined &&
        !query.types.isUnion(selected.selectedType) && !query.types.isNullish(selected.selectedType)) projected = projected.value;
      bindings.push({ kind: "resolved", node: element, ...(selected === undefined ? {} : { component: selected }),
        ...(projected === undefined ? {} : { type: projected }) });
      if (ast.is.IsArrayBindingPattern(name) || ast.is.IsObjectBindingPattern(name)) {
        visit(name, selected, projected ?? (selected === undefined ? undefined : context.describe(element, selected)));
      }
    }
  }
}

export function sourceTypeFlowDescriptorPart(context: SourceTypeFlowAnalysisContext, site: Node, type: SourceTypeDescriptor, part: SourceTypeFlowPathPart): SourceTypeDescriptor | undefined {
  const structure = sourceTypeDescriptorStructure(type);
  if (part.kind === "element") return structure.kind === "array" ? structure.element : undefined;
  if (part.kind === "optional-value") return structure.kind === "optional" ? structure.value : undefined;
  if (part.kind === "tuple") return structure.kind === "tuple" ? sourceTypeDescriptorTupleValue(structure, part.index) : undefined;
  if (part.kind === "member") return structure.kind === "shape"
    ? structure.members.find(member => member.name === part.name)?.type ?? structure.indexes.find(index => index.key.kind === "string")?.value : undefined;
  if (type.kind !== "declared") return undefined;
  const queries = context.source.semantics.forNode(site);
  const declared = queries.declarations.declaredType(type.declaration);
  const parameters = declared === undefined ? undefined : queries.types.typeArgumentBindings(declared)?.map(binding => binding.declaration);
  const index = (parameters ?? sourceTypeFlowTypeParameters(context.source.ast, type.declaration)).indexOf(part.declaration);
  return index < 0 ? undefined : type.typeArguments[index];
}

export function sourceTypeFlowObjectLiteralReceiver(ast: AstReader, node: Node): Node | undefined {
  if (ast.kindName(node) !== "KindThisKeyword") return undefined;
  for (let owner = ast.parent(node); owner !== undefined; owner = ast.parent(owner)) {
    if (ast.is.IsArrowFunction(owner)) continue;
    if (isCallable(ast, owner)) {
      const literal = ast.parent(owner);
      return (ast.is.IsMethodDeclaration(owner) || ast.is.IsGetAccessorDeclaration(owner) || ast.is.IsSetAccessorDeclaration(owner)) &&
        literal !== undefined && ast.is.IsObjectLiteralExpression(literal) ? literal : undefined;
    }
    if (ast.is.IsClassDeclaration(owner) || ast.is.IsClassExpression(owner) || ast.is.IsSourceFile(owner)) return undefined;
  }
  return undefined;
}

export function isWriteTarget(ast: AstReader, node: Node): boolean {
  const parent = ast.parent(node);
  if (parent === undefined) return false;
  if (ast.is.IsPrefixUnaryExpression(parent) || ast.is.IsPostfixUnaryExpression(parent)) {
    return ast.operatorKindName(parent) === "KindPlusPlusToken" || ast.operatorKindName(parent) === "KindMinusMinusToken";
  }
  if (!ast.is.IsBinaryExpression(parent) || ast.as.AsBinaryExpression(parent)?.Left !== node) return false;
  const operator = ast.operatorKindName(parent);
  return operator !== undefined && ["KindEqualsToken", "KindPlusEqualsToken", "KindMinusEqualsToken", "KindAsteriskEqualsToken",
    "KindSlashEqualsToken", "KindPercentEqualsToken", "KindAsteriskAsteriskEqualsToken", "KindLessThanLessThanEqualsToken",
    "KindGreaterThanGreaterThanEqualsToken", "KindGreaterThanGreaterThanGreaterThanEqualsToken", "KindAmpersandEqualsToken",
    "KindBarEqualsToken", "KindCaretEqualsToken", "KindQuestionQuestionEqualsToken", "KindBarBarEqualsToken", "KindAmpersandAmpersandEqualsToken"].includes(operator);
}
