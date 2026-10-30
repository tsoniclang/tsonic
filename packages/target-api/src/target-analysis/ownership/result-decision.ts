import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/types.js";
import type { SourceDeclarationAsyncCompletionSelection, SourceDeclarationAsyncOwnershipSelection,
  SourceDeclarationAsyncResultDisposition, SourceDeclarationContinuationSelection, SourceDeclarationOwnershipBudget,
  SourceDeclarationOwnershipUnresolved, SourceDeclarationRetentionReadSelection,
  SourceDeclarationRetentionPremise } from "./model.js";
import { sourceDeclarationOwnershipContractProblem, sourceDeclarationOwnershipUnresolved } from "./contracts.js";

export function decideSourceDeclarationAsyncResultUse(input: {
  readonly source: TargetSourceProgram;
  readonly budget: SourceDeclarationOwnershipBudget;
  readonly call: Node;
  readonly completion: SourceDeclarationAsyncCompletionSelection;
  readonly disposition: SourceDeclarationAsyncResultDisposition | SourceDeclarationOwnershipUnresolved;
  readonly continuation: () => SourceDeclarationContinuationSelection;
  readonly retention: (reference: Node) => SourceDeclarationRetentionReadSelection;
}): SourceDeclarationAsyncOwnershipSelection {
  const { source, budget, call, completion, disposition } = input;
  if (!budget.step(call)) return budget.failure()!;
  const file = source.ast.getSourceFile(call);
  if (file === undefined || !source.semantics.includes(file) || !source.ast.is.IsCallExpression(call))
    return sourceDeclarationOwnershipUnresolved(call, "Async result-use requires its exact checked source call.");
  if (completion.kind !== "async") return completion;
  const selected = source.semantics.forNode(call).operations.call(call);
  if (selected?.sourceSelectedSignatureKind !== "resolved")
    return sourceDeclarationOwnershipUnresolved(call, "Async result-use requires the exact selected checked signature.");
  const declaration = source.semantics.forNode(call).declarations.signatureDeclaration(selected.selectedSignature);
  const problem = sourceDeclarationOwnershipContractProblem(source, call,
    { selectedType: selected.sourceResultType }, completion.contract);
  if (problem !== undefined) return sourceDeclarationOwnershipUnresolved(call, problem);
  if (disposition.kind === "unresolved") return disposition;
  if (completion.resultPolicy === "must-observe" && disposition.kind === "discarded" &&
    !source.ast.is.IsVoidExpression(disposition.use))
    return Object.freeze({ kind: "resolved", call, disposition, dependencies: Object.freeze([]), decision: "rejected",
      diagnostic: Object.freeze({ code: "TSONIC_NATIVE_ASYNC_RESULT_DISCARDED", at: call,
        message: "A native asynchronous call result must be observed, not discarded." }) });
  const continuation = input.continuation();
  const retention = input.retention(call);
  if (continuation.kind === "unresolved") return budget.failure() ?? continuation;
  if (retention.kind === "unresolved" || retention.premises.length === 0)
    return retention.kind === "unresolved" ? retention
      : sourceDeclarationOwnershipUnresolved(call, "The async result requires its nonempty completed native retention contract.");
  if (retention.reference !== call || retention.premises.some(premise => premise.value.node !== call))
    return sourceDeclarationOwnershipUnresolved(call,
      "Native async retention must describe this exact result-use call, not another source read.");
  for (const premise of retention.premises) {
    if (!budget.step(call)) return budget.failure()!;
    const problem = sourceDeclarationOwnershipContractProblem(source, call,
      { selectedType: selected.sourceResultType }, premise.contract);
    if (problem !== undefined) return sourceDeclarationOwnershipUnresolved(call, problem);
  }
  const dependencies = continuation.dependencies;
  const leases = [...dependencies.map(dependency => dependency.retention), ...retention.premises];
  for (const premise of leases) {
    if (!budget.step(call)) return budget.failure()!;
    let effective: readonly SourceDeclarationRetentionPremise[] = [premise];
    if (premise.kind === "formal-borrowed" && premise.value.node !== call &&
      (declaration === premise.executionOwner || declaration === premise.value.region.owner)) {
      let formal = premise.region.kind === "input-duration" ? premise.region.parameter
        : source.ast.is.IsParameterDeclaration(premise.value.node) ? premise.value.node
          : source.navigation.sourceReferenceFor(premise.value.node)?.declaration;
      if (declaration !== premise.executionOwner) {
        const node = premise.value.node;
        const semantics = source.semantics.forNode(node);
        const operation = source.ast.is.IsCallExpression(node) ? semantics.operations.call(node) : undefined;
        const native = operation?.sourceSelectedSignatureKind === "resolved"
          ? semantics.declarations.signatureDeclaration(operation.selectedSignature) : undefined;
        const parameter = operation?.sourceSelectedSignatureParameters.find(candidate => candidate.parameterDeclaration === formal);
        const bindings = native !== premise.executionOwner || parameter === undefined ? [] : operation!.sourceArgumentBindings.filter(binding =>
          binding.sourceParameterIndex === parameter.parameterIndex && binding.sourceForm === "value");
        const argument = bindings.length === 1 ? source.ast.arguments(node)[bindings[0]!.sourceArgumentIndex] : undefined;
        const reference = argument === undefined ? undefined : source.navigation.sourceReferenceFor(argument)?.declaration;
        if (reference === undefined || !source.ast.is.IsParameterDeclaration(reference) || source.ast.parent(reference) !== declaration)
          return sourceDeclarationOwnershipUnresolved(call,
            "A declaration-native pending input requires its original direct formal read, not an alias or caller history.");
        formal = reference;
      }
      const executionOwner = declaration;
      const parameter = selected.sourceSelectedSignatureParameters.find(candidate => candidate.parameterDeclaration === formal);
      const bindings = parameter === undefined ? [] : selected.sourceArgumentBindings.filter(binding =>
        binding.sourceParameterIndex === parameter.parameterIndex && binding.sourceForm === "value");
      const argument = bindings.length === 1 ? source.ast.arguments(call)[bindings[0]!.sourceArgumentIndex] : undefined;
      if (argument === undefined) return sourceDeclarationOwnershipUnresolved(call,
        "A native formal continuation requires its exact selected caller input.");
      const actual = input.retention(argument);
      if (actual.kind === "unresolved") return actual;
      if (actual.reference !== argument || actual.premises.length === 0)
        return sourceDeclarationOwnershipUnresolved(call, "Native formal retention must describe its exact actual input read.");
      for (const inputPremise of actual.premises) {
        if (!budget.step(call)) return budget.failure()!;
        if (inputPremise.value.node !== argument) return sourceDeclarationOwnershipUnresolved(call,
          "Native formal retention belongs to a different checked input value.");
        const problem = sourceDeclarationOwnershipContractProblem(source, argument,
          inputPremise.value.component, inputPremise.contract);
        if (problem !== undefined) return sourceDeclarationOwnershipUnresolved(call, problem);
        let matched = false;
        for (const output of retention.premises) {
          if (!budget.step(call)) return budget.failure()!;
          if (output.kind === "formal-borrowed" && output.executionOwner === executionOwner &&
            output.region.kind === "input-duration" && output.region.parameter === formal ||
            output.kind === "formal-borrowed" && output.executionOwner === executionOwner &&
              output.region.kind === "type-argument" && inputPremise.kind === "formal-borrowed" &&
              inputPremise.region.kind === "type-argument" && output.region.declaration === inputPremise.region.declaration &&
              source.semantics.forNode(call).types.isIdentical(output.region.binding.argumentType, inputPremise.region.binding.argumentType) ||
            output.kind === "scoped-borrowed" && inputPremise.kind === "scoped-borrowed" &&
              output.owner === inputPremise.owner && output.region === inputPremise.region && output.mode === inputPremise.mode ||
            output.kind === "retained" && inputPremise.kind === "retained") matched = true;
        }
        if (!matched) return sourceDeclarationOwnershipUnresolved(call,
          "A native continuation needs every completed input-to-result lifetime correspondence.");
      }
      effective = actual.premises;
    }
    for (const lease of effective) {
      if (!budget.step(call)) return budget.failure()!;
      if (lease.kind !== "scoped-borrowed" && lease.kind !== "formal-borrowed") continue;
      if (disposition.kind === "passed" || disposition.kind === "consumed")
        return sourceDeclarationOwnershipUnresolved(disposition.use,
          "A selected async consumer does not prove this caller's exact borrowed-input lifetime.");
      if (disposition.kind === "awaited-in-scope") {
        const owner = lease.kind === "scoped-borrowed" ? lease.region : lease.value.region.owner;
        let current: Node | undefined = disposition.use;
        const visited = new Set<Node>();
        while (current !== undefined && current !== owner) {
          if (!budget.step(call)) return budget.failure()!;
          if (visited.has(current))
            return sourceDeclarationOwnershipUnresolved(call, "An awaited lease has cyclic checked ancestry.");
          visited.add(current);
          current = source.ast.parent(current);
        }
        if (current === undefined || disposition.region.owner !== lease.value.region.owner)
          return sourceDeclarationOwnershipUnresolved(disposition.use,
            "The actual await must be inside the same checked region and native lease owner.");
      } else if (completion.resultPolicy === "observe-rejection" || completion.resultPolicy === "native-discard")
        return Object.freeze({ kind: "resolved", call, disposition, dependencies, decision: "rejected",
          diagnostic: Object.freeze({ code: "TSONIC_BORROWED_ASYNC_RESULT_ESCAPES", at: call,
            message: "An asynchronous result retaining a source-scoped lease across pending work cannot be discarded, stored or returned." }) });
    }
  }
  return Object.freeze({ kind: "resolved", call, disposition, dependencies,
    decision: disposition.kind !== "discarded" ? "admitted"
      : completion.resultPolicy === "observe-rejection" ? "observe-discarded-rejection" : "discard-native-result" });
}
