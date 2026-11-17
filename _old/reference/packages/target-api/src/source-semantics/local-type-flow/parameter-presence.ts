import type { SourceInputComponent } from "../../host-input/identities.js";
import type { SourceTypeComponent, SourceTypeEvidence } from "../../public/source/contracts.js";
import type { SourceProductionResult } from "../../source-model/production.js";
import type { SourceDescriptorBuilder } from "../descriptor-contracts.js";

export function produceSourceParameterPresence(builder: SourceDescriptorBuilder, component: SourceInputComponent,
  identity: SourceTypeComponent, value: SourceTypeEvidence, optional: boolean): SourceProductionResult<SourceTypeEvidence> {
  builder.assertEvidence(value);
  if (!optional) return { kind: "resolved", value };
  if (value.type.kind === "optional" || value.sum?.arms.some(arm => arm.type.kind === "intrinsic" &&
    (arm.type.intrinsic === "absence" || arm.type.intrinsic === "void")) || value.type.kind === "intrinsic" &&
    (value.type.intrinsic === "absence" || value.type.intrinsic === "void")) return builder.join(identity, "authored", [value], component);
  const absence = builder.evidence({ type: builder.intrinsic("absence"), component: identity,
    category: { kind: "known", category: "absence" }, numeric: undefined, sum: undefined }, [], undefined,
  { kind: "finite", values: [{ kind: "absence" }] },
  { members: { kind: "unavailable" }, origins: builder.sourceOriginSubjects(value) });
  return builder.join(identity, "authored", [value, absence], component);
}
