import type { SourceMemberPair } from "../../../public/source/objects.js";
import { sourceTypeDescriptorArms, sourceTypeDescriptorIsAbsent, sourceTypeDescriptorIsAbsentArm, sourceTypeDescriptorIsNeverArm } from "../../../source-semantics/descriptor-arms.js";
import { sourceAnalysisIncludesFile, sourceAnalysisValueType, type SourceAnalysisProgram } from "../../analysis-program.js";
import { sourceTypeDescriptorOpenness } from "../../../source-semantics/local-type-flow/uses.js";
import type { Node, SourceFile } from "@tsonic/tsts";
import type { SourceTypeDescriptor } from "../../../source-semantics/descriptor-model.js";
import { sourcePresentStorageArms, sourceStorageComponents, sourceStorageIsScalarType, sourceStorageSubjectType, sourceStorageTypesEqual } from "../model/components.js";
import { sourceStorageHasOriginalValue, sourceStorageIsDataMember, sourceStorageIsMethodMember, sourceStorageMemberSubject, sourceStorageObjectRestOwner } from "../model/subjects.js";
import type { SourceStorageSubject, SourceStorageSubjectQuery } from "../model/subjects.js";
import type { SourceStorageProjection } from "../model/subjects.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageClassLineage } from "../model/construction.js";
import { Node_Initializer, SpreadAssignment_Expression } from "../../../source-navigation/index.js";
import { sourceMemberOwner } from "../../../source-model/class-members.js";
import { sourceStorageCallReceiver } from "../model/host-reads.js";

type Descriptor = SourceTypeDescriptor;

interface MemberIndex {
  aggregateReady: boolean;
  members: readonly SourceMemberPair[] | undefined;
  readonly declarations: Map<Node, {
    readonly member: SourceMemberPair;
    readonly originals: readonly Node[];
  } | undefined>;
}

const noMembers: readonly SourceMemberPair[] = Object.freeze([]);

/** A member a spread or rest copies: its Host member name, optionality, read type and declarations. */
export interface SourceStorageSpreadMember {
  readonly name: string;
  readonly optional: boolean;
  readonly type: Descriptor;
  readonly declarations: readonly Node[];
}

// A member read through a receiver typed T | undefined | null reads the member of T: absent arms have no members, so
// member correspondence is computed against the present arm (or the whole type when several arms are present).
function memberDestination(receiverType: Descriptor): Descriptor | undefined {
  const arms = sourcePresentStorageArms(receiverType);
  return arms.length === 0 ? undefined : arms.length === 1 ? arms[0] : receiverType;
}

/** The authored member name of a member or element declaration (Host property-name facts). */
function memberName(source: SourceAnalysisProgram, declaration: Node): string | undefined {
  const name = source.ast.name(declaration);
  const selected = name === undefined ? undefined : source.facts.analyses.propertyName(name);
  return selected?.kind === "resolved" ? selected.name : undefined;
}

export function createSourceStorageMemberFlow(
  source: SourceAnalysisProgram,
  budget: SourceStorageBudget,
  subject: SourceStorageSubjectQuery,
  sourceFileFor: (subject: SourceStorageSubject) => SourceFile | undefined,
  retainCheckedContext: (node: Node, sourceFile: SourceFile) => boolean,
) {
  const { ast } = source;
  // An object literal's Host type is already its contextual (destination) type (values.type, B4 D8), so the members a
  // literal VALUE physically has are selected from its elements (objects.literalCorrespondingMember), keyed by the
  // literal; every other owner selects from its Host type.
  const selections = new Map<SourceFile, Map<Descriptor | Node, Map<Descriptor, MemberIndex>>>();
  const indexFor = (file: SourceFile, from: Descriptor, to: Descriptor, selection: "aggregate" | Node,
    literal?: Node): MemberIndex | undefined => {
    const sources = selections.get(file);
    const destinations = sources?.get(literal === undefined || selection === "aggregate" ? from : literal);
    const existing = destinations?.get(to);
    if (selection === "aggregate" ? existing?.aggregateReady : existing?.declarations.has(selection)) return existing;
    const rows = budget.createRows();
    let published = false;
    try {
      let aggregate: readonly SourceMemberPair[] | undefined;
      let selectedMember: { readonly member: SourceMemberPair; readonly originals: readonly Node[] } | undefined;
      if (selection === "aggregate") {
        const selected = source.facts.objects.correspondence(from, to, "correspondence");
        if (selected.kind === "unavailable" && selected.reason === "disjoint-shape") aggregate = noMembers;
        if (selected.kind === "available") {
          if (!rows.add(1 + selected.members.length)) return undefined;
          aggregate = selected.members;
        }
      } else {
        if (!budget.step()) return undefined;
        const member = literal === undefined ? source.facts.objects.correspondingMember(from, to, selection, "correspondence")
          : source.facts.objects.literalCorrespondingMember(literal, to, selection, "correspondence");
        if (member !== undefined) {
          if (!rows.add(2)) return undefined;
          if (!member.destination.declarations.includes(selection)) return undefined;
          const originals = new Set<Node>();
          if (member.kind === "present") for (const original of member.source.declarations) {
            if (!budget.step()) return undefined;
            if (originals.has(original)) continue;
            if (!rows.add(1)) return undefined;
            originals.add(original);
          }
          if (member.kind === "absent" || originals.size !== 0)
            selectedMember = Object.freeze({ member, originals: Object.freeze([...originals]) });
        }
        if (!rows.add(1)) return undefined;
      }
      if (budget.failure() !== undefined || existing === undefined &&
        !rows.add(1 + (sources === undefined ? 1 : 0) + (destinations === undefined ? 1 : 0))) return undefined;
      const index = existing ?? { aggregateReady: false, members: undefined, declarations: new Map() };
      if (selection === "aggregate") { index.members = aggregate; index.aggregateReady = true; }
      else index.declarations.set(selection, selectedMember);
      const retainedSources = sources ?? new Map<Descriptor | Node, Map<Descriptor, MemberIndex>>();
      const retainedDestinations = destinations ?? new Map<Descriptor, MemberIndex>();
      retainedDestinations.set(to, index);
      retainedSources.set(literal === undefined || selection === "aggregate" ? from : literal, retainedDestinations);
      selections.set(file, retainedSources);
      published = true;
      return index;
    } finally {
      if (!published) rows.release();
    }
  };
  const receiverSelection = (owner: SourceStorageSubject, receiverType: Descriptor) => {
    if (!budget.step()) return undefined;
    const file = sourceFileFor(owner);
    const checked = sourceStorageSubjectType(source, owner, file);
    if (file === undefined || checked === undefined) return undefined;
    // An owner whose Host type is only absence (an `undefined` / `null` alternative) has no members: it is selected as
    // itself, so the Host correspondence answers it (disjoint from a present receiver: excluded).
    const type = memberDestination(checked) ?? (sourceTypeDescriptorIsAbsent(checked) ? checked : undefined);
    const destinationType = memberDestination(receiverType);
    if (type === undefined || destinationType === undefined) return undefined;
    // A union owner reads through the one arm the receiver's type selects (equal Host arm), else no single arm.
    const arms = sourcePresentStorageArms(type);
    const destinationArms = sourcePresentStorageArms(destinationType);
    const matching = arms.length === 1 ? arms
      : arms.filter(arm => destinationArms.some(candidate => sourceStorageTypesEqual(arm, candidate)));
    const selectedType = arms.length === 0 ? type : matching.length === 1 ? matching[0] : undefined;
    const literal = owner.projection.length === 0 && ast.is.IsObjectLiteralExpression(owner.node) ? owner.node : undefined;
    return { file, type, destinationType, selectedType, literal };
  };
  const aggregateIndex = (owner: SourceStorageSubject, receiverType: Descriptor): MemberIndex | undefined => {
    const selected = receiverSelection(owner, receiverType);
    return selected?.selectedType === undefined ? undefined
      : indexFor(selected.file, selected.selectedType, selected.destinationType, "aggregate");
  };
  const excludes = (owner: SourceStorageSubject, destinationType: Descriptor): boolean => aggregateIndex(owner, destinationType)?.members === noMembers;
  const selectedMember = (owner: SourceStorageSubject, declaration: Node, receiverType: Descriptor) => {
    const selected = receiverSelection(owner, receiverType);
    if (selected === undefined) return undefined;
    const entry = indexFor(selected.file, selected.selectedType ?? selected.type, selected.destinationType, declaration,
      selected.literal)?.declarations.get(declaration);
    for (const original of entry?.originals ?? []) {
      if (!budget.step() || !retainCheckedContext(original, selected.file)) return undefined;
    }
    return entry;
  };
  const memberFor = (owner: SourceStorageSubject, declaration: Node, receiverType: Descriptor): SourceMemberPair | undefined =>
    selectedMember(owner, declaration, receiverType)?.member;
  const declarationsFor = (owner: SourceStorageSubject, declaration: Node, receiverType: Descriptor): readonly Node[] | undefined => {
    const entry = selectedMember(owner, declaration, receiverType);
    return entry?.member.kind === "present" ? entry.originals : undefined;
  };
  const membersInLineage = <Bindings>(lineage: SourceStorageClassLineage<Bindings>, declaration: Node, destinationType: Descriptor): {
    readonly members: readonly { readonly declaration: Node; readonly bindings: Bindings }[]; readonly absent: boolean;
  } | undefined => {
    if (!lineage.complete || lineage.classes.length === 0) return undefined;
    let absent = false;
    let excluded = 0;
    for (const captured of lineage.classes) {
      if (!budget.step()) return undefined;
      const receiver = subject(captured.subject.node, "receiver");
      if (receiver === undefined) return undefined;
      if (excludes(receiver, destinationType)) { excluded++; continue; }
      const member = memberFor(receiver, declaration, destinationType);
      if (member === undefined) return undefined;
      if (member.kind === "absent") { absent ||= member.destination.optional; continue; }
      const physical = member.source.declarations.filter(original => !ast.hasModifierKind(original, "static") &&
        sourceMemberOwner(ast, original) === captured.subject.node);
      if (physical.length === 0) continue;
      return Object.freeze({ members: Object.freeze(physical.map(declaration => Object.freeze({ declaration, bindings: captured.bindings }))),
        absent: false });
    }
    if (excluded === lineage.classes.length || absent)
      return Object.freeze({ members: Object.freeze([]), absent: excluded !== lineage.classes.length });
    const nativeBase = lineage.nativeBase;
    if (nativeBase === undefined || nativeBase.constructors.length === 0) return undefined;
    let originals: readonly Node[] | undefined;
    for (const constructor of nativeBase.constructors) {
      if (!budget.step()) return undefined;
      let receiver: SourceStorageSubject | undefined;
      if (ast.is.IsConstructSignatureDeclaration(constructor)) receiver = subject(constructor, "return");
      else if (ast.is.IsConstructorDeclaration(constructor)) {
        const owner = ast.parent(constructor);
        if (owner === undefined || owner !== nativeBase.subject.node || ast.body(constructor) !== undefined ||
          !ast.is.IsClassDeclaration(owner) && !ast.is.IsClassExpression(owner) ||
          source.navigation.isProjectDeclaration(owner)) return undefined;
        receiver = subject(owner, "receiver");
      } else return undefined;
      const member = receiver === undefined ? undefined : memberFor(receiver, declaration, destinationType);
      if (member?.kind !== "present") return undefined;
      const physical: Node[] = [];
      for (const original of member.source.declarations) {
        if (!budget.step()) return undefined;
        if (!ast.hasModifierKind(original, "static")) physical.push(original);
      }
      if (physical.length === 0 || originals !== undefined && originals.length !== physical.length) return undefined;
      if (originals !== undefined) for (const candidate of physical) {
        let present = false;
        for (const original of originals) {
          if (!budget.step()) return undefined;
          if (original === candidate) { present = true; break; }
        }
        if (!present) return undefined;
      }
      originals = physical;
    }
    return originals === undefined ? undefined : Object.freeze({
      members: Object.freeze(originals.map(declaration => Object.freeze({ declaration, bindings: nativeBase.bindings }))), absent: false,
    });
  };
  const restExcludedKeys = (rest: Node): ReadonlySet<string> | undefined => {
    const owner = sourceStorageObjectRestOwner(rest, ast);
    const pattern = owner === undefined ? undefined : ast.name(owner);
    if (pattern === undefined) return undefined;
    const keys = new Set<string>();
    for (const element of ast.elements(pattern)) {
      if (!budget.step() || element === undefined) return undefined;
      if (element === rest) continue;
      if (!ast.is.IsBindingElement(element)) return undefined;
      const binding = ast.as.AsBindingElement(element);
      const name = binding?.PropertyName ?? ast.name(element);
      const key = name === undefined ? undefined : source.facts.analyses.propertyName(name);
      if (key?.kind !== "resolved") return undefined;
      keys.add(key.name);
    }
    return keys;
  };
  /** The Host members of each arm of a value's type; undefined when an arm is open or its members are refused. */
  const armMembers = (type: Descriptor): readonly (readonly SourceStorageSpreadMember[])[] | undefined => {
    const selected: (readonly SourceStorageSpreadMember[])[] = [];
    for (const arm of sourceTypeDescriptorArms(type)) {
      if (!budget.step() || sourceTypeDescriptorOpenness(source.ast, arm) === "top") return undefined;
      if (sourceTypeDescriptorIsAbsentArm(arm) || sourceTypeDescriptorIsNeverArm(arm)) continue;
      const members = source.facts.objects.members(arm);
      if ("kind" in members) return undefined;
      selected.push(members.map(member => Object.freeze({ name: member.name, optional: member.optional, type: member.type,
        declarations: member.declarations })));
    }
    return selected;
  };
  const spreadMembersFor = (expression: Node, evaluation: Node): readonly SourceStorageSpreadMember[] | undefined => {
    const file = ast.getSourceFile(expression);
    if (file === undefined || !sourceAnalysisIncludesFile(source, file)) return undefined;
    const raw = sourceAnalysisValueType(source, expression);
    if (raw === undefined) return undefined;
    const rest = sourceStorageObjectRestOwner(evaluation, ast) !== undefined;
    const excluded = rest ? restExcludedKeys(evaluation) : undefined;
    if (rest && excluded === undefined) return undefined;
    const binding = !rest && ast.is.IsBindingElement(evaluation) ? ast.as.AsBindingElement(evaluation) : undefined;
    const name = binding === undefined ? undefined : binding.PropertyName ?? ast.name(evaluation);
    const selected = name === undefined ? undefined : source.facts.analyses.propertyName(name);
    if (binding !== undefined && selected?.kind !== "resolved") return undefined;
    const copying = rest || ast.is.IsSpreadAssignment(evaluation);
    const arms = armMembers(raw);
    if (arms === undefined) return undefined;
    const rows: SourceStorageSpreadMember[] = [];
    for (const members of arms) for (const member of members) {
      if (!budget.step()) return undefined;
      if (excluded?.has(member.name)) continue;
      if (selected?.kind === "resolved" && selected.name !== member.name) continue;
      const declarations = new Set<Node>();
      for (const declaration of member.declarations) {
        if (!budget.step()) return undefined;
        const owner = ast.parent(declaration);
        const prototype = owner !== undefined && (ast.is.IsClassDeclaration(owner) || ast.is.IsClassExpression(owner)) &&
          (ast.is.IsMethodDeclaration(declaration) || ast.is.IsGetAccessorDeclaration(declaration) ||
            ast.is.IsSetAccessorDeclaration(declaration));
        if (copying && prototype) continue;
        if (!retainCheckedContext(declaration, file)) return undefined;
        declarations.add(declaration);
      }
      if (declarations.size === 0) continue;
      rows.push(Object.freeze({ ...member, declarations: Object.freeze([...declarations]) }));
    }
    return Object.freeze(rows);
  };
  const copyContributionFor = (owner: SourceStorageSubject, declaration: Node, destinationType: Descriptor, before: Node):
    | { readonly kind: "own"; readonly declaration: Node }
    | { readonly kind: "spread"; readonly expression: Node; readonly components: readonly SourceStorageProjection[];
        readonly evaluation: Node; readonly definite: boolean }
    | { readonly kind: "absent" }
    | undefined => {
    const file = sourceFileFor(owner);
    const object = ast.is.IsObjectLiteralExpression(owner.node) ? ast.as.AsObjectLiteralExpression(owner.node) : undefined;
    const rest = sourceStorageObjectRestOwner(owner.node, ast);
    if (file === undefined || object === undefined && rest === undefined || owner.projection.length !== 0) return undefined;
    const destinationMembers = source.facts.objects.joinedMembers(destinationType);
    let selected = destinationMembers?.filter(member => member.declarations.includes(declaration)) ?? [];
    if (selected.length === 0) {
      // The declaration belongs to another shape the value is read through (a declared return type, or the spread source
      // literal); Host member correspondence is by member name, so it selects the destination member of the same name.
      const name = memberName(source, declaration);
      selected = name === undefined ? [] : destinationMembers?.filter(member => member.name === name) ?? [];
    }
    if (selected.length !== 1) return undefined;
    const property = selected[0]!;
    if (rest !== undefined) {
      if (before !== owner.node) return Object.freeze({ kind: "absent" });
      const excluded = restExcludedKeys(owner.node);
      if (excluded === undefined) return undefined;
      if (excluded.has(property.name)) return Object.freeze({ kind: "absent" });
      return Object.freeze({ kind: "spread", expression: Node_Initializer(ast, rest) ?? rest,
        components: Object.freeze([Object.freeze({ kind: sourceStorageIsMethodMember(declaration, ast)
          ? "method-value" : "member", declaration })]), evaluation: owner.node, definite: !property.optional });
    }
    const properties = ast.properties(owner.node);
    const limit = before === owner.node ? properties.length : properties.indexOf(before);
    if (limit < 0) return undefined;
    const ownContribution = (element: Node): { readonly kind: "own"; readonly declaration: Node } | undefined => {
      const accessor = (node: Node): boolean => ast.is.IsGetAccessorDeclaration(node) || ast.is.IsSetAccessorDeclaration(node);
      // Two accessors of one literal element (a get/set pair) are one entity: the pair's merged declarations.
      if (element !== declaration && accessor(element) && accessor(declaration) && ast.parent(declaration) === owner.node &&
        source.navigation.mergedDeclarations(declaration).includes(element)) return Object.freeze({ kind: "own", declaration });
      return Object.freeze({ kind: "own", declaration: element });
    };
    for (let ordinal = limit - 1; ordinal >= 0; ordinal -= 1) {
      const element = properties[ordinal];
      if (!budget.step() || element === undefined) return undefined;
      if (!ast.is.IsSpreadAssignment(element)) {
        const name = ast.name(element);
        const checked = name === undefined ? undefined : source.facts.analyses.propertyName(name);
        if (checked === undefined || checked.kind === "rejected") return undefined;
        if (checked.kind === "resolved") {
          if (checked.name === property.name) return ownContribution(element);
          continue;
        }
        const merged = source.navigation.mergedDeclarations(element);
        if (property.declarations.some(candidate => candidate === element || merged.includes(candidate))) return ownContribution(element);
        continue;
      }
      const expression = SpreadAssignment_Expression(ast, element);
      const raw = expression === undefined ? undefined : sourceAnalysisValueType(source, expression);
      if (raw === undefined || expression === undefined) return undefined;
      const arms = armMembers(raw);
      if (arms === undefined) return undefined;
      const matches = arms.flatMap(members => members.filter(member => member.name === property.name));
      if (matches.length === 0) continue;
      const declarations = new Set<Node>();
      const components: SourceStorageProjection[] = [];
      for (const member of matches) for (const original of member.declarations) {
        if (!budget.step() || !retainCheckedContext(original, file)) return undefined;
        if (declarations.has(original) || ast.is.IsSetAccessorDeclaration(original)) continue;
        declarations.add(original);
        components.push(Object.freeze({ kind: sourceStorageIsMethodMember(original, ast) ? "method-value" : "member", declaration: original }));
      }
      return components.length === 0 ? undefined : Object.freeze({ kind: "spread", expression,
        components: Object.freeze(components), evaluation: element,
        definite: matches.length === arms.length && matches.every(member => !member.optional) });
    }
    return Object.freeze({ kind: "absent" });
  };
  const memberStorageKindFor = (owner: SourceStorageSubject, declaration: Node, destinationType: Descriptor):
    "direct" | "copied" | "absent" | undefined => {
    if (owner.projection.length !== 0) return "direct";
    if (sourceStorageObjectRestOwner(owner.node, ast) !== undefined) return "copied";
    if (!ast.is.IsObjectLiteralExpression(owner.node)) return "direct";
    const contribution = copyContributionFor(owner, declaration, destinationType, owner.node);
    return contribution === undefined ? undefined : contribution.kind === "spread" ? "copied"
      : contribution.kind === "absent" ? "absent" : contribution.declaration === declaration ? "direct" : "copied";
  };
  const componentsFor = (owner: SourceStorageSubject): readonly SourceStorageProjection[] | undefined => {
    const file = sourceFileFor(owner);
    const type = sourceStorageSubjectType(source, owner, file);
    if (file === undefined || type === undefined) return undefined;
    const components: SourceStorageProjection[] = [];
    const declarations = new Set<Node>();
    for (const alternative of sourcePresentStorageArms(type)) {
      if (!budget.step() || sourceTypeDescriptorOpenness(source.ast, alternative) === "top") return undefined;
      const indexed = [...sourceStorageComponents(alternative)];
      if (indexed.length !== 0) {
        components.push(...indexed);
        continue;
      }
      const members = source.facts.objects.members(alternative);
      if ("kind" in members) return undefined;
      for (const member of members) for (const declaration of member.declarations) {
        if (!budget.step()) return undefined;
        if (declarations.has(declaration) || ast.hasModifierKind(declaration, "static") ||
          !sourceStorageIsDataMember(declaration, ast) && !sourceStorageIsMethodMember(declaration, ast) &&
            !ast.is.IsGetAccessorDeclaration(declaration)) continue;
        if (!retainCheckedContext(declaration, file)) return undefined;
        declarations.add(declaration);
        components.push(Object.freeze({ kind: sourceStorageIsMethodMember(declaration, ast) ? "method-value" : "member", declaration }));
      }
    }
    return Object.freeze(components);
  };
  return Object.freeze({ memberFor, membersInLineage, declarationsFor, excludes, copyContributionFor, memberStorageKindFor, spreadMembersFor, componentsFor,
    membersFor: (owner: SourceStorageSubject, destinationType: Descriptor): readonly SourceMemberPair[] | undefined =>
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

export function createSourceStorageMemberImplementations(source: SourceAnalysisProgram, budget: SourceStorageBudget,
  inputs: SourceStorageMemberImplementationInputs) {
  const { ast, navigation } = source;
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
    const call = navigation.call(invocation);
    const access = navigation.memberAccess(invocation);
    const receiver = checkedReceiver ?? (call === undefined ? undefined : sourceStorageCallReceiver(source, call))
      ?? access?.receiver ?? inputs.accessorTargets.get(invocation)?.find(target => target.declaration === declaration)?.receiver;
    const receiverType = receiver === undefined ? undefined : sourceAnalysisValueType(source, receiver);
    const valueType = receiverType;
    if (valueType !== undefined && sourceStorageIsScalarType(valueType, ast))
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
