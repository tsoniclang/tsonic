import type { UnitRef, UnitValue } from "../diag/contract.js";
import type { NodeRef, TyId } from "../ids/contract.js";
import type { MirBody, MirSite } from "../ir-mir/contract.js";
import type { BodyInstance, ConstantReference, ConstValue } from "../ir-types/contract.js";

export type EvaluationResult =
  | { readonly kind: "value"; readonly value: ConstValue }
  | { readonly kind: "not-constant"; readonly at: NodeRef;
      readonly reason: "external-operation" | "external-storage" | "suspension" };

export type EvaluateRequest =
  | { readonly kind: "mir-body"; readonly instance: BodyInstance }
  | { readonly kind: "const-value"; readonly reference: ConstantReference }
  | { readonly kind: "observation-value"; readonly instance: BodyInstance; readonly at: NodeRef };

export type EvaluateAnswer =
  | { readonly kind: "mir-body"; readonly body: MirBody }
  | { readonly kind: "const-value"; readonly unit: UnitRef; readonly value: UnitValue<EvaluationResult> }
  | { readonly kind: "observation-value"; readonly unit: UnitRef; readonly value: UnitValue<ObservationValue> };

export type ObservationValue = { readonly kind: "value"; readonly value: bigint } | { readonly kind: "error" };

export interface EvaluationWitness {
  readonly instance: BodyInstance;
  readonly site: MirSite;
  readonly request: EvaluateRequest;
  readonly type: TyId | null;
  /** Only indices below count are available. That prefix is never changed, including after resume. */
  readonly ready: { readonly values: readonly ConstValue[]; readonly count: number };
}
