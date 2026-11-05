import type { Node } from "@tsonic/tsts";
import { Node_Initializer } from "../../source-navigation/ast.js";
import { isSourceCallableSignatureDeclaration } from "../../source-navigation/callable-boundaries.js";
import { sourceArrayElementType } from "../array-types.js";
import { createSourceTypeFlowAnalysisContext, sourceTypeFlowIntegerFits, sourceTypeFlowNumericLiteralKind, sourceTypeFlowTypeParameters } from "./defaults.js";
import { collectSourceTypeFlowEdges } from "./edges.js";
import { createSourceTypeFlowRefusal } from "./refusals.js";
import { collectSourceTypeFlowSignatures } from "./signatures.js";
import { createSourceTypeFlowTerms, freezeSourceTypeDescriptor, isSourceTypeFlowDeclaredConstruction, sourceTypeDescriptorDepth, sourceTypeDescriptorsEqual, sourceTypeDescriptorStructure, sourceTypeDescriptorUnion } from "./terms.js";
import { collectSourceTypeFlowUses } from "./uses.js";
import { publishSourceLiteralMetadata, sourceLiteralMemberCorrespondence } from "./literal-publication.js";
import { sourceTypeFlowCallableReturns } from "./callable-returns.js";
import { sourceTypeFlowAssignmentPattern } from "./value-syntax.js";
import { sourceTypeDescriptorMemberOriginsEqual } from "./member-origins.js";
import type { SourceFileSemantics, SourceTypeComponentEvidence } from "../types.js";
import type {
  SourceEffectiveCallInstantiation, SourceEffectiveTypeOutcome, SourceEffectiveTypes, SourceTypeDescriptor, SourceLiteralMemberCorrespondence,
  SourceTypeFlowAssociation, SourceTypeFlowDerived, SourceTypeFlowGraph, SourceTypeFlowNode,
  SourceTypeFlowObligation, SourceTypeFlowRefusal, SourceTypeFlowSignature, SourceTypeFlowSource,
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
  const outcomes = new WeakMap<Node, SourceEffectiveTypeOutcome>();
  const calls = new WeakMap<Node, SourceEffectiveCallInstantiation>();
  const callableReturns = new WeakMap<Node, SourceEffectiveTypeOutcome>();
  const callableQueries = new WeakMap<Node, SourceFileSemantics>();
  const activeReturns = new Set<Node>();
  const obligations: SourceTypeFlowObligation[] = [];
  const valueVariables = new WeakMap<Node, SourceTypeFlowVariable>();
  const records = new WeakMap<Node, SourceTypeFlowNode>();
  for (const node of graph.nodes) if (node.publish && node.kind !== "binder" && node.variable.path.length === 0) {
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
    if (record.declaredType !== undefined) return record.declaredType;
    if (isSourceTypeFlowDeclaredConstruction(record)) {
      return group(record.variable).constructions.find(fill => fill.site === record.node)?.type;
    }
    return record.term?.kind === "fixed" ? record.term.type : context.describe(record.node, record.association?.component);
  }
  for (const selected of terms.groups()) group(selected.variable);
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
  for (const issue of graph.refusals) {
    const construction = records.get(issue.site);
    if (construction?.declaredSlotRefusal === issue) {
      group(construction.variable).refused = issue;
      continue;
    }
    const owner = inferenceOwner(issue.site) ?? inferenceOwner(issue.related);
    if (owner !== undefined) owner.pendingRefusals.push(issue);
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
      authority: component?.authoredTypeNode !== undefined || component?.declaration !== undefined &&
        source.ast.typeNode(component.declaration) !== undefined ? "declared" : "inferred",
      ...(component === undefined ? {} : { component }) } });
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
    for (const derived of selected.derived) for (const operand of derived.operands) selected.dependencies.add(group(operand));
    selected.dependencies.delete(selected);
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
    const fixed = selected.fills.filter(fill => fill.fixed);
    if (fixed.length > 1 && fixed.some(fill => !sourceTypeDescriptorsEqual(fixed[0]!.type, fill.type))) {
      const array = arrayConstruction(selected);
      refuse(selected, array === undefined ? "TSONIC_LOCAL_TYPE_CONFLICT" : "TSONIC_LOCAL_TYPE_MIXED_ELEMENTS",
        array?.node ?? fixed[1]!.site, fixed[0]!.site);
      return;
    }
    for (const fill of selected.fills) {
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
    if (derived.operator === "identity") return types[0];
    if (derived.operator === "sequence") return types[types.length - 1];
    if (derived.operator === "conditional" || derived.operator === "logical-and" || derived.operator === "logical-or") {
      return sourceTypeDescriptorUnion(types.filter((type): type is SourceTypeDescriptor => type !== undefined));
    }
    if (derived.operator === "coalesce") {
      const left = types[0];
      const right = types[1];
      return right === undefined ? undefined : sourceTypeDescriptorUnion([
        ...(left === undefined || left.kind === "intrinsic" && left.intrinsic === "absence" ? [] : [left.kind === "optional" ? left.value : left]), right,
      ]);
    }
    const comparison = ["less", "less-equal", "greater", "greater-equal", "equal", "not-equal", "logical-not"].includes(derived.operator);
    if (comparison) return { kind: "primitive", primitive: "bool" };
    if (derived.operator === "add" && types.some(type => type?.kind === "string")) return { kind: "string" };
    const supported = new Set(["int32", "uint32", "int64", "uint64", "float32", "float64", "decimal"]);
    if (types.some(type => type?.kind !== "primitive" || !supported.has(type.primitive))) return undefined;
    const first = types[0];
    if (first?.kind !== "primitive") return undefined;
    if (derived.operator === "negate" && (first.primitive === "uint32" || first.primitive === "uint64")) return undefined;
    if (["bit-and", "bit-or", "bit-xor", "bit-not"].includes(derived.operator) &&
      types.some(type => type?.kind !== "primitive" || !["int32", "uint32", "int64", "uint64"].includes(type.primitive))) return undefined;
    if (derived.operator === "shift-left" || derived.operator === "shift-right" || derived.operator === "shift-right-unsigned") {
      return ["int32", "uint32", "int64", "uint64"].includes(first.primitive) ? first : undefined;
    }
    if (types.every(type => type?.kind === "primitive" && type.primitive === first.primitive)) return first;
    const literal = (selected: Group): Extract<SourceTypeFlowTerm, { kind: "numeric" }> | undefined =>
      selected.terms.find((term): term is Extract<SourceTypeFlowTerm, { kind: "numeric" }> => term.kind === "numeric" && selected.filledBy === undefined);
    if (types.length === 2) {
      for (const index of [0, 1]) {
        const leaf = literal(operands[index]!); const other = types[1 - index];
        if (leaf === undefined || other?.kind !== "primitive") continue;
        const floating = leaf.form === "fractional" || sourceTypeFlowNumericLiteralKind(leaf.literal) === "float64";
        if (floating && ["int32", "uint32", "int64", "uint64"].includes(other.primitive)) {
          return { kind: "primitive", primitive: "float64" };
        }
        const value = leaf.literal.integerConstant ?? leaf.literal.integer;
        if (!floating && leaf.form === "integer" && value !== undefined && sourceTypeFlowIntegerFits(value, other.primitive)) return other;
      }
    }
    return undefined;
  }

  function solve(selected: Group, accumulator = false): void {
    for (const node of selected.nodes) {
      const refusal = defaults.descriptorRefusals.get(node.node);
      if (refusal !== undefined) { selected.refused = refusal; break; }
    }
    if (selected.inference && selected.refused === undefined) for (const dependency of selected.dependencies) {
      if (dependency.refused !== undefined) { selected.refused = dependency.refused; break; }
    }
    if (selected.refused !== undefined) { selected.solved = true; return; }
    if (!accumulator && selected.derived.some(derived => derived.operands.some(operand => group(operand) === selected))) {
      refuse(selected, "TSONIC_LOCAL_TYPE_UNSUPPORTED", selected.variable.node);
      selected.solved = true;
      return;
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
    const construction = selected.constructions[0];
    const anchor = (construction?.authority === "declared" ? construction : aggregateFill ?? construction) ?? (!selected.inference ? fixed[0] ??
      (retainedStructure === undefined ? selected.fills.find(fill => !fill.fixed)
        : { type: retainedStructure, site: selected.variable.node, fixed: true, authority: "inferred" as const })
      : declared ? fixed[0] : selected.fills[0]);
    if (anchor !== undefined && (selected.derived.length === 0 || accumulator)) {
      selected.type = anchor.type; selected.filledBy = anchor.site; selected.chosenFill = anchor;
    }
    if (selected.type === undefined && (selected.derived.length === 0 || accumulator)) {
      selected.type = constructed(selected);
      if (selected.type === undefined && selected.terms.some(term => term.kind === "numeric")) {
        selected.type = { kind: "primitive", primitive: selected.terms.some(term => term.kind === "numeric" &&
          (term.form === "fractional" || sourceTypeFlowNumericLiteralKind(term.literal) === "float64")) ? "float64" : "int32" };
      }
      selected.defaulted = selected.type !== undefined;
    }
    for (const derived of selected.derived) {
      const type = derivedType(derived);
      if (type === undefined) refuse(selected, accumulator ? "TSONIC_LOCAL_TYPE_ACCUMULATOR" : "TSONIC_LOCAL_TYPE_UNSUPPORTED", derived.node);
      else if (selected.type !== undefined && !sourceTypeDescriptorsEqual(selected.type, type)) {
        refuse(selected, accumulator ? "TSONIC_LOCAL_TYPE_ACCUMULATOR" : "TSONIC_LOCAL_TYPE_CONFLICT", derived.node);
      } else selected.type = type;
    }
    if (selected.type !== undefined) {
      selected.type = freezeSourceTypeDescriptor(selected.type);
      if (sourceTypeDescriptorDepth(selected.type) > 4) refuse(selected, "TSONIC_LOCAL_TYPE_LIMIT", selected.variable.node);
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
    refuse(selected, "TSONIC_LOCAL_TYPE_UNSUPPORTED", selected.variable.node);
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

  function obligation(use: SourceTypeFlowUse, selected: Group): void {
    if (selected.type === undefined || selected.refused !== undefined) return;
    if (use.kind === "check") {
      obligations.push(Object.freeze({ kind: use.check, site: use.site, type: selected.type,
        required: use.required, requiredType: freezeSourceTypeDescriptor(use.type), association: use.association }));
    } else if (use.kind === "write") {
      const candidateVariable = use.valueVariable ?? valueVariables.get(use.value);
      const valueVariable = candidateVariable !== undefined && group(candidateVariable).inference ? candidateVariable : undefined;
      const valueGroup = candidateVariable === undefined ? undefined : group(candidateVariable);
      const record = candidateVariable?.path.length === 0 ? declaredRecord(candidateVariable.node) : undefined;
      const selectedValue = record !== undefined ? declaredDescriptor(record)
        : valueGroup?.refused === undefined ? valueGroup?.type : undefined;
      obligations.push(Object.freeze({ kind: "write-fit", site: use.site, type: selected.type, required: use.required,
        value: use.value, ...(selectedValue === undefined ? {} : { valueType: freezeSourceTypeDescriptor(selectedValue) }),
        ...(valueVariable === undefined ? {} : { valueVariable: Object.freeze({ node: valueVariable.node,
          path: Object.freeze(valueVariable.path.map(part => Object.freeze({ ...part }))) }) }), association: use.association }));
    }
  }
  for (const use of uses) {
    const selected = group(use.variable);
    obligation(use, selected);
  }
  function publish(node: Node, selected: Group, association?: SourceTypeFlowAssociation): void {
    const record = declaredRecord(node);
    const declared = record !== undefined;
    if (selected.refused !== undefined && (!declared || record.declaredType === undefined &&
      record.association?.component === undefined)) { outcomes.set(node, selected.refused); return; }
    const type = record !== undefined ? declaredDescriptor(record) : selected.inference || selected.derived.length > 0 ? selected.type
      : context.describe(node, association?.component);
    if (type === undefined) {
      if (!selected.inference) return;
      refuse(selected, "TSONIC_LOCAL_TYPE_UNSUPPORTED", node);
      if (selected.refused !== undefined) outcomes.set(node, selected.refused);
      return;
    }
    const sourceFile = source.ast.getSourceFile(node);
    if (sourceFile === undefined) throw new Error("A checked effective type occurrence requires its original source file.");
    outcomes.set(node, Object.freeze({ kind: !declared && selected.defaulted ? "default" : "resolved", type,
      provenance: Object.freeze({ group: selected.nodes.find(candidate => candidate.declaration !== undefined)?.declaration ?? selected.variable.node,
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
  for (const node of defaults.nodes) {
    if (!(source.ast.is.IsInterfaceDeclaration(node) || source.ast.is.IsClassDeclaration(node))) continue;
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
        let selected = outcomes.get(node);
        if (ast.is.IsCallExpression(node)) {
          const call = source.semantics.forNode(node).operations.call(node);
          const owner = call === undefined ? undefined : queries.declarations.signatureDeclaration(call.selectedSignature);
          const signature = owner === undefined ? undefined : queries.types.declarationSignatureInfo(owner);
          if (owner !== undefined && signature?.returnType !== undefined &&
            !queries.types.couldContainTypeVariables(signature.returnType)) selected = callableReturn(owner);
        }
        if (selected?.kind === "refused") { failure = selected; break; }
        let current = selected?.type ?? context.describe(node);
        if (current === undefined) { incomplete = true; break; }
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
    if (ast.is.IsGetAccessorDeclaration(node) || ast.is.IsSetAccessorDeclaration(node) || ast.is.IsConstructorDeclaration(node) ||
      ast.is.IsCallSignatureDeclaration(node) || ast.is.IsConstructSignatureDeclaration(node)) continue;
    const selectedCall = { declaration: node,
      typeParameters: sourceTypeFlowTypeParameters(ast, node),
      parameters: parameters.filter((parameter): parameter is NonNullable<typeof parameter> => parameter !== undefined),
      result: returned.type };
    const described = contextual?.type ?? context.describe(node);
    const structure = described === undefined ? undefined : sourceTypeDescriptorStructure(described);
    if (structure === undefined || structure.kind !== "callable" && structure.kind !== "shape" || structure.calls.length === 0) {
      throw new Error("A Source callable value requires its complete canonical member and signature inventory.");
    }
    const type: SourceTypeDescriptor = { ...structure, calls: structure.calls.length === 1 ? [selectedCall]
      : structure.calls.map(signature => signature.declaration === node ? selectedCall : signature) };
    const outcome = Object.freeze({ ...returned, type: freezeSourceTypeDescriptor(type) });
    outcomes.set(node, outcome);
    for (const use of source.navigation.declarationUses(node)) {
      if (use.role === "type-only" || use.role === "source-linkage") continue;
      const sourceFile = ast.getSourceFile(use.reference);
      if (sourceFile !== undefined) outcomes.set(use.reference, Object.freeze({ ...outcome,
        provenance: Object.freeze({ ...outcome.provenance, occurrence: use.reference, sourceFile }) }));
    }
  }
  for (const node of defaults.nodes) if (source.ast.is.IsCallExpression(node)) {
    const queries = source.semantics.forNode(node);
    const call = queries.operations.call(node);
    const declaration = call === undefined ? undefined : queries.declarations.signatureDeclaration(call.selectedSignature);
    const signature = declaration === undefined ? undefined : queries.types.declarationSignatureInfo(declaration);
    if (declaration === undefined || signature?.returnType === undefined || queries.types.couldContainTypeVariables(signature.returnType)) continue;
    const returned = callableReturn(declaration);
    if (returned === undefined) continue;
    if (returned.kind === "refused") outcomes.set(node, returned);
    else {
      const file = source.ast.getSourceFile(node);
      if (file !== undefined) outcomes.set(node, Object.freeze({ ...returned,
        provenance: Object.freeze({ ...returned.provenance, occurrence: node, sourceFile: file }) }));
    }
  }
  for (const [node, refusal] of defaults.descriptorRefusals) outcomes.set(node, refusal);
  publishSourceLiteralMetadata(context, defaults.nodes, outcomes, callableReturn, node => {
    const variable = valueVariables.get(node);
    return variable === undefined ? undefined : group(variable).chosenFill?.component;
  }, node => defaults.descriptorRefusals.get(node));
  function authority(node: Node): "inferred" | "declared" {
    const variable = valueVariables.get(node);
    const selected = variable === undefined ? undefined : group(variable).chosenFill;
    return selected?.authority === "declared" ? "declared" : defaults.declaredSlots.get(node)?.authority ?? "inferred";
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
  const frozenIssues = Object.freeze([...new Set([...defaults.signatureRefusals.values(), ...defaults.descriptorRefusals.values(),
    ...[...groups.values()].flatMap(selected => selected.refused === undefined ? [] : [selected.refused])])]
    .sort((left, right) => compare(left.site, right.site)));
  const frozenObligations = Object.freeze(obligations.filter(obligation => !defaults.descriptorRefusals.has(obligation.site)));
  return Object.freeze({ get: (node: Node) => outcomes.get(node), callableReturn, callInstantiation: (call: Node) => calls.get(call),
    obligations: () => frozenObligations, refusals: () => frozenIssues });
}
