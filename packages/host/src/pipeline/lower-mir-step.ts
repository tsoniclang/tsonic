import type { UnitRef } from "../diag/contract.js";
import type { DefId, BodyId } from "../ids/contract.js";
import type { InferenceDeclaration } from "../ir-infer/contract.js";
import type { MirVerificationContext, MirVerificationLimits } from "../ir-mir/contract.js";
import type { TirBody } from "../ir-tir/contract.js";
import type { TypeInterner, TypeTable } from "../ir-types/contract.js";
import { readSignature, readType } from "../ir-types/index.js";
import type { LowerMirDefs, LowerMirDeps, LowerMirLimits } from "../lower-mir/contract.js";

// The inputs Pipeline gives LowerMir and the MIR verifier for one typed body (COMPONENTS §7 part 1, `lowerToMir`:
// "views: the run's type and signature tables. plain: the two canonical types for completion selectors and exception
// storage; the limit of part 7"; §12 part 1.5, the lowered-body barrier: "MIR (MIR verifier); only for a selected
// error-free instance"). Both records are built from the run's own data; nothing in them is computed here.

/** What the run holds that lowering and the verification of its graph read. */
export interface LowerMirRun {
  /** The run's type interner: lowering reads types and signatures through it. */
  readonly interner: TypeInterner;
  /**
   * The table the verifier checks references against: the table `exportTypes` publishes from this same interner at
   * the typed-body barrier, so that lowering (reading the interner) and verification (reading the table) see one set
   * of types. The step does not export it itself: the export has its own limits and refusal, which are the barrier's.
   * Pipeline's barrier driver supplies it; that call is not written yet (W4-2.md, the step's open items).
   */
  readonly table: TypeTable;
  readonly defs: LowerMirDefs;
  /** The size limit of one lowered graph (`LowerMirLimits`). Its place in `CompilerLimits` is NEEDS-W4 D2. */
  readonly lowering: LowerMirLimits;
  /** `CompilerLimits.mirVerification`. */
  readonly verification: MirVerificationLimits;
  readonly declarationOf: (definition: DefId) => InferenceDeclaration | null;
  readonly bodyOwner: (body: BodyId) => DefId | null;
}

/** The deps of `lowerToMir` for one query unit: the run's type and signature views, the canonical types and the size limit. */
export function lowerMirDeps(run: LowerMirRun, unit: UnitRef): LowerMirDeps {
  return { defs: run.defs, typeOf: type => readType(run.interner, type), signatureOf: signature => readSignature(run.interner, signature),
    limits: run.lowering, unit };
}

/** The context in which the graph of `body` is verified at the lowered-body barrier. */
export function mirVerificationContext(run: LowerMirRun, body: TirBody): MirVerificationContext {
  return { limits: run.verification, source: body, types: run.table, declarationOf: run.declarationOf, bodyOwner: run.bodyOwner };
}
