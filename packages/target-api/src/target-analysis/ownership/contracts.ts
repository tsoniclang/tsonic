import type { Node } from "@tsonic/tsts";
import type { SourceTypeComponentEvidence, TargetSourceProgram } from "../../source-semantics/types.js";
import type { SourceDeclarationOwnershipBudget, SourceDeclarationOwnershipContract,
  SourceDeclarationOwnershipLimits, SourceDeclarationOwnershipUnresolved } from "./model.js";

export const defaultSourceDeclarationOwnershipLimits: SourceDeclarationOwnershipLimits = Object.freeze({
  maximumSteps: 33_554_432,
  maximumTransportRows: 4_194_304,
});

export function sourceDeclarationOwnershipUnresolved(at: Node, reason: string): SourceDeclarationOwnershipUnresolved {
  return Object.freeze({ kind: "unresolved", at, reason, cause: Object.freeze({ kind: "required-fact" }) });
}

export function createSourceDeclarationOwnershipBudget(subject: Node,
  limits: SourceDeclarationOwnershipLimits): SourceDeclarationOwnershipBudget {
  let failure: SourceDeclarationOwnershipUnresolved | undefined;
  const invalid = (at: Node, reason: string): false => {
    failure ??= Object.freeze({ kind: "unresolved", at, reason, cause: Object.freeze({ kind: "invalid-input" }) });
    return false;
  };
  const exhausted = (at: Node, category: "step" | "row", limit: number): false => {
    failure ??= Object.freeze({ kind: "unresolved", at,
      reason: `Declaration ownership exhausted its ${category} limit (${limit}).`,
      cause: Object.freeze({ kind: "resource-limit", subject: at, category, limit }) });
    return false;
  };
  let maximumSteps = 0;
  let maximumRows = 0;
  if (typeof limits !== "object" || limits === null) {
    invalid(subject, "Declaration ownership limits require finite own data values.");
  } else {
    for (const key of ["maximumSteps", "maximumTransportRows"] as const) {
      const descriptor = Object.getOwnPropertyDescriptor(limits, key);
      if (descriptor === undefined || !("value" in descriptor) || typeof descriptor.value !== "number" ||
        !Number.isSafeInteger(descriptor.value) || descriptor.value <= 0 ||
        descriptor.value > defaultSourceDeclarationOwnershipLimits[key]) {
        invalid(subject, `Declaration ownership ${key} must be a positive safe integer within its finite default.`);
        break;
      }
      if (key === "maximumSteps") maximumSteps = descriptor.value;
      else maximumRows = descriptor.value;
    }
  }
  let steps = 0;
  let rows = 0;
  return Object.freeze({
    step(at: Node): boolean {
      if (failure !== undefined) return false;
      steps++;
      return steps <= maximumSteps || exhausted(at, "step", maximumSteps);
    },
    createRows(at: Node) {
      let retained = 0;
      let released = false;
      return Object.freeze({
        add(cost: number): boolean {
          if (failure !== undefined) return false;
          if (released || !Number.isSafeInteger(cost) || cost <= 0)
            return invalid(at, "Declaration ownership accounting requires a live positive finite row reservation.");
          if (rows + cost > maximumRows) return exhausted(at, "row", maximumRows);
          rows += cost;
          retained += cost;
          return true;
        },
        release(): void {
          if (released) return;
          released = true;
          rows -= retained;
          retained = 0;
        },
      });
    },
    failure: () => failure,
    usage: () => Object.freeze({ steps, rows }),
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
