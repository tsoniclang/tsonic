import type { Node } from "@tsonic/tsts";
import type { SourceTypeEvidence } from "../public/source/contracts.js";
import type { SourceProductionResult } from "./descriptor-contracts.js";
import { selectSourceValueGuard, type SourceValueGuard } from "./native-value-guards.js";
import { selectSourceGuardedEvidenceMembers } from "./value-flow-conditions.js";
import type { SourceGuardContext } from "./value-flow-model.js";

export function createSourceValueGuardQueries(context: SourceGuardContext) {
  const select = (expression: Node) => selectSourceValueGuard(context, expression);
  return Object.freeze({ select,
    members(reference: Node, value: SourceTypeEvidence,
      test: (member: SourceTypeEvidence, guard: SourceValueGuard) => SourceProductionResult<boolean | undefined>):
      SourceProductionResult<readonly SourceTypeEvidence[] | undefined> {
      context.view.assertEvidence(value);
      return selectSourceGuardedEvidenceMembers(context, reference, value, expression => {
        const selected = select(expression);
        return selected.kind !== "resolved" ? selected : Object.freeze({ kind: "resolved", value: selected.value === undefined
          ? undefined : Object.freeze({ sourceOperand: selected.value.sourceOperand, predicate: selected.value }) });
      }, test);
    },
  });
}
