import type { Node } from "@tsonic/tsts";
import type { SourceInputSignature } from "../../host-input/identities.js";
import type { SourceSignatureIdentity, SourceTypeBinding, SourceTypeEvidence } from "../../public/source/contracts.js";
import type { SourceProductionResult } from "../../source-model/production.js";
import type { SourceDescriptorBuilder, SourceSignatureOmissionProduction, SourceSignatureParameterProduction } from "../descriptor-contracts.js";
import { Node_Initializer } from "../../source-navigation/ast.js";
import type { SourceSemanticProduction } from "./production-context.js";
import { sourceTypeExpansionBudget } from "../type-expansion-budget.js";
import { failTargetCompilerResourceLimit } from "../../artifacts.js";

export function createSourceOmissionAllowance(builder: SourceDescriptorBuilder, root: Node):
  (value: SourceTypeEvidence, rest: boolean) => SourceProductionResult<boolean> {
  const active = new WeakMap<SourceTypeEvidence, Set<boolean>>();
  const completed = new WeakMap<SourceTypeEvidence, Map<boolean, boolean>>();
  let depth = 0;
  let work = 0;
  function allowsAbsence(value: SourceTypeEvidence, rest: boolean): SourceProductionResult<boolean> {
    builder.assertEvidence(value);
    const previous = completed.get(value)?.get(rest);
    if (previous !== undefined) return { kind: "resolved", value: previous };
    if (active.get(value)?.has(rest)) return { kind: "pending", dependencies: [value.component] };
    if (depth >= sourceTypeExpansionBudget.depth) failTargetCompilerResourceLimit("tsonic", "Source type expansion", "depth", sourceTypeExpansionBudget.depth, root);
    if (++work > sourceTypeExpansionBudget.types) failTargetCompilerResourceLimit("tsonic", "Source type expansion", "types", sourceTypeExpansionBudget.types, root);
    let path = active.get(value);
    if (path === undefined) { path = new Set(); active.set(value, path); }
    path.add(rest);
    depth++;
    try {
      const result = produce(value, rest);
      if (result.kind === "resolved") {
        let entries = completed.get(value);
        if (entries === undefined) { entries = new Map(); completed.set(value, entries); }
        entries.set(rest, result.value);
      }
      return result;
    } finally { depth--; path.delete(rest); }
  }
  function produce(value: SourceTypeEvidence, rest: boolean): SourceProductionResult<boolean> {
    if (value.sum !== undefined) {
      let allowed = false;
      for (const role of value.sum.roles) {
        const selected = allowsAbsence(role.value, rest);
        if (selected.kind !== "resolved") return selected;
        allowed ||= selected.value;
      }
      return { kind: "resolved", value: allowed };
    }
    const defined = builder.produceDefinition(value);
    if (defined.kind !== "resolved") return defined;
    if (defined.value !== value) return allowsAbsence(defined.value, rest);
    const type = value.type;
    if (!rest) return { kind: "resolved", value: type.kind === "intrinsic" && type.intrinsic === "void" };
    if (type.kind === "array") return { kind: "resolved", value: true };
    if (type.kind !== "tuple") return { kind: "resolved", value: false };
    for (const [index, element] of type.elements.entries()) {
      if (element.kind === "optional") continue;
      const child = builder.component(value, { kind: "tuple-element", index });
      if (child.kind !== "resolved") return child;
      const selected = allowsAbsence(child.value, element.kind === "rest");
      if (selected.kind !== "resolved" || !selected.value) return selected;
    }
    return { kind: "resolved", value: true };
  }
  return allowsAbsence;
}

export function produceSourceSignatureOmissions(context: Pick<SourceSemanticProduction, "ast" | "input" | "builder">,
  signature: SourceSignatureIdentity, parameters: readonly SourceSignatureParameterProduction[],
  bindings: readonly SourceTypeBinding[]): ReturnType<SourceSignatureOmissionProduction["signatureOmissions"]> {
  const { ast, input, builder } = context;
  const original = builder.originalSignature(signature);
  const shape = input.describeSignature(original);
  if (shape.parameters.length !== parameters.length)
    throw new Error("Signature omission requires the complete original ordered formal vector.");
  const seen = new Set<Node>();
  for (const binding of bindings) {
    input.assertNode(binding.declaration);
    builder.typeParameter(binding.declaration);
    builder.assertEvidence(binding.value);
    if (seen.has(binding.declaration)) throw new Error("Signature omission requires one value per original binder.");
    seen.add(binding.declaration);
  }
  if (parameters.length === 0) return { kind: "resolved", value: Object.freeze([]) };
  const allowsAbsence = createSourceOmissionAllowance(builder, original.declaration ?? original.owner ?? parameters[0]!.value.component.root);
  function originalDeclaration(index: number): Node | undefined {
    let current: SourceInputSignature | undefined = original;
    const visited = new Set<SourceInputSignature>();
    while (current !== undefined) {
      if (visited.has(current)) throw new Error("An original formal target relation cannot cycle.");
      visited.add(current);
      const facts = input.describeSignature(current);
      const declaration = facts.parameters[index]?.declaration;
      if (declaration !== undefined) return declaration;
      current = facts.target;
    }
    return undefined;
  }
  const result: Extract<ReturnType<SourceSignatureOmissionProduction["signatureOmissions"]>, { readonly kind: "resolved" }>["value"][number][] = [];
  let requiredAfter = false;
  for (let index = parameters.length - 1; index >= 0; index--) {
    const parameter = parameters[index]!;
    builder.assertEvidence(parameter.value);
    const declaration = originalDeclaration(index);
    if (declaration !== parameter.declaration)
      throw new Error("Signature omission requires each exact original formal declaration and ordinal.");
    if (declaration !== undefined) input.assertNode(declaration);
    const syntax = declaration === undefined ? undefined : ast.as.AsParameterDeclaration(declaration);
    const initializer = declaration === undefined ? undefined : Node_Initializer(ast, declaration);
    const rest = syntax?.DotDotDotToken !== undefined || parameter.kind === "rest";
    const optional = syntax === undefined ? parameter.kind === "optional" : syntax.QuestionToken !== undefined;
    const applied = builder.substitute(parameter.value, bindings);
    if (applied.kind !== "resolved") return applied;
    const absent = allowsAbsence(applied.value, rest);
    if (absent.kind !== "resolved") return absent;
    const acceptsOmission = rest ? absent.value : optional || !requiredAfter && (initializer !== undefined || absent.value);
    const kind = rest ? "rest" : optional || initializer !== undefined && !requiredAfter ? "optional" : "required";
    result.push(Object.freeze({ kind, omission: Object.freeze({ acceptsOmission,
      initializer: initializer === undefined ? Object.freeze({ kind: "none" as const })
        : Object.freeze({ kind: "present" as const, value: initializer }) }) }));
    requiredAfter ||= !acceptsOmission;
  }
  return { kind: "resolved", value: Object.freeze(result.reverse()) };
}
