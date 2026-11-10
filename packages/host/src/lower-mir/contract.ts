import type { Computed } from "../diag/contract.js";
import type { TyId } from "../ids/contract.js";
import type { SignatureOf, TypeOf } from "../ir-types/contract.js";
import type { MirBody } from "../ir-mir/contract.js";
import type { TirBody } from "../ir-tir/contract.js";

export interface LowerMirDefs {
  readonly completionSelector: TyId;
  readonly exceptionStorage: TyId;
}

export interface LowerMirDeps {
  readonly defs: LowerMirDefs;
  readonly typeOf: TypeOf;
  readonly signatureOf: SignatureOf;
}

export type LowerToMir = (deps: LowerMirDeps, body: TirBody) => Computed<MirBody>;
