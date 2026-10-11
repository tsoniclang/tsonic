import type { Node, SourceFile, Type } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/index.js";
import type { SourceStructuralMemberPair } from "../../source-semantics/structural-members.js";
import { sourceStorageSubjectType } from "./components.js";
import type { SourceStorageSubject } from "./subjects.js";
import type { SourceStorageBudget } from "./resource-budget.js";

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
  const selections = new Map<SourceFile, Map<Type, Map<Type, MemberIndex | undefined>>>();
  const indexFor = (file: SourceFile, from: Type, to: Type): MemberIndex | undefined => {
    const sources = selections.get(file);
    const destinations = sources?.get(from);
    if (destinations?.has(to)) return destinations.get(to);
    const rows = budget.createRows();
    let published = false;
    try {
      const selected = source.semantics.forFile(file).types.structuralMembers(from, to);
      let index: MemberIndex | undefined;
      if (selected.kind === "unavailable" && selected.reason === "disjoint-shape") index = noMembers;
      if (selected.kind === "available") {
        if (!rows.add(1 + selected.members.length)) return undefined;
        const members = new Map<Node, Set<Node>>();
        for (const member of selected.members) {
          if (!budget.step()) return undefined;
          if (member.kind !== "present") continue;
          for (const target of member.destination.declarations) {
            if (!budget.step()) return undefined;
            let originals = members.get(target);
            if (originals === undefined) {
              if (!rows.add(1)) return undefined;
              originals = new Set();
              members.set(target, originals);
            }
            for (const original of member.source.declarations) {
              if (!budget.step()) return undefined;
              if (originals.has(original)) continue;
              if (!rows.add(1)) return undefined;
              originals.add(original);
            }
          }
        }
        index = Object.freeze({ members: Object.freeze([...selected.members]),
          declarations: new Map([...members].map(([target, originals]) => [target, Object.freeze([...originals])])) });
      }
      if (!rows.add(1 + (sources === undefined ? 1 : 0) + (destinations === undefined ? 1 : 0))) return undefined;
      const retainedSources = sources ?? new Map<Type, Map<Type, MemberIndex | undefined>>();
      const retainedDestinations = destinations ?? new Map<Type, MemberIndex | undefined>();
      retainedDestinations.set(to, index);
      retainedSources.set(from, retainedDestinations);
      selections.set(file, retainedSources);
      published = true;
      return index;
    } finally {
      if (!published) rows.release();
    }
  };
  const selectedIndex = (owner: SourceStorageSubject, destinationType: Type): MemberIndex | undefined => {
    if (!budget.step()) return undefined;
    const file = sourceFileFor(owner);
    const type = sourceStorageSubjectType(source, owner, file);
    if (file === undefined || type === undefined) return undefined;
    const semantics = source.semantics.forFile(file);
    if (!semantics.types.isUnion(type)) return indexFor(file, type, destinationType);
    const refinement = semantics.types.refinement(type, destinationType);
    return refinement.kind === "members" && refinement.types.length === 1
      ? indexFor(file, refinement.types[0]!, destinationType) : undefined;
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
  return Object.freeze({ declarationsFor,
    membersFor: (owner: SourceStorageSubject, destinationType: Type): readonly SourceStructuralMemberPair[] | undefined =>
      selectedIndex(owner, destinationType)?.members });
}
