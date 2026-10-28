import type { Node, SourceFile, Type } from "@tsonic/tsts";
import type { SourceFileSemantics, TargetSourceProgram } from "../../../source-semantics/index.js";
import type { SourceStorageProjection, SourceStorageSubject, SourceStorageSubjectQuery } from "./subjects.js";
import { sourceStorageMemberSubject } from "./subjects.js";
import { sourcePresentStorageType, sourceStorageComponents, sourceStorageComponentType, sourceStorageSubjectType, sourceStorageOriginalComponents } from "./components.js";
import type { SourceStorageEdgeTypes } from "../graph/edges.js";

export function createSourceStorageStructuralFlow(
  source: TargetSourceProgram,
  step: () => boolean,
  subject: SourceStorageSubjectQuery,
  connect: (origin: SourceStorageSubject | undefined, destination: SourceStorageSubject | undefined,
    types?: { readonly from: Type; readonly to: Type }) => void,
  sourceFileFor: (subject: SourceStorageSubject) => SourceFile | undefined,
  retainCheckedContext: (node: Node, sourceFile: SourceFile) => boolean,
): (origin: SourceStorageSubject, destination: SourceStorageSubject, types?: SourceStorageEdgeTypes) => void {
  const visited = new Map<Type, Set<Type>>();
  const pending: { readonly from: Type; readonly to: Type; readonly semantics: SourceFileSemantics }[] = [];
  let draining = false;
  return (origin, destination, types) => {
    const fromFile = sourceFileFor(origin);
    const toFile = sourceFileFor(destination);
    const from = types === undefined ? sourceStorageSubjectType(source, origin, fromFile) : types.from;
    const to = types === undefined ? sourceStorageSubjectType(source, destination, toFile) : types.to;
    if (from === undefined || to === undefined || fromFile === undefined) return;
    pending.push({ from, to, semantics: source.semantics.forFile(fromFile) });
    if (draining) return;
    draining = true;
    while (pending.length !== 0 && step()) {
      const selected = pending.pop()!;
      const { from, to, semantics } = selected;
      if (from === to) continue;
      const targets = visited.get(from) ?? new Set<Type>();
      if (targets.has(to)) continue;
      targets.add(to);
      visited.set(from, targets);
      const fromPresent = sourcePresentStorageType(from, semantics);
      const toPresent = sourcePresentStorageType(to, semantics);
      if (fromPresent === undefined || toPresent === undefined) continue;
      for (const component of sourceStorageComponents(toPresent, semantics)) {
        if (!step()) break;
        const toComponent = sourceStorageComponentType(toPresent, component, semantics, source.ast);
        if (toComponent === undefined) continue;
        const components: Iterable<SourceStorageProjection> = sourceStorageOriginalComponents(fromPresent, toPresent, component, semantics);
        for (const originalComponent of components) {
          if (!step()) break;
          const fromComponent = sourceStorageComponentType(fromPresent, originalComponent, semantics, source.ast);
          if (fromComponent === undefined) continue;
          pending.push({ from: fromComponent, to: toComponent, semantics });
        }
      }
      const relation = semantics.types.structuralMembers(from, to, "read");
      if (relation.kind !== "available") continue;
      for (const member of relation.members) {
        if (!step()) break;
        if (member.kind !== "present" || member.destination.read === "accessor") continue;
        const originals = member.source.read === "accessor" ? member.source.getters : member.source.declarations;
        for (const original of originals) {
          if (!step() || !retainCheckedContext(original, semantics.sourceFile)) break;
          const origin = sourceStorageMemberSubject(original, source.ast, subject);
          for (const target of member.destination.declarations) {
            if (!step() || !retainCheckedContext(target, semantics.sourceFile)) break;
            const destination = sourceStorageMemberSubject(target, source.ast, subject);
            const types = member.source.property.type === undefined || member.destination.property.type === undefined ? undefined
              : { from: member.source.property.type, to: member.destination.property.type };
            connect(origin, destination, types);
            if (origin !== undefined && destination !== undefined && types !== undefined) pending.push({ ...types, semantics });
          }
        }
      }
    }
    draining = false;
  };
}
