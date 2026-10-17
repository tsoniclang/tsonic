import type { Node, Type } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/types.js";
import type { SourceOwnershipContractEvidence, SourceOwnershipUnresolved } from "./model.js";

export function sourceOwnershipContractProblem(source: TargetSourceProgram, node: Node, type: Type,
  evidence: SourceOwnershipContractEvidence): string | undefined {
  const file = source.ast.getSourceFile(node);
  if (file === undefined || !source.semantics.includes(file)) {
    return "Ownership contract evidence must belong to the exact checked source program.";
  }
  const semantics = source.semantics.forNode(node);
  if (!semantics.types.isIdentical(type, evidence.checkedType)) {
    return "Ownership contract evidence does not describe the exact instantiated source type.";
  }
  const selectedDeclarations = new Set<Node>([node]);
  const reference = source.navigation.sourceReferenceFor(node);
  if (reference !== undefined) selectedDeclarations.add(reference.declaration);
  if (source.ast.is.IsCallExpression(node) || source.ast.is.IsNewExpression(node)) {
    const selected = semantics.operations.call(node);
    const declaration = selected?.sourceSelectedSignatureKind === "resolved"
      ? semantics.declarations.signatureDeclaration(selected.selectedSignature) : undefined;
    if (declaration !== undefined) selectedDeclarations.add(declaration);
  }
  for (const symbol of [semantics.declarations.typeSymbol(type), semantics.declarations.typeAliasSymbol(type)]) {
    if (symbol !== undefined) {
      for (const declaration of semantics.declarations.symbolDeclarations(symbol)) selectedDeclarations.add(declaration);
    }
  }
  return selectedDeclarations.has(evidence.contractDeclaration) ? undefined
    : "Ownership contract evidence is not attached to the selected declaration or exact native type.";
}

export function sourceOwnershipUnresolved(at: Node, reason: string): SourceOwnershipUnresolved {
  return Object.freeze({ kind: "unresolved", at, reason });
}
