import type { Node, Type } from "@tsonic/tsts";
import type { SourceFileSemantics, TargetSourceProgram } from "../../source-semantics/index.js";
import type { SourceErrorStorageSubject } from "./error-storage-subjects.js";

export function createSourceErrorStructuralFlow(
  source: TargetSourceProgram,
  step: () => boolean,
  subject: (node: Node | undefined, kind?: SourceErrorStorageSubject["kind"]) => SourceErrorStorageSubject | undefined,
  connect: (origin: SourceErrorStorageSubject | undefined, destination: SourceErrorStorageSubject | undefined) => void,
): (origin: SourceErrorStorageSubject, destination: SourceErrorStorageSubject) => void {
  const selectedTypes = new Map<SourceErrorStorageSubject, Type | undefined>();
  const visited = new WeakMap<Type, WeakSet<Type>>();
  const pending: { readonly origin: SourceErrorStorageSubject; readonly destination: SourceErrorStorageSubject;
    readonly selected?: { readonly from: Type; readonly to: Type; readonly semantics: SourceFileSemantics } }[] = [];
  let draining = false;
  const typeFor = (value: SourceErrorStorageSubject): Type | undefined => {
    if (selectedTypes.has(value)) return selectedTypes.get(value);
    const file = source.ast.getSourceFile(value.node);
    if (file === undefined || !source.semantics.includes(file)) {
      selectedTypes.set(value, undefined);
      return undefined;
    }
    const semantics = source.semantics.forNode(value.node);
    const nodeType = semantics.declarations.declaredValueType(value.node) ?? semantics.types.expressionType(value.node);
    const signatures = value.kind !== "return" || nodeType === undefined ? [] : semantics.types.callSignatures(nodeType)
      .filter(signature => semantics.declarations.signatureDeclaration(signature) === value.node);
    const selected = value.kind === "return" ? signatures.length === 1 ? semantics.types.returnType(signatures[0]!) : undefined
      : value.kind === "receiver" ? semantics.declarations.declaredType(value.node) : nodeType;
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
      if (from === undefined || to === undefined || from === to) continue;
      const targets = visited.get(from) ?? new WeakSet<Type>();
      if (targets.has(to)) continue;
      targets.add(to);
      visited.set(from, targets);
      const semantics = selected.selected?.semantics ?? source.semantics.forNode(selected.origin.node);
      const relation = semantics.types.structuralMembers(from, to);
      if (relation.kind !== "available") continue;
      for (const member of relation.members) {
        if (!step()) break;
        if (member.kind !== "present" || member.source.read === "method" || member.destination.read === "method") continue;
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
