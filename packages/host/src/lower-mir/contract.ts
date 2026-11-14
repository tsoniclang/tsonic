import type { Result } from "../diag/contract.js";
import type { LocalRef, SigId, TyId } from "../ids/contract.js";
import type { BodyInstance, SignatureOf, TypeOf } from "../ir-types/contract.js";
import type { MirBody } from "../ir-mir/contract.js";
import type { TirBody } from "../ir-tir/contract.js";

export interface LowerMirDefs {
  readonly completionSelector: TyId;
  readonly exceptionStorage: TyId;
}

// The size of one lowered body. One record is one local, one place, one constant, one statement or one block with
// its terminator. Lowering charges a record before it allocates it and refuses when the count would pass the maximum.
export interface LowerMirLimits {
  readonly maximumRecords: number;
}

export interface LowerMirDeps {
  readonly defs: LowerMirDefs;
  readonly typeOf: TypeOf;
  readonly signatureOf: SignatureOf;
  readonly limits: LowerMirLimits;
}

export interface InternalBodyInput {
  readonly instance: BodyInstance;
  readonly captures: readonly LocalRef[];
  readonly signature: SigId;
}

export type LowerToMir = (
  deps: LowerMirDeps,
  body: TirBody,
  internal: readonly InternalBodyInput[],
) => Result<MirBody>;
