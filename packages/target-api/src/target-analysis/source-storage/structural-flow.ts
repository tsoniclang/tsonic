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
  const selectedTypes = new Map<SourceStorageSubject, Type | undefined>();
  const visited = new Map<SourceStorageSubject, Set<SourceStorageSubject>>();
  const pending: { readonly origin: SourceStorageSubject; readonly destination: SourceStorageSubject;
    readonly selected?: { readonly from: Type; readonly to: Type; readonly semantics: SourceFileSemantics } }[] = [];
  let draining = false;
  const typeFor = (value: SourceStorageSubject): Type | undefined => {
    if (selectedTypes.has(value)) return selectedTypes.get(value);
    const selected = sourceStorageSubjectType(source, value);
    selectedTypes.set(value, selected);
    return selected;
  };
  return (origin, destination) => {
    pending.push({ origin, destination });
    if (draining) return;
    draining = true;
    while (pending.length !== 0 && step()) {
      const selected = pending.pop()!;
      const from = selected.selected?.from ?? typeFor(selected.origin);
      const to = selected.selected?.to ?? typeFor(selected.destination);
      if (from === undefined || to === undefined) continue;
      const targets = visited.get(selected.origin) ?? new Set<SourceStorageSubject>();
      if (targets.has(selected.destination)) continue;
      targets.add(selected.destination);
      visited.set(selected.origin, targets);
      const semantics = selected.selected?.semantics ?? source.semantics.forNode(selected.origin.node);
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
          const origin = subject(selected.origin.node, selected.origin.kind, [...selected.origin.projection, originalComponent]);
          const destination = subject(selected.destination.node, selected.destination.kind, [...selected.destination.projection, component]);
          connect(origin, destination);
          if (origin !== undefined && destination !== undefined) pending.push({ origin, destination,
            selected: { from: fromComponent, to: toComponent, semantics } });
        }
      }
      if (from === to) continue;
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
              member.destination.property.type !== undefined) pending.push({ origin, destination,
                selected: { from: member.source.property.type, to: member.destination.property.type, semantics } });
          }
        }
      }
    }
    draining = false;
  };
}
