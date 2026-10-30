import type { Node } from "@tsonic/tsts";
import type { TargetDiagnosticSourceSpan } from "../../artifacts.js";
import {
  Node_Expression, sourceExpressionResultDisposition, sourceCallableDefinitionIsDiscarded,
  sourceLexicalFunctionIsUnused, sourceNodesOutsideErasedSubtrees,
} from "../../source-navigation/index.js";
import type { TargetSourceProgram } from "../../source-semantics/types.js";
import { createSourceGenericAdoptionDiagnostics } from "./generic-adoption-diagnostics.js";
import type { SourceDeclarationOwnershipBudget, SourceDeclarationOwnershipPremises,
  SourceDeclarationOwnershipUnresolved } from "./model.js";
import { sourceDeclarationOwnershipContractProblem, sourceDeclarationOwnershipUnresolved } from "./contracts.js";

export { sourceGenericAdoptionDiagnosticMessage } from "./generic-adoption-diagnostics.js";
export const sourceGenericAdoptionDiagnosticCode = "TSONIC_GENERIC_ASYNC_ADOPTION_UNSUPPORTED";

export interface SourceGenericAdoptionIssue {
  readonly site: Node;
  readonly parameter: Node;
  readonly declaration: Node;
  readonly operation: Node;
  readonly message: string;
  readonly sourceSpan: TargetDiagnosticSourceSpan;
  readonly evidence: readonly string[];
}

export function analyzeSourceDeclarationGenericAdoption(input: {
  readonly source: TargetSourceProgram;
  readonly projectRoot: string;
  readonly nodes: readonly Node[];
  readonly premises: Pick<SourceDeclarationOwnershipPremises, "completionFor">;
  readonly budget: SourceDeclarationOwnershipBudget;
  readonly exemptTypeParameter?: (parameter: Node) => boolean;
}): { readonly kind: "resolved"; readonly issues: readonly SourceGenericAdoptionIssue[] }
  | SourceDeclarationOwnershipUnresolved {
  const { source, budget } = input;
  const { ast } = source;
  const root = input.nodes[0] ?? source.sourceFiles[0];
  if (root === undefined) return Object.freeze({ kind: "resolved", issues: Object.freeze([]) });
  const domain = sourceNodesOutsideErasedSubtrees(ast, input.nodes, node =>
    ast.is.IsArrowFunction(node) || ast.is.IsFunctionExpression(node)
      ? sourceCallableDefinitionIsDiscarded(node, ast, source.navigation)
      : sourceLexicalFunctionIsUnused(node, ast, source.navigation));
  if (domain.kind === "unresolved") return sourceDeclarationOwnershipUnresolved(root, domain.reason);
  const rows = budget.createRows(root);
  const format = createSourceGenericAdoptionDiagnostics(source, input.projectRoot);
  const issues: SourceGenericAdoptionIssue[] = [];
  const issuedSites = new Set<Node>();
  try {
    for (const node of domain.nodes) {
      if (!budget.step(node)) return budget.failure()!;
      const semantics = source.semantics.forNode(node);
      if (ast.is.IsCallExpression(node) || ast.is.IsNewExpression(node)) {
        const selected = semantics.operations.call(node);
        const declaration = selected?.sourceSelectedSignatureKind === "resolved"
          ? semantics.declarations.signatureDeclaration(selected.selectedSignature) : undefined;
        if (selected !== undefined && declaration !== undefined) {
          const completion = input.premises.completionFor(node, selected);
          if (completion.kind === "unresolved") return completion;
          if (completion.kind === "async") {
            const problem = sourceDeclarationOwnershipContractProblem(source, node,
              { selectedType: selected.sourceResultType }, completion.contract);
            if (problem !== undefined) return sourceDeclarationOwnershipUnresolved(node, problem);
          }
        }
      }
      if (!ast.is.IsAwaitExpression(node) || issuedSites.has(node)) continue;
      const operand = Node_Expression(ast, node);
      const type = operand === undefined ? undefined : semantics.types.expressionType(operand);
      if (operand === undefined || type === undefined)
        return sourceDeclarationOwnershipUnresolved(node, "Await admission requires its original checked operand and type.");
      if (sourceExpressionResultDisposition(ast, node).kind === "discarded") continue;
      const symbol = semantics.declarations.typeSymbol(type);
      if (symbol === undefined) continue;
      let parameter: Node | undefined;
      for (const declaration of semantics.declarations.symbolDeclarations(symbol)) {
        if (!budget.step(declaration)) return budget.failure()!;
        if (!ast.is.IsTypeParameterDeclaration(declaration)) continue;
        const declared = semantics.declarations.declaredType(declaration);
        if (declared === undefined)
          return sourceDeclarationOwnershipUnresolved(node, "Await admission requires its exact checked type-parameter declaration.");
        if (!semantics.types.isIdentical(declared, type)) continue;
        if (parameter !== undefined && parameter !== declaration)
          return sourceDeclarationOwnershipUnresolved(node, "Await admission has conflicting checked type-parameter declarations.");
        parameter = declaration;
      }
      if (parameter === undefined || input.exemptTypeParameter?.(parameter) === true) continue;
      const declaration = ast.parent(parameter);
      const formatted = declaration === undefined ? undefined : format(node, declaration, node, parameter, operand);
      if (declaration === undefined || formatted === undefined)
        return sourceDeclarationOwnershipUnresolved(node, "Await diagnostics require their exact checked declaration, operand and source spans.");
      if (!rows.add(2)) return budget.failure()!;
      issuedSites.add(node);
      issues.push(Object.freeze({ site: node, parameter, declaration, operation: node, ...formatted }));
    }
    return Object.freeze({ kind: "resolved", issues: Object.freeze(issues) });
  } finally { rows.release(); }
}
