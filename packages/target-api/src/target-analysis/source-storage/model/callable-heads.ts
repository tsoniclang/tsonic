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

export function sourceStorageOriginalParameters(source: SourceStorageProgram, declaration: Node, role: "body" | "signature"):
  readonly Node[] | undefined {
  const original = sourceStorageOriginalSignature(source, declaration, role);
  if (original === undefined) return undefined;
  const parameters: Node[] = [];
  const seen = new Set<Node>();
  for (const parameter of original.signature.parameters) {
    source.work(declaration);
    const selected = parameter.declaration;
    if (selected === undefined || !source.ast.is.IsParameterDeclaration(selected) ||
      !source.facts.navigation.includes(selected) || source.ast.parent(selected) !== declaration || seen.has(selected)) return undefined;
    seen.add(selected);
    parameters.push(selected);
  }
  return Object.freeze(parameters);
}
