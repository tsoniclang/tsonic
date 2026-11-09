import type { Node, ResolvedCallApplicationEvidence, ResolvedCallTypeArgumentEvidence,
  ResolvedCheckedComponentEvidence, Type } from "@tsonic/tsts";

export type MemorySourceProvenance =
  | { readonly kind: "binding"; readonly application: ResolvedCallApplicationEvidence;
      readonly argument: ResolvedCallTypeArgumentEvidence; readonly declaration: Node;
      readonly sourceType: Type }
  | { readonly kind: "result"; readonly application: ResolvedCallApplicationEvidence;
      readonly component: ResolvedCheckedComponentEvidence };

export interface MemoryTypePublicationSources {
  readonly source: MemorySourceProvenance;
  readonly owner: MemorySourceProvenance | undefined;
}

export function memorySourceType(source: MemorySourceProvenance): Type {
  return source.kind === "binding" ? source.sourceType : source.component.type;
}

export function assertMemorySource(source: MemorySourceProvenance, call: Node): void {
  if (source.application.invocation !== call) throw new Error("Memory provenance requires its exact original application.");
  if (source.kind === "binding") {
    if (source.argument.declaration !== source.declaration || source.argument.checkedArgument !== source.sourceType ||
      !source.application.signatureTypeArguments.includes(source.argument))
      throw new Error("Memory binding provenance requires its identical original binder and observed argument.");
  } else if (source.component.application !== source.application || source.component.root.node !== call) {
    throw new Error("Memory result provenance requires its original observed result component.");
  }
}
