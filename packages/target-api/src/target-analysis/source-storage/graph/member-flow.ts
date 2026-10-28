import type { Node, SourceFile, Type, TypePropertyInfo } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import type { SourceStructuralMemberPair } from "../../../source-semantics/structural-members.js";
import { sourceStorageComponents, sourceStorageIsScalarType, sourceStorageSubjectType } from "../model/components.js";
import { sourceStorageHasOriginalValue, sourceStorageIsDataMember, sourceStorageIsMethodMember, sourceStorageMemberSubject, sourceStorageObjectRestOwner } from "../model/subjects.js";
import type { SourceStorageSubject, SourceStorageSubjectQuery } from "../model/subjects.js";
import type { SourceStorageProjection } from "../model/subjects.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageClassLineage } from "../model/construction.js";
import { Node_Initializer, SpreadAssignment_Expression } from "../../../source-navigation/index.js";
import { sourceMemberOwner } from "../../../source-navigation/class-members.js";

interface MemberIndex {
  aggregateReady: boolean;
  members: readonly SourceStructuralMemberPair[] | undefined;
  readonly declarations: Map<Node, {
    readonly member: SourceStructuralMemberPair;
    readonly originals: readonly Node[];
  } | undefined>;
}

const noMembers: readonly SourceStructuralMemberPair[] = Object.freeze([]);

export interface SourceStorageSpreadMember {
  readonly property: TypePropertyInfo;
  readonly declarations: readonly Node[];
}

// A member read through a receiver typed T | undefined | null reads the member of T: the nullish constituents have no
// members, so member correspondence is computed against the non-nullish receiver type.
function memberDestination(semantics: ReturnType<TargetSourceProgram["semantics"]["forFile"]>, receiverType: Type): Type | undefined {
  return semantics.types.isUnion(receiverType) ? semantics.types.nonNullableType(receiverType) : receiverType;
}

export function createSourceStorageMemberFlow(
  source: TargetSourceProgram,
  budget: SourceStorageBudget,
  subject: SourceStorageSubjectQuery,
  sourceFileFor: (subject: SourceStorageSubject) => SourceFile | undefined,
  retainCheckedContext: (node: Node, sourceFile: SourceFile) => boolean,
) {
  const selections = new Map<SourceFile, Map<Type, Map<Type | undefined, Map<Type, MemberIndex>>>>();
  const physicalMember = (member: SourceStructuralMemberPair, contract: SourceStructuralMemberPair | undefined): SourceStructuralMemberPair => {
    const allocated: SourceStructuralMemberPair = member.kind === "absent" && contract?.kind === "present" &&
      contract.source.property.optional ? Object.freeze({ kind: "present", destination: member.destination, source: contract.source }) : member;
    return allocated.kind === "present" && contract?.kind === "present" && contract.source.property.readonly
      ? Object.freeze({ ...allocated, source: Object.freeze({ ...allocated.source,
        property: Object.freeze({ ...allocated.source.property, readonly: true }) }) }) : allocated;
  };
  const indexFor = (file: SourceFile, from: Type, to: Type, contextual: Type | undefined,
    selection: "aggregate" | Node): MemberIndex | undefined => {
    const sources = selections.get(file);
    const contexts = sources?.get(from);
    const destinations = contexts?.get(contextual);
    const existing = destinations?.get(to);
    if (selection === "aggregate" ? existing?.aggregateReady : existing?.declarations.has(selection)) return existing;
    const rows = budget.createRows();
    let published = false;
    try {
      const queries = source.semantics.forFile(file);
      const contextualMember = (declaration: Node): SourceStructuralMemberPair | undefined => contextual === undefined
        ? undefined : queries.types.structuralMember(contextual, to, declaration, "correspondence");
      let aggregate: readonly SourceStructuralMemberPair[] | undefined;
      let selectedMember: { readonly member: SourceStructuralMemberPair; readonly originals: readonly Node[] } | undefined;
      if (selection === "aggregate") {
        const selected = queries.types.structuralMembers(from, to, "correspondence");
        if (selected.kind === "unavailable" && selected.reason === "disjoint-shape") aggregate = noMembers;
        if (selected.kind === "available") {
          if (!rows.add(1 + selected.members.length)) return undefined;
          const members: SourceStructuralMemberPair[] = [];
          for (const member of selected.members) {
            if (!budget.step()) return undefined;
            const declaration = member.destination.declarations[0];
            members.push(physicalMember(member, declaration === undefined ? undefined : contextualMember(declaration)));
          }
          aggregate = Object.freeze(members);
        }
      } else {
        if (!budget.step()) return undefined;
        const selected = queries.types.structuralMember(from, to, selection, "correspondence");
        if (selected !== undefined) {
          if (!rows.add(2)) return undefined;
          const member = physicalMember(selected, contextualMember(selection));
          let selectedDeclaration = false;
          for (const declaration of member.destination.declarations) {
            if (!budget.step()) return undefined;
            selectedDeclaration ||= declaration === selection;
          }
          if (!selectedDeclaration) return undefined;
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
        !rows.add(1 + (sources === undefined ? 1 : 0) + (contexts === undefined ? 1 : 0) + (destinations === undefined ? 1 : 0))) return undefined;
      const index = existing ?? { aggregateReady: false, members: undefined, declarations: new Map() };
      if (selection === "aggregate") { index.members = aggregate; index.aggregateReady = true; }
      else index.declarations.set(selection, selectedMember);
      const retainedSources = sources ?? new Map<Type, Map<Type | undefined, Map<Type, MemberIndex>>>();
      const retainedContexts = contexts ?? new Map<Type | undefined, Map<Type, MemberIndex>>();
      const retainedDestinations = destinations ?? new Map<Type, MemberIndex>();
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
  const receiverSelection = (owner: SourceStorageSubject, receiverType: Type) => {
    if (!budget.step()) return undefined;
    const file = sourceFileFor(owner);
    const type = sourceStorageSubjectType(source, owner, file);
    if (file === undefined || type === undefined) return undefined;
    const semantics = source.semantics.forFile(file);
    const destinationType = memberDestination(semantics, receiverType);
    if (destinationType === undefined) return undefined;
    const contextual = owner.projection.length === 0 && source.ast.is.IsObjectLiteralExpression(owner.node)
      ? semantics.types.contextualType(owner.node)?.selectedType : undefined;
    const refinement = semantics.types.isUnion(type) ? semantics.types.refinement(type, destinationType) : undefined;
    const selectedType = !semantics.types.isUnion(type) ? type
      : refinement?.kind === "members" && refinement.types.length === 1 ? refinement.types[0] : undefined;
    return { file, type, destinationType, contextual, selectedType };
  };
  const aggregateIndex = (owner: SourceStorageSubject, receiverType: Type): MemberIndex | undefined => {
    const selected = receiverSelection(owner, receiverType);
    return selected?.selectedType === undefined ? undefined
      : indexFor(selected.file, selected.selectedType, selected.destinationType, selected.contextual, "aggregate");
  };
  const excludes = (owner: SourceStorageSubject, destinationType: Type): boolean => aggregateIndex(owner, destinationType)?.members === noMembers;
  const selectedMember = (owner: SourceStorageSubject, declaration: Node, receiverType: Type) => {
    const selected = receiverSelection(owner, receiverType);
    if (selected === undefined) return undefined;
    const entry = indexFor(selected.file, selected.selectedType ?? selected.type, selected.destinationType,
      selected.contextual, declaration)?.declarations.get(declaration);
    for (const original of entry?.originals ?? []) {
      if (!budget.step() || !retainCheckedContext(original, selected.file)) return undefined;
    }
    return entry;
  };
  const memberFor = (owner: SourceStorageSubject, declaration: Node, receiverType: Type): SourceStructuralMemberPair | undefined =>
    selectedMember(owner, declaration, receiverType)?.member;
  const declarationsFor = (owner: SourceStorageSubject, declaration: Node, receiverType: Type): readonly Node[] | undefined => {
    const entry = selectedMember(owner, declaration, receiverType);
    return entry?.member.kind === "present" ? entry.originals : undefined;
  };
  const membersInLineage = <Bindings>(lineage: SourceStorageClassLineage<Bindings>, declaration: Node, destinationType: Type): {
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
      if (member.kind === "absent") { absent ||= member.destination.property.optional; continue; }
      const physical = member.source.declarations.filter(original => !source.ast.hasModifierKind(original, "static") &&
        sourceMemberOwner(source.ast, original) === captured.subject.node);
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
      if (source.ast.is.IsConstructSignatureDeclaration(constructor)) receiver = subject(constructor, "return");
      else if (source.ast.is.IsConstructorDeclaration(constructor)) {
        const owner = source.ast.parent(constructor);
        if (owner === undefined || owner !== nativeBase.subject.node || source.ast.body(constructor) !== undefined ||
          !source.ast.is.IsClassDeclaration(owner) && !source.ast.is.IsClassExpression(owner) ||
          source.navigation.isProjectDeclaration(owner)) return undefined;
        receiver = subject(owner, "receiver");
      } else return undefined;
      const member = receiver === undefined ? undefined : memberFor(receiver, declaration, destinationType);
      if (member?.kind !== "present") return undefined;
      const physical: Node[] = [];
      for (const original of member.source.declarations) {
        if (!budget.step()) return undefined;
        if (!source.ast.hasModifierKind(original, "static")) physical.push(original);
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
    const owner = sourceStorageObjectRestOwner(rest, source.ast);
    const pattern = owner === undefined ? undefined : source.ast.name(owner);
    if (pattern === undefined) return undefined;
    const queries = source.semantics.forNode(rest);
    const keys = new Set<string>();
    for (const element of source.ast.elements(pattern)) {
      if (!budget.step() || element === undefined) return undefined;
      if (element === rest) continue;
      if (!source.ast.is.IsBindingElement(element)) return undefined;
      const binding = source.ast.as.AsBindingElement(element);
      const name = binding?.PropertyName ?? source.ast.name(element);
      const key = name === undefined ? undefined : queries.operations.propertyName(name);
      if (key === undefined) return undefined;
      keys.add(key.name);
    }
    return keys;
  };
  const spreadMembersFor = (expression: Node, evaluation: Node): readonly SourceStorageSpreadMember[] | undefined => {
    const file = source.ast.getSourceFile(expression);
    if (file === undefined || !source.semantics.includes(file)) return undefined;
    const queries = source.semantics.forFile(file);
    const raw = queries.types.expressionType(expression) ?? queries.declarations.declaredValueType(expression);
    if (raw === undefined) return undefined;
    const alternatives = queries.types.isUnion(raw) ? queries.types.unionOrIntersectionTypes(raw) : [raw];
    const rest = sourceStorageObjectRestOwner(evaluation, source.ast) !== undefined;
    const excluded = rest ? restExcludedKeys(evaluation) : undefined;
    if (rest && excluded === undefined) return undefined;
    const binding = !rest && source.ast.is.IsBindingElement(evaluation) ? source.ast.as.AsBindingElement(evaluation) : undefined;
    const name = binding === undefined ? undefined : binding.PropertyName ?? source.ast.name(evaluation);
    const selected = name === undefined ? undefined : queries.operations.propertyName(name);
    if (binding !== undefined && selected === undefined) return undefined;
    const copying = rest || source.ast.is.IsSpreadAssignment(evaluation);
    const rows: { readonly property: TypePropertyInfo; readonly declarations: readonly Node[] }[] = [];
    for (const type of alternatives) {
      if (!budget.step() || queries.types.isAny(type) || queries.types.isUnknown(type)) return undefined;
      if (queries.types.isNullish(type) || queries.types.isVoidLike(type) || queries.types.isNever(type)) continue;
      for (const property of queries.types.propertyInfos(type)) {
        if (!budget.step()) return undefined;
        if (excluded?.has(property.name)) continue;
        if (selected !== undefined && selected.name !== property.name) continue;
        const declarations = new Set<Node>();
        for (const symbol of [property.symbol, ...property.rootSymbols]) for (const declaration of queries.declarations.symbolDeclarations(symbol)) {
          if (!budget.step()) return undefined;
          const owner = source.ast.parent(declaration);
          const prototype = owner !== undefined && (source.ast.is.IsClassDeclaration(owner) || source.ast.is.IsClassExpression(owner)) &&
            (source.ast.is.IsMethodDeclaration(declaration) || source.ast.is.IsGetAccessorDeclaration(declaration) ||
              source.ast.is.IsSetAccessorDeclaration(declaration));
          if (copying && prototype) continue;
          if (!retainCheckedContext(declaration, file)) return undefined;
          declarations.add(declaration);
        }
        if (declarations.size === 0) continue;
        rows.push({ property, declarations: Object.freeze([...declarations]) });
      }
    }
    return Object.freeze(rows.map(member => Object.freeze(member)));
  };
  const copyContributionFor = (owner: SourceStorageSubject, declaration: Node, destinationType: Type, before: Node):
    | { readonly kind: "own"; readonly declaration: Node }
    | { readonly kind: "spread"; readonly expression: Node; readonly components: readonly SourceStorageProjection[];
        readonly evaluation: Node; readonly definite: boolean }
    | { readonly kind: "absent" }
    | undefined => {
    const file = sourceFileFor(owner);
    const object = source.ast.is.IsObjectLiteralExpression(owner.node) ? source.ast.as.AsObjectLiteralExpression(owner.node) : undefined;
    const rest = sourceStorageObjectRestOwner(owner.node, source.ast);
    if (file === undefined || object === undefined && rest === undefined || owner.projection.length !== 0) return undefined;
    const queries = source.semantics.forFile(file);
    let selected = queries.types.propertyInfos(destinationType).filter(property => [property.symbol, ...property.rootSymbols]
      .some(symbol => queries.declarations.symbolDeclarations(symbol).includes(declaration)));
    if (selected.length === 0) {
      // The declaration belongs to another shape the value is read through (a declared return type, or the spread source
      // literal); it selects the destination property by checked structural correspondence from that shape.
      const declarationOwner = sourceMemberOwner(source.ast, declaration);
      const ownerType = declarationOwner === undefined ? undefined
        : source.ast.is.IsTypeLiteralNode(declarationOwner) ? queries.types.authoredType(declarationOwner)
          : source.ast.is.IsObjectLiteralExpression(declarationOwner) ? queries.types.expressionType(declarationOwner)
            : queries.declarations.declaredType(declarationOwner);
      const correspondence = ownerType === undefined ? undefined
        : queries.types.structuralMember(destinationType, ownerType, declaration, "correspondence");
      if (correspondence?.kind === "present") selected = [correspondence.source.property];
    }
    if (selected.length !== 1) return undefined;
    const property = selected[0]!;
    if (rest !== undefined) {
      if (before !== owner.node) return Object.freeze({ kind: "absent" });
      const excluded = restExcludedKeys(owner.node);
      if (excluded === undefined) return undefined;
      if (excluded.has(property.name)) return Object.freeze({ kind: "absent" });
      return Object.freeze({ kind: "spread", expression: Node_Initializer(source.ast, rest) ?? rest,
        components: Object.freeze([Object.freeze({ kind: sourceStorageIsMethodMember(declaration, source.ast)
          ? "method-value" : "member", declaration })]), evaluation: owner.node, definite: !property.optional });
    }
    const properties = source.ast.properties(owner.node);
    const limit = before === owner.node ? properties.length : properties.indexOf(before);
    if (limit < 0) return undefined;
    const ownContribution = (element: Node): { readonly kind: "own"; readonly declaration: Node } | undefined => {
      const accessor = (node: Node): boolean => source.ast.is.IsGetAccessorDeclaration(node) || source.ast.is.IsSetAccessorDeclaration(node);
      if (element !== declaration && accessor(element) && accessor(declaration) && source.ast.parent(declaration) === owner.node) {
        const original = queries.operations.objectLiteralElement(declaration)?.sourceElementSymbol;
        const selected = queries.operations.objectLiteralElement(element)?.sourceElementSymbol;
        if (original === undefined || selected === undefined) return undefined;
        if (original === selected) return Object.freeze({ kind: "own", declaration });
      }
      return Object.freeze({ kind: "own", declaration: element });
    };
    for (let ordinal = limit - 1; ordinal >= 0; ordinal -= 1) {
      const element = properties[ordinal];
      if (!budget.step() || element === undefined) return undefined;
      if (!source.ast.is.IsSpreadAssignment(element)) {
        const name = source.ast.name(element);
        const checked = name === undefined ? undefined : queries.operations.propertyName(name);
        if (checked === undefined) return undefined;
        if (checked.kind !== "unique-symbol") {
          if (checked.name === property.name) return ownContribution(element);
          continue;
        }
        const symbol = queries.operations.objectLiteralElement(element)?.sourceElementSymbol;
        if (symbol === undefined) return undefined;
        if (symbol === property.symbol || property.rootSymbols.includes(symbol)) return ownContribution(element);
        continue;
      }
      const expression = SpreadAssignment_Expression(source.ast, element);
      const raw = expression === undefined ? undefined : queries.types.expressionType(expression);
      if (raw === undefined || expression === undefined) return undefined;
      const alternatives = queries.types.isUnion(raw) ? queries.types.unionOrIntersectionTypes(raw) : [raw];
      const matches: TypePropertyInfo[] = [];
      for (const alternative of alternatives) {
        if (!budget.step() || queries.types.isAny(alternative) || queries.types.isUnknown(alternative)) return undefined;
        matches.push(...queries.types.propertyInfos(alternative).filter(member => member.name === property.name));
      }
      if (matches.length === 0) continue;
      const declarations = new Set<Node>();
      const components: SourceStorageProjection[] = [];
      for (const member of matches) for (const symbol of [member.symbol, ...member.rootSymbols]) {
        for (const original of queries.declarations.symbolDeclarations(symbol)) {
          if (!budget.step() || !retainCheckedContext(original, file)) return undefined;
          if (declarations.has(original) || source.ast.is.IsSetAccessorDeclaration(original)) continue;
          declarations.add(original);
          components.push(Object.freeze({ kind: sourceStorageIsMethodMember(original, source.ast) ? "method-value" : "member", declaration: original }));
        }
      }
      return components.length === 0 ? undefined : Object.freeze({ kind: "spread", expression,
        components: Object.freeze(components), evaluation: element,
        definite: matches.length === alternatives.length && matches.every(member => !member.optional) });
    }
    return Object.freeze({ kind: "absent" });
  };
  const memberStorageKindFor = (owner: SourceStorageSubject, declaration: Node, destinationType: Type):
    "direct" | "copied" | "absent" | undefined => {
    if (owner.projection.length !== 0) return "direct";
    if (sourceStorageObjectRestOwner(owner.node, source.ast) !== undefined) return "copied";
    if (!source.ast.is.IsObjectLiteralExpression(owner.node)) return "direct";
    const contribution = copyContributionFor(owner, declaration, destinationType, owner.node);
    return contribution === undefined ? undefined : contribution.kind === "spread" ? "copied"
      : contribution.kind === "absent" ? "absent" : contribution.declaration === declaration ? "direct" : "copied";
  };
  const componentsFor = (owner: SourceStorageSubject): readonly SourceStorageProjection[] | undefined => {
    const file = sourceFileFor(owner);
    const type = sourceStorageSubjectType(source, owner, file);
    if (file === undefined || type === undefined) return undefined;
    const queries = source.semantics.forFile(file);
    const alternatives = queries.types.isUnion(type) || queries.types.isIntersection(type)
      ? queries.types.unionOrIntersectionTypes(type) : [type];
    const components: SourceStorageProjection[] = [];
    const declarations = new Set<Node>();
    for (const alternative of alternatives) {
      if (!budget.step() || queries.types.isAny(alternative) || queries.types.isUnknown(alternative)) return undefined;
      const indexed = [...sourceStorageComponents(alternative, queries)];
      if (indexed.length !== 0) {
        components.push(...indexed);
        continue;
      }
      for (const property of queries.types.propertyInfos(alternative)) {
        if (!budget.step()) return undefined;
        for (const symbol of [property.symbol, ...property.rootSymbols]) {
          for (const declaration of queries.declarations.symbolDeclarations(symbol)) {
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
    }
    return Object.freeze(components);
  };
  return Object.freeze({ memberFor, membersInLineage, declarationsFor, excludes, copyContributionFor, memberStorageKindFor, spreadMembersFor, componentsFor,
    membersFor: (owner: SourceStorageSubject, destinationType: Type): readonly SourceStructuralMemberPair[] | undefined =>
      aggregateIndex(owner, destinationType)?.members });
}

interface SourceStorageMemberImplementationInputs {
  readonly subject: import("../model/subjects.js").SourceStorageSubjectQuery;
  subjectFor(node: Node | undefined): SourceStorageSubject | undefined;
  incomingFor(subject: SourceStorageSubject): ReadonlySet<SourceStorageSubject>;
  originsFor(subject: SourceStorageSubject): Iterable<SourceStorageSubject> | undefined;
  storesFor(subject: SourceStorageSubject): Iterable<import("./stored-values.js").SourceStorageStore> | undefined;
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

export function createSourceStorageMemberImplementations(source: TargetSourceProgram, budget: SourceStorageBudget,
  inputs: SourceStorageMemberImplementationInputs) {
  const { ast, navigation, semantics } = source;
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
    const queries = semantics.forNode(invocation);
    const call = queries.operations.call(invocation);
    const access = queries.operations.propertyAccess(invocation);
    const receiver = checkedReceiver ?? call?.sourceReceiver?.expression ?? call?.sourceCalleeAccess?.receiver.expression
      ?? access?.receiver.expression ?? inputs.accessorTargets.get(invocation)?.find(target => target.declaration === declaration)?.receiver;
    const receiverType = call?.sourceReceiver?.type ?? call?.sourceCalleeAccess?.receiver.type ?? access?.receiver.type
      ?? (receiver === undefined ? undefined : queries.types.expressionType(receiver));
    const valueType = receiver === undefined ? undefined : queries.types.expressionType(receiver);
    if (valueType !== undefined && sourceStorageIsScalarType(valueType, queries))
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
