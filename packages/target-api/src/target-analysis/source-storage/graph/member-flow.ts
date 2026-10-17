import type { Node, SourceFile, Type } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import type { SourceStructuralMemberPair } from "../../../source-semantics/structural-members.js";
import { sourceStorageSubjectType } from "../model/components.js";
import type { SourceStorageSubject } from "../model/subjects.js";
import type { SourceStorageProjection } from "../model/subjects.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import { SpreadAssignment_Expression } from "../../../source-navigation/index.js";

interface MemberIndex {
  readonly members: readonly SourceStructuralMemberPair[];
  readonly declarations: ReadonlyMap<Node, readonly Node[]>;
}

const noMembers: MemberIndex = Object.freeze({ members: Object.freeze([]), declarations: new Map() });

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
      const selected = queries.types.structuralMembers(from, to);
      let index: MemberIndex | undefined;
      if (selected.kind === "unavailable" && selected.reason === "disjoint-shape") index = noMembers;
      if (selected.kind === "available") {
        if (!rows.add(1 + selected.members.length)) return undefined;
        const contextualMembers = contextual === undefined || !selected.members.some(member => member.kind === "absent")
          ? undefined : queries.types.structuralMembers(contextual, to);
        const contextualByDestination = new Map<SourceStructuralMemberPair["destination"]["property"]["symbol"], SourceStructuralMemberPair>();
        if (contextualMembers?.kind === "available") for (const member of contextualMembers.members) {
          if (!budget.step() || !temporary.add(1)) return undefined;
          contextualByDestination.set(member.destination.property.symbol, member);
        }
        const physicalMembers: SourceStructuralMemberPair[] = [];
        const members = new Map<Node, Set<Node>>();
        for (const member of selected.members) {
          if (!budget.step()) return undefined;
          const physical = member.kind === "absent" && contextualByDestination.size !== 0
            ? contextualByDestination.get(member.destination.property.symbol) ?? member : member;
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
    const index = selectedIndex(owner, destinationType);
    if (index === noMembers) return Object.freeze([]);
    const declarations = index?.declarations.get(declaration);
    if (declarations === undefined || declarations.length === 0) return undefined;
    const file = sourceFileFor(owner);
    if (file === undefined) return undefined;
    for (const original of declarations) {
      if (!budget.step() || !retainCheckedContext(original, file)) return undefined;
    }
    return declarations;
  };
  const spreadInputsFor = (owner: SourceStorageSubject, declaration: Node, destinationType: Type): readonly {
    readonly expression: Node; readonly component: SourceStorageProjection;
  }[] | undefined => {
    const file = sourceFileFor(owner);
    const object = source.ast.as.AsObjectLiteralExpression(owner.node);
    const index = selectedIndex(owner, destinationType);
    if (file === undefined || object === undefined || owner.projection.length !== 0 || index === undefined) return undefined;
    const selected = index.members.filter(member => member.kind === "present" &&
      (member.source.declarations.includes(declaration) || member.destination.declarations.includes(declaration)));
    if (selected.length !== 1 || selected[0]?.kind !== "present") return undefined;
    const property = selected[0].source.property;
    const queries = source.semantics.forFile(file);
    const inputs: { readonly expression: Node; readonly component: SourceStorageProjection }[] = [];
    for (const element of [...source.ast.properties(owner.node)].reverse()) {
      if (!budget.step()) return undefined;
      if (!source.ast.is.IsSpreadAssignment(element)) {
        const selected = queries.operations.objectLiteralElement(element);
        const symbol = selected?.sourceElementSymbol;
        if (selected === undefined || symbol === undefined) return undefined;
        if (queries.declarations.symbolName(symbol) === property.name) break;
        continue;
      }
      const expression = SpreadAssignment_Expression(source.ast, element);
      const type = expression === undefined ? undefined : queries.types.expressionType(expression);
      const members = type === undefined ? undefined : indexFor(file, type, type);
      if (members === undefined || expression === undefined) return undefined;
      const matches = members.members.filter(member => member.kind === "present" && member.source.property.name === property.name);
      if (matches.length === 0) continue;
      if (matches.length !== 1 || matches[0]?.kind !== "present") return undefined;
      const member = matches[0].source;
      if (member.read !== "property" && member.read !== "method" || member.declarations.length === 0) return undefined;
      for (const original of member.declarations) {
        if (!budget.step() || !retainCheckedContext(original, file)) return undefined;
        inputs.push(Object.freeze({ expression, component: Object.freeze({
          kind: member.read === "method" ? "method-value" : "member", declaration: original,
        }) }));
      }
      if (!member.property.optional) break;
    }
    return Object.freeze(inputs);
  };
  return Object.freeze({ declarationsFor, spreadInputsFor,
    membersFor: (owner: SourceStorageSubject, destinationType: Type): readonly SourceStructuralMemberPair[] | undefined =>
      selectedIndex(owner, destinationType)?.members });
}
