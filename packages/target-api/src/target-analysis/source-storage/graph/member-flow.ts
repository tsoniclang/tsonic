import type { Node, SourceFile } from "@tsonic/tsts";
import type { SourceTypeEvidence } from "../../../public/source/contracts.js";
import type { SourceMemberPair } from "../../../source-model/members.js";
import type { SourceStorageProjection, SourceStorageSubject } from "../../../source-model/storage.js";
import { sourceLiteralDomainUnion } from "../../../source-model/literals/domain.js";
import { sourceLiteralKeyIdentity } from "../../../source-model/literals/key.js";
import type { SourceConstructionMemberContribution, SourceMemberInventoryRow } from "../../../source-semantics/member-inventory.js";
import { sourceMemberOwner } from "../../../source-navigation/class-members.js";
import type { SourceStorageClassLineage } from "../model/construction.js";
import { sourcePresentStorageType, sourceStorageComponents, sourceStorageIsScalarType, sourceStorageSubjectType } from "../model/components.js";
import type { SourceStorageProgram } from "../model/program.js";
import { sourceStorageValue } from "../model/program.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import { sourceStorageHasOriginalValue, sourceStorageIsDataMember, sourceStorageIsMethodMember, sourceStorageMemberSubject, sourceStorageObjectRestOwner } from "../model/subjects.js";
import type { SourceStorageSubjectQuery } from "../model/subjects.js";

interface MemberIndex {
  aggregateReady: boolean;
  members: readonly SourceMemberPair[] | undefined;
  readonly declarations: Map<Node, {
    readonly member: SourceMemberPair;
    readonly originals: readonly Node[];
  }>;
}

const noMembers: readonly SourceMemberPair[] = Object.freeze([]);

export interface SourceStorageSpreadMember {
  readonly member: SourceMemberInventoryRow;
  readonly declarations: readonly Node[];
}

export interface SourceStorageCopySelection {
  readonly optional: boolean;
  readonly contributions: readonly SourceConstructionMemberContribution[];
}

export function sourceStorageCopyComponents(member: SourceMemberInventoryRow): readonly SourceStorageProjection[] {
  const declarations = member.read === "accessor" ? member.getters : member.declarations;
  return Object.freeze([...new Set(declarations)].map(declaration => Object.freeze({
    kind: member.read === "method" ? "method-value" as const : "member" as const, declaration })));
}

export function createSourceStorageMemberFlow(
  source: SourceStorageProgram,
  budget: SourceStorageBudget,
  subject: SourceStorageSubjectQuery,
  sourceFileFor: (subject: SourceStorageSubject) => SourceFile | undefined,
  retainCheckedContext: (node: Node, sourceFile: SourceFile) => boolean,
) {
  const selections = new Map<SourceFile, Map<SourceTypeEvidence, Map<SourceTypeEvidence | undefined, Map<SourceTypeEvidence, MemberIndex>>>>();
  const settled = <Value>(result: import("../../../source-model/production.js").SourceProductionResult<Value>): Value =>
    sourceStorageValue(source.analysis.settle(result));
  const physicalMember = (member: SourceMemberPair, contract: SourceMemberPair | undefined): SourceMemberPair => {
    const allocated: SourceMemberPair = member.kind === "absent" && contract?.kind === "present" && contract.source.optional
      ? Object.freeze({ kind: "present", destination: member.destination, source: contract.source }) : member;
    return allocated.kind === "present" && contract?.kind === "present" && contract.source.readonly
      ? Object.freeze({ ...allocated, source: Object.freeze({ ...allocated.source, readonly: true }) }) : allocated;
  };
  const indexFor = (file: SourceFile, from: SourceTypeEvidence, to: SourceTypeEvidence, contextual: SourceTypeEvidence | undefined,
    selection: "aggregate" | Node): MemberIndex | undefined => {
    source.facts.descriptors.assertEvidence(from);
    source.facts.descriptors.assertEvidence(to);
    if (contextual !== undefined) source.facts.descriptors.assertEvidence(contextual);
    const sources = selections.get(file);
    const contexts = sources?.get(from);
    const destinations = contexts?.get(contextual);
    const existing = destinations?.get(to);
    if (selection === "aggregate" ? existing?.aggregateReady : existing?.declarations.has(selection)) return existing;
    const rows = budget.createRows();
    let published = false;
    try {
      let aggregate: readonly SourceMemberPair[] | undefined;
      let selectedMember: { readonly member: SourceMemberPair; readonly originals: readonly Node[] } | undefined;
      if (selection === "aggregate") {
        const selected = sourceStorageValue(source.facts.objects.correspondence(from, to, "correspondence"));
        if (selected.kind === "unavailable") {
          if (selected.reason !== "disjoint-shape") return undefined;
          aggregate = noMembers;
        } else {
          const contracts = new Map<string | Node, SourceMemberPair>();
          if (contextual !== undefined) {
            const original = sourceStorageValue(source.facts.objects.correspondence(contextual, to, "correspondence"));
            if (original.kind !== "available") return undefined;
            for (const member of original.members) {
              if (!budget.step() || !rows.add(1)) return undefined;
              contracts.set(sourceLiteralKeyIdentity(member.destination.key), member);
            }
          }
          if (!rows.add(1 + selected.members.length)) return undefined;
          const members: SourceMemberPair[] = [];
          for (const member of selected.members) {
            if (!budget.step()) return undefined;
            members.push(physicalMember(member, contracts.get(sourceLiteralKeyIdentity(member.destination.key))));
          }
          aggregate = Object.freeze(members);
        }
      } else {
        if (!budget.step()) return undefined;
        const selected = sourceStorageValue(source.facts.objects.correspondingMember(from, to, selection, "correspondence"));
        if (selected.kind === "none") return undefined;
        let contract: SourceMemberPair | undefined;
        if (contextual !== undefined) {
          const original = sourceStorageValue(source.facts.objects.correspondingMember(contextual, to, selection, "correspondence"));
          if (original.kind === "none") return undefined;
          contract = original.value;
        }
        const member = physicalMember(selected.value, contract);
        if (!member.destination.declarations.includes(selection)) return undefined;
        const originals = member.kind === "present" ? [...new Set(member.source.declarations)] : [];
        if (member.kind === "present" && originals.length === 0) return undefined;
        for (const original of originals) if (!budget.step() || !retainCheckedContext(original, file)) return undefined;
        if (!rows.add(3 + originals.length)) return undefined;
        selectedMember = Object.freeze({ member, originals: Object.freeze(originals) });
      }
      if (budget.failure() !== undefined || existing === undefined &&
        !rows.add(1 + (sources === undefined ? 1 : 0) + (contexts === undefined ? 1 : 0) + (destinations === undefined ? 1 : 0))) return undefined;
      const index = existing ?? { aggregateReady: false, members: undefined, declarations: new Map() };
      if (selection === "aggregate") { index.members = aggregate; index.aggregateReady = true; }
      else {
        if (selectedMember === undefined) return undefined;
        index.declarations.set(selection, selectedMember);
      }
      const retainedSources = sources ?? new Map<SourceTypeEvidence, Map<SourceTypeEvidence | undefined, Map<SourceTypeEvidence, MemberIndex>>>();
      const retainedContexts = contexts ?? new Map<SourceTypeEvidence | undefined, Map<SourceTypeEvidence, MemberIndex>>();
      const retainedDestinations = destinations ?? new Map<SourceTypeEvidence, MemberIndex>();
      retainedDestinations.set(to, index);
      retainedContexts.set(contextual, retainedDestinations);
      retainedSources.set(from, retainedContexts);
      selections.set(file, retainedSources);
      published = true;
      return index;
    } finally {
      if (!published) rows.release();
    }
  };
  const receiverSelection = (owner: SourceStorageSubject, receiverType: SourceTypeEvidence) => {
    if (!budget.step()) return undefined;
    const file = sourceFileFor(owner);
    const checked = sourceStorageSubjectType(source, owner, file);
    if (file === undefined || checked === undefined) return undefined;
    const type = sourcePresentStorageType(checked, source);
    const destinationType = sourcePresentStorageType(receiverType, source);
    if (type === undefined || destinationType === undefined) return undefined;
    let contextual: SourceTypeEvidence | undefined;
    if (owner.projection.length === 0 && source.ast.is.IsObjectLiteralExpression(owner.node)) {
      const selected = sourceStorageValue(source.facts.values.destination(owner.node));
      if (selected.kind === "present") contextual = selected.value.applied;
    }
    return { file, type, destinationType, contextual };
  };
  const aggregateIndex = (owner: SourceStorageSubject, receiverType: SourceTypeEvidence): MemberIndex | undefined => {
    const selected = receiverSelection(owner, receiverType);
    return selected === undefined ? undefined
      : indexFor(selected.file, selected.type, selected.destinationType, selected.contextual, "aggregate");
  };
  const excludes = (owner: SourceStorageSubject, destinationType: SourceTypeEvidence): boolean =>
    aggregateIndex(owner, destinationType)?.members === noMembers;
  const selectedMember = (owner: SourceStorageSubject, declaration: Node, receiverType: SourceTypeEvidence) => {
    const selected = receiverSelection(owner, receiverType);
    return selected === undefined ? undefined : indexFor(selected.file, selected.type, selected.destinationType,
      selected.contextual, declaration)?.declarations.get(declaration);
  };
  const memberFor = (owner: SourceStorageSubject, declaration: Node, receiverType: SourceTypeEvidence): SourceMemberPair | undefined =>
    selectedMember(owner, declaration, receiverType)?.member;
  const declarationsFor = (owner: SourceStorageSubject, declaration: Node, receiverType: SourceTypeEvidence): readonly Node[] | undefined => {
    const entry = selectedMember(owner, declaration, receiverType);
    return entry?.member.kind === "present" ? entry.originals : undefined;
  };
  const membersInLineage = <Bindings>(lineage: SourceStorageClassLineage<Bindings>, declaration: Node, destinationType: SourceTypeEvidence): {
    readonly members: readonly { readonly declaration: Node; readonly bindings: Bindings }[]; readonly absent: boolean;
  } | undefined => {
    if (!lineage.complete || lineage.classes.length === 0) return undefined;
    const root = lineage.classes[0]!;
    const receiver = subject(root.subject.node, "receiver");
    if (receiver === undefined) return undefined;
    if (excludes(receiver, destinationType)) return Object.freeze({ members: Object.freeze([]), absent: false });
    const selected = memberFor(receiver, declaration, destinationType);
    if (selected === undefined) return undefined;
    if (selected.kind === "absent")
      return selected.destination.optional ? Object.freeze({ members: Object.freeze([]), absent: true }) : undefined;
    const members: { readonly declaration: Node; readonly bindings: Bindings }[] = [];
    const uncovered = new Set<Node>();
    for (const original of selected.source.declarations) {
      if (!budget.step()) return undefined;
      if (source.ast.hasModifierKind(original, "static")) continue;
      const owner = sourceMemberOwner(source.ast, original);
      const captures = lineage.classes.filter(captured => captured.subject.node === owner);
      if (captures.length === 0) { uncovered.add(original); continue; }
      for (const capture of captures) members.push(Object.freeze({ declaration: original, bindings: capture.bindings }));
    }
    if (uncovered.size !== 0) {
      const nativeBase = lineage.nativeBase;
      if (nativeBase === undefined || nativeBase.constructors.length === 0 || nativeBase.receiver === undefined) return undefined;
      let originals: ReadonlySet<Node> | undefined;
      for (const constructor of nativeBase.constructors) {
        if (!budget.step()) return undefined;
        if (constructor.kind !== "construct") throw new Error("A Native constructor premise requires its original construct identity.");
        const native = sourceStorageValue(source.facts.objects.correspondingMember(nativeBase.receiver, destinationType, declaration, "correspondence"));
        if (native.kind !== "present" || native.value.kind !== "present") return undefined;
        const physical = new Set(native.value.source.declarations.filter(original => !source.ast.hasModifierKind(original, "static")));
        if (physical.size === 0 || originals !== undefined &&
          (physical.size !== originals.size || [...physical].some(original => !originals!.has(original)))) return undefined;
        originals = physical;
      }
      if (originals === undefined || [...uncovered].some(original => !originals!.has(original))) return undefined;
      for (const original of uncovered) members.push(Object.freeze({ declaration: original, bindings: nativeBase.bindings }));
    }
    return members.length === 0 ? undefined : Object.freeze({ members: Object.freeze(members), absent: false });
  };
  const construction = (occurrence: Node, before: Node) => settled(source.analysis.objects.construction(occurrence, before, {
    read: (original, values) => source.analysis.aggregate(original, values), domain: sourceLiteralDomainUnion }));
  const copyContributionsFor = (owner: SourceStorageSubject, declaration: Node, destinationType: SourceTypeEvidence,
    before: Node): SourceStorageCopySelection | undefined => {
    if (owner.projection.length !== 0 || !source.ast.is.IsObjectLiteralExpression(owner.node) &&
      sourceStorageObjectRestOwner(owner.node, source.ast) === undefined) return undefined;
    const selected = settled(source.analysis.objects.correspondingDeclarations({ kind: "evidence", value: destinationType },
      { kind: "evidence", value: destinationType }, "source", declaration));
    if (selected.kind !== "present") return undefined;
    const identity = sourceLiteralKeyIdentity(selected.value.source.key);
    const history = construction(owner.node, before);
    if (history.kind !== "complete") return undefined;
    const entries = history.members.filter(entry => sourceLiteralKeyIdentity(entry.member.key) === identity);
    if (entries.length > 1) throw new Error("Canonical construction history requires one row per original property key.");
    if (entries.length === 0) return Object.freeze({ optional: true, contributions: Object.freeze([]) });
    const entry = entries[0]!;
    return Object.freeze({ optional: entry.member.optional, contributions: entry.contributions });
  };
  const spreadMembersFor = (expression: Node, evaluation: Node): readonly SourceStorageSpreadMember[] | undefined => {
    if (!budget.step()) return undefined;
    const parent = source.ast.parent(evaluation);
    const rest = sourceStorageObjectRestOwner(evaluation, source.ast) !== undefined;
    const occurrence = rest ? evaluation : parent !== undefined && source.ast.is.IsObjectLiteralExpression(parent) ? parent : undefined;
    if (occurrence !== undefined) {
      const history = settled(source.analysis.inventory.constructionHistory(occurrence));
      const index = history.steps.findIndex(step => step.evaluation === evaluation);
      const step = history.steps[index];
      if (index < 0 || step === undefined || step.kind === "own" || step.operand !== expression) return undefined;
      const before = history.steps[index + 1]?.evaluation ?? occurrence;
      const selected = construction(occurrence, before);
      if (selected.kind !== "complete") return undefined;
      const members: SourceStorageSpreadMember[] = [];
      for (const entry of selected.members) for (const contribution of entry.contributions) {
        if (!budget.step()) return undefined;
        if (contribution.kind !== "copy" || contribution.evaluation !== evaluation) continue;
        const declarations = contribution.member.read === "accessor" ? contribution.member.getters : contribution.member.declarations;
        for (const declaration of declarations) {
          const file = source.ast.getSourceFile(declaration);
          if (file === undefined || !retainCheckedContext(declaration, file)) return undefined;
        }
        members.push(Object.freeze({ member: contribution.member, declarations: Object.freeze([...declarations]) }));
      }
      return Object.freeze(members);
    }
    if (!source.ast.is.IsBindingElement(evaluation)) return undefined;
    const binding = source.ast.as.AsBindingElement(evaluation);
    const name = binding?.PropertyName ?? source.ast.name(evaluation);
    if (name === undefined) return undefined;
    const property = sourceStorageValue(source.facts.objects.propertyName(name));
    const key = property.kind === "name" ? Object.freeze({ kind: "name" as const, name: property.name })
      : property.kind === "symbol" || property.kind === "well-known-symbol"
        ? Object.freeze({ kind: "symbol" as const, declaration: property.declaration }) : undefined;
    if (key === undefined) return undefined;
    const value = sourceStorageValue(source.facts.values.type(expression));
    const selected = settled(source.analysis.objects.named(value, key));
    if (selected.kind !== "available") return undefined;
    return Object.freeze(selected.members.map(member => Object.freeze({ member,
      declarations: member.read === "accessor" ? member.getters : member.declarations })));
  };
  const memberStorageKindFor = (owner: SourceStorageSubject, declaration: Node, destinationType: SourceTypeEvidence):
    "direct" | "copied" | "absent" | undefined => {
    if (owner.projection.length !== 0) return "direct";
    if (sourceStorageObjectRestOwner(owner.node, source.ast) !== undefined) return "copied";
    if (!source.ast.is.IsObjectLiteralExpression(owner.node)) return "direct";
    const selected = copyContributionsFor(owner, declaration, destinationType, owner.node);
    if (selected === undefined) return undefined;
    if (selected.contributions.length === 0) return "absent";
    return selected.contributions.every(contribution => contribution.kind === "own" &&
      contribution.declarations.includes(declaration)) ? "direct" : "copied";
  };
  const componentsFor = (owner: SourceStorageSubject): readonly SourceStorageProjection[] | undefined => {
    const file = sourceFileFor(owner);
    const type = sourceStorageSubjectType(source, owner, file);
    if (file === undefined || type === undefined) return undefined;
    const present = sourcePresentStorageType(type, source);
    if (present === undefined) return Object.freeze([]);
    const indexed = [...sourceStorageComponents(present, source)];
    if (indexed.length !== 0) return Object.freeze(indexed);
    const declarations = new Set<Node>();
    const components: SourceStorageProjection[] = [];
    for (const arm of present.sum?.arms ?? [present]) {
      const inventory = settled(source.analysis.inventory.members(arm));
      if (inventory.kind !== "complete") return undefined;
      for (const member of inventory.members) {
        if (!budget.step()) return undefined;
        for (const declaration of member.declarations) {
          if (!budget.step()) return undefined;
          if (declarations.has(declaration) || source.ast.hasModifierKind(declaration, "static") ||
            !sourceStorageIsDataMember(declaration, source.ast) && !sourceStorageIsMethodMember(declaration, source.ast) &&
              !source.ast.is.IsGetAccessorDeclaration(declaration)) continue;
          if (!retainCheckedContext(declaration, file)) return undefined;
          declarations.add(declaration);
          components.push(Object.freeze({ kind: sourceStorageIsMethodMember(declaration, source.ast) ? "method-value" : "member", declaration }));
        }
      }
    }
    return Object.freeze(components);
  };
  return Object.freeze({ memberFor, membersInLineage, declarationsFor, excludes, copyContributionsFor,
    memberStorageKindFor, spreadMembersFor, componentsFor,
    membersFor: (owner: SourceStorageSubject, destinationType: SourceTypeEvidence): readonly SourceMemberPair[] | undefined =>
      aggregateIndex(owner, destinationType)?.members });
}

interface SourceStorageMemberImplementationInputs {
  readonly subject: import("../model/subjects.js").SourceStorageSubjectQuery;
  subjectFor(node: Node | undefined): SourceStorageSubject | undefined;
  incomingFor(subject: SourceStorageSubject): ReadonlySet<SourceStorageSubject>;
  originsFor(subject: SourceStorageSubject): Iterable<SourceStorageSubject> | undefined;
  storesFor(subject: SourceStorageSubject): Iterable<import("../model/stores.js").SourceStorageStore> | undefined;
  readonly declarationsFor: ReturnType<typeof createSourceStorageMemberFlow>["declarationsFor"];
  readonly excludes: ReturnType<typeof createSourceStorageMemberFlow>["excludes"];
  readonly membersInLineage: ReturnType<typeof createSourceStorageMemberFlow>["membersInLineage"];
  readonly memberStorageKindFor: ReturnType<typeof createSourceStorageMemberFlow>["memberStorageKindFor"];
  constructionLineagesFor(invocation: Node,
    originsFor: (subject: SourceStorageSubject) => Iterable<SourceStorageSubject> | undefined,
    mode?: "heritage"): readonly SourceStorageClassLineage<undefined>[] | undefined;
  readonly contracts: ReadonlyMap<Node, ReadonlySet<Node>>;
  readonly accessorTargets: ReadonlyMap<Node, readonly import("./scoped-model.js").SourceStorageAccessorInvocation[]>;
}

export function createSourceStorageMemberImplementations(source: SourceStorageProgram, budget: SourceStorageBudget,
  inputs: SourceStorageMemberImplementationInputs) {
  const { ast } = source;
  const { navigation } = source.facts;
  const step = budget.step;
  const implementationsFor = (declaration: Node, invocation: Node,
    originsFor: (subject: SourceStorageSubject) => Iterable<SourceStorageSubject> | undefined = inputs.originsFor,
    checkedReceiver?: Node): { readonly nodes: ReadonlySet<Node>; readonly exact: boolean;
      readonly slots?: ReadonlySet<SourceStorageSubject> } => {
    const selected = new Set<Node>();
    const implementation = navigation.callableImplementation(declaration);
    if (implementation.kind === "resolved") selected.add(implementation.implementation.declaration);
    if (ast.hasModifierKind(declaration, "static") || ast.hasModifierKind(declaration, "private") ||
      !ast.is.IsMethodDeclaration(declaration) && ast.kindName(declaration) !== "KindMethodSignature" &&
      !ast.is.IsGetAccessorDeclaration(declaration) && !ast.is.IsSetAccessorDeclaration(declaration))
        return { nodes: selected, exact: implementation.kind === "resolved" };
    const accessorReceivers = [...new Set(inputs.accessorTargets.get(invocation)
      ?.filter(target => target.declaration === declaration).map(target => target.receiver) ?? [])];
    if (checkedReceiver === undefined && accessorReceivers.length > 1) {
      const nodes = new Set<Node>();
      const slots = new Set<SourceStorageSubject>();
      let exact = true;
      for (const receiver of accessorReceivers) {
        if (!step()) return { nodes, exact: false, slots };
        const result = implementationsFor(declaration, invocation, originsFor, receiver);
        for (const node of result.nodes) nodes.add(node);
        for (const slot of result.slots ?? []) slots.add(slot);
        exact &&= result.exact;
      }
      return { nodes, exact, slots };
    }
    const callable = ast.is.IsCallExpression(invocation) || ast.is.IsNewExpression(invocation)
      ? sourceStorageValue(source.facts.applications.application(invocation)) : undefined;
    const memberOccurrence = callable?.callee.occurrence ?? invocation;
    const access = ast.is.IsPropertyAccessExpression(memberOccurrence) || ast.is.IsElementAccessExpression(memberOccurrence)
      ? sourceStorageValue(source.facts.objects.use(memberOccurrence)) : undefined;
    const receiver = checkedReceiver ?? (callable?.receiver.kind === "value" ? callable.receiver.occurrence
      : access?.receiver.occurrence ?? (accessorReceivers.length === 1 ? accessorReceivers[0] : undefined));
    const receiverType = checkedReceiver !== undefined ? sourceStorageValue(source.facts.values.type(checkedReceiver))
      : callable?.receiver.kind === "value" ? callable.receiver.value : access?.receiver.value;
    if (receiverType !== undefined && sourceStorageIsScalarType(receiverType, source))
      return { nodes: selected, exact: true };
    if (ast.kindName(receiver) === "KindSuperKeyword") return { nodes: selected, exact: true };
    const receiverSubject = inputs.subjectFor(receiver);
    const origins = receiverSubject === undefined ? undefined : originsFor(receiverSubject);
    const exact = new Set<Node>();
    const slots = new Set<SourceStorageSubject>();
    let unknown = receiverSubject === undefined;
    const selectSlot = (slot: SourceStorageSubject): void => {
      slots.add(slot);
      for (const value of originsFor(slot) ?? []) {
        if (!step()) return;
        if (!sourceStorageHasOriginalValue(value, ast, inputs.incomingFor(value).size !== 0)) continue;
        const implementation = navigation.callableImplementation(value.node);
        if (implementation.kind !== "resolved") { unknown = true; continue; }
        exact.add(implementation.implementation.declaration);
      }
    };
    const selectMember = (member: Node): void => {
      if (ast.is.IsGetAccessorDeclaration(declaration) && ast.is.IsSetAccessorDeclaration(member) ||
        ast.is.IsSetAccessorDeclaration(declaration) && ast.is.IsGetAccessorDeclaration(member)) return;
      if (ast.is.IsGetAccessorDeclaration(member) || ast.is.IsSetAccessorDeclaration(member)) {
        exact.add(member);
        return;
      }
      const slot = sourceStorageMemberSubject(member, ast, inputs.subject);
      if (slot === undefined) return;
      if (ast.is.IsMethodDeclaration(member) && ast.body(member) !== undefined &&
        inputs.storesFor(slot)?.[Symbol.iterator]().next().done !== false) {
        inputs.incomingFor(slot);
        slots.add(slot);
        exact.add(member);
      } else selectSlot(slot);
    };
    for (const origin of origins ?? []) {
      if (!step()) return { nodes: selected, exact: false };
      if (ast.is.IsParameterDeclaration(origin.node)) unknown = true;
      if (inputs.incomingFor(origin).size !== 0) continue;
      if (ast.is.IsNewExpression(origin.node)) {
        const lineages = inputs.constructionLineagesFor(origin.node, originsFor, "heritage");
        unknown ||= lineages === undefined || lineages.length === 0 || lineages.some(lineage => !lineage.complete);
        for (const lineage of lineages ?? []) {
          const members = receiverType === undefined ? undefined : inputs.membersInLineage(lineage, declaration, receiverType);
          if (members === undefined || members.absent || members.members.length === 0) { unknown = true; continue; }
          for (const member of members.members) {
            if (!step()) return { nodes: selected, exact: false };
            selectMember(member.declaration);
          }
        }
      } else if (ast.is.IsObjectLiteralExpression(origin.node) || sourceStorageObjectRestOwner(origin.node, ast) !== undefined) {
        if (receiverType !== undefined && inputs.excludes(origin, receiverType)) continue;
        const members = receiverType === undefined ? undefined : inputs.declarationsFor(origin, declaration, receiverType);
        unknown ||= members === undefined;
        for (const member of members ?? []) {
          if (!step()) return { nodes: selected, exact: false };
          const storageKind = receiverType === undefined ? undefined : inputs.memberStorageKindFor(origin, member, receiverType);
          if (storageKind === undefined) { unknown = true; continue; }
          if (storageKind === "copied") {
            const slot = inputs.subject(origin.node, origin.kind, [...origin.projection, {
              kind: ast.is.IsMethodDeclaration(member) || ast.is.IsMethodSignatureDeclaration(member) ? "method-value" : "member", declaration: member,
            }]);
            if (slot !== undefined) {
              if (ast.is.IsGetAccessorDeclaration(declaration) || ast.is.IsSetAccessorDeclaration(declaration)) slots.add(slot);
              else selectSlot(slot);
            }
          }
          if (storageKind === "copied") continue;
          selectMember(member);
        }
      } else unknown = true;
    }
    if (!unknown) return { nodes: exact, exact: true, slots };
    for (const implementation of exact) selected.add(implementation);
    for (const target of inputs.contracts.get(declaration) ?? []) {
      if (!step()) break;
      selected.add(target);
    }
    return { nodes: selected, exact: false };
  };
  return implementationsFor;
}
