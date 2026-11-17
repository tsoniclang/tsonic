import type { DataflowAccount, DataflowResult } from "../dataflow/contract.js";
import { accountFailure, chargeResultEntries, chargeWork } from "../dataflow/index.js";
import type { Summary } from "./contract.js";
import { projectSummary } from "./print.js";

export function summaryEquals(left: Summary, right: Summary, account: DataflowAccount): DataflowResult<boolean> {
  const prior = accountFailure(account);
  if (prior !== null) return prior;
  const setup = chargeWork(account, 1) ?? chargeResultEntries(account, 2);
  if (setup !== null) return setup;
  const first = projectSummary(left);
  const second = projectSummary(right);
  for (;;) {
    const firstStop = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
    if (firstStop !== null) return firstStop;
    const selected = first.next();
    const secondStop = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
    if (secondStop !== null) return secondStop;
    const compared = second.next();
    if (selected.done || compared.done) return { kind: "complete", value: selected.done === compared.done };
    const work = chargeWork(account, 1 + (typeof selected.value === "string" ? selected.value.length : 0)
      + (typeof compared.value === "string" ? compared.value.length : 0));
    if (work !== null) return work;
    if (!Object.is(selected.value, compared.value)) return { kind: "complete", value: false };
  }
}
