import type { SourceStorageProgram } from "./program.js";
import type { SourceTypeEvidence } from "../../../public/source/contracts.js";
import type { Node, SourceFile } from "@tsonic/tsts";
import { sourceStorageValue } from "./program.js";
import type { SourceStorageProjection, SourceStorageSubject, SourceStorageSubjectQuery } from "./subjects.js";
import { sourceStorageMemberSubject } from "./subjects.js";
import { sourcePresentStorageType, sourceStorageComponents, sourceStorageComponentType, sourceStorageSubjectType, sourceStorageOriginalComponents } from "./components.js";
import type { SourceStorageEdgeTypes } from "./relations.js";

export function createSourceStorageStructuralFlow(
  source: SourceStorageProgram,
  step: () => boolean,
  subject: SourceStorageSubjectQuery,
  connect: (origin: SourceStorageSubject | undefined, destination: SourceStorageSubject | undefined,
    types?: SourceStorageEdgeTypes) => void,
  sourceFileFor: (subject: SourceStorageSubject) => SourceFile | undefined,
  retainCheckedContext: (node: Node, sourceFile: SourceFile) => boolean,
): (origin: SourceStorageSubject, destination: SourceStorageSubject, types?: SourceStorageEdgeTypes) => void {
  const visited = new Map<SourceTypeEvidence, Set<SourceTypeEvidence>>();
  const pending: { readonly from: SourceTypeEvidence; readonly to: SourceTypeEvidence; readonly sourceFile: SourceFile }[] = [];
  let draining = false;
  return (origin, destination, types) => {
    const fromFile = sourceFileFor(origin);
    const toFile = sourceFileFor(destination);
    const from = types === undefined ? sourceStorageSubjectType(source, origin, fromFile) : types.from;
    const to = types === undefined ? sourceStorageSubjectType(source, destination, toFile) : types.to;
    if (from === undefined || to === undefined || fromFile === undefined) return;
    pending.push({ from, to, sourceFile: fromFile });
    if (draining) return;
    draining = true;
    while (pending.length !== 0 && step()) {
      const selected = pending.pop()!;
      const { from, to, sourceFile } = selected;
      if (from === to) continue;
      const targets = visited.get(from) ?? new Set<SourceTypeEvidence>();
      if (targets.has(to)) continue;
      targets.add(to);
      visited.set(from, targets);
      const fromPresent = sourcePresentStorageType(from, source);
      const toPresent = sourcePresentStorageType(to, source);
      if (fromPresent === undefined || toPresent === undefined) continue;
      for (const component of sourceStorageComponents(toPresent, source)) {
        if (!step()) break;
        const toComponent = sourceStorageComponentType(toPresent, component, source);
        if (toComponent === undefined) continue;
        const components: Iterable<SourceStorageProjection> = sourceStorageOriginalComponents(fromPresent, toPresent, component, source);
        for (const originalComponent of components) {
          if (!step()) break;
          const fromComponent = sourceStorageComponentType(fromPresent, originalComponent, source);
          if (fromComponent === undefined) continue;
          pending.push({ from: fromComponent, to: toComponent, sourceFile });
        }
      }
      const relation = sourceStorageValue(source.facts.objects.correspondence(from, to, "read"));
      if (relation.kind !== "available") continue;
      for (const member of relation.members) {
        if (!step()) break;
        if (member.kind !== "present" || member.destination.read === "accessor") continue;
        const originals = member.source.read === "accessor" ? member.source.getters : member.source.declarations;
        for (const original of originals) {
          if (!step() || !retainCheckedContext(original, sourceFile)) break;
          const origin = sourceStorageMemberSubject(original, source.ast, subject);
          for (const target of member.destination.declarations) {
            if (!step() || !retainCheckedContext(target, sourceFile)) break;
            const destination = sourceStorageMemberSubject(target, source.ast, subject);
            const types = member.source.readType === undefined || member.destination.readType === undefined ? undefined
              : { from: member.source.readType, to: member.destination.readType };
            connect(origin, destination, types);
            if (origin !== undefined && destination !== undefined && types !== undefined) pending.push({ ...types, sourceFile });
          }
        }
      }
    }
    draining = false;
  };
}
