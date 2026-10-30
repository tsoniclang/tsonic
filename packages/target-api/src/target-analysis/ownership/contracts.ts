import type { Node } from "@tsonic/tsts";
import type { SourceTypeComponentEvidence, TargetSourceProgram } from "../../source-semantics/types.js";
import type { SourceDeclarationOwnershipBudget, SourceDeclarationOwnershipContract,
  SourceDeclarationOwnershipLimits, SourceDeclarationOwnershipUnresolved } from "./model.js";
import { sourceExpressionResultDisposition } from "../../source-navigation/expression-use.js";

export const defaultSourceDeclarationOwnershipLimits: SourceDeclarationOwnershipLimits = Object.freeze({
  maximumSteps: 33_554_432,
  maximumTransportRows: 4_194_304,
});

export function sourceDeclarationOwnershipUnresolved(at: Node, reason: string): SourceDeclarationOwnershipUnresolved {
  return Object.freeze({ kind: "unresolved", at, reason, cause: Object.freeze({ kind: "required-fact" }) });
}

export function createSourceDeclarationParameterUseQuery(input: {
  readonly source: TargetSourceProgram;
  readonly budget: SourceDeclarationOwnershipBudget;
}) {
  const { source, budget } = input;
  type Contract = { readonly kind: "resolved"; readonly declaration: Node; readonly parameter: Node;
    readonly use: "result" | "retained"; readonly sites: readonly Node[];
    readonly contract: SourceDeclarationOwnershipContract };
  const declarations = new Map<Node, ReadonlyMap<Node, Contract>>();
  const publish = (declaration: Node): ReadonlyMap<Node, Contract> | SourceDeclarationOwnershipUnresolved => {
    if (!budget.step(declaration)) return budget.failure()!;
    const existing = declarations.get(declaration);
    if (existing !== undefined) return existing;
    const body = source.ast.body(declaration);
    if (body === undefined || !source.navigation.isProjectDeclaration(declaration))
      return sourceDeclarationOwnershipUnresolved(declaration, "A native parameter use requires its published declaration contract.");
    const selected = new Map<Node, Contract>();
    const rows = budget.createRows(declaration);
    let published = false;
    try {
      for (const parameter of source.ast.parameters(declaration)) {
        if (parameter === undefined) continue;
        if (!budget.step(parameter)) return budget.failure()!;
        const semantics = source.semantics.forNode(parameter);
        const selectedType = semantics.declarations.declaredValueType(parameter);
        if (selectedType === undefined) continue;
        const sites: Node[] = [];
        let use: "result" | "retained" | undefined;
        let complete = true;
        for (const reference of source.navigation.declarationUses(parameter)) {
          if (!budget.step(reference.reference)) return budget.failure()!;
          if (reference.kind === "type-only" || reference.kind === "source-linkage") continue;
          if (reference.captured || reference.throughMember) { complete = false; break; }
          const disposition = sourceExpressionResultDisposition(source.ast, reference.reference);
          if (disposition.kind !== "returned" && disposition.kind !== "stored") { complete = false; break; }
          sites.push(reference.reference);
          if (disposition.kind === "stored") use = "retained";
          else use ??= "result";
        }
        if (!complete || use === undefined) continue;
        if (!rows.add(3 + sites.length)) return budget.failure()!;
        selected.set(parameter, Object.freeze({ kind: "resolved", declaration, parameter, use,
          sites: Object.freeze(sites), contract: Object.freeze({ kind: "declaration", declaration: parameter,
            component: Object.freeze({ selectedType }) }) }));
      }
      if (!rows.add(1)) return budget.failure()!;
      declarations.set(declaration, selected);
      published = true;
      return selected;
    } finally { if (!published) rows.release(); }
  };
  return Object.freeze({
    forArgument(call: Node, argument: Node): Contract | SourceDeclarationOwnershipUnresolved {
      if (!budget.step(call)) return budget.failure()!;
      const file = source.ast.getSourceFile(call);
      if (file === undefined || !source.semantics.includes(file) || !source.ast.is.IsCallExpression(call))
        return sourceDeclarationOwnershipUnresolved(call, "Native parameter consumption requires its original checked direct call.");
      const semantics = source.semantics.forNode(call);
      const selected = semantics.operations.call(call);
      const declaration = selected?.sourceSelectedSignatureKind === "resolved"
        ? semantics.declarations.signatureDeclaration(selected.selectedSignature) : undefined;
      if (declaration === undefined || selected?.sourceSelectedSignatureKind !== "resolved")
        return sourceDeclarationOwnershipUnresolved(call, "Native parameter consumption requires its exact selected declaration.");
      const index = source.ast.arguments(call).indexOf(argument);
      const bindings = selected.sourceArgumentBindings.filter(binding => binding.sourceArgumentIndex === index && binding.sourceForm === "value");
      const parameter = bindings.length === 1 ? selected.sourceSelectedSignatureParameters.find(candidate =>
        candidate.parameterIndex === bindings[0]!.sourceParameterIndex)?.parameterDeclaration : undefined;
      if (index < 0 || parameter === undefined || !source.ast.parameters(declaration).includes(parameter))
        return sourceDeclarationOwnershipUnresolved(call, "Native parameter use requires one exact checked argument-to-formal correspondence.");
      const contracts = publish(declaration);
      if ("kind" in contracts) return contracts;
      return contracts.get(parameter) ?? sourceDeclarationOwnershipUnresolved(call,
        "The selected native parameter has no completed direct result or retained-input contract.");
    },
  });
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
