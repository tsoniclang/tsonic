import type { DataflowAccount, DataflowResult } from "../dataflow/contract.js";
import { chargeWork } from "../dataflow/index.js";
import type { Signature } from "../ir-types/contract.js";

export function acceptsProvided(signature: Signature, provided: number,
  account: DataflowAccount): DataflowResult<boolean | null> {
  let fixed = 0;
  let minimum = 0;
  let complete = true;
  for (let position = 0; position < signature.parameters.length; position += 1) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
    const parameter = signature.parameters[position];
    if (parameter === undefined) { complete = false; continue; }
    if (parameter.kind === "rest") continue;
    fixed += 1;
    if (!parameter.acceptsOmission) minimum = fixed;
  }
  return { kind: "complete", value: complete ? Number.isSafeInteger(provided)
    && !Object.is(provided, -0) && provided >= minimum && provided <= fixed : null };
}
