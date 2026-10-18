import type { Node, SourceFile, Type, TypePropertyInfo } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import type { SourceStructuralMemberPair } from "../../../source-semantics/structural-members.js";
import { sourceStorageComponents, sourceStorageIsScalarType, sourceStorageSubjectType } from "../model/components.js";
import { sourceStorageHasOriginalValue, sourceStorageIsDataMember, sourceStorageIsMethodMember, sourceStorageMemberSubject,
  sourceStorageObjectRestOwner } from "../model/subjects.js";
import type { SourceStorageSubject } from "../model/subjects.js";
import type { SourceStorageProjection } from "../model/subjects.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import { Node_Initializer, SpreadAssignment_Expression } from "../../../source-navigation/index.js";

interface MemberIndex {
  readonly members: readonly SourceStructuralMemberPair[];
  readonly declarations: ReadonlyMap<Node, readonly Node[]>;
}

const noMembers: MemberIndex = Object.freeze({ members: Object.freeze([]), declarations: new Map() });

export interface SourceStorageSpreadMember {
  readonly property: TypePropertyInfo;
  readonly declarations: readonly Node[];
}

export function createSourceStorageMemberFlow(
  source: TargetSourceProgram,
  budget: SourceStorageBudget,
  sourceFileFor: (subject: SourceStorageSubject) => SourceFile | undefined,
  retainCheckedContext: (node: Node, sourceFile: SourceFile) => boolean,
) {
  const selections = new Map<SourceFile, Map<Type, Map<Type | undefined, Map<Type, MemberIndex | undefined>>>>();
  const indexFor = (file: SourceFile, from: Type, to: Type, contextual?: Type): MemberIndex | undefined => {
    const sources = selections.get(file);
    const contexts = sources?.get(from);
    const destinations = contexts?.get(contextual);
    if (destinations?.has(to)) return destinations.get(to);
    const rows = budget.createRows();
    const temporary = budget.createRows();
    let published = false;
    try {
      const queries = source.semantics.forFile(file);
      const selected = queries.types.structuralMembers(from, to, "storage");
      let index: MemberIndex | undefined;
      if (selected.kind === "unavailable" && selected.reason === "disjoint-shape") index = noMembers;
      if (selected.kind === "available") {
        if (!rows.add(1 + selected.members.length)) return undefined;
        const contextualMembers = contextual === undefined
          ? undefined : queries.types.structuralMembers(contextual, to, "storage");
        const contextualByDestination = new Map<SourceStructuralMemberPair["destination"]["property"]["symbol"], SourceStructuralMemberPair>();
        if (contextualMembers?.kind === "available") for (const member of contextualMembers.members) {
          if (!budget.step() || !temporary.add(1)) return undefined;
          contextualByDestination.set(member.destination.property.symbol, member);
        }
        const physicalMembers: SourceStructuralMemberPair[] = [];
        const members = new Map<Node, Set<Node>>();
        for (const member of selected.members) {
          if (!budget.step()) return undefined;
          const contract = contextualByDestination.get(member.destination.property.symbol);
          const physical: SourceStructuralMemberPair = member.kind === "present" && contract?.kind === "present" && contract.source.property.readonly
            ? Object.freeze({ ...member, source: Object.freeze({ ...member.source,
              property: Object.freeze({ ...member.source.property, readonly: true }) }) }) : member;
          physicalMembers.push(physical);
          if (physical.kind !== "present") continue;
          for (const target of physical.destination.declarations) {
            if (!budget.step()) return undefined;
            let originals = members.get(target);
            if (originals === undefined) {
              if (!rows.add(1)) return undefined;
              originals = new Set();
              members.set(target, originals);
            }
            for (const original of physical.source.declarations) {
              if (!budget.step()) return undefined;
              if (originals.has(original)) continue;
              if (!rows.add(1)) return undefined;
              originals.add(original);
            }
          }
        }
        index = Object.freeze({ members: Object.freeze(physicalMembers),
          declarations: new Map([...members].map(([target, originals]) => [target, Object.freeze([...originals])])) });
      }
      if (!rows.add(1 + (sources === undefined ? 1 : 0) + (contexts === undefined ? 1 : 0) + (destinations === undefined ? 1 : 0))) return undefined;
      const retainedSources = sources ?? new Map<Type, Map<Type | undefined, Map<Type, MemberIndex | undefined>>>();
      const retainedContexts = contexts ?? new Map<Type | undefined, Map<Type, MemberIndex | undefined>>();
      const retainedDestinations = destinations ?? new Map<Type, MemberIndex | undefined>();
      retainedDestinations.set(to, index);
      retainedContexts.set(contextual, retainedDestinations);
      retainedSources.set(from, retainedContexts);
      selections.set(file, retainedSources);
      published = true;
      return index;
    } finally {
      temporary.release();
      if (!published) rows.release();
    }
  };
  const selectedIndex = (owner: SourceStorageSubject, destinationType: Type): MemberIndex | undefined => {
    if (!budget.step()) return undefined;
    const file = sourceFileFor(owner);
    const type = sourceStorageSubjectType(source, owner, file);
    if (file === undefined || type === undefined) return undefined;
    const semantics = source.semantics.forFile(file);
    const contextual = owner.projection.length === 0 && source.ast.is.IsObjectLiteralExpression(owner.node)
      ? semantics.types.contextualType(owner.node) : undefined;
    if (!semantics.types.isUnion(type)) return indexFor(file, type, destinationType, contextual);
    const refinement = semantics.types.refinement(type, destinationType);
    return refinement.kind === "members" && refinement.types.length === 1
      ? indexFor(file, refinement.types[0]!, destinationType, contextual) : undefined;
  };
  const declarationsFor = (owner: SourceStorageSubject, declaration: Node, destinationType: Type): readonly Node[] | undefined => {
    const file = sourceFileFor(owner);
    if (file === undefined) return undefined;
    const queries = source.semantics.forFile(file);
    const type = sourceStorageSubjectType(source, owner, file);
    let declarations: readonly Node[] | undefined;
    if (type !== undefined && type === destinationType) {
      const members = queries.types.propertyInfos(type).map(property => Object.freeze([...new Set(
        [property.symbol, ...property.rootSymbols].flatMap(symbol => queries.declarations.symbolDeclarations(symbol)))]));
      const selected = members.filter(declarations => declarations.includes(declaration));
      declarations = selected.length === 1 ? selected[0] : undefined;
    } else {
      const index = selectedIndex(owner, destinationType);
      if (index === noMembers) return Object.freeze([]);
      if (index?.members.some(member => member.kind === "absent" && member.destination.declarations.includes(declaration)))
        return Object.freeze([]);
      declarations = index?.declarations.get(declaration);
    }
    if (declarations === undefined || declarations.length === 0) return undefined;
    for (const original of declarations) {
      if (!budget.step() || !retainCheckedContext(original, file)) return undefined;
    }
    return declarations;
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
    | { readonly kind: "spread"; readonly expression: Node; readonly components: readonly SourceStorageProjection[]; readonly evaluation: Node }
    | { readonly kind: "absent" }
    | undefined => {
    const file = sourceFileFor(owner);
    const object = source.ast.is.IsObjectLiteralExpression(owner.node) ? source.ast.as.AsObjectLiteralExpression(owner.node) : undefined;
    const rest = sourceStorageObjectRestOwner(owner.node, source.ast);
    if (file === undefined || object === undefined && rest === undefined || owner.projection.length !== 0) return undefined;
    const queries = source.semantics.forFile(file);
    const selected = queries.types.propertyInfos(destinationType).filter(property => [property.symbol, ...property.rootSymbols]
      .some(symbol => queries.declarations.symbolDeclarations(symbol).includes(declaration)));
    if (selected.length !== 1) return undefined;
    const property = selected[0]!;
    if (rest !== undefined) {
      if (before !== owner.node) return Object.freeze({ kind: "absent" });
      const excluded = restExcludedKeys(owner.node);
      if (excluded === undefined) return undefined;
      if (excluded.has(property.name)) return Object.freeze({ kind: "absent" });
      return Object.freeze({ kind: "spread", expression: Node_Initializer(source.ast, rest) ?? rest,
        components: Object.freeze([Object.freeze({ kind: sourceStorageIsMethodMember(declaration, source.ast)
          ? "method-value" : "member", declaration })]), evaluation: owner.node });
    }
    const properties = source.ast.properties(owner.node);
    const limit = before === owner.node ? properties.length : properties.indexOf(before);
    if (limit < 0) return undefined;
    for (let ordinal = limit - 1; ordinal >= 0; ordinal -= 1) {
      const element = properties[ordinal];
      if (!budget.step() || element === undefined) return undefined;
      if (!source.ast.is.IsSpreadAssignment(element)) {
        const name = source.ast.name(element);
        const checked = name === undefined ? undefined : queries.operations.propertyName(name);
        if (checked === undefined) return undefined;
        if (checked.kind !== "unique-symbol") {
          if (checked.name === property.name) return Object.freeze({ kind: "own", declaration: element });
          continue;
        }
        const symbol = queries.operations.objectLiteralElement(element)?.sourceElementSymbol;
        if (symbol === undefined) return undefined;
        if (symbol === property.symbol || property.rootSymbols.includes(symbol)) return Object.freeze({ kind: "own", declaration: element });
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
        components: Object.freeze(components), evaluation: element });
    }
    return Object.freeze({ kind: "absent" });
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
      if (indexed.length !== 0) { components.push(...indexed); continue; }
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
  return Object.freeze({ declarationsFor, copyContributionFor, spreadMembersFor, componentsFor,
    membersFor: (owner: SourceStorageSubject, destinationType: Type): readonly SourceStructuralMemberPair[] | undefined =>
      selectedIndex(owner, destinationType)?.members });
}

interface SourceStorageMemberImplementationInputs {
  readonly subject: import("../model/subjects.js").SourceStorageSubjectQuery;
  subjectFor(node: Node | undefined): SourceStorageSubject | undefined;
  incomingFor(subject: SourceStorageSubject): ReadonlySet<SourceStorageSubject>;
  originsFor(subject: SourceStorageSubject): Iterable<SourceStorageSubject> | undefined;
  storesFor(subject: SourceStorageSubject): Iterable<import("./stored-values.js").SourceStorageStore> | undefined;
  readonly declarationsFor: ReturnType<typeof createSourceStorageMemberFlow>["declarationsFor"];
  constructionLineagesFor(invocation: Node,
    originsFor: (subject: SourceStorageSubject) => Iterable<SourceStorageSubject> | undefined): readonly {
      readonly classes: readonly { readonly subject: SourceStorageSubject }[]; readonly complete: boolean;
    }[] | undefined;
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
      if (ast.is.IsGetAccessorDeclaration(member) || ast.is.IsSetAccessorDeclaration(member)) {
        exact.add(member);
        return;
      }
      const slot = sourceStorageMemberSubject(member, ast, inputs.subject);
      if (slot !== undefined) selectSlot(slot);
    };
    for (const origin of origins ?? []) {
      if (!step()) return { nodes: selected, exact: false };
      if (ast.is.IsParameterDeclaration(origin.node)) unknown = true;
      if (inputs.incomingFor(origin).size !== 0) continue;
      if (ast.is.IsNewExpression(origin.node)) {
        const lineages = inputs.constructionLineagesFor(origin.node, originsFor);
        unknown ||= lineages === undefined || lineages.length === 0 || lineages.some(lineage => !lineage.complete);
        for (const lineage of lineages ?? []) {
          const concrete = lineage.classes[0]?.subject.node;
          const target = concrete === undefined ? undefined : navigation.memberImplementation(concrete, declaration);
          if (target?.kind !== "resolved") { unknown = true; continue; }
          const original = target.implementation.declaration;
          exact.add(original);
          const slot = sourceStorageMemberSubject(original, ast, inputs.subject);
          if (slot !== undefined && inputs.storesFor(slot) !== undefined) selectMember(original);
        }
      } else if (ast.is.IsObjectLiteralExpression(origin.node) || sourceStorageObjectRestOwner(origin.node, ast) !== undefined) {
        const members = receiverType === undefined ? undefined : inputs.declarationsFor(origin, declaration, receiverType);
        unknown ||= members === undefined;
        for (const member of members ?? []) {
          if (!step()) return { nodes: selected, exact: false };
          const copied = sourceStorageObjectRestOwner(origin.node, ast) !== undefined ||
            ast.parent(member) !== origin.node;
          if (copied) {
            const slot = inputs.subject(origin.node, origin.kind, [...origin.projection, {
              kind: ast.is.IsMethodDeclaration(member) || ast.is.IsMethodSignatureDeclaration(member) ? "method-value" : "member", declaration: member,
            }]);
            if (slot !== undefined) {
              if (ast.is.IsGetAccessorDeclaration(declaration) || ast.is.IsSetAccessorDeclaration(declaration)) slots.add(slot);
              else selectSlot(slot);
            }
          }
          if (copied) continue;
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
