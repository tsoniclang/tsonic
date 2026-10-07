import type { Node, SourceFile, Type } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/index.js";
import { sourceStorageSubjectType } from "./components.js";
import type { SourceStorageSubject } from "./subjects.js";

export function createSourceStorageMemberFlow(
  source: TargetSourceProgram,
  step: () => boolean,
  sourceFileFor: (subject: SourceStorageSubject) => SourceFile | undefined,
  retainCheckedContext: (node: Node, sourceFile: SourceFile) => boolean,
) {
  const declarationsFor = (owner: SourceStorageSubject, declaration: Node, destinationType: Type): readonly Node[] | undefined => {
    const file = sourceFileFor(owner);
    const type = sourceStorageSubjectType(source, owner, file);
    if (file === undefined || type === undefined) return undefined;
    const selected = source.semantics.forFile(file).types.structuralMembers(type, destinationType);
    if (selected.kind !== "available") return undefined;
    const declarations = new Set<Node>();
    for (const member of selected.members) {
      if (!step()) return undefined;
      if (member.kind !== "present") continue;
      let matches = false;
      for (const target of member.destination.declarations) {
        if (!step()) return undefined;
        matches ||= target === declaration;
      }
      if (!matches) continue;
      for (const original of member.source.declarations) {
        if (!step() || !retainCheckedContext(original, file)) return undefined;
        declarations.add(original);
      }
    }
    return declarations.size === 0 ? undefined : [...declarations];
  };
  return Object.freeze({ declarationsFor });
}
