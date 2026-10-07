import type { Type } from "@tsonic/tsts";
import type { SourceFileSemantics, TargetSourceProgram } from "../../source-semantics/index.js";
import type { SourceStorageProjection, SourceStorageSubject, SourceStorageSubjectQuery } from "./subjects.js";
import { sourcePresentStorageType, sourceStorageComponents, sourceStorageComponentType, sourceStorageSubjectType } from "./components.js";

export function createSourceStorageStructuralFlow(
  source: TargetSourceProgram,
  step: () => boolean,
  subject: SourceStorageSubjectQuery,
  connect: (origin: SourceStorageSubject | undefined, destination: SourceStorageSubject | undefined) => void,
): (origin: SourceStorageSubject, destination: SourceStorageSubject) => void {
  const visited = new Map<Type, Set<Type>>();
  const pending: { readonly from: Type; readonly to: Type; readonly semantics: SourceFileSemantics }[] = [];
  let draining = false;
  return (origin, destination) => {
    const from = sourceStorageSubjectType(source, origin);
    const to = sourceStorageSubjectType(source, destination);
    if (from === undefined || to === undefined) return;
    pending.push({ from, to, semantics: source.semantics.forNode(origin.node) });
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
        const toComponent = sourceStorageComponentType(toPresent, component, semantics);
        if (toComponent === undefined) continue;
        const components: Iterable<SourceStorageProjection> = component.kind === "array-element"
          ? sourceStorageComponents(fromPresent, semantics)
          : [semantics.types.isTuple(fromPresent) ? component : { kind: "array-element" }];
        for (const originalComponent of components) {
          if (!step()) break;
          const fromComponent = sourceStorageComponentType(fromPresent, originalComponent, semantics);
          if (fromComponent === undefined) continue;
          pending.push({ from: fromComponent, to: toComponent, semantics });
        }
      }
      const relation = semantics.types.structuralMembers(from, to);
      if (relation.kind !== "available") continue;
      for (const member of relation.members) {
        if (!step()) break;
        if (member.kind !== "present") continue;
        for (const original of member.source.declarations) {
          if (!step()) break;
          const origin = subject(original, source.ast.is.IsGetAccessorDeclaration(original) ? "return" : "value");
          for (const target of member.destination.declarations) {
            if (!step()) break;
            const destination = subject(target, source.ast.is.IsGetAccessorDeclaration(target) ? "return" : "value");
            connect(origin, destination);
            if (origin !== undefined && destination !== undefined && member.source.property.type !== undefined &&
              member.destination.property.type !== undefined) pending.push({
                from: member.source.property.type, to: member.destination.property.type, semantics });
          }
        }
      }
    }
    draining = false;
  };
}
