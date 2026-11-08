import type { Node } from "@tsonic/tsts";
import type { SourceTypeDescriptorSignature, SourceTypeEvidence } from "../../../public/source/contracts.js";
import { sourceCallableSignatures } from "../../../source-navigation/callable-parameters.js";
import { sourceStorageValue, type SourceStorageProgram } from "./program.js";

export function sourceStorageOriginalSignature(source: SourceStorageProgram, declaration: Node, role: "body" | "signature"):
  { readonly value: SourceTypeEvidence; readonly signature: SourceTypeDescriptorSignature } | undefined {
  const head = sourceStorageValue(source.analysis.settle(source.analysis.callableHead(declaration, role, Object.freeze([]))));
  const selected = sourceStorageValue(sourceCallableSignatures(source, head, source.work))
    .filter(original => original.signature.identity.declaration === declaration);
  return selected.length === 1 ? selected[0] : undefined;
}
