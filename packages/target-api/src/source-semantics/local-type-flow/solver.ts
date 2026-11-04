import type { Node } from "@tsonic/tsts";
import { Node_Initializer } from "../../source-navigation/ast.js";
import { createSourceTypeFlowAnalysisContext, sourceTypeFlowIntegerFits, sourceTypeFlowNumericLiteralKind } from "./defaults.js";
import { collectSourceTypeFlowEdges } from "./edges.js";
import { createSourceTypeFlowRefusal } from "./refusals.js";
import { collectSourceTypeFlowSignatures } from "./signatures.js";
import { createSourceTypeFlowTerms, freezeSourceTypeDescriptor, isSourceTypeFlowDeclaredConstruction, sourceTypeDescriptorDepth, sourceTypeDescriptorsEqual } from "./terms.js";
import { collectSourceTypeFlowUses } from "./uses.js";
import type {
  SourceEffectiveCallInstantiation, SourceEffectiveTypeOutcome, SourceEffectiveTypes, SourceTypeDescriptor,
  SourceTypeFlowAssociation, SourceTypeFlowDerived, SourceTypeFlowGraph, SourceTypeFlowNode,
  SourceTypeFlowObligation, SourceTypeFlowRefusal, SourceTypeFlowSignature, SourceTypeFlowSource,
  SourceTypeFlowTerm, SourceTypeFlowUse, SourceTypeFlowVariable,
} from "./types.js";

interface Fill {
  readonly type: SourceTypeDescriptor;
  readonly site: Node;
  readonly fixed: boolean;
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
  readonly issues: SourceTypeFlowRefusal[];
  readonly inference: boolean;
  outside: boolean;
  type?: SourceTypeDescriptor;
  filledBy?: Node;
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
  const obligations: SourceTypeFlowObligation[] = [];
  const issues: SourceTypeFlowRefusal[] = [];
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
      const declared = selected.nodes.filter(isSourceTypeFlowDeclaredConstruction);
      const constructions = declared.flatMap(node => {
        const component = node.association?.component;
        const type = component === undefined ? undefined : context.describe(node.node, component);
        return type === undefined ? [] : [{ type, site: node.node, fixed: true }];
      });
      result = { variable: selected.variable, nodes: selected.nodes, terms: selected.terms,
        fills: [], constructions, signatures: [], derived: [], dependencies: new Set(), dependents: new Set(),
        issues: terms.isInference(variable) ? [...selected.refusals] : [], inference: terms.isInference(variable),
        outside: !terms.isInference(variable) && (selected.refusals.length > 0 || constructions.length < declared.length),
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
    if (selected.inference) selected.issues.push(use.refusal);
    else selected.outside = true;
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
    const owner = inferenceOwner(issue.site) ?? inferenceOwner(issue.related);
    if (owner !== undefined) owner.issues.push(issue);
    else for (let current: Node | undefined = issue.site; current !== undefined; current = source.ast.parent(current)) {
      const selected = owners.get(current);
      if (selected !== undefined) {
        for (const candidate of selected) candidate.outside = true;
        break;
      }
      if (graph.roots.includes(current)) break;
    }
  }

  function refuse(selected: Group, code: SourceTypeFlowRefusal["code"], site: Node, related?: Node): void {
    if (selected.inference && !selected.issues.some(issue => issue.code === code && issue.site === site)) {
      selected.issues.push(createSourceTypeFlowRefusal(code, site, related));
    }
  }
  function children(term: SourceTypeFlowTerm): readonly SourceTypeFlowVariable[] {
    return term.kind === "array" ? [term.element] : term.kind === "optional" ? [term.value]
      : term.kind === "tuple" ? term.elements : term.kind === "shape" ? term.members.map(member => member.variable)
      : term.kind === "declared" ? term.typeArguments : [];
  }
  const interfaceChecks = new Map<Group, { readonly type: SourceTypeDescriptor; readonly site: Node }>();
  for (const use of uses) if (use.kind === "check" && use.check === "interface") {
    const selected = group(use.variable);
    const prior = interfaceChecks.get(selected);
    if (prior === undefined) interfaceChecks.set(selected, { type: use.type, site: use.site });
    else if (!sourceTypeDescriptorsEqual(prior.type, use.type)) refuse(selected, "TSONIC_LOCAL_TYPE_CONFLICT", use.site, prior.site);
  }
  function member(type: SourceTypeDescriptor, name: string, site: Node): SourceTypeDescriptor | undefined {
    if (type.kind === "shape") return type.members.find(selected => selected.name === name)?.type;
    if (type.kind !== "declared" || type.source === undefined) return undefined;
    const queries = source.semantics.forNode(site);
    const property = queries.types.propertyInfos(type.source.selectedType).find(candidate => candidate.name === name);
    if (property === undefined) return undefined;
    if (queries.types.callSignatures(property.type).length > 0 || queries.types.constructSignatures(property.type).length > 0) return undefined;
    const declaration = queries.declarations.primarySymbolDeclaration(property.symbol);
    return context.describe(site, { selectedType: property.type,
      ...(declaration === undefined ? {} : { declaration, authoredTypeNode: source.ast.typeNode(declaration) }) });
  }
  const pendingFills: { readonly variable: SourceTypeFlowVariable; readonly fill: Fill }[] = [];
  for (const selected of groups.values()) {
    for (const fill of selected.constructions) pendingFills.push({ variable: selected.variable, fill });
    for (const term of selected.terms) if (term.kind === "fixed") {
      pendingFills.push({ variable: selected.variable, fill: { type: term.type, site: term.site, fixed: true } });
    }
  }
  for (const use of uses) if (use.kind === "fill") {
    pendingFills.push({ variable: use.variable, fill: { type: use.type, site: use.site, fixed: false } });
  }
  for (let index = 0; index < pendingFills.length; index += 1) {
    const { variable, fill } = pendingFills[index]!;
    const selected = group(variable);
    if (selected.fills.some(prior => prior.site === fill.site && prior.fixed === fill.fixed &&
      sourceTypeDescriptorsEqual(prior.type, fill.type))) continue;
    selected.fills.push(fill);
    if (sourceTypeDescriptorDepth(fill.type) > 4) {
      refuse(selected, "TSONIC_LOCAL_TYPE_LIMIT", fill.site);
      continue;
    }
    for (const term of selected.terms) {
      const add = (child: SourceTypeFlowVariable, type: SourceTypeDescriptor | undefined): void => {
        if (type !== undefined) pendingFills.push({ variable: child, fill: { ...fill, type } });
      };
      if (term.kind === "array" && fill.type.kind === "array") add(term.element, fill.type.element);
      else if (term.kind === "optional" && fill.type.kind === "optional") add(term.value, fill.type.value);
      else if (term.kind === "tuple" && fill.type.kind === "tuple") {
        add(term.elements[0], fill.type.elements[0]); add(term.elements[1], fill.type.elements[1]);
      } else if (term.kind === "declared" && fill.type.kind === "declared" && term.declaration === fill.type.declaration) {
        term.typeArguments.forEach((argument, offset) => add(argument, fill.type.kind === "declared" ? fill.type.typeArguments[offset] : undefined));
      } else if (term.kind === "shape" && (fill.type.kind === "shape" || fill.type.kind === "declared")) {
        for (const entry of term.members) add(entry.variable, member(fill.type, entry.name, fill.site));
      }
    }
  }
  for (const selected of groups.values()) {
    if (!selected.inference && !selected.nodes.some(node => node.kind === "binder") && selected.terms.some(term =>
      term.kind === "numeric" && term.literal.integerConstant !== undefined &&
      term.literal.numeric === undefined && term.literal.integer === undefined)) {
      selected.outside = true;
    }
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
  const outside = [...groups.values()].filter(selected => selected.outside);
  for (let index = 0; index < outside.length; index += 1) {
    const selected = outside[index]!;
    const linked = [...selected.dependents];
    for (const term of selected.terms) for (const child of children(term)) linked.push(group(child));
    for (const dependent of linked) if (!dependent.inference && !dependent.outside) {
      dependent.outside = true;
      outside.push(dependent);
    }
  }

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
      const array = graph.nodes.find(node => node.term?.kind === "array" &&
        source.ast.is.IsArrayLiteralExpression(node.node) && group(node.term.element) === selected);
      refuse(selected, array === undefined ? "TSONIC_LOCAL_TYPE_CONFLICT" : "TSONIC_LOCAL_TYPE_MIXED_ELEMENTS",
        array?.node ?? fixed[1]!.site, fixed[0]!.site);
      return;
    }
    for (const fill of selected.fills) if (!sourceTypeDescriptorsEqual(selected.type, fill.type)) {
      refuse(selected, selected.signatures.length > 0 ? "TSONIC_LOCAL_TYPE_SIGNATURE" : "TSONIC_LOCAL_TYPE_CONFLICT",
        fill.site, selected.filledBy ?? selected.signatures[0]?.site);
    }
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
        const first = group(term.elements[0]).type; const second = group(term.elements[1]).type;
        if (first !== undefined && second !== undefined) return { kind: "tuple", readonly: term.readonly, elements: [first, second] };
      } else if (term.kind === "declared") {
        const arguments_: SourceTypeDescriptor[] = [];
        for (const argument of term.typeArguments) {
          const value = group(argument).type;
          if (value === undefined) return undefined;
          arguments_.push(value);
        }
        return { kind: "declared", declaration: term.declaration, typeArguments: arguments_,
          ...(term.source === undefined ? {} : { source: term.source }) };
      } else if (term.kind === "shape") {
        if (term.members.length === 0 && source.ast.is.IsObjectLiteralExpression(term.site)) {
          refuse(selected, "TSONIC_UNTYPED_OBJECT_LITERAL", term.site);
          continue;
        }
        const members = [];
        for (const entry of term.members) {
          const type = group(entry.variable).type;
          if (type === undefined) return undefined;
          members.push({ name: entry.name, optional: entry.optional, type,
            ...(entry.declaration === undefined ? {} : { declaration: entry.declaration }),
            ...(entry.readonly === undefined ? {} : { readonly: entry.readonly }) });
        }
        return { kind: "shape", members };
      }
    }
    return undefined;
  }

  function derivedType(derived: SourceTypeFlowDerived): SourceTypeDescriptor | undefined {
    const operands = derived.operands.map(operand => group(operand));
    const types = operands.map(operand => operand.type);
    if (types.some(type => type === undefined)) return undefined;
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
    const fixed = selected.fills.filter(fill => fill.fixed);
    const declared = selected.signatures.length > 0;
    const retainedStructure = !selected.inference && selected.terms.some(term => term.kind !== "fixed" && term.kind !== "numeric" &&
      !source.ast.is.IsArrayLiteralExpression(term.site) && !source.ast.is.IsObjectLiteralExpression(term.site))
      ? constructed(selected) : undefined;
    const anchor = selected.constructions[0] ?? (!selected.inference ? fixed[0] ??
      (retainedStructure === undefined ? selected.fills.find(fill => !fill.fixed)
        : { type: retainedStructure, site: selected.variable.node, fixed: true })
      : declared ? fixed[0] : selected.fills[0]);
    if (anchor !== undefined && (selected.derived.length === 0 || accumulator)) {
      selected.type = anchor.type; selected.filledBy = anchor.site;
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
    for (const dependency of selected.dependencies) for (const issue of selected.inference ? dependency.issues : []) {
      if (!selected.issues.includes(issue)) selected.issues.push(issue);
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
    if (selfDerived && !accumulator) refuse(selected, "TSONIC_LOCAL_TYPE_UNSUPPORTED", selected.variable.node);
    else solve(selected, accumulator);
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

  function obligation(use: SourceTypeFlowUse, selected: Group): void {
    if (selected.type === undefined || selected.issues.length > 0 || selected.outside) return;
    if (use.kind === "check") {
      obligations.push(Object.freeze({ kind: use.check, site: use.site, type: selected.type,
        required: use.required, requiredType: freezeSourceTypeDescriptor(use.type), association: use.association }));
    } else if (use.kind === "write") {
      const valueVariable = use.valueVariable ?? valueVariables.get(use.value);
      const valueGroup = valueVariable === undefined ? undefined : group(valueVariable);
      const record = valueVariable?.path.length === 0 ? declaredRecord(valueVariable.node) : undefined;
      const selectedValue = record !== undefined ? declaredDescriptor(record)
        : valueGroup?.issues.length === 0 ? valueGroup.type : undefined;
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
    if (!declared && !selected.inference && (selected.filledBy === undefined || selected.defaulted)) return;
    const type = record !== undefined ? declaredDescriptor(record) : selected.type;
    if (declared && type === undefined) return;
    if (!declared && selected.outside) return;
    selected.issues.sort((left, right) => compare(left.site, right.site));
    if (!declared && selected.inference && selected.issues[0] !== undefined) { outcomes.set(node, selected.issues[0]); return; }
    if (type === undefined) {
      if (!selected.inference) return;
      const issue = createSourceTypeFlowRefusal("TSONIC_LOCAL_TYPE_UNSUPPORTED", node);
      outcomes.set(node, issue); issues.push(issue); return;
    }
    const sourceFile = source.ast.getSourceFile(node);
    if (sourceFile === undefined) throw new Error("A checked effective type occurrence requires its original source file.");
    outcomes.set(node, Object.freeze({ kind: !declared && selected.defaulted ? "default" : "resolved", type,
      provenance: Object.freeze({ group: selected.nodes.find(candidate => candidate.declaration !== undefined)?.declaration ?? selected.variable.node,
        occurrence: node, sourceFile, ...(selected.filledBy === undefined ? {} : { filledBy: selected.filledBy }),
        ...(association?.component === undefined ? {} : { component: association.component }),
        ...(defaults.fixedRule(node) === undefined ? {} : { fixedRule: defaults.fixedRule(node) }) }) }));
  }
  for (const node of graph.nodes) if (node.publish) publish(node.node, group(node.variable), node.association);
  for (const derived of graph.derived) publish(derived.node, group(derived.result));
  for (const selected of groups.values()) {
    issues.push(...selected.issues);
    for (const node of selected.nodes) if (node.publish && node.declaration === node.node && selected.type !== undefined) {
      for (const use of source.navigation.declarationUses(node.declaration)) if (use.role !== "type-only" && use.role !== "source-linkage") {
        publish(use.reference, selected, node.association);
      }
    }
  }
  for (const node of graph.nodes) {
    const term = node.term;
    if (term === undefined || term.site !== node.node || node.variable.path.length !== 0) continue;
    const selected = group(node.variable);
    if (selected.inference && selected.type !== undefined && !selected.outside && selected.issues.length === 0 && (
      term.kind === "numeric" && context.literal(term.site) !== undefined ||
      term.kind === "array" && source.ast.is.IsArrayLiteralExpression(term.site) ||
      term.kind === "shape" && source.ast.is.IsObjectLiteralExpression(term.site))) {
      obligations.push(Object.freeze({ kind: "literal-admission", site: node.node, type: selected.type, required: node.node }));
    }
  }
  for (const call of graph.calls) {
    if (graph.refusals.some(issue => issue.site === call.node)) continue;
    const vector = (binders: typeof call.receiver) => binders.flatMap(binder => {
      const selected = group(binder.variable);
      return selected.type === undefined || selected.issues.length > 0 || selected.outside ? []
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
  for (const node of defaults.nodes) {
    if (outcomes.has(node)) continue;
    if (!source.ast.is.IsVariableDeclaration(node) && !source.ast.is.IsParameterDeclaration(node) &&
      !source.ast.is.IsPropertyDeclaration(node) && !source.ast.is.IsIdentifier(node) &&
      !source.ast.is.IsPropertyAccessExpression(node) && !source.ast.is.IsElementAccessExpression(node) &&
      !source.ast.is.IsCallExpression(node)) continue;
    const declaration = source.navigation.sourceReferenceFor(node)?.declaration ?? node;
    const initializer = source.ast.is.IsVariableDeclaration(declaration) || source.ast.is.IsPropertyDeclaration(declaration) ||
      source.ast.is.IsParameterDeclaration(declaration) ? Node_Initializer(source.ast, declaration) : undefined;
    const literalDefault = initializer !== undefined && (context.literal(initializer) !== undefined || source.ast.is.IsObjectLiteralExpression(initializer));
    if (defaults.fixedRule(node) === undefined && !defaults.hasDeclaredSourceType(node) && !literalDefault) continue;
    const type = context.describe(node);
    const sourceFile = source.ast.getSourceFile(node);
    if (type === undefined || sourceFile === undefined) continue;
    outcomes.set(node, Object.freeze({ kind: literalDefault ? "default" : "resolved", type,
      provenance: Object.freeze({ group: declaration, occurrence: node, sourceFile,
        ...(defaults.fixedRule(node) === undefined ? {} : { fixedRule: defaults.fixedRule(node) }) }) }));
  }
  const uniqueIssues = issues.filter((issue, index) => issues.findIndex(prior => prior.code === issue.code && prior.site === issue.site) === index)
    .sort((left, right) => compare(left.site, right.site));
  const frozenIssues = Object.freeze(uniqueIssues);
  const frozenObligations = Object.freeze(obligations);
  return Object.freeze({ get: (node: Node) => outcomes.get(node), callInstantiation: (call: Node) => calls.get(call),
    obligations: () => frozenObligations, refusals: () => frozenIssues });
}
