import type { SourceTypeComponent, SourceTypeEvidence } from "../../public/source/contracts.js";
import type { SourceProductionResult } from "../descriptor-contracts.js";
import { sourceOpenLiteralDomain } from "../../source-model/literals/domain.js";
import { sourceKeyDomainContains } from "./key-domains.js";
import { sourceProductionValues, sourceSemanticRefusal, type SourceSemanticProduction } from "./semantic-production.js";
import { sourceKeyEvidence } from "./type-keys.js";

export function produceSourceAwaitedType(context: SourceSemanticProduction, source: SourceTypeEvidence): SourceProductionResult<SourceTypeEvidence> {
  const active = new Set<SourceTypeEvidence>();
  const completed = new Map<SourceTypeEvidence, SourceProductionResult<SourceTypeEvidence>>();
  const { builder } = context;

  function join(component: SourceTypeComponent, values: readonly SourceTypeEvidence[]): SourceProductionResult<SourceTypeEvidence> {
    return builder.join(component, "inferred", values, undefined);
  }

  function present(value: SourceTypeEvidence): SourceProductionResult<readonly SourceTypeEvidence[]> {
    if (value.sum !== undefined) return { kind: "resolved", value: value.sum.arms.filter(arm =>
      !(arm.type.kind === "intrinsic" && (arm.type.intrinsic === "absence" || arm.type.intrinsic === "void"))) };
    if (value.type.kind === "optional") {
      const payload = builder.component(value, { kind: "optional-value" });
      return payload.kind === "refused" ? payload : present(payload.value);
    }
    return { kind: "resolved", value: value.type.kind === "intrinsic" &&
      (value.type.intrinsic === "absence" || value.type.intrinsic === "void") ? [] : [value] };
  }

  function callableParameters(value: SourceTypeEvidence): SourceProductionResult<readonly SourceTypeEvidence[]> {
    const arms = present(value);
    if (arms.kind !== "resolved") return arms;
    const values: SourceProductionResult<SourceTypeEvidence>[] = [];
    for (const arm of arms.value) {
      const definition = builder.produceDefinition(arm);
      if (definition.kind !== "resolved") return definition;
      const type = definition.value.type;
      if (type.kind === "intrinsic" && type.intrinsic === "never") continue;
      if (type.kind !== "callable" && type.kind !== "shape" || type.calls.length === 0) {
        return sourceSemanticRefusal(source.component.root, "An awaited thenable requires its original callable fulfillment parameter.");
      }
      for (const signature of type.calls) {
        if (signature.parameters.length === 0) {
          return sourceSemanticRefusal(source.component.root, "An awaited fulfillment callback requires its original first value parameter.");
        }
        values.push(builder.component(definition.value, { kind: "parameter", signature: signature.identity, index: 0 }));
      }
    }
    return sourceProductionValues(values);
  }

  function produce(value: SourceTypeEvidence): SourceProductionResult<SourceTypeEvidence> {
    builder.assertEvidence(value);
    const previous = completed.get(value);
    if (previous !== undefined) return previous;
    if (active.has(value)) return sourceSemanticRefusal(value.component.root,
      "This awaited completion depends on its own original thenable payload.", "TSONIC_LOCAL_TYPE_SELF_REFERENCE");
    active.add(value);
    let result: SourceProductionResult<SourceTypeEvidence>;
    try {
      if (value.type.kind === "parameter" || value.type.kind === "projection") {
        const component = builder.componentIdentity(value.component.root, [...value.component.path, { kind: "awaited" }]);
        const type = builder.projection(value.type, { kind: "awaited" });
        result = { kind: "resolved", value: builder.evidence({ type, component,
          category: { kind: "dynamic" }, numeric: undefined, sum: undefined },
        [{ selector: { kind: "projection-source" }, value }], undefined, sourceOpenLiteralDomain,
        { members: { kind: "definition" }, origins: builder.sourceOriginSubjects(value) }) };
      } else if (value.sum !== undefined) {
        const arms = sourceProductionValues(value.sum.arms.map(produce));
        result = arms.kind === "resolved" ? join(builder.componentIdentity(value.component.root,
          [...value.component.path, { kind: "awaited" }]), arms.value) : arms;
      } else if (value.type.kind === "optional") {
        const child = builder.component(value, { kind: "optional-value" });
        if (child.kind === "refused") result = child;
        else {
          const payload = produce(child.value);
          if (payload.kind !== "resolved") result = payload;
          else {
            const absence = builder.evidence({ type: builder.intrinsic("absence"), component: value.component,
              category: { kind: "known", category: "absence" }, numeric: undefined, sum: undefined }, [], undefined,
            { kind: "finite", values: [{ kind: "absence" }] },
            { members: { kind: "unavailable" }, origins: builder.sourceOriginSubjects(value) });
            result = join(builder.componentIdentity(value.component.root, [...value.component.path, { kind: "awaited" }]), [payload.value, absence]);
          }
        }
      } else {
        const definition = builder.produceDefinition(value);
        if (definition.kind !== "resolved") result = definition;
        else if (definition.value.type.kind !== "shape") result = { kind: "resolved", value };
        else {
          const key = sourceKeyEvidence(context, value.component.root, { kind: "string", value: "then" });
          const selected = context.objects.indexed(definition.value, key,
            (destination, source) => sourceKeyDomainContains(builder, destination, source));
          if (selected.kind !== "resolved") result = selected;
          else if (selected.value.kind === "unavailable") result = selected.value.reason === "missing-member"
            ? { kind: "resolved", value } : sourceSemanticRefusal(value.component.root,
              "An awaited thenable requires its complete original readable fulfillment member.");
          else if (selected.value.members.length === 0 || selected.value.members.some(member => member.optional)) {
            result = { kind: "resolved", value };
          } else {
            const payloads: SourceProductionResult<SourceTypeEvidence>[] = [];
            for (const member of selected.value.members) {
              const then = member.readType();
              if (then.kind !== "resolved") { payloads.push(then); continue; }
              if (then.value.kind === "none") {
                payloads.push(sourceSemanticRefusal(value.component.root,
                  "An awaited thenable requires its original readable fulfillment component."));
                continue;
              }
              const arms = present(then.value.value);
              if (arms.kind !== "resolved") { payloads.push(arms); continue; }
              if (arms.value.length === 0) payloads.push({ kind: "resolved", value });
              for (const arm of arms.value) {
                const callable = builder.produceDefinition(arm);
                if (callable.kind !== "resolved") { payloads.push(callable); continue; }
                const type = callable.value.type;
                if (type.kind !== "shape" && type.kind !== "callable" || type.calls.length === 0) {
                  payloads.push({ kind: "resolved", value });
                  continue;
                }
                for (const signature of type.calls) {
                  if (signature.parameters.length === 0) {
                    payloads.push(sourceSemanticRefusal(value.component.root, "An awaited thenable requires its original fulfillment argument."));
                    continue;
                  }
                  const callback = builder.component(callable.value, { kind: "parameter", signature: signature.identity, index: 0 });
                  if (callback.kind === "refused") { payloads.push(callback); continue; }
                  const parameters = callableParameters(callback.value);
                  if (parameters.kind !== "resolved") { payloads.push(parameters); continue; }
                  for (const parameter of parameters.value) payloads.push(produce(parameter));
                }
              }
            }
            const payload = sourceProductionValues(payloads);
            result = payload.kind !== "resolved" ? payload : join(builder.componentIdentity(value.component.root,
              [...value.component.path, { kind: "awaited" }]), payload.value);
          }
        }
      }
    } finally { active.delete(value); }
    if (result.kind !== "pending") completed.set(value, result);
    return result;
  }

  return produce(source);
}
