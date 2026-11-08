import type { Node } from "@tsonic/tsts";
import type { SourcePresence } from "../../public/source/contracts.js";
import type { SourceProductionResult } from "../../source-semantics/descriptor-contracts.js";
import { createSourceIntegerRangeQueries } from "./analysis.js";
import type { SourceIntegerRangeOptions } from "./analysis.js";
import { sourceIntegerIsNonnegative } from "./guards.js";
import { sourceIntegerInduction } from "./induction.js";
import type { SourceIntegerInductionContext } from "./induction.js";

export type SourceIntegerContext = SourceIntegerRangeOptions & SourceIntegerInductionContext;

export function createSourceIntegerFacts(context: SourceIntegerContext) {
  const ranges = createSourceIntegerRangeQueries(context);
  const cached = <Value>(query: (node: Node) => SourceProductionResult<Value>) => {
    const completed = new WeakMap<Node, SourceProductionResult<Value>>();
    return (node: Node): SourceProductionResult<Value> => {
      if (!context.navigation.includes(node)) throw new Error("Integer facts require the exact original node from this Source program.");
      const previous = completed.get(node);
      if (previous !== undefined) return previous;
      const result = query(node);
      if (result.kind !== "pending") completed.set(node, result);
      return result;
    };
  };
  const presence = <Value>(result: SourceProductionResult<Value | undefined>): SourceProductionResult<SourcePresence<Value>> =>
    result.kind !== "resolved" ? result : Object.freeze({ kind: "resolved", value: result.value === undefined
      ? Object.freeze({ kind: "none" }) : Object.freeze({ kind: "present", value: result.value }) });
  const numeric = <Value>(node: Node, query: () => SourceProductionResult<Value>, absent: Value): SourceProductionResult<Value> => {
    const selected = context.value(node);
    if (selected.kind !== "resolved") return selected;
    context.view.assertEvidence(selected.value);
    const category = selected.value.category;
    return category.kind === "known" && (category.category === "number" || category.category === "bigint")
      ? query() : Object.freeze({ kind: "resolved", value: absent });
  };
  return Object.freeze({
    range: cached(node => presence(numeric(node, () => ranges.range(node), undefined))),
    nonnegative: cached(node => numeric(node, () => sourceIntegerIsNonnegative(context, node), false)),
    induction: cached(node => presence(sourceIntegerInduction(context, node))),
  });
}
