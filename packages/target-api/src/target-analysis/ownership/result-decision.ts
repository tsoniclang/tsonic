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
  const nativeRetention = (reference: Node): SourceDeclarationRetentionReadSelection => {
    const actual = input.retention(reference);
    if (actual.kind === "unresolved") return actual;
    if (actual.reference !== reference || actual.premises.length === 0)
      return sourceDeclarationOwnershipUnresolved(reference,
        "Native continuation retention must describe its exact nonempty checked input or capture read.");
    for (const premise of actual.premises) {
      if (!budget.step(reference)) return budget.failure()!;
      if (premise.value.node !== reference)
        return sourceDeclarationOwnershipUnresolved(reference,
          "Native continuation retention belongs to a different checked input or capture value.");
      const problem = sourceDeclarationOwnershipContractProblem(source, reference,
        premise.value.component, premise.contract);
      if (problem !== undefined) return sourceDeclarationOwnershipUnresolved(reference, problem);
    }
    return actual;
  };
  const callerRetention = (reference: Node): SourceDeclarationRetentionReadSelection => {
    const formal = source.ast.is.IsParameterDeclaration(reference) ? reference
      : source.navigation.sourceReferenceFor(reference)?.declaration;
    if (formal === undefined || !source.ast.is.IsParameterDeclaration(formal))
      return nativeRetention(reference);
    const owner = source.ast.parent(formal);
    if (owner === declaration) {
      const parameter = selected.sourceSelectedSignatureParameters.find(candidate => candidate.parameterDeclaration === formal);
      const bindings = parameter === undefined ? [] : selected.sourceArgumentBindings.filter(binding =>
        binding.sourceParameterIndex === parameter.parameterIndex && binding.sourceForm === "value");
      const argument = bindings.length === 1 ? source.ast.arguments(call)[bindings[0]!.sourceArgumentIndex] : undefined;
      return argument === undefined ? sourceDeclarationOwnershipUnresolved(call,
        "A native formal continuation requires its exact selected caller input.") : nativeRetention(argument);
    }
    let current = declaration;
    const visited = new Set<Node>();
    while (current !== undefined && current !== owner) {
      if (!budget.step(reference)) return budget.failure()!;
      if (visited.has(current)) return sourceDeclarationOwnershipUnresolved(reference,
        "A native capture requires acyclic checked declaration ancestry.");
      visited.add(current);
      current = source.ast.parent(current);
    }
    return current === undefined || owner === undefined ? sourceDeclarationOwnershipUnresolved(reference,
      "A native continuation requires its exact selected formal or lexical capture owner.")
      : nativeRetention(selected.sourceCallee.expression);
  };
  const leases = [...dependencies.map(dependency => dependency.retention), ...retention.premises];
  for (const premise of leases) {
    if (!budget.step(call)) return budget.failure()!;
    let effective: readonly SourceDeclarationRetentionPremise[] = [premise];
    if (premise.kind === "formal-borrowed" && premise.value.node !== call &&
      (declaration === premise.executionOwner || declaration === premise.value.region.owner)) {
      const node = premise.value.node;
      const semantics = source.semantics.forNode(node);
      const operation = source.ast.is.IsCallExpression(node) ? semantics.operations.call(node) : undefined;
      const native = operation?.sourceSelectedSignatureKind === "resolved"
        ? semantics.declarations.signatureDeclaration(operation.selectedSignature) : undefined;
      let reference = node;
      const region = premise.region;
      if (native === premise.executionOwner && region.kind === "input-duration") {
        const parameter = operation!.sourceSelectedSignatureParameters.find(candidate =>
          candidate.parameterDeclaration === region.parameter);
        const bindings = parameter === undefined ? [] : operation!.sourceArgumentBindings.filter(binding =>
          binding.sourceParameterIndex === parameter.parameterIndex && binding.sourceForm === "value");
        const argument = bindings.length === 1 ? source.ast.arguments(node)[bindings[0]!.sourceArgumentIndex] : undefined;
        if (argument === undefined) return sourceDeclarationOwnershipUnresolved(node,
          "A pending native result requires its exact completed input-duration relation.");
        reference = argument;
      }
      const actual = callerRetention(reference);
      if (actual.kind === "unresolved") return actual;
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
      } else
        return Object.freeze({ kind: "resolved", call, disposition, dependencies, decision: "rejected",
          diagnostic: Object.freeze({ code: "TSONIC_BORROWED_ASYNC_RESULT_ESCAPES", at: call,
            message: "An asynchronous result retaining a source-scoped lease across pending work cannot be discarded, stored or returned." }) });
    }
  }
  return Object.freeze({ kind: "resolved", call, disposition, dependencies,
    decision: disposition.kind !== "discarded" ? "admitted"
      : completion.resultPolicy === "observe-rejection" ? "observe-discarded-rejection" : "discard-native-result" });
}
