import type { Node, Type } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/types.js";
import type { SourceOwnershipContractEvidence, SourceOwnershipUnresolved } from "./model.js";
import type { SourceTypeComponentEvidence } from "../../source-semantics/types.js";
import type { SourceStorageLimits } from "../source-storage/model/types.js";
import { createSourceStorageBudget } from "../source-storage/model/resource-budget.js";
import type { SourceDeclarationOwnershipBudget, SourceDeclarationOwnershipContract,
  SourceDeclarationOwnershipUnresolved } from "./model.js";

export function sourceOwnershipContractProblem(source: TargetSourceProgram, node: Node, type: Type,
  evidence: SourceOwnershipContractEvidence): string | undefined {
  const file = source.ast.getSourceFile(node);
  const declarationFile = source.ast.getSourceFile(evidence.contractDeclaration);
  if (file === undefined || declarationFile === undefined || !source.semantics.includes(file)) {
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

export function sourceDeclarationOwnershipUnresolved(at: Node, reason: string): SourceDeclarationOwnershipUnresolved {
  return Object.freeze({ kind: "unresolved", at, reason, cause: Object.freeze({ kind: "required-fact" }) });
}

export function createSourceDeclarationOwnershipBudget(subject: Node,
  limits: SourceStorageLimits): SourceDeclarationOwnershipBudget {
  const counter = createSourceStorageBudget(limits);
  const initial = counter.failure();
  let failure: SourceDeclarationOwnershipUnresolved | undefined = initial === undefined ? undefined
    : Object.freeze({ kind: "unresolved", at: subject, reason: initial,
        cause: Object.freeze({ kind: "invalid-input" }) });
  const fail = (at: Node, category: "step" | "row", limit: number, exhausted: boolean): void => {
    failure ??= Object.freeze({ kind: "unresolved", at,
      reason: counter.failure() ?? "Ownership accounting requires a live finite reservation.",
      cause: exhausted ? Object.freeze({ kind: "resource-limit", subject: at, category, limit })
        : Object.freeze({ kind: "invalid-input" }) });
  };
  return Object.freeze({
    step(at: Node): boolean {
      if (failure !== undefined) return false;
      if (counter.step()) return true;
      fail(at, "step", counter.limits.maximumSteps, counter.usage().steps > counter.limits.maximumSteps);
      return false;
    },
    createRows(at: Node) {
      const rows = counter.createRows();
      let released = false;
      return Object.freeze({
        add(cost: number): boolean {
          if (failure !== undefined) return false;
          const exhausted = !released && Number.isSafeInteger(cost) && cost > 0 &&
            counter.usage().rows + cost > counter.limits.maximumTransportRows;
          if (rows.add(cost)) return true;
          fail(at, "row", counter.limits.maximumTransportRows, exhausted);
          return false;
        },
        release(): void { rows.release(); released = true; },
      });
    },
    failure: () => failure,
  });
}

export function sourceDeclarationOwnershipContractProblem(source: TargetSourceProgram, node: Node,
  component: SourceTypeComponentEvidence, contract: SourceDeclarationOwnershipContract): string | undefined {
  const file = source.ast.getSourceFile(node);
  if (file === undefined || !source.semantics.includes(file))
    return "Ownership evidence requires its original checked source operation or value.";
  const semantics = source.semantics.forNode(node);
  if (!semantics.types.isIdentical(component.selectedType, contract.component.selectedType))
    return "Ownership evidence does not describe the exact completed checked component.";
  if (contract.kind === "expression") return contract.expression === node ? undefined
    : "Ownership expression evidence belongs to a different checked operation or value.";
  const declarationFile = source.ast.getSourceFile(contract.declaration);
  if (declarationFile === undefined)
    return "Ownership evidence requires the actual checked declaration, including checked provider declarations.";
  const declarations = new Set<Node>();
  const declaration = semantics.declarations.declarationSignature(node);
  if (declaration !== undefined || source.ast.is.IsParameterDeclaration(node) ||
    source.ast.is.IsVariableDeclaration(node) || source.ast.is.IsPropertyDeclaration(node) ||
    source.ast.is.IsPropertySignatureDeclaration(node)) declarations.add(node);
  const reference = source.navigation.sourceReferenceFor(node);
  if (reference !== undefined) declarations.add(reference.declaration);
  if (source.ast.is.IsCallExpression(node) || source.ast.is.IsNewExpression(node)) {
    const selected = semantics.operations.call(node);
    const selectedDeclaration = selected?.sourceSelectedSignatureKind === "resolved"
      ? semantics.declarations.signatureDeclaration(selected.selectedSignature) : undefined;
    if (selectedDeclaration !== undefined) declarations.add(selectedDeclaration);
  }
  if (source.ast.is.IsPropertyAccessExpression(node)) {
    const selected = semantics.operations.propertyAccess(node);
    if (selected?.selectedReadDeclaration !== undefined) declarations.add(selected.selectedReadDeclaration);
    if (selected?.selectedWriteDeclaration !== undefined) declarations.add(selected.selectedWriteDeclaration);
  }
  return declarations.has(contract.declaration) ? undefined
    : "Ownership evidence must identify this operation's selected declaration, not a declaration of its type.";
}
