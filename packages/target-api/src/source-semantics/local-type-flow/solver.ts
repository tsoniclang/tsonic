import type { Node, SourcePrimitiveKind } from "@tsonic/tsts";
import { Node_Expression, Node_Initializer, sourceTransparentExpressionOperand } from "../../source-navigation/ast.js";
import { isSourceCallableSignatureDeclaration } from "../../source-navigation/callable-boundaries.js";
import { sourceArrayElementType } from "../array-types.js";
import { sourceLiteralToken } from "../literal-token.js";
import type { SourceLiteralValue } from "../literal-values-model.js";
import { createSourceTypeFlowAnalysisContext, sourceTypeFlowCallResultType, sourceTypeFlowNumericLiteralKind, sourceTypeFlowTypeParameters } from "./defaults.js";
import { collectSourceTypeFlowEdges, isWriteTarget, sourceTypeFlowDeclaredPatternBindings, sourceTypeFlowDescriptorPart, sourceTypeFlowObjectLiteralReceiver } from "./edges.js";
import { createSourceTypeFlowRefusal } from "./refusals.js";
import { collectSourceTypeFlowSignatures } from "./signatures.js";
import { createSourceTypeFlowTerms, freezeSourceTypeDescriptor, isSourceTypeFlowDeclaredConstruction, sourceTypeDescriptorDepth, sourceTypeDescriptorsEqual, sourceTypeDescriptorStructure, sourceTypeDescriptorUnion, substituteSourceTypeDescriptor } from "./terms.js";
import { collectSourceTypeFlowUses } from "./uses.js";
import { publishSourceLiteralMetadata, sourceLiteralMemberCorrespondence } from "./literal-publication.js";
import { sourceTypeFlowCallableReturns } from "./callable-returns.js";
import { sourceTypeFlowAssignmentPattern, sourceTypeFlowDiscardedSelection, sourceTypeFlowDiscardedValue } from "./value-syntax.js";
import { sourceTypeDescriptorMemberOriginsEqual } from "./member-origins.js";
import type { SourceFileSemantics, SourceTypeComponentEvidence } from "../types.js";
import { sourceTypeFlowAwaitedPayload } from "./awaited.js";
import { sourceTypeFlowScalarCalculationArm, type SourceTypeFlowScalarCalculationArm } from "./construction-slots.js";
import {
  decideSourcePrimitiveBinaryOperator, decideSourcePrimitiveUnaryOperator, sourcePrimitiveBinaryOperators,
  sourcePrimitiveOperatorIsIntegral, sourcePrimitiveOperatorLiteralFits, type SourcePrimitiveOperatorOperand, type SourcePrimitiveUnaryOperator,
} from "./operator-decisions.js";
import type {
  SourceEffectiveCallInstantiation, SourceEffectiveTypeOutcome, SourceEffectiveTypes, SourceTypeDescriptor, SourceLiteralMemberCorrespondence,
  SourceTypeFlowAssociation, SourceTypeFlowDerived, SourceTypeFlowGraph, SourceTypeFlowNode,
  SourceTypeFlowObligation, SourceTypeFlowPathPart, SourceTypeFlowRefusal, SourceTypeFlowSignature, SourceTypeFlowSource,
  SourceTypeFlowTerm, SourceTypeFlowUse, SourceTypeFlowVariable,
} from "./types.js";

interface Fill {
  readonly type: SourceTypeDescriptor;
  readonly site: Node;
  readonly fixed: boolean;
  readonly authority: "inferred" | "declared";
  readonly component?: SourceTypeComponentEvidence;
}

interface Group {
  readonly variable: SourceTypeFlowVariable;
  readonly nodes: readonly SourceTypeFlowNode[];
  readonly terms: readonly SourceTypeFlowTerm[];
  readonly fills: Fill[];
  readonly constructions: readonly Fill[];
  readonly signatures: SourceTypeFlowSignature[];
  readonly derived: SourceTypeFlowDerived[];
  readonly dependencies: Set<Group>;
  readonly dependents: Set<Group>;
  readonly pendingRefusals: SourceTypeFlowRefusal[];
  readonly inference: boolean;
  refused?: SourceTypeFlowRefusal;
  type?: SourceTypeDescriptor;
  filledBy?: Node;
  chosenFill?: Fill;
  defaulted: boolean;
  solved: boolean;
}

interface SourceReadProjection {
  readonly source: Group;
  readonly origin: Node;
  readonly site: Node;
  readonly path: readonly SourceTypeFlowPathPart[];
  readonly construction: boolean;
}

export function analyzeSourceEffectiveTypes(source: SourceTypeFlowSource): SourceEffectiveTypes {
  const defaults = createSourceTypeFlowAnalysisContext(source);
  const { context } = defaults;
  const compare = (left: Node, right: Node): number => {
    const first = context.order(left);
    const second = context.order(right);
    return first.start - second.start || first.preorder - second.preorder;
  };
  const collected = collectSourceTypeFlowEdges(context);
  const graph: SourceTypeFlowGraph = { ...collected,
    links: [...collected.links].sort((left, right) => compare(left.site, right.site)) };
  const uses = [...collectSourceTypeFlowUses(context, graph)].sort((left, right) => compare(left.site, right.site));
  const terms = createSourceTypeFlowTerms(source.ast, graph);
  const signatures = collectSourceTypeFlowSignatures(context, graph, terms.isInference);
  const groups = new Map<SourceTypeFlowVariable, Group>();
  const structuredGroups = new Set<Group>();
  const outcomes = new WeakMap<Node, SourceEffectiveTypeOutcome>();
  const calls = new WeakMap<Node, SourceEffectiveCallInstantiation>();
  const callableReturns = new WeakMap<Node, SourceEffectiveTypeOutcome>();
  const callableQueries = new WeakMap<Node, SourceFileSemantics>();
  const activeReturns = new Set<Node>();
  const obligations: SourceTypeFlowObligation[] = [];
  const compoundCalculationTypes = new WeakMap<Node, SourceTypeDescriptor>();
  const scalarCalculations = new WeakMap<Node, SourceTypeDescriptor | SourceTypeFlowRefusal>();
  const directGraphRefusals: SourceTypeFlowRefusal[] = [];
  const domainValues = new Set(defaults.values);
  const retainedVariables = new WeakMap<Node, SourceTypeFlowVariable>();
  const valueVariables = new WeakMap<Node, SourceTypeFlowVariable>();
  const records = new WeakMap<Node, SourceTypeFlowNode>();
  const bodyCallResults = new Map<Group, { readonly declaration: Node; readonly call: SourceTypeFlowGraph["calls"][number];
    readonly returned: readonly SourceTypeFlowVariable[]; readonly missing?: Node }>();
  for (const node of graph.nodes) if (node.kind !== "binder" && node.variable.path.length === 0) {
    retainedVariables.set(node.node, node.variable);
    if (!node.publish) continue;
    valueVariables.set(node.node, node.variable);
    records.set(node.node, node);
  }
  for (const derived of graph.derived) valueVariables.set(derived.node, derived.result);

  function group(variable: SourceTypeFlowVariable): Group {
    const selected = terms.group(variable);
    let result = groups.get(selected.variable);
    if (result === undefined) {
      const declared = selected.nodes.filter(node => node.declaredType !== undefined || isSourceTypeFlowDeclaredConstruction(node));
      const constructions = declared.flatMap(node => {
        const component = node.association?.component;
        const type = node.declaredType ?? (component === undefined ? undefined : context.describe(node.node, component));
        return type === undefined ? [] : [{ type, site: node.node, fixed: true,
          authority: defaults.declaredSlots.get(node.node)?.authority ?? (component?.authoredTypeNode !== undefined ||
            component?.declaration !== undefined && source.ast.typeNode(component.declaration) !== undefined ? "declared" : "inferred"),
          ...(component === undefined ? {} : { component }) }];
      });
      result = { variable: selected.variable, nodes: selected.nodes, terms: selected.terms,
        fills: [], constructions, signatures: [], derived: [], dependencies: new Set(), dependents: new Set(),
        pendingRefusals: [], inference: terms.isInference(variable),
        ...(terms.isInference(variable) && selected.refusals[0] !== undefined ? { refused: selected.refusals[0] } : {}),
        defaulted: false, solved: false };
      groups.set(selected.variable, result);
    }
    return result;
  }
  function declaredRecord(node: Node): SourceTypeFlowNode | undefined {
    const record = records.get(node);
    return record !== undefined && (record.term?.kind === "fixed" || record.kind === "fixed" ||
      record.declaration !== undefined && source.ast.typeNode(record.declaration) !== undefined) ? record : undefined;
  }
  function declaredDescriptor(record: SourceTypeFlowNode): SourceTypeDescriptor | undefined {
    const selected = group(record.variable);
    if (bodyCallResults.has(selected) && record.declaredType === undefined &&
      source.ast.typeNode(record.declaration ?? record.node) === undefined) return selected.type;
    const construction = selected.constructions.find(fill => fill.site === record.node);
    if (construction?.authority === "inferred" && selected.chosenFill?.authority === "declared") return selected.chosenFill.type;
    const declaration = record.declaration ?? record.association?.component?.declaration;
    if (record.term?.kind === "fixed" && selected.chosenFill?.authority === "declared" && !selected.chosenFill.fixed &&
      record.association?.component?.authoredTypeNode === undefined && (declaration === undefined || source.ast.typeNode(declaration) === undefined) &&
      selected.constructions.some(fill => fill.authority === "inferred" && fill.site === record.term?.site &&
        source.ast.is.IsArrayLiteralExpression(fill.site))) {
      return selected.chosenFill.type;
    }
    if (record.declaredType !== undefined) return record.declaredType;
    if (isSourceTypeFlowDeclaredConstruction(record)) {
      return construction?.type;
    }
    return record.term?.kind === "fixed" ? record.term.type : context.describe(record.node, record.association?.component);
  }
  for (const selected of terms.groups()) group(selected.variable);
  for (const call of graph.calls) {
    if (call.result === undefined || !source.ast.is.IsCallExpression(call.node)) continue;
    const queries = source.semantics.forNode(call.node);
    const declaration = queries.declarations.signatureDeclaration(call.source.selectedSignature);
    if (declaration === undefined || source.ast.body(declaration) === undefined || source.ast.typeNode(declaration) !== undefined) continue;
    const returned = sourceTypeFlowCallableReturns(source.ast, declaration).returned;
    const variables = returned.map(node => retainedVariables.get(node));
    const missing = returned.find((_, index) => variables[index] === undefined);
    callableQueries.set(declaration, queries);
    bodyCallResults.set(group(call.result), { declaration, call,
      returned: variables.filter((variable): variable is SourceTypeFlowVariable => variable !== undefined),
      ...(missing === undefined ? {} : { missing }) });
  }
  const receiverProjections = new Map<Group, SourceReadProjection[]>();
  const variables = new Set([...graph.nodes.map(record => record.variable),
    ...graph.links.flatMap(link => [link.source, link.target])]);
  function retainReceiverProjection(variable: SourceTypeFlowVariable, projection: SourceReadProjection): void {
    const selected = group(variable);
    let projections = receiverProjections.get(selected);
    if (projections === undefined) receiverProjections.set(selected, projections = []);
    if (!projections.some(previous => previous.source === projection.source && previous.construction === projection.construction &&
      previous.path.length === projection.path.length && previous.path.every((part, index) => part === projection.path[index]))) {
      projections.push(projection);
    }
  }
  for (const variable of variables) {
    const literal = sourceTypeFlowObjectLiteralReceiver(source.ast, variable.node);
    if (literal === undefined) continue;
    const owner = valueVariables.get(literal);
    if (owner === undefined) throw new Error("An object-literal receiver requires its original retained construction group.");
    retainReceiverProjection(variable, { source: group(owner), origin: literal, site: variable.node, path: variable.path, construction: true });
  }
  for (const record of graph.nodes) {
    if (record.kind !== "read" || record.declaration === undefined || record.variable.path.length !== 0 ||
      !source.ast.is.IsIdentifier(record.node) || !(source.ast.is.IsFunctionDeclaration(record.root) ||
        (source.ast.is.IsArrowFunction(record.root) || source.ast.is.IsFunctionExpression(record.root)) &&
          source.navigation.expressionResultDisposition(record.root).kind === "discarded")) continue;
    const declaration = records.get(record.declaration);
    const owner = valueVariables.get(record.declaration);
    if (declaration === undefined || owner === undefined || declaration.root === record.root) continue;
    retainReceiverProjection(record.variable, { source: group(owner), origin: record.declaration,
      site: record.node, path: record.variable.path, construction: false });
  }
  const projectedVariables = [...variables].filter(variable => variable.path.length > 0 &&
    sourceTypeFlowObjectLiteralReceiver(source.ast, variable.node) === undefined);
  for (let index = 0; index < projectedVariables.length;) {
    const variable = projectedVariables[index]!;
    const base = valueVariables.get(variable.node);
    const baseGroup = base === undefined ? undefined : group(base);
    const declaredMember = variable.path[0]?.kind === "member" && variable.path.every(part => part.kind !== "binder") &&
      baseGroup?.terms.some(term => term.kind === "declared" ||
        term.kind === "fixed" && term.type.kind === "declared") &&
      group(variable) !== baseGroup;
    const origin = baseGroup === undefined ? undefined : receiverProjections.get(baseGroup)?.[0]?.origin ??
      bodyCallResults.get(baseGroup)?.call.node ?? (declaredMember ? variable.node : undefined);
    if (baseGroup === undefined || origin === undefined) { index += 1; continue; }
    retainReceiverProjection(variable, { source: baseGroup, origin,
      site: variable.node, path: variable.path, construction: false });
    projectedVariables.splice(index, 1);
    index = 0;
  }
  for (const use of uses) group(use.variable);
  for (const use of uses) if (use.kind === "write" && use.valueVariable !== undefined) group(use.valueVariable);
  for (const use of uses) if (use.kind === "refused") {
    const selected = group(use.variable);
    const construction = records.get(use.refusal.site);
    if (construction !== undefined && (source.ast.is.IsArrayLiteralExpression(construction.node) ||
      source.ast.is.IsObjectLiteralExpression(construction.node)) && group(construction.variable) === selected) {
      selected.refused ??= use.refusal;
    } else if (selected.inference) selected.pendingRefusals.push(use.refusal);
  }
  for (const signature of signatures) if (group(signature.variable).inference) group(signature.variable).signatures.push(signature);
  for (const derived of graph.derived) group(derived.result).derived.push(derived);
  const owners = new WeakMap<Node, Set<Group>>();
  for (const node of graph.nodes) {
    let selected = owners.get(node.node);
    if (selected === undefined) owners.set(node.node, selected = new Set());
    selected.add(group(node.variable));
  }
  function inferenceOwner(node: Node | undefined): Group | undefined {
    for (let current = node; current !== undefined; current = source.ast.parent(current)) {
      const selected = [...(owners.get(current) ?? [])].find(owner => owner.inference);
      if (selected !== undefined) return selected;
      if (graph.roots.includes(current)) break;
    }
    return undefined;
  }
  const graphRefusalOwners = new Map<SourceTypeFlowRefusal, Group>();
  for (const issue of graph.refusals) {
    const construction = records.get(issue.site);
    if (construction?.declaredSlotRefusal === issue) {
      group(construction.variable).refused = issue;
      continue;
    }
    const owner = inferenceOwner(issue.site) ?? inferenceOwner(issue.related);
    if (owner === undefined && !valueVariables.has(issue.site) && domainValues.has(issue.site)) {
      outcomes.set(issue.site, issue);
      directGraphRefusals.push(issue);
    }
    if (owner !== undefined) {
      graphRefusalOwners.set(issue, owner);
      owner.pendingRefusals.push(issue);
    }
  }

  function refuse(selected: Group, code: SourceTypeFlowRefusal["code"], site: Node, related?: Node): void {
    if (selected.inference && selected.refused === undefined) {
      selected.refused = createSourceTypeFlowRefusal(code, site, related);
    }
  }
  function children(term: SourceTypeFlowTerm): readonly SourceTypeFlowVariable[] {
    return term.kind === "array" ? [term.element] : term.kind === "optional" ? [term.value]
      : term.kind === "tuple" ? term.elements.map(element => element.variable) : term.kind === "shape" ? term.members.map(member => member.variable)
      : term.kind === "declared" ? term.typeArguments : [];
  }
  const interfaceChecks = new Map<Group, { readonly type: SourceTypeDescriptor; readonly site: Node }>();
  for (const use of uses) if (use.kind === "check" && use.check === "interface") {
    const selected = group(use.variable);
    const prior = interfaceChecks.get(selected);
    if (prior === undefined) interfaceChecks.set(selected, { type: use.type, site: use.site });
    else if (selected.inference && !sourceTypeDescriptorsEqual(prior.type, use.type)) {
      selected.pendingRefusals.push(createSourceTypeFlowRefusal("TSONIC_LOCAL_TYPE_CONFLICT", use.site, prior.site));
    }
  }
  function member(type: SourceTypeDescriptor, name: string): SourceTypeDescriptor | undefined {
    const selected = sourceTypeDescriptorStructure(type);
    return selected.kind === "shape"
      ? selected.members.find(member => member.name === name)?.type ?? selected.indexes.find(index => index.key.kind === "string")?.value
      : undefined;
  }
  const pendingFills: { readonly variable: SourceTypeFlowVariable; readonly fill: Fill }[] = [];
  const initialFills = new Map<Group, Fill[]>();
  function inferredLiteralStorage(selected: Group, fill: Fill): boolean {
    if (fill.authority !== "inferred" || !selected.constructions.includes(fill) ||
      !selected.terms.some(term => term.kind === "numeric" && term.site === fill.site)) return false;
    const type = sourceTypeDescriptorStructure(fill.type);
    return type.kind === "union" || type.kind === "optional" || type.kind === "intrinsic" &&
      (type.intrinsic === "unknown" || type.intrinsic === "object" || type.intrinsic === "any");
  }
  function unboundNumericLiteral(variable: SourceTypeFlowVariable, fill?: Fill): SourceLiteralValue | undefined {
    const selected = group(variable);
    const literal = context.literal(variable.node);
    return literal !== undefined && selected.filledBy === undefined && selected.fills.every(fill => inferredLiteralStorage(selected, fill)) &&
      selected.constructions.every(fill => inferredLiteralStorage(selected, fill)) &&
      selected.terms.some(term => term.kind === "numeric") && !selected.terms.some(term => term.kind === "fixed") &&
      defaults.declaredSlots.get(variable.node)?.authority !== "declared" &&
      !initialFills.get(selected)?.some(prior => prior !== fill && !inferredLiteralStorage(selected, prior))
      ? literal : undefined;
  }

  function numericCreation(node: Node): { readonly site: Node; readonly literal: SourceLiteralValue | undefined } {
    let occurrence = node;
    let site = node;
    let literal = context.literal(node);
    for (let parent = source.ast.parent(occurrence); parent !== undefined; parent = source.ast.parent(occurrence)) {
      if (source.ast.is.IsParenthesizedExpression(parent) && source.ast.as.AsParenthesizedExpression(parent)?.Expression === occurrence) {
        site = parent;
        literal = context.literal(parent) ?? literal;
        occurrence = parent;
      } else if (source.ast.is.IsPrefixUnaryExpression(parent) &&
        (source.ast.operatorKindName(parent) === "KindPlusToken" || source.ast.operatorKindName(parent) === "KindMinusToken") &&
        source.ast.as.AsPrefixUnaryExpression(parent)?.Operand === occurrence) {
        site = parent;
        occurrence = parent;
        literal = context.literal(parent);
      } else break;
    }
    return { site, literal };
  }

  function literalSelectionFits(variable: SourceTypeFlowVariable, primitive: SourcePrimitiveKind, fill: Fill): boolean {
    const pending = [variable];
    const seen = new Set<Group>();
    while (pending.length > 0) {
      const current = pending.pop()!;
      const selected = group(current);
      if (seen.has(selected) || selected.filledBy !== undefined || selected.fills.some(prior => !inferredLiteralStorage(selected, prior)) ||
        selected.constructions.some(prior => !inferredLiteralStorage(selected, prior)) ||
        selected.terms.some(term => term.kind === "fixed") || defaults.declaredSlots.get(current.node)?.authority === "declared" ||
        initialFills.get(selected)?.some(prior => prior !== fill && !inferredLiteralStorage(selected, prior))) return false;
      seen.add(selected);
      const literal = context.literal(current.node);
      if (literal !== undefined && selected.terms.some(term => term.kind === "numeric")) {
        if (!sourcePrimitiveOperatorLiteralFits(literal, primitive)) return false;
      } else if (selected.derived.length > 0 && selected.derived.every(derived => derived.operator === "conditional")) {
        for (const derived of selected.derived) pending.push(...derived.operands);
      } else return false;
    }
    return true;
  }
  for (const selected of groups.values()) {
    for (const fill of selected.constructions) pendingFills.push({ variable: selected.variable, fill });
    for (const term of selected.terms) if (term.kind === "fixed") {
      const slot = defaults.declaredSlots.get(term.site);
      const component = records.get(term.site)?.association?.component;
      const declaration = records.get(term.site)?.declaration ?? source.navigation.sourceReferenceFor(term.site)?.declaration ?? term.site;
      pendingFills.push({ variable: selected.variable, fill: { type: term.type, site: term.site, fixed: true,
        authority: slot?.authority ?? (component?.authoredTypeNode !== undefined || source.ast.typeNode(declaration) !== undefined
          ? "declared" : "inferred") } });
    }
  }
  for (const use of uses) if (use.kind === "fill") {
    const component = use.association?.component;
    pendingFills.push({ variable: use.variable, fill: { type: use.type, site: use.site, fixed: false,
      authority: use.authority === "declared" || component?.authoredTypeNode !== undefined || component?.declaration !== undefined &&
        source.ast.typeNode(component.declaration) !== undefined ? "declared" : "inferred",
      ...(component === undefined ? {} : { component }) } });
  }
  for (const entry of pendingFills) {
    const selected = group(entry.variable);
    let fills = initialFills.get(selected);
    if (fills === undefined) initialFills.set(selected, fills = []);
    fills.push(entry.fill);
  }
  for (let index = 0; index < pendingFills.length; index += 1) {
    const { variable, fill } = pendingFills[index]!;
    const selected = group(variable);
    if (selected.fills.some(prior => prior.site === fill.site && prior.fixed === fill.fixed &&
      sourceTypeDescriptorsEqual(prior.type, fill.type))) continue;
    selected.fills.push(fill);
    if (selected.inference && sourceTypeDescriptorDepth(fill.type) > 4) {
      refuse(selected, "TSONIC_LOCAL_TYPE_LIMIT", fill.site);
      continue;
    }
    const primitive = sourceTypeDescriptorStructure(fill.type);
    if (!fill.fixed && fill.authority === "declared") for (const record of selected.nodes) {
      if (record.term?.kind !== "fixed" || !source.ast.is.IsArrayLiteralExpression(record.node) ||
        defaults.declaredSlots.get(record.node)?.authority === "declared") continue;
      for (const [index, child] of source.ast.elements(record.node).entries()) {
        const variable = child === undefined ? undefined : valueVariables.get(child);
        if (variable === undefined || unboundNumericLiteral(variable, fill) === undefined) continue;
        const type = sourceTypeFlowDescriptorPart(context, record.node, fill.type,
          primitive.kind === "tuple" ? { kind: "tuple", index } : { kind: "element" });
        if (type !== undefined) pendingFills.push({ variable, fill: { type, site: fill.site, fixed: false, authority: fill.authority } });
      }
    }
    if (!fill.fixed && fill.authority === "declared" && primitive.kind === "primitive" && selected.derived.length > 0 &&
      selected.derived.every(derived => derived.operator === "conditional" &&
        derived.operands.every(operand => literalSelectionFits(operand, primitive.primitive, fill)))) {
      for (const derived of selected.derived) for (const variable of derived.operands) pendingFills.push({ variable, fill });
    }
    for (const derived of selected.derived) {
      if (!selected.terms.some(term => term.kind === "numeric" && term.site === derived.node)) continue;
      const literal = context.literal(derived.node);
      const arm = literal !== undefined && (primitive.kind === "union" || primitive.kind === "optional")
        ? sourceTypeFlowScalarCalculationArm(fill.type, literal) : undefined;
      const calculation = primitive.kind === "primitive" ? primitive.primitive : arm?.kind === "resolved" ? arm.primitive : undefined;
      if (calculation === undefined) continue;
      const spelling = (derived.operator === "positive" || derived.operator === "negate") && derived.operands.length === 1;
      if (derived.operands.every(variable => spelling ? unboundNumericLiteral(variable, fill) !== undefined
        : literalSelectionFits(variable, calculation, fill))) {
        for (const variable of derived.operands) pendingFills.push({ variable,
          fill: spelling || primitive.kind === "primitive" ? fill : { ...fill, type: { kind: "primitive", primitive: calculation } } });
      }
    }
    for (const term of selected.terms) {
      const add = (child: SourceTypeFlowVariable, type: SourceTypeDescriptor | undefined,
        component: SourceTypeComponentEvidence | undefined): void => {
        if (type !== undefined) pendingFills.push({ variable: child, fill: { type, site: fill.site, fixed: fill.fixed, authority: fill.authority,
          ...(component === undefined ? {} : { component }) } });
      };
      const queries = source.semantics.forNode(fill.site);
      if (term.kind === "array" && fill.type.kind === "array") {
        const selectedType = fill.component === undefined ? undefined : sourceArrayElementType(fill.component.selectedType, queries);
        add(term.element, fill.type.element, selectedType === undefined ? undefined : { selectedType });
      } else if (term.kind === "optional" && fill.type.kind === "optional") {
        const members = fill.component === undefined ? [] : queries.types.unionOrIntersectionTypes(fill.component.selectedType)
          .filter(type => !queries.types.isNullish(type));
        add(term.value, fill.type.value, members.length !== 1 ? undefined : { selectedType: members[0]! });
      }
      else if (term.kind === "tuple" && fill.type.kind === "tuple") {
        const members = fill.component === undefined ? [] : queries.types.tupleElementInfos(fill.component.selectedType);
        term.elements.forEach((element, index) => add(element.variable, fill.type.kind === "tuple" ? fill.type.elements[index]?.type : undefined,
          members[index] === undefined ? undefined : { selectedType: members[index]!.type }));
      } else if (term.kind === "declared" && fill.type.kind === "declared" && term.declaration === fill.type.declaration) {
        const bindings = fill.component === undefined ? [] : queries.types.typeArgumentBindings(fill.component.selectedType) ?? [];
        term.typeArguments.forEach((argument, offset) => add(argument, fill.type.kind === "declared" ? fill.type.typeArguments[offset] : undefined,
          bindings[offset] === undefined ? undefined : { selectedType: bindings[offset]!.argumentType, declaration: bindings[offset]!.declaration }));
      } else if (term.kind === "shape" && (fill.type.kind === "shape" || fill.type.kind === "declared")) {
        const properties = fill.component === undefined ? [] : queries.types.propertyInfos(fill.component.selectedType);
        for (const entry of term.members) {
          const produced = group(entry.variable);
          if (source.ast.is.IsObjectLiteralExpression(term.site) && produced.terms.length > 0 &&
            produced.derived.length === 0 && produced.terms.every(term => term.kind === "fixed")) continue;
          const property = properties.find(property => property.name === entry.name);
          add(entry.variable, member(fill.type, entry.name), property === undefined ? undefined : { selectedType: property.type });
        }
      }
    }
  }
  for (const selected of groups.values()) {
    selected.fills.sort((left, right) => compare(left.site, right.site));
    const locals = selected.nodes.filter(node => node.kind === "open-local" || node.kind === "derived-local");
    if (new Set(locals.map(node => node.declaration ?? node.node)).size > 64) {
      refuse(selected, "TSONIC_LOCAL_TYPE_LIMIT", selected.variable.node);
    }
    for (const local of locals) if (source.navigation.declarationUses(local.declaration ?? local.node).length > 1024) {
      refuse(selected, "TSONIC_LOCAL_TYPE_LIMIT", local.node);
    }
    for (const term of selected.terms) for (const child of children(term)) selected.dependencies.add(group(child));
    for (const derived of selected.derived) {
      for (const operand of derived.operands) selected.dependencies.add(group(operand));
      const condition = source.ast.as.AsConditionalExpression(derived.node)?.Condition;
      const variable = condition === undefined ? undefined : retainedVariables.get(condition);
      if (variable !== undefined) selected.dependencies.add(group(variable));
    }
    for (const receiver of receiverProjections.get(selected) ?? []) selected.dependencies.add(receiver.source);
    const body = bodyCallResults.get(selected);
    if (body !== undefined) {
      for (const variable of body.returned) selected.dependencies.add(group(variable));
      for (const binder of [...body.call.receiver, ...body.call.method]) selected.dependencies.add(group(binder.variable));
    }
    selected.dependencies.delete(selected);
  }
  const literalPeers = new Map<Group, { readonly source: Group; readonly variable: SourceTypeFlowVariable;
    readonly site: Node; readonly literal: SourceLiteralValue; readonly present: boolean }[]>();
  for (const derived of graph.derived) {
    if (derived.operands.length !== 2 || !(sourcePrimitiveBinaryOperators.some(operator => operator === derived.operator) ||
      derived.operator === "conditional" || derived.operator === "coalesce")) continue;
    if (derived.operator === "shift-left" || derived.operator === "shift-right" || derived.operator === "shift-right-unsigned") continue;
    for (const [index, variable] of derived.operands.entries()) {
      const literal = unboundNumericLiteral(variable);
      const peer = derived.operands[1 - index]!;
      if (literal === undefined || unboundNumericLiteral(peer) !== undefined) continue;
      const sourceGroup = group(peer);
      const pending = [variable];
      const seen = new Set<Group>();
      while (pending.length > 0) {
        const current = pending.pop()!;
        const selected = group(current);
        if (seen.has(selected) || unboundNumericLiteral(current) === undefined || selected === sourceGroup) continue;
        seen.add(selected);
        const dependencies = [sourceGroup];
        const visited = new Set<Group>();
        while (dependencies.length > 0) {
          const dependency = dependencies.pop()!;
          if (visited.has(dependency)) continue;
          visited.add(dependency);
          dependencies.push(...dependency.dependencies);
        }
        if (visited.has(selected)) continue;
        selected.dependencies.add(sourceGroup);
        let peers = literalPeers.get(selected);
        if (peers === undefined) literalPeers.set(selected, peers = []);
        peers.push({ source: sourceGroup, variable: current, site: peer.node, literal,
          present: derived.operator === "coalesce" && index === 1 });
        for (const operation of selected.derived) if (selected.terms.some(term => term.kind === "numeric" && term.site === operation.node)) {
          pending.push(...operation.operands);
        }
      }
    }
  }
  for (const selected of groups.values()) for (const dependency of selected.dependencies) dependency.dependents.add(selected);

  function validate(selected: Group): void {
    if (selected.type === undefined) return;
    if (selected.type.kind === "shape" && selected.type.members.length === 0 && selected.fills.every(fill => fill.fixed) &&
      selected.nodes.every(node => node.declaration === undefined || source.ast.typeNode(node.declaration) === undefined) &&
      selected.nodes.some(node => node.initializer !== undefined && source.ast.is.IsObjectLiteralExpression(node.initializer) ||
        source.ast.is.IsObjectLiteralExpression(node.node))) {
      const literal = selected.nodes.find(node => source.ast.is.IsObjectLiteralExpression(node.node));
      refuse(selected, "TSONIC_UNTYPED_OBJECT_LITERAL", literal?.node ?? selected.variable.node);
    }
    const fixed = selected.fills.filter(fill => fill.fixed && !inferredLiteralStorage(selected, fill));
    if (fixed.length > 1 && fixed.some(fill => !sourceTypeDescriptorsEqual(fixed[0]!.type, fill.type))) {
      const array = arrayConstruction(selected);
      refuse(selected, array === undefined ? "TSONIC_LOCAL_TYPE_CONFLICT" : "TSONIC_LOCAL_TYPE_MIXED_ELEMENTS",
        array?.node ?? fixed[1]!.site, fixed[0]!.site);
      return;
    }
    for (const fill of selected.fills) {
      if (inferredLiteralStorage(selected, fill)) continue;
      if (!sourceTypeDescriptorsEqual(selected.type, fill.type)) {
        refuse(selected, selected.signatures.length > 0 ? "TSONIC_LOCAL_TYPE_SIGNATURE" : "TSONIC_LOCAL_TYPE_CONFLICT",
          fill.site, selected.filledBy ?? selected.signatures[0]?.site);
      } else if (fill.authority === "declared" && !fill.fixed && selected.chosenFill?.authority !== "declared") {
        selected.chosenFill = fill;
      }
    }
    for (const literal of selected.nodes.filter(node => source.ast.is.IsObjectLiteralExpression(node.node))) {
      const chosen = new Map<Node, { readonly origin: SourceLiteralMemberCorrespondence["origin"]; readonly site: Node }>();
      for (const fill of selected.fills) {
        if (fill.fixed || fill.component === undefined) continue;
        for (const pair of sourceLiteralMemberCorrespondence(context, literal.node, fill.type, fill.component) ?? []) {
          const previous = chosen.get(pair.property);
          if (previous !== undefined && !sourceTypeDescriptorMemberOriginsEqual(previous.origin, pair.origin)) {
            refuse(selected, "TSONIC_LOCAL_TYPE_CONFLICT", fill.site, previous.site);
          } else chosen.set(pair.property, { origin: pair.origin, site: fill.site });
        }
      }
    }
  }
  function arrayConstruction(selected: Group): SourceTypeFlowNode | undefined {
    return graph.nodes.find(node => node.term?.kind === "array" &&
      source.ast.is.IsArrayLiteralExpression(node.node) && group(node.term.element) === selected);
  }
  function constructed(selected: Group): SourceTypeDescriptor | undefined {
    for (const term of selected.terms) {
      if (term.kind === "array") {
        const element = group(term.element).type;
        if (element !== undefined) return { kind: "array", readonly: term.readonly, element };
        if (source.ast.is.IsArrayLiteralExpression(term.site)) {
          refuse(selected, "TSONIC_UNTYPED_ARRAY_LITERAL", term.site);
        }
      } else if (term.kind === "optional") {
        const value = group(term.value).type;
        if (value !== undefined) return { kind: "optional", value };
      } else if (term.kind === "tuple") {
        const elements = [];
        for (const element of term.elements) {
          const type = group(element.variable).type;
          if (type === undefined) return undefined;
          elements.push({ kind: element.kind, type, ...(element.declaration === undefined ? {} : { declaration: element.declaration }) });
        }
        return { kind: "tuple", readonly: term.readonly, elements };
      } else if (term.kind === "declared") {
        const arguments_: SourceTypeDescriptor[] = [];
        for (const argument of term.typeArguments) {
          const value = group(argument).type;
          if (value === undefined) return undefined;
          arguments_.push(value);
        }
        const queries = source.semantics.forNode(term.site);
        const declaredType = term.source?.selectedType ?? queries.declarations.declaredType(term.declaration);
        if (declaredType !== undefined) {
          const call = graph.calls.find(call => call.node === term.site);
          const substitutions = [...(call === undefined ? [] : [...call.receiver, ...call.method])].flatMap(binder => {
            const selected = group(binder.variable);
            return selected.type === undefined ? [] : [{ declaration: binder.declaration, type: selected.type }];
          });
          const parameters = queries.types.typeArgumentBindings(declaredType)?.map(binding => binding.declaration) ??
            sourceTypeFlowTypeParameters(source.ast, term.declaration);
          parameters.forEach((declaration, index) => {
            if (declaration !== undefined && arguments_[index] !== undefined) substitutions.push({ declaration, type: arguments_[index]! });
          });
          return context.describe(term.site, term.source ?? { selectedType: declaredType, declaration: term.declaration }, substitutions);
        }
        return undefined;
      } else if (term.kind === "shape") {
        if (term.members.length === 0 && source.ast.is.IsObjectLiteralExpression(term.site)) {
          refuse(selected, "TSONIC_UNTYPED_OBJECT_LITERAL", term.site);
          continue;
        }
        const members = [];
        for (const entry of term.members) {
          const type = group(entry.variable).type;
          if (type === undefined) return undefined;
          if (entry.declaration === undefined) throw new Error("A constructed Source member requires its actual authored declaration.");
          members.push({ name: entry.name, optional: entry.optional, type,
            origin: { kind: "declared" as const, declaration: entry.declaration },
            ...(entry.readonly === undefined ? {} : { readonly: entry.readonly }) });
        }
        return { kind: "shape", members, indexes: [], calls: [], constructs: [] };
      }
    }
    return undefined;
  }

  function derivedType(derived: SourceTypeFlowDerived): SourceTypeDescriptor | undefined {
    const operands = derived.operands.map(operand => group(operand));
    const types = operands.map(operand => operand.type);
    if (types.some(type => type === undefined)) return undefined;
    const token = source.ast.operatorKindName(derived.node);
    const update = token === "KindPlusPlusToken" ? "increment" : token === "KindMinusMinusToken" ? "decrement" : undefined;
    if (derived.operator === "await") {
      const operand = derived.operands[0];
      return operand === undefined || types.length !== 1 ? undefined
        : sourceTypeFlowAwaitedPayload(source.semantics.forNode(operand.node), operand.node, types[0]);
    }
    if (derived.operator === "identity" && update === undefined) return types[0];
    if (derived.operator === "sequence") return types[types.length - 1];
    if (derived.operator === "conditional") {
      const condition = source.ast.as.AsConditionalExpression(derived.node)?.Condition;
      const variable = condition === undefined ? undefined : retainedVariables.get(condition);
      const type = variable === undefined ? undefined : group(variable).type;
      const structure = type === undefined ? undefined : sourceTypeDescriptorStructure(type);
      if (structure?.kind !== "primitive" || structure.primitive !== "bool") {
        return operatorRefusal(derived, "A conditional operator requires an exact bool condition.");
      }
      return sourceTypeDescriptorUnion(partneredArms(derived.operands, types.filter((type): type is SourceTypeDescriptor => type !== undefined)));
    }
    if (derived.operator === "logical-and" || derived.operator === "logical-or") {
      const primitives = types.map(type => type === undefined ? undefined : sourceTypeDescriptorStructure(type));
      return primitives.length === 2 && primitives.every(type => type?.kind === "primitive" && type.primitive === "bool")
        ? binaryResult(derived, { kind: "primitive", primitive: "bool" })
        : operatorRefusal(derived, "A logical operator requires exact bool operands.");
    }
    if (derived.operator === "coalesce") {
      const left = types[0] === undefined ? undefined : sourceTypeDescriptorStructure(types[0]);
      const right = types[1];
      if (right === undefined) return undefined;
      if (left === undefined || left.kind === "primitive") {
        return operatorRefusal(derived, "A coalescing operator requires a nullable or runtime-union left operand.");
      }
      const present = left.kind === "optional" ? left.value : left.kind === "intrinsic" && left.intrinsic === "absence" ? undefined : types[0];
      const result = present === undefined ? right : sourceTypeDescriptorUnion(partneredArms(derived.operands, [present, right]));
      return result === undefined ? undefined : binaryResult(derived, result);
    }
    const unary: SourcePrimitiveUnaryOperator | undefined = update ?? (derived.operator === "positive" || derived.operator === "negate" ||
      derived.operator === "bit-not" || derived.operator === "logical-not" ? derived.operator : undefined);
    if (unary !== undefined) {
      const operand = types[0] === undefined ? undefined : sourceTypeDescriptorStructure(types[0]);
      if (types.length === 1 && operand?.kind === "intrinsic" && operand.intrinsic === "bigint") {
        return unary === "negate" || unary === "bit-not" || unary === "increment" || unary === "decrement"
          ? update === undefined ? { kind: "intrinsic", intrinsic: "bigint" } : producedOperandType(derived.operands[0]!)
          : operatorRefusal(derived, "This unary operator has no admitted bigint result.");
      }
      let primitive = operand?.kind === "primitive" ? operand.primitive : undefined;
      const literal = context.literal(derived.node);
      const selected = group(derived.result);
      if ((unary === "positive" || unary === "negate") && literal !== undefined &&
        selected.terms.some(term => term.kind === "numeric" && term.site === derived.node)) {
        const expected = expectedOperatorKind(selected, derived.node);
        const arm = literalDestinationArm(derived);
        if (expected !== undefined) primitive = expected;
        else if (arm !== undefined) {
          if (arm.kind === "unfitted") return operatorRefusal(derived, "The numeric literal fits no primitive destination arm.");
          primitive = arm.primitive;
        } else {
          const creation = numericCreation(derived.node);
          const own = sourceTypeFlowNumericLiteralKind(creation.literal ?? literal);
          if (own.kind === "refused") {
            selected.refused ??= defaults.numericCreationRefusal(creation.site, own.reason);
            return undefined;
          }
          primitive = own.primitive;
        }
      } else if (operand?.kind === "union") return unionOperandRefusal(derived, operand);
      if (types.length !== 1 || primitive === undefined) return operatorRefusal(derived, "A unary operator requires one exact primitive operand.");
      const decision = decideSourcePrimitiveUnaryOperator(unary, primitive);
      return decision.kind === "refused" ? operatorRefusal(derived, decision.reason)
        : update !== undefined ? producedOperandType(derived.operands[0]!) : { kind: "primitive", primitive: decision.result };
    }
    const comparison = ["less", "less-equal", "greater", "greater-equal", "equal", "not-equal"].includes(derived.operator);
    const structures = types.map(type => type === undefined ? undefined : sourceTypeDescriptorStructure(type));
    const bigints = structures.map(type => type?.kind === "intrinsic" && type.intrinsic === "bigint");
    if (bigints.length === 2 && bigints.every(value => value)) {
      if (comparison) return { kind: "primitive", primitive: "bool" };
      if (["add", "subtract", "multiply", "divide", "remainder", "bit-and", "bit-or", "bit-xor"].includes(derived.operator)) {
        return binaryResult(derived, { kind: "intrinsic", intrinsic: "bigint" });
      }
      return operatorRefusal(derived, derived.operator === "power" ? "Exponentiation has no admitted native operator result."
        : "This binary operator has no admitted bigint result.");
    }
    const binary = sourcePrimitiveBinaryOperators.find(operator => operator === derived.operator);
    if (binary !== undefined) {
      const left = derived.operands[0] === undefined ? undefined : primitiveOperand(derived.operands[0]);
      const right = derived.operands[1] === undefined ? undefined : primitiveOperand(derived.operands[1]);
      if (derived.operands.length === 2 && left !== undefined && right !== undefined) {
        const selected = group(derived.result);
        const arm = literalDestinationArm(derived);
        const expected = expectedOperatorKind(selected, derived.node);
        const decision = decideSourcePrimitiveBinaryOperator(binary, left, right,
          expected ?? (arm?.kind === "resolved" ? arm.primitive : undefined));
        if (decision.kind === "refused") return operatorRefusal(derived, decision.reason);
        if (arm?.kind === "unfitted") return operatorRefusal(derived, "The numeric literal fits no primitive destination arm.");
        const folded = selected.terms.find((term): term is Extract<SourceTypeFlowTerm, { kind: "numeric" }> =>
          term.kind === "numeric" && term.site === derived.node);
        if (folded !== undefined && expected === undefined && arm?.kind !== "resolved") {
          const creation = numericCreation(derived.node);
          const own = sourceTypeFlowNumericLiteralKind(creation.literal ?? folded.literal);
          if (own.kind === "refused") {
            selected.refused ??= defaults.numericCreationRefusal(creation.site, own.reason);
            return undefined;
          }
        }
        const primitive = folded === undefined ? decision.result : expected ?? (arm?.kind === "resolved" ? arm.primitive : decision.result);
        return binaryResult(derived, { kind: "primitive", primitive });
      }
      if (binary === "power") return operatorRefusal(derived, "Exponentiation has no admitted native operator result.");
      const union = structures.find((type): type is Extract<SourceTypeDescriptor, { kind: "union" }> => type?.kind === "union");
      if (union !== undefined && binary !== "equal" && binary !== "not-equal") return unionOperandRefusal(derived, union);
    }
    if ((derived.operator === "equal" || derived.operator === "not-equal") && types.some(type => type !== undefined && bigintOperand(type))) {
      return types.every(type => type !== undefined && bigintEqualityOperand(type)) ? { kind: "primitive", primitive: "bool" }
        : operatorRefusal(derived, "Bigint equality requires bigint, absence or a native-integral operand.");
    }
    if (bigints.some(value => value) && !structures.some(type => type?.kind === "string")) {
      return operatorRefusal(derived, "A bigint operand requires the same exact bigint domain or an admitted primitive literal partner.");
    }
    if (comparison) return { kind: "primitive", primitive: "bool" };
    if (derived.operator === "add" && structures.some(type => type?.kind === "intrinsic" && type.intrinsic === "any")) {
      return binaryResult(derived, { kind: "intrinsic", intrinsic: "any" });
    }
    if (derived.operator === "add" && types.some(type => type !== undefined && sourceTypeDescriptorStructure(type).kind === "string")) {
      return binaryResult(derived, { kind: "string" });
    }
    return undefined;
  }

  function binaryResult(derived: SourceTypeFlowDerived, calculation: SourceTypeDescriptor): SourceTypeDescriptor | undefined {
    const target = source.ast.as.AsBinaryExpression(derived.node)?.Left;
    if (target === undefined || !isWriteTarget(source.ast, target)) return calculation;
    compoundCalculationTypes.set(derived.node, calculation);
    return derived.operands[0] === undefined ? undefined : producedOperandType(derived.operands[0]);
  }

  function bigintOperand(type: SourceTypeDescriptor): boolean {
    const structure = sourceTypeDescriptorStructure(type);
    return structure.kind === "optional" ? bigintOperand(structure.value) : structure.kind === "intrinsic" && structure.intrinsic === "bigint";
  }

  function bigintEqualityOperand(type: SourceTypeDescriptor): boolean {
    const structure = sourceTypeDescriptorStructure(type);
    return structure.kind === "optional" ? bigintEqualityOperand(structure.value)
      : structure.kind === "union" ? structure.types.every(bigintEqualityOperand)
      : structure.kind === "intrinsic" ? structure.intrinsic === "bigint" || structure.intrinsic === "absence"
        : structure.kind === "primitive" && sourcePrimitiveOperatorIsIntegral(structure.primitive);
  }

  function declaredDestination(selected: Group, site?: Node): Fill | undefined {
    return selected.constructions.find(fill => fill.authority === "declared" && (site === undefined || fill.site === site)) ??
      selected.fills.find(fill => !fill.fixed && fill.authority === "declared");
  }

  function expectedOperatorKind(selected: Group, node: Node): SourcePrimitiveKind | undefined {
    const slot = defaults.declaredSlots.get(node);
    const declared = slot?.authority !== "declared" || slot.type === undefined ? undefined : sourceTypeDescriptorStructure(slot.type);
    if (declared?.kind === "union" || declared?.kind === "optional") return undefined;
    if (declared?.kind === "primitive") return declared.primitive;
    const fill = declaredDestination(selected, node) ??
      selected.fills.find(fill => sourceTypeDescriptorStructure(fill.type).kind === "primitive");
    const type = fill === undefined ? undefined : sourceTypeDescriptorStructure(fill.type);
    return type?.kind === "primitive" ? type.primitive : undefined;
  }

  function literalDestinationArm(derived: SourceTypeFlowDerived): SourceTypeFlowScalarCalculationArm | undefined {
    const selected = group(derived.result);
    if (selected.filledBy !== undefined || expectedOperatorKind(selected, derived.node) !== undefined) return undefined;
    const whole = selected.terms.find((term): term is Extract<SourceTypeFlowTerm, { kind: "numeric" }> =>
      term.kind === "numeric" && term.site === derived.node);
    if (whole === undefined) return undefined;
    const slot = defaults.declaredSlots.get(derived.node);
    const destination = (slot?.authority === "declared" ? slot.type : undefined) ??
      declaredDestination(selected, derived.node)?.type;
    const structure = destination === undefined ? undefined : sourceTypeDescriptorStructure(destination);
    return destination !== undefined && (structure?.kind === "union" || structure?.kind === "optional")
      ? sourceTypeFlowScalarCalculationArm(destination, whole.literal) : undefined;
  }

  function producedOperandType(variable: SourceTypeFlowVariable): SourceTypeDescriptor | undefined {
    const record = variable.path.length === 0 ? declaredRecord(variable.node) : undefined;
    return record === undefined ? group(variable).type : declaredDescriptor(record);
  }

  function primitiveOperand(variable: SourceTypeFlowVariable): SourcePrimitiveOperatorOperand | undefined {
    const selected = group(variable);
    const type = selected.type === undefined ? undefined : sourceTypeDescriptorStructure(selected.type);
    if (type?.kind === "primitive") {
      const literal = unboundNumericLiteral(variable);
      return literal === undefined ? { kind: "fixed", primitive: type.primitive }
        : { kind: "unbound-literal", primitive: type.primitive, literal };
    }
    const literal = context.literal(variable.node);
    return type?.kind === "intrinsic" && type.intrinsic === "bigint" && literal?.form === "bigint" &&
      (selected.filledBy === undefined || selected.filledBy === variable.node) && selected.fills.length > 0 &&
      selected.fills.every(fill => fill.fixed && fill.site === variable.node && fill.authority !== "declared" &&
        fill.type.kind === "intrinsic" && fill.type.intrinsic === "bigint") &&
      defaults.declaredSlots.get(variable.node)?.authority !== "declared"
      ? { kind: "unbound-literal", primitive: "bigint", literal } : undefined;
  }

  function operatorRefusal(derived: SourceTypeFlowDerived, reason: string): undefined {
    group(derived.result).refused ??= Object.freeze({
      ...createSourceTypeFlowRefusal("TSONIC_LOCAL_TYPE_UNSUPPORTED", derived.node), reason,
    });
    return undefined;
  }

  function unionOperandRefusal(derived: SourceTypeFlowDerived, union: Extract<SourceTypeDescriptor, { kind: "union" }>): undefined {
    const operator = source.ast.as.AsBinaryExpression(derived.node)?.OperatorToken;
    const token = operator === undefined ? undefined : sourceLiteralToken(source.ast, operator);
    const name = token?.kind === "authored" ? token.text : derived.operator;
    const arms = union.types.map(type => sourceTypeDescriptorStructure(type)).map(type =>
      type.kind === "primitive" ? type.primitive : type.kind === "intrinsic" ? type.intrinsic : type.kind).join(" | ");
    return operatorRefusal(derived,
      `Operator '${name}' has no admitted result for the union operand '(${arms})'; narrow the operand to one primitive kind first.`);
  }

  // C14 for value-selecting operators (?:, &&, ||, ??): an open integer-literal arm takes the kind of its one
  // non-literal numeric partner arm when it fits that kind, as in arithmetic (`maybe ?? 0` over number is float64).
  function partneredArms(operands: readonly SourceTypeFlowVariable[], arms: readonly SourceTypeDescriptor[]): readonly SourceTypeDescriptor[] {
    if (arms.length !== operands.length) return arms;
    const inputs = operands.map(primitiveOperand);
    const partners = [...new Set(arms.flatMap((arm, index) => inputs[index]?.kind !== "unbound-literal" &&
      arm.kind === "primitive" ? [arm.primitive] : []))];
    if (partners.length !== 1) return arms;
    const partner = partners[0]!;
    return arms.map((arm, index) => {
      const input = inputs[index];
      return input?.kind === "unbound-literal" && arm.kind === "primitive" && sourcePrimitiveOperatorLiteralFits(input.literal, partner)
        ? { kind: "primitive", primitive: partner } as const : arm;
    });
  }

  function solve(selected: Group, accumulator = false): void {
    for (const node of selected.nodes) {
      const refusal = defaults.descriptorRefusals.get(node.node);
      if (refusal !== undefined) { selected.refused = refusal; break; }
    }
    if ((selected.inference || selected.derived.length > 0) && selected.refused === undefined) for (const dependency of selected.dependencies) {
      if (dependency.refused !== undefined) { selected.refused = dependency.refused; break; }
    }
    if (selected.refused !== undefined) { selected.solved = true; return; }
    const body = bodyCallResults.get(selected);
    if (body !== undefined) {
      if (body.missing !== undefined) {
        const missing = defaults.descriptorRefusals.get(body.missing) ?? outcomes.get(body.missing);
        selected.refused = missing?.kind === "refused" ? missing
          : createSourceTypeFlowRefusal("TSONIC_LOCAL_TYPE_UNSUPPORTED", body.missing);
        outcomes.set(body.missing, selected.refused);
        selected.solved = true;
        return;
      }
      const returned = callableReturn(body.declaration);
      if (returned?.kind === "refused") selected.refused = returned;
      else if (returned !== undefined) {
        const bindings = new Map<Node, SourceTypeDescriptor>();
        for (const binder of [...body.call.receiver, ...body.call.method]) {
          const argument = group(binder.variable).type;
          if (argument === undefined) {
            selected.refused = group(binder.variable).refused ??
              createSourceTypeFlowRefusal("TSONIC_LOCAL_TYPE_UNSUPPORTED", body.call.node, binder.declaration);
            break;
          }
          bindings.set(binder.declaration, argument);
        }
        if (selected.refused === undefined) {
          selected.type = freezeSourceTypeDescriptor(sourceTypeFlowCallResultType(source.semantics.forNode(body.call.node), body.call.source,
            substituteSourceTypeDescriptor(returned.type, bindings)));
          structuredGroups.add(selected);
          validate(selected);
        }
      } else selected.refused = createSourceTypeFlowRefusal("TSONIC_LOCAL_TYPE_UNSUPPORTED", body.call.node, body.declaration);
      selected.solved = true;
      return;
    }
    const receivers = receiverProjections.get(selected);
    if (receivers !== undefined) {
      for (const receiver of receivers) {
        if (receiver.source.refused !== undefined) { selected.refused = receiver.source.refused; break; }
        const declaration = receiver.construction ? declaredRecord(receiver.origin) : undefined;
        let type = declaration === undefined ? receiver.source.type : declaredDescriptor(declaration);
        if (receiver.construction && type?.kind === "intrinsic" && (type.intrinsic === "object" || type.intrinsic === "unknown")) {
          const physical = constructed(receiver.source);
          type = physical === undefined ? undefined : freezeSourceTypeDescriptor(physical);
        }
        for (const part of receiver.path) type = type === undefined ? undefined
          : sourceTypeFlowDescriptorPart(context, receiver.site, type, part);
        if (type === undefined) {
          selected.refused = createSourceTypeFlowRefusal("TSONIC_LOCAL_TYPE_UNSUPPORTED", selected.variable.node, receiver.origin);
          break;
        }
        if (selected.type !== undefined && !sourceTypeDescriptorsEqual(selected.type, type)) {
          selected.refused = createSourceTypeFlowRefusal("TSONIC_LOCAL_TYPE_CONFLICT", selected.variable.node, receiver.origin);
          break;
        }
        selected.type = type;
      }
      structuredGroups.add(selected);
      validate(selected);
      selected.solved = true;
      return;
    }
    if (!accumulator && selected.derived.some(derived => derived.operands.some(operand => group(operand) === selected))) {
      refuse(selected, "TSONIC_LOCAL_TYPE_UNSUPPORTED", selected.variable.node);
      selected.solved = true;
      return;
    }
    for (const peer of literalPeers.get(selected) ?? []) {
      const literal = unboundNumericLiteral(peer.variable);
      const produced = peer.source.type === undefined ? undefined : sourceTypeDescriptorStructure(peer.source.type);
      const present = peer.present && produced?.kind === "optional" ? sourceTypeDescriptorStructure(produced.value) : produced;
      const creation = numericCreation(peer.variable.node);
      if (literal === undefined || present?.kind !== "primitive" || !sourcePrimitiveOperatorLiteralFits(peer.literal, present.primitive) ||
        creation.literal === undefined || !sourcePrimitiveOperatorLiteralFits(creation.literal, present.primitive)) continue;
      selected.fills.push({ type: present, site: peer.site, fixed: false,
        authority: peer.source.chosenFill?.authority ?? "inferred" });
    }
    const fixed = selected.fills.filter(fill => fill.fixed);
    const declared = selected.signatures.length > 0;
    const aggregateFill = selected.nodes.some(node => node.term?.kind === "fixed" &&
      (source.ast.is.IsArrayLiteralExpression(node.node) || source.ast.is.IsObjectLiteralExpression(node.node)) &&
      defaults.declaredSlots.get(node.node)?.authority !== "declared")
      ? selected.fills.find(fill => !fill.fixed && fill.authority === "declared") : undefined;
    const retainedStructure = !selected.inference && selected.terms.some(term => term.kind !== "fixed" && term.kind !== "numeric" &&
      !source.ast.is.IsArrayLiteralExpression(term.site) && !source.ast.is.IsObjectLiteralExpression(term.site))
      ? constructed(selected) : undefined;
    if (retainedStructure !== undefined) structuredGroups.add(selected);
    const construction = selected.constructions[0];
    const destination = declaredDestination(selected);
    const destinationType = destination === undefined ? undefined : sourceTypeDescriptorStructure(destination.type);
    const laterScalarStorage = construction === undefined && fixed.length === 0 && selected.terms.length > 0 &&
      (destinationType?.kind === "union" || destinationType?.kind === "optional") &&
      selected.terms.every(term => term.kind === "numeric" && defaults.declaredSlots.get(term.site)?.authority !== "declared");
    const contextualFill = construction?.authority === "inferred" || laterScalarStorage ? destination : undefined;
    const anchor = (construction?.authority === "declared" ? construction : contextualFill ?? aggregateFill ?? construction) ?? (!selected.inference ? fixed[0] ??
      (retainedStructure === undefined ? selected.fills.find(fill => !fill.fixed)
        : { type: retainedStructure, site: selected.variable.node, fixed: true, authority: "inferred" as const })
      : declared ? fixed[0] : selected.fills[0]);
    const scalarStorage = (construction !== undefined || laterScalarStorage) && selected.terms.length > 0 &&
      selected.terms.every(term => term.kind === "numeric" || term.kind === "fixed") &&
      selected.constructions.every(fill => {
        const type = sourceTypeDescriptorStructure(fill.type);
        return type.kind === "union" || type.kind === "optional" || type.kind === "intrinsic" &&
          (type.intrinsic === "unknown" || type.intrinsic === "object" || type.intrinsic === "any");
      });
    if (anchor !== undefined && (selected.derived.length === 0 || accumulator || scalarStorage)) {
      selected.type = anchor.type;
      if (!scalarStorage) selected.filledBy = anchor.site;
      selected.chosenFill = anchor;
    }
    if (scalarStorage) for (const term of selected.terms) {
      if (selected.derived.some(derived => derived.node === term.site)) continue;
      const destination = declaredDestination(selected, term.site) ??
        selected.constructions.find(fill => fill.site === term.site);
      const literal = context.literal(term.site);
      if (destination === undefined || literal === undefined) continue;
      const storage = sourceTypeDescriptorStructure(destination.type);
      if (destination.authority === "declared" && storage.kind === "primitive") {
        scalarCalculations.set(term.site, freezeSourceTypeDescriptor(storage));
      } else if (destination.authority === "declared" && (storage.kind === "union" || storage.kind === "optional")) {
        const creation = numericCreation(term.site);
        if (creation.literal === undefined) continue;
        const arm = sourceTypeFlowScalarCalculationArm(destination.type, creation.literal);
        if (arm.kind === "resolved") scalarCalculations.set(term.site, freezeSourceTypeDescriptor({ kind: "primitive", primitive: arm.primitive }));
      } else if (term.kind === "fixed" && scalarType(term.type)) {
        scalarCalculations.set(term.site, freezeSourceTypeDescriptor(term.type));
      } else if (term.kind === "numeric") {
        const creation = numericCreation(term.site);
        const own = creation.literal === undefined ? undefined : sourceTypeFlowNumericLiteralKind(creation.literal);
        if (own?.kind === "resolved") scalarCalculations.set(term.site, freezeSourceTypeDescriptor({ kind: "primitive", primitive: own.primitive }));
        else {
          const refusal = own?.kind === "refused" ? defaults.numericCreationRefusal(creation.site, own.reason)
            : createSourceTypeFlowRefusal("TSONIC_LOCAL_TYPE_UNSUPPORTED", creation.site);
          scalarCalculations.set(term.site, refusal);
          selected.refused ??= refusal;
        }
      }
    }
    if (selected.type === undefined && (selected.derived.length === 0 || accumulator)) {
      selected.type = constructed(selected);
      if (selected.type === undefined && selected.terms.some(term => term.kind === "numeric")) {
        const kinds = new Set<"int64" | "float64">();
        for (const term of selected.terms) {
          if (term.kind !== "numeric") continue;
          const { site, literal } = numericCreation(term.site);
          if (literal === undefined) {
            selected.refused ??= createSourceTypeFlowRefusal("TSONIC_LOCAL_TYPE_UNSUPPORTED", site);
            break;
          }
          const own = sourceTypeFlowNumericLiteralKind(literal);
          if (own.kind === "refused") {
            selected.refused ??= defaults.numericCreationRefusal(site, own.reason);
            break;
          }
          kinds.add(own.primitive);
        }
        if (selected.refused === undefined && kinds.size > 0) {
          selected.type = { kind: "primitive", primitive: kinds.has("float64") ? "float64" : "int64" };
        }
      }
      selected.defaulted = selected.type !== undefined;
    }
    for (const derived of selected.derived) {
      const type = derivedType(derived);
      if (type === undefined) selected.refused ??= createSourceTypeFlowRefusal(
        accumulator ? "TSONIC_LOCAL_TYPE_ACCUMULATOR" : "TSONIC_LOCAL_TYPE_UNSUPPORTED", derived.node);
      else if (scalarStorage && scalarType(type)) scalarCalculations.set(derived.node, freezeSourceTypeDescriptor(type));
      else if (selected.type !== undefined && !sourceTypeDescriptorsEqual(selected.type, type)) {
        refuse(selected, accumulator ? "TSONIC_LOCAL_TYPE_ACCUMULATOR" : "TSONIC_LOCAL_TYPE_CONFLICT", derived.node);
      } else selected.type = type;
    }
    if (selected.type !== undefined) {
      selected.type = freezeSourceTypeDescriptor(selected.type);
      // B6 depth applies to an open (inferred) group only; declared structure has full depth (C34, C-2269).
      if (selected.inference && sourceTypeDescriptorDepth(selected.type) > 4) refuse(selected, "TSONIC_LOCAL_TYPE_LIMIT", selected.variable.node);
      validate(selected);
    }
    selected.solved = true;
  }
  const remaining = new Map<Group, number>();
  const ready: Group[] = [];
  for (const selected of groups.values()) {
    remaining.set(selected, selected.dependencies.size);
    if (selected.dependencies.size === 0) ready.push(selected);
  }
  while (ready.length > 0) {
    ready.sort((left, right) => compare(left.variable.node, right.variable.node));
    const selected = ready.shift()!;
    const selfDerived = selected.derived.some(derived => derived.operands.some(operand => group(operand) === selected));
    const accumulator = selfDerived && selected.derived.every(derived => derived.accumulator !== undefined && group(derived.accumulator) === selected);
    solve(selected, accumulator);
    selected.solved = true;
    for (const dependent of selected.dependents) {
      const count = remaining.get(dependent)! - 1;
      remaining.set(dependent, count);
      if (count === 0) ready.push(dependent);
    }
  }
  for (const selected of groups.values()) if (!selected.solved) {
    if (selected.derived.length > 0 || receiverProjections.has(selected) || bodyCallResults.has(selected)) {
      selected.refused ??= createSourceTypeFlowRefusal("TSONIC_LOCAL_TYPE_UNSUPPORTED", selected.variable.node);
    } else refuse(selected, "TSONIC_LOCAL_TYPE_UNSUPPORTED", selected.variable.node);
  }

  const conditionRefusals: SourceTypeFlowRefusal[] = [];
  const derivedNodes = new Set(graph.derived.map(derived => derived.node));
  function selectionAbruptType(node: Node): SourceTypeDescriptor | undefined {
    const pending = [node];
    while (pending.length > 0) {
      const current = pending.pop()!;
      const outcome = outcomes.get(current);
      const type = outcome?.kind === "refused" ? undefined : outcome?.type;
      const structure = type === undefined ? undefined : sourceTypeDescriptorStructure(type);
      if (structure?.kind === "intrinsic" && structure.intrinsic === "never") return type;
      const operand = sourceTransparentExpressionOperand(source.ast, current);
      if (operand !== undefined) pending.push(operand);
      else if (source.ast.operatorKindName(current) === "KindCommaToken") {
        const binary = source.ast.as.AsBinaryExpression(current);
        if (binary?.Right !== undefined) pending.push(binary.Right);
        if (binary?.Left !== undefined) pending.push(binary.Left);
      }
    }
    return undefined;
  }
  function selectionLeafTypes(node: Node):
    | { readonly kind: "resolved"; readonly types: readonly SourceTypeDescriptor[] }
    | { readonly kind: "refused"; readonly refusal: SourceTypeFlowRefusal } {
    const types: SourceTypeDescriptor[] = [];
    const pending = [{ node, present: false }];
    const seen = [new Set<Node>(), new Set<Node>()];
    while (pending.length > 0) {
      const current = pending.pop()!;
      const visited = seen[current.present ? 1 : 0]!;
      if (visited.has(current.node)) continue;
      visited.add(current.node);
      let expression = current.node;
      for (let operand = sourceTransparentExpressionOperand(source.ast, expression); operand !== undefined;
        operand = sourceTransparentExpressionOperand(source.ast, expression)) expression = operand;
      const conditional = source.ast.is.IsConditionalExpression(expression) ? source.ast.as.AsConditionalExpression(expression) : undefined;
      const binary = source.ast.is.IsBinaryExpression(expression) ? source.ast.as.AsBinaryExpression(expression) : undefined;
      const operator = source.ast.operatorKindName(expression);
      if (sourceTypeFlowDiscardedSelection(source, expression) && conditional !== undefined) {
        if (conditional.WhenTrue === undefined || conditional.WhenFalse === undefined) return { kind: "refused",
          refusal: createSourceTypeFlowRefusal("TSONIC_LOCAL_TYPE_UNSUPPORTED", expression) };
        pending.push({ node: conditional.WhenTrue, present: current.present }, { node: conditional.WhenFalse, present: current.present });
        continue;
      }
      if (binary?.Left !== undefined && binary.Right !== undefined &&
        (sourceTypeFlowDiscardedSelection(source, expression) || operator === "KindCommaToken")) {
        const abrupt = operator === "KindCommaToken" ? selectionAbruptType(binary.Left) : undefined;
        if (abrupt !== undefined) { types.push(abrupt); continue; }
        if (operator !== "KindCommaToken") pending.push({ node: binary.Left,
          present: current.present || operator === "KindQuestionQuestionToken" });
        pending.push({ node: binary.Right, present: current.present });
        continue;
      }
      const outcome = outcomes.get(current.node);
      if (outcome?.kind === "refused") return { kind: "refused", refusal: outcome };
      let type = outcome?.type;
      if (type === undefined) return { kind: "refused",
        refusal: createSourceTypeFlowRefusal("TSONIC_LOCAL_TYPE_UNSUPPORTED", current.node) };
      if (current.present) {
        const structure = sourceTypeDescriptorStructure(type);
        if (structure.kind === "intrinsic" && structure.intrinsic === "absence") continue;
        if (structure.kind === "optional") type = structure.value;
      }
      types.push(type);
    }
    return { kind: "resolved", types };
  }
  function validateSelectionConditions(): void {
    for (const node of defaults.nodes) {
      if (!sourceTypeFlowDiscardedSelection(source, node) &&
        (!source.ast.is.IsConditionalExpression(node) || derivedNodes.has(node))) continue;
      const conditional = source.ast.is.IsConditionalExpression(node) ? source.ast.as.AsConditionalExpression(node) : undefined;
      const binary = source.ast.is.IsBinaryExpression(node) ? source.ast.as.AsBinaryExpression(node) : undefined;
      const condition = conditional?.Condition ?? binary?.Left;
      const outcome = condition === undefined ? undefined : outcomes.get(condition);
      if (outcome?.kind === "refused") continue;
      const nullish = source.ast.operatorKindName(node) === "KindQuestionQuestionToken";
      const leaves = nullish && condition !== undefined ? selectionLeafTypes(condition) : undefined;
      if (leaves?.kind === "refused") { conditionRefusals.push(leaves.refusal); continue; }
      if (!nullish && condition !== undefined && outcome === undefined) {
        conditionRefusals.push(createSourceTypeFlowRefusal("TSONIC_LOCAL_TYPE_UNSUPPORTED", condition));
        continue;
      }
      const type = leaves?.kind === "resolved" ? sourceTypeDescriptorUnion(leaves.types) : outcome?.type;
      const structure = type === undefined ? undefined : sourceTypeDescriptorStructure(type);
      const admitted = nullish ? structure !== undefined && structure.kind !== "primitive"
        : structure?.kind === "primitive" && structure.primitive === "bool";
      if (admitted) continue;
      conditionRefusals.push(Object.freeze({
        ...createSourceTypeFlowRefusal("TSONIC_LOCAL_TYPE_UNSUPPORTED", node),
        reason: nullish ? "A coalescing operator requires a nullable or runtime-union left operand."
          : conditional === undefined ? "A logical operator requires exact bool operands."
            : "A conditional operator requires an exact bool condition.",
      }));
    }
  }

  function propagateRefusal(selected: Group): void {
    if (selected.refused === undefined) return;
    const pending = [selected];
    const seen = new Set<Group>();
    while (pending.length > 0) {
      const current = pending.pop()!;
      if (seen.has(current)) continue;
      seen.add(current);
      const affected = [...current.dependents];
      for (const term of current.terms) for (const child of children(term)) affected.push(group(child));
      for (const target of affected) {
        if (!target.inference || target.refused !== undefined && target.refused !== selected.refused) continue;
        target.refused = selected.refused;
        pending.push(target);
      }
    }
  }
  for (const selected of groups.values()) propagateRefusal(selected);
  for (const selected of groups.values()) {
    if (selected.refused !== undefined || !selected.inference) continue;
    const pending = selected.pendingRefusals.sort((left, right) => compare(left.site, right.site))[0];
    if (pending === undefined) continue;
    selected.refused = pending;
    propagateRefusal(selected);
  }
  for (const issue of graph.refusals) {
    const refusal = graphRefusalOwners.get(issue)?.refused ?? issue;
    for (let node: Node | undefined = issue.site; node !== undefined && !graph.roots.includes(node); node = source.ast.parent(node)) {
      if (domainValues.has(node) && !retainedVariables.has(node) && !outcomes.has(node)) outcomes.set(node, refusal);
    }
  }
  function obligation(use: SourceTypeFlowUse, selected: Group): void {
    if (selected.type === undefined || selected.refused !== undefined) return;
    if (use.kind === "check") {
      obligations.push(Object.freeze({ kind: use.check, site: use.site, type: selected.type,
        required: use.required, requiredType: freezeSourceTypeDescriptor(use.type), association: use.association }));
    } else if (use.kind === "write") {
      const candidateVariable = use.valueVariable ?? valueVariables.get(use.value);
      const valueVariable = candidateVariable !== undefined &&
        (group(candidateVariable).inference || candidateVariable.path.length > 0) ? candidateVariable : undefined;
      const valueGroup = candidateVariable === undefined ? undefined : group(candidateVariable);
      const record = candidateVariable?.path.length === 0 ? declaredRecord(candidateVariable.node) : undefined;
      const selectedValue = record !== undefined ? declaredDescriptor(record)
        : valueGroup?.refused === undefined ? valueGroup?.type : undefined;
      const valueType = compoundCalculationTypes.get(use.value) ?? selectedValue;
      obligations.push(Object.freeze({ kind: "write-fit", site: use.site, type: selected.type, required: use.required,
        value: use.value, ...(valueType === undefined ? {} : { valueType: freezeSourceTypeDescriptor(valueType) }),
        ...(valueVariable === undefined ? {} : { valueVariable: Object.freeze({ node: valueVariable.node,
          path: Object.freeze(valueVariable.path.map(part => Object.freeze({ ...part }))) }) }), association: use.association }));
    }
  }
  for (const use of uses) {
    const selected = group(use.variable);
    obligation(use, selected);
  }
  function scalarType(type: SourceTypeDescriptor): boolean {
    return type.kind === "primitive" || type.kind === "string" || type.kind === "intrinsic" &&
      (type.intrinsic === "bigint" || type.intrinsic === "absence");
  }

  function publish(node: Node, selected: Group, association?: SourceTypeFlowAssociation): void {
    if (sourceTypeFlowDiscardedValue(source, node)) return;
    let calculation = scalarCalculations.get(node);
    for (let value = node; calculation === undefined;) {
      const operand = sourceTransparentExpressionOperand(source.ast, value);
      const variable = operand === undefined ? undefined : valueVariables.get(operand);
      if (operand === undefined || variable === undefined || group(variable) !== selected) break;
      calculation = scalarCalculations.get(operand);
      value = operand;
    }
    if (calculation?.kind === "refused") { outcomes.set(node, calculation); return; }
    // C30/C-2228: an aggregate whose own declared slot is refused publishes that refusal, never the slot's type.
    const slotRefusal = records.get(node)?.declaredSlotRefusal;
    if (slotRefusal !== undefined && selected.refused === slotRefusal) { outcomes.set(node, slotRefusal); return; }
    const record = declaredRecord(node);
    const declared = record !== undefined;
    if (selected.refused !== undefined && (selected.derived.some(derived => derived.node === node) || !declared || record.declaredType === undefined &&
      record.association?.component === undefined)) { outcomes.set(node, selected.refused); return; }
    // A group solved from a retained structure (e.g. a generic result array whose element is a solved binder, N1) publishes
    // that solved structure; only an unstructured fixed group is described from its checked type.
    const published = record !== undefined ? declaredDescriptor(record) :
      (selected.inference || selected.derived.length > 0 || selected.terms.some(term => term.kind === "numeric") ||
        structuredGroups.has(selected) ? selected.type
        : context.describe(node, association?.component));
    const scalar = calculation !== undefined && scalarType(calculation) ? calculation
      : selected.type !== undefined && scalarType(selected.type) &&
        (context.literal(node) !== undefined || selected.derived.some(derived => derived.node === node)) ? selected.type : undefined;
    const type = published !== undefined && scalar !== undefined && sourceTypeDescriptorsEqual(published, scalar) ? scalar : published;
    if (type === undefined) {
      if (!selected.inference) return;
      refuse(selected, "TSONIC_LOCAL_TYPE_UNSUPPORTED", node);
      if (selected.refused !== undefined) outcomes.set(node, selected.refused);
      return;
    }
    const sourceFile = source.ast.getSourceFile(node);
    if (sourceFile === undefined) throw new Error("A checked effective type occurrence requires its original source file.");
    const logical = sourceTypeDescriptorStructure(type);
    const construction = logical.kind === "union" || logical.kind === "optional" || logical.kind === "intrinsic" &&
      (logical.intrinsic === "unknown" || logical.intrinsic === "object" || logical.intrinsic === "any") ? scalar : undefined;
    outcomes.set(node, Object.freeze({ kind: !declared && selected.defaulted ? "default" : "resolved", type,
      ...(construction === undefined ? {} : { construction }),
      provenance: Object.freeze({ group: receiverProjections.get(selected)?.[0]?.origin ??
        selected.nodes.find(candidate => candidate.declaration !== undefined)?.declaration ?? selected.variable.node,
        occurrence: node, sourceFile, ...(selected.filledBy === undefined ? {} : { filledBy: selected.filledBy }),
        ...(association?.component === undefined ? {} : { component: Object.freeze({
          ...(association.component.declaration === undefined ? {} : { declaration: association.component.declaration }),
          ...(association.component.authoredTypeNode === undefined ? {} : { authoredTypeNode: association.component.authoredTypeNode }),
        }) }),
        ...(defaults.fixedRule(node) === undefined ? {} : { fixedRule: defaults.fixedRule(node) }) }) }));
  }
  for (const node of graph.nodes) if (node.publish) publish(node.node, group(node.variable), node.association);
  for (const derived of graph.derived) publish(derived.node, group(derived.result));
  for (const selected of groups.values()) {
    for (const node of selected.nodes) if (node.publish && node.declaration === node.node && selected.type !== undefined) {
      for (const use of source.navigation.declarationUses(node.declaration)) if (use.role !== "type-only" && use.role !== "source-linkage") {
        publish(use.reference, selected, node.association);
      }
    }
  }
  for (const call of graph.calls) {
    if (graph.refusals.some(issue => issue.site === call.node)) continue;
    const vector = (binders: typeof call.receiver) => binders.flatMap(binder => {
      const selected = group(binder.variable);
      return selected.type === undefined || selected.refused !== undefined ? []
        : [Object.freeze({ declaration: binder.declaration, type: selected.type })];
    });
    const receiver = vector(call.receiver); const method = vector(call.method);
    if (receiver.length !== call.receiver.length || method.length !== call.method.length) continue;
    const result = call.result === undefined ? undefined : group(call.result).type;
    calls.set(call.node, Object.freeze({ call: call.source, receiver: Object.freeze(receiver), method: Object.freeze(method),
      ...(result === undefined ? {} : { result }) }));
    for (const binder of [...call.receiver, ...call.method]) if (binder.constraint !== undefined) {
      const type = group(binder.variable).type;
      if (type !== undefined) obligations.push(Object.freeze({ kind: "constraint", site: call.node, type,
        required: binder.constraint.authoredTypeNode ?? binder.declaration,
        association: Object.freeze({ occurrence: call.node, sourceFile: source.ast.getSourceFile(call.node)!,
          call: call.source, component: binder.constraint }) }));
    }
  }
  // Every resolved call with method type arguments publishes its instantiation, also when none of its values joins the
  // local graph (e.g. a statement call `receiver.member<Word>()` on an ambient or provider declaration). The method
  // binders take the descriptor of the selected type argument, from its authored syntax when it is explicit.
  for (const node of defaults.nodes) {
    if (calls.has(node) || !(source.ast.is.IsCallExpression(node) || source.ast.is.IsNewExpression(node))) continue;
    const queries = source.semantics.forNode(node);
    const call = queries.operations.call(node);
    const selected = call?.sourceSelectedMethodTypeArguments ?? [];
    if (call === undefined || call.sourceSelectedSignatureKind !== "resolved" || selected.length === 0) continue;
    const method: { readonly declaration: Node; readonly type: SourceTypeDescriptor }[] = [];
    for (const argument of selected) {
      const symbol = queries.declarations.typeSymbol(argument.typeParameter);
      const declarations = symbol === undefined ? [] : queries.declarations.symbolDeclarations(symbol)
        .filter(declaration => source.ast.is.IsTypeParameterDeclaration(declaration));
      const type = declarations.length !== 1 ? undefined : context.describe(node, { selectedType: argument.selectedType,
        ...(argument.explicitTypeNode === undefined ? {} : { authoredTypeNode: argument.explicitTypeNode }) });
      if (declarations.length !== 1 || type === undefined) break;
      method.push(Object.freeze({ declaration: declarations[0]!, type: freezeSourceTypeDescriptor(type) }));
    }
    if (method.length !== selected.length) continue;
    calls.set(node, Object.freeze({ call, receiver: Object.freeze([]), method: Object.freeze(method) }));
  }
  for (const node of [...graph.nodes.filter(record => record.declaration === record.node).map(record => record.node), ...defaults.values]) {
    if (outcomes.has(node)) continue;
    const declaration = source.navigation.sourceReferenceFor(node)?.declaration ?? node;
    const initializer = source.ast.is.IsVariableDeclaration(declaration) || source.ast.is.IsPropertyDeclaration(declaration) ||
      source.ast.is.IsParameterDeclaration(declaration) ? Node_Initializer(source.ast, declaration) : undefined;
    const literalDefault = initializer !== undefined && (context.literal(initializer) !== undefined || source.ast.is.IsObjectLiteralExpression(initializer));
    const type = context.describe(node);
    const sourceFile = source.ast.getSourceFile(node);
    if (type === undefined || sourceFile === undefined) continue;
    outcomes.set(node, Object.freeze({ kind: literalDefault ? "default" : "resolved", type,
      provenance: Object.freeze({ group: declaration, occurrence: node, sourceFile,
        ...(defaults.fixedRule(node) === undefined ? {} : { fixedRule: defaults.fixedRule(node) }) }) }));
  }
  // A variable or parameter declaration whose name is a binding pattern is a declared fact (C29): its storage is its
  // annotation's descriptor, or, unannotated, its initializer's published value. Targets declare the destructured
  // source from this fact; each binding element publishes its own member value above.
  for (const node of defaults.nodes) {
    if (outcomes.has(node) || !(source.ast.is.IsVariableDeclaration(node) || source.ast.is.IsParameterDeclaration(node))) continue;
    const name = source.ast.name(node);
    if (name === undefined || !(source.ast.is.IsObjectBindingPattern(name) || source.ast.is.IsArrayBindingPattern(name))) continue;
    const sourceFile = source.ast.getSourceFile(node);
    if (sourceFile === undefined) continue;
    const initializer = Node_Initializer(source.ast, node);
    const value = source.ast.typeNode(node) === undefined && initializer !== undefined ? outcomes.get(initializer) : undefined;
    if (value?.kind === "refused") { outcomes.set(node, value); continue; }
    const type = value?.type ?? context.describe(node);
    if (type === undefined) continue;
    outcomes.set(node, Object.freeze({ kind: "resolved", type, provenance: Object.freeze({ group: node, occurrence: node, sourceFile }) }));
  }
  // Property signatures of interfaces and of named type literals are declared facts too (C29): each carries its
  // authored declared type, so targets declare the member from the Host fact.
  for (const node of defaults.nodes) {
    if (outcomes.has(node) || !source.ast.is.IsPropertySignatureDeclaration(node)) continue;
    const owner = source.ast.parent(node);
    const alias = owner === undefined ? undefined : source.ast.parent(owner);
    if (owner === undefined || !(source.ast.is.IsInterfaceDeclaration(owner) ||
      source.ast.is.IsTypeLiteralNode(owner) && alias !== undefined && source.ast.is.IsTypeAliasDeclaration(alias))) continue;
    const type = context.describe(node);
    const sourceFile = source.ast.getSourceFile(node);
    if (type === undefined || sourceFile === undefined) continue;
    outcomes.set(node, Object.freeze({ kind: "resolved", type,
      provenance: Object.freeze({ group: node, occurrence: node, sourceFile }) }));
  }
  // Parameters of callables without a body (interface or type-literal methods, call and construct signatures, abstract
  // methods and accessors, overload and ambient declarations) are declared facts in the publication domain (C29):
  // each carries its authored declared type, exactly as a parameter of a callable with a body does. Targets build
  // interface contracts, abstract ABIs and forwarding from them.
  for (const node of defaults.nodes) {
    if (outcomes.has(node) || !source.ast.is.IsParameterDeclaration(node)) continue;
    const owner = source.ast.parent(node);
    if (owner === undefined || !isSourceCallableSignatureDeclaration(source.ast, owner) ||
      source.ast.is.IsFunctionTypeNode(owner) || source.ast.is.IsConstructorTypeNode(owner) ||
      !(source.ast.is.IsMethodSignatureDeclaration(owner) || source.ast.is.IsCallSignatureDeclaration(owner) ||
        source.ast.is.IsConstructSignatureDeclaration(owner) || source.ast.body(owner) === undefined)) continue;
    const type = context.describe(node);
    const sourceFile = source.ast.getSourceFile(node);
    if (type === undefined || sourceFile === undefined) continue;
    outcomes.set(node, Object.freeze({ kind: "resolved", type,
      provenance: Object.freeze({ group: node, occurrence: node, sourceFile }) }));
  }
  for (const node of defaults.nodes) {
    if (!source.ast.is.IsParameterDeclaration(node)) continue;
    const owner = source.ast.parent(node);
    const pattern = source.ast.name(node);
    const annotation = source.ast.typeNode(node);
    const head = outcomes.get(node);
    if (owner === undefined || source.ast.body(owner) !== undefined || pattern === undefined || annotation === undefined ||
      !(source.ast.is.IsArrayBindingPattern(pattern) || source.ast.is.IsObjectBindingPattern(pattern)) ||
      head === undefined || head.kind === "refused") continue;
    const queries = source.semantics.forNode(node);
    const selectedType = queries.types.authoredType(annotation);
    if (selectedType === undefined) continue;
    const component = { selectedType, declaration: node, authoredTypeNode: annotation };
    for (const binding of sourceTypeFlowDeclaredPatternBindings(context, pattern, component, queries, head.type)) {
      if (outcomes.has(binding.node)) continue;
      const type = binding.kind === "refused" ? undefined : binding.type ?? (binding.component?.authoredTypeNode === undefined
        ? undefined : context.describe(binding.node, binding.component));
      if (type === undefined) {
        const refusal = createSourceTypeFlowRefusal("TSONIC_LOCAL_TYPE_UNSUPPORTED", binding.node, node);
        outcomes.set(binding.node, refusal);
        directGraphRefusals.push(refusal);
        continue;
      }
      const sourceFile = source.ast.getSourceFile(binding.node);
      if (sourceFile === undefined) throw new Error("A declared binding requires its original checked source file.");
      outcomes.set(binding.node, Object.freeze({ kind: "resolved", type: freezeSourceTypeDescriptor(type),
        provenance: Object.freeze({ group: node, occurrence: binding.node, sourceFile }) }));
    }
  }
  for (const node of defaults.nodes) {
    if (!(source.ast.is.IsVariableDeclaration(node) || source.ast.is.IsParameterDeclaration(node) || source.ast.is.IsBindingElement(node))) continue;
    const name = source.ast.name(node);
    const outcome = outcomes.get(node);
    if (name === undefined || !source.ast.is.IsIdentifier(name) || outcomes.has(name) || outcome === undefined) continue;
    outcomes.set(name, outcome.kind === "refused" ? outcome : Object.freeze({ ...outcome,
      provenance: Object.freeze({ ...outcome.provenance, occurrence: name }) }));
  }
  for (const node of defaults.nodes) {
    if (!(source.ast.is.IsInterfaceDeclaration(node) || source.ast.is.IsClassDeclaration(node) ||
      source.ast.is.IsTypeAliasDeclaration(node))) continue;
    const queries = source.semantics.forNode(node);
    const selectedType = queries.declarations.declaredType(node);
    const type = selectedType === undefined ? undefined : context.describe(node, { selectedType, declaration: node });
    const sourceFile = source.ast.getSourceFile(node);
    if (type === undefined || sourceFile === undefined) continue;
    outcomes.set(node, Object.freeze({ kind: "resolved", type,
      provenance: Object.freeze({ group: node, occurrence: node, sourceFile }) }));
  }
  for (const refusal of defaults.signatureRefusals.values()) outcomes.set(refusal.site, refusal);
  for (const node of defaults.nodes) {
    const ast = source.ast;
    if (!(ast.is.IsCallExpression(node) || ast.is.IsNewExpression(node) || ast.is.IsPropertyAccessExpression(node))) continue;
    const queries = source.semantics.forNode(node);
    const call = ast.is.IsCallExpression(node) || ast.is.IsNewExpression(node) ? queries.operations.call(node) : undefined;
    const declaration = ast.is.IsPropertyAccessExpression(node) ? queries.operations.propertyAccess(node)?.selectedReadDeclaration
      : call === undefined ? undefined : queries.declarations.signatureDeclaration(call.selectedSignature);
    if (declaration !== undefined) callableQueries.set(declaration, queries);
  }
  function callableReturn(declaration: Node): SourceEffectiveTypeOutcome | undefined {
    const refusal = defaults.signatureRefusals.get(declaration);
    if (refusal !== undefined) return refusal;
    const cached = callableReturns.get(declaration);
    if (cached !== undefined) return cached;
    if (activeReturns.has(declaration)) return undefined;
    const ast = source.ast;
    if (!isSourceCallableSignatureDeclaration(ast, declaration)) return undefined;
    activeReturns.add(declaration);
    const file = ast.getSourceFile(declaration);
    const queries = callableQueries.get(declaration) ?? (file !== undefined && source.semantics.includes(file)
      ? source.semantics.forFile(file) : undefined);
    if (queries === undefined) { activeReturns.delete(declaration); return undefined; }
    const signature = queries.types.declarationSignatureInfo(declaration);
    const selectedType = signature?.returnType;
    let type: SourceTypeDescriptor | undefined;
    let failure: SourceTypeFlowRefusal | undefined;
    const annotation = ast.typeNode(declaration);
    const contextual = annotation === undefined ? defaults.declaredSlots.callable(declaration, queries) : undefined;
    const requiredResult = annotation === undefined ? defaults.declaredSlots.returned(declaration, queries) : undefined;
    if (ast.is.IsConstructorDeclaration(declaration)) {
      const owner = ast.parent(declaration);
      const selected = owner === undefined ? undefined : queries.declarations.declaredType(owner);
      if (owner !== undefined && selected !== undefined) type = context.describe(owner, { selectedType: selected, declaration: owner });
    } else if (contextual !== undefined || requiredResult !== undefined) {
      type = contextual?.signature.result ?? requiredResult;
      const requiredType = requiredResult;
      if (requiredType === undefined) throw new Error("A declared callable return requires its exact Source result descriptor.");
      const returnedValues = file !== undefined && source.semantics.includes(file)
        ? sourceTypeFlowCallableReturns(ast, declaration).returned : [];
      for (const returned of returnedValues) {
        const value = outcomes.get(returned);
        if (value === undefined) throw new Error("A declared callable body requires its canonical Source publication.");
        if (value.kind === "refused") { failure = value; break; }
        obligations.push(Object.freeze({ kind: "write-fit", site: returned, type: freezeSourceTypeDescriptor(requiredType),
          value: returned, valueType: value.type, required: declaration }));
      }
    } else if (selectedType !== undefined && (annotation !== undefined || ast.body(declaration) === undefined ||
      file === undefined || !source.semantics.includes(file))) {
      type = context.describe(declaration, { selectedType, declaration,
        ...(annotation === undefined ? {} : { authoredTypeNode: annotation }) });
    } else {
      const { returned, absent } = sourceTypeFlowCallableReturns(ast, declaration);
      const types: SourceTypeDescriptor[] = [];
      const asynchronous = ast.hasModifierKind(declaration, "async");
      let incomplete = false;
      for (const node of returned) {
        const selected = outcomes.get(node) ?? solvedValue(node);
        if (selected?.kind === "refused") { failure = selected; break; }
        let current = selected?.type;
        if (current === undefined) {
          failure = defaults.descriptorRefusals.get(node) ?? createSourceTypeFlowRefusal("TSONIC_LOCAL_TYPE_UNSUPPORTED", node);
          outcomes.set(node, failure);
          break;
        }
        if (asynchronous && current.kind === "declared") {
          const actual = queries.types.expressionType(node);
          const awaited = actual === undefined ? undefined : queries.types.awaitedType(actual);
          const arguments_ = actual === undefined ? [] : queries.types.typeArguments(actual);
          const index = awaited === undefined ? -1 : arguments_.findIndex(argument => queries.types.isIdentical(argument, awaited));
          if (index >= 0) current = current.typeArguments[index];
        }
        if (current === undefined) { incomplete = true; break; }
        if (!types.some(previous => sourceTypeDescriptorsEqual(previous, current!))) types.push(current);
      }
      if (failure === undefined && !incomplete && (returned.length === 0 || types.length > 0)) {
        if (types.length > 0 && (absent || queries.operations.callableCompletion(declaration)?.canFallThrough === true)) {
          types.push({ kind: "intrinsic", intrinsic: "absence" });
        }
        type = types.length === 0 ? { kind: "intrinsic", intrinsic: "void" } : sourceTypeDescriptorUnion(types);
        if (asynchronous && selectedType !== undefined) {
          const complete = context.describe(declaration, { selectedType });
          const awaited = queries.types.awaitedType(selectedType);
          const arguments_ = queries.types.typeArguments(selectedType);
          const index = awaited === undefined ? -1 : arguments_.findIndex(argument => queries.types.isIdentical(argument, awaited));
          const parameter = complete?.kind === "declared" ? sourceTypeFlowTypeParameters(ast, complete.declaration)[index] : undefined;
          type = parameter === undefined || type === undefined ? undefined
            : context.describe(declaration, { selectedType }, [{ declaration: parameter, type }]);
        }
      }
    }
    activeReturns.delete(declaration);
    const outcome = failure ?? (type === undefined || file === undefined ? undefined : Object.freeze({ kind: "resolved" as const,
      type: freezeSourceTypeDescriptor(type), provenance: Object.freeze({ group: declaration, occurrence: declaration, sourceFile: file }) }));
    if (outcome !== undefined) callableReturns.set(declaration, outcome);
    return outcome;
  }
  function solvedValue(node: Node): SourceEffectiveTypeOutcome | undefined {
    const variable = retainedVariables.get(node);
    const selected = variable === undefined ? undefined : group(variable);
    if (selected?.solved !== true) return undefined;
    if (selected.refused !== undefined) return selected.refused;
    const record = declaredRecord(node);
    const type = record === undefined ? selected.type : declaredDescriptor(record);
    const sourceFile = source.ast.getSourceFile(node);
    return type === undefined || sourceFile === undefined ? undefined : Object.freeze({ kind: "resolved",
      type: freezeSourceTypeDescriptor(type), provenance: Object.freeze({ group: selected.variable.node, occurrence: node, sourceFile }) });
  }
  for (const node of defaults.nodes) {
    if (isSourceCallableSignatureDeclaration(source.ast, node)) callableReturn(node);
  }
  for (const node of defaults.nodes) {
    const ast = source.ast;
    if (!isSourceCallableSignatureDeclaration(ast, node)) continue;
    const returned = callableReturn(node);
    if (returned === undefined) continue;
    if (returned.kind === "refused") { outcomes.set(node, returned); continue; }
    const queries = source.semantics.forNode(node);
    const signature = queries.types.declarationSignatureInfo(node);
    if (signature === undefined) continue;
    const contextual = defaults.declaredSlots.callable(node, queries);
    const parameters = signature.parameters.map((parameter, index) => {
      const declared = parameter.declaration;
      const published = declared === undefined ? undefined : outcomes.get(declared);
      if (published?.kind === "refused") return undefined;
      const type = published?.type;
      return type === undefined ? undefined : { kind: contextual?.signature.parameters[index]?.kind ?? parameter.parameterKind, type,
        ...(declared === undefined ? {} : { declaration: declared }) };
    });
    if (parameters.some(parameter => parameter === undefined)) continue;
    // Construct-only signatures (constructor declarations, construct signatures, constructor types) and accessors are
    // not callable values; call signatures are inventory entries of their owner, not values.
    if (ast.is.IsGetAccessorDeclaration(node) || ast.is.IsSetAccessorDeclaration(node) || ast.is.IsConstructorDeclaration(node) ||
      ast.is.IsCallSignatureDeclaration(node) || ast.is.IsConstructSignatureDeclaration(node) || ast.is.IsConstructorTypeNode(node)) continue;
    const selectedCall = { declaration: node,
      typeParameters: sourceTypeFlowTypeParameters(ast, node),
      parameters: parameters.filter((parameter): parameter is NonNullable<typeof parameter> => parameter !== undefined),
      result: returned.type };
    const described = contextual?.type ?? context.describe(node);
    // An optional method (`accept?(next: T): T`) is an optional callable member: its inventory is the callable inside.
    const optional = described?.kind === "optional";
    const inner = described?.kind === "optional" ? described.value : described;
    const structure = inner === undefined ? undefined : sourceTypeDescriptorStructure(inner);
    if (structure === undefined || structure.kind !== "callable" && structure.kind !== "shape" || structure.calls.length === 0) {
      throw new Error("A Source callable value requires its complete canonical member and signature inventory.");
    }
    const callable: SourceTypeDescriptor = { ...structure, calls: structure.calls.length === 1 ? [selectedCall]
      : structure.calls.map(signature => signature.declaration === node ? selectedCall : signature) };
    const type: SourceTypeDescriptor = optional ? { kind: "optional", value: callable } : callable;
    const outcome = Object.freeze({ ...returned, type: freezeSourceTypeDescriptor(type) });
    outcomes.set(node, outcome);
    for (const use of source.navigation.declarationUses(node)) {
      if (use.role === "type-only" || use.role === "source-linkage") continue;
      const sourceFile = ast.getSourceFile(use.reference);
      if (sourceFile !== undefined) outcomes.set(use.reference, Object.freeze({ ...outcome,
        provenance: Object.freeze({ ...outcome.provenance, occurrence: use.reference, sourceFile }) }));
    }
  }
  for (const [node, refusal] of defaults.descriptorRefusals) outcomes.set(node, refusal);
  publishSourceLiteralMetadata(context, defaults.nodes, outcomes, callableReturn, node => {
    const variable = valueVariables.get(node);
    return variable === undefined ? undefined : group(variable).chosenFill?.component;
  }, node => defaults.descriptorRefusals.get(node));
  validateSelectionConditions();
  for (const refusal of conditionRefusals) {
    if (!sourceTypeFlowDiscardedValue(source, refusal.site)) outcomes.set(refusal.site, refusal);
  }
  // R1 totality (C-2309, K-2443): every value node of the domain has exactly one outcome. A value no publication
  // pass described (an inexpressible declared or derived type, an unavailable callable result) receives one
  // precise refusal at that node; nothing is left for a target to type itself.
  const totalityRefusals: SourceTypeFlowRefusal[] = [];
  for (const node of defaults.values) {
    if (outcomes.has(node)) continue;
    const refusal = createSourceTypeFlowRefusal("TSONIC_LOCAL_TYPE_UNSUPPORTED", node);
    outcomes.set(node, refusal);
    totalityRefusals.push(refusal);
  }
  function authority(node: Node): "inferred" | "declared" {
    const pending = [node];
    const seen = new Set<Node>();
    while (pending.length > 0) {
      const occurrence = pending.pop()!;
      if (seen.has(occurrence)) continue;
      seen.add(occurrence);
      const variable = valueVariables.get(occurrence);
      const selected = variable === undefined ? undefined : group(variable);
      if (selected?.chosenFill?.authority === "declared" || selected?.nodes.some(record => {
        const slot = defaults.declaredSlots.get(record.node);
        return slot?.authority === "declared" && slot.type !== undefined && slot.refusal === undefined;
      })) return "declared";
      const slot = defaults.declaredSlots.get(occurrence);
      if (slot?.authority === "declared" && slot.type !== undefined && slot.refusal === undefined) return "declared";
      const parent = source.ast.parent(occurrence);
      if (parent === undefined) continue;
      if ((source.ast.is.IsParenthesizedExpression(parent) || source.ast.isConstAssertion(parent)) &&
        Node_Expression(source.ast, parent) === occurrence) {
        pending.push(parent);
      } else if (source.ast.is.IsVariableDeclaration(parent) && Node_Initializer(source.ast, parent) === occurrence &&
        source.ast.typeNode(parent) === undefined) {
        const owner = records.get(parent);
        if (owner === undefined) continue;
        for (const use of source.navigation.declarationUses(parent)) {
          if (use.kind === "type-only" || use.kind === "source-linkage" || records.get(use.reference)?.root !== owner.root) continue;
          pending.push(use.reference);
        }
      }
    }
    return "inferred";
  }
  for (const node of defaults.values) {
    const ast = source.ast;
    if (!(ast.is.IsArrayLiteralExpression(node) || ast.is.IsObjectLiteralExpression(node)) ||
      sourceTypeFlowAssignmentPattern(ast, node)) continue;
    const outcome = outcomes.get(node);
    if (outcome === undefined || outcome.kind === "refused") continue;
    obligations.push(Object.freeze({ kind: "literal-admission", site: node, type: outcome.type, required: node,
      authority: authority(node) }));
  }
  for (const node of graph.nodes) {
    if (node.term?.kind !== "numeric" || node.term.site !== node.node || node.variable.path.length !== 0 ||
      !group(node.variable).inference || group(node.variable).refused !== undefined) continue;
    let occurrence = node.node;
    let parent = source.ast.parent(occurrence);
    while (parent !== undefined && (source.ast.is.IsParenthesizedExpression(parent) || source.ast.is.IsNonNullExpression(parent) ||
      source.ast.is.IsAsExpression(parent) || source.ast.is.IsSatisfiesExpression(parent) ||
      (source.ast.is.IsPrefixUnaryExpression(parent) || source.ast.is.IsBinaryExpression(parent)) && context.literal(parent) !== undefined)) {
      occurrence = parent;
      parent = source.ast.parent(occurrence);
    }
    if (parent !== undefined && source.ast.is.IsPropertyAssignment(parent) && Node_Initializer(source.ast, parent) === occurrence) {
      occurrence = parent;
      parent = source.ast.parent(parent);
    }
    if (parent === undefined || !(source.ast.is.IsArrayLiteralExpression(parent) || source.ast.is.IsObjectLiteralExpression(parent)) ||
      sourceTypeFlowAssignmentPattern(source.ast, parent) || outcomes.get(parent)?.kind === "refused") continue;
    const outcome = outcomes.get(node.node);
    if (outcome === undefined || outcome.kind === "refused") continue;
    obligations.push(Object.freeze({ kind: "literal-admission", site: node.node, type: outcome.type, required: node.node,
      authority: authority(parent) }));
  }
  // Refusals that literal publication sets on an aggregate literal itself are reported like every other Host refusal.
  const literalRefusals = defaults.values.flatMap(node => {
    if (!(source.ast.is.IsObjectLiteralExpression(node) || source.ast.is.IsArrayLiteralExpression(node))) return [];
    const outcome = outcomes.get(node);
    return outcome?.kind === "refused" && outcome.site === node ? [outcome] : [];
  });
  const frozenIssues = Object.freeze([...new Set([...defaults.signatureRefusals.values(), ...defaults.descriptorRefusals.values(),
    ...totalityRefusals, ...literalRefusals, ...directGraphRefusals, ...conditionRefusals,
    ...[...groups.values()].flatMap(selected => selected.refused === undefined ? [] : [selected.refused])])]
    .sort((left, right) => compare(left.site, right.site)));
  const frozenObligations = Object.freeze(obligations.filter(obligation => !defaults.descriptorRefusals.has(obligation.site)));
  return Object.freeze({ get: (node: Node) => outcomes.get(node), callableReturn, callInstantiation: (call: Node) => calls.get(call),
    obligations: () => frozenObligations, refusals: () => frozenIssues });
}
