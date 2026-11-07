import type { Node } from "@tsonic/tsts";
import type { HostSourceProgram } from "@tsonic/target-api/host";
import type { TsonicHostRecords } from "../../analysis/host-records.js";
import type { TsonicMemoryLayoutFact } from "../../memory-layout/facts.js";
import { selectTsonicRawLocationOperation } from "../raw-memory/selection.js";
import { createTsonicPointerBackingQueries } from "./requirements.js";
import type { TsonicPointerBackingIssue, TsonicPointerBackingOrigin } from "./requirements.js";
import { sameBackingLayout } from "./layout-equality.js";

export interface TsonicPointerBackingDemand {
  readonly origin: TsonicPointerBackingOrigin;
  readonly layout: TsonicMemoryLayoutFact;
}

export interface TsonicPointerBackingDemands {
  record(node: Node): void;
  entries(): readonly TsonicPointerBackingDemand[];
  issues(): readonly TsonicPointerBackingIssue[];
}

/** `records` are the Host records of the same program view (host-records.ts). */
export function createTsonicPointerBackingDemands(
  source: HostSourceProgram,
  records: Pick<TsonicHostRecords, "reinterpret">,
): TsonicPointerBackingDemands {
  const demands = new Map<Node, TsonicPointerBackingDemand>();
  const issues: TsonicPointerBackingIssue[] = [];
  const recorded = new WeakSet<Node>();
  const queries = createTsonicPointerBackingQueries(source, records, {
    maximumValues: 131_072,
    hasClosedCallers(declaration) {
      return source.ast.is.IsFunctionDeclaration(declaration) &&
        !source.navigation.declarationUseSummary(declaration).exported;
    },
  });
  return Object.freeze({
    entries: () => Object.freeze([...demands.values()]),
    issues: () => Object.freeze([...issues]),
    record(node: Node) {
      if (!source.ast.is.IsCallExpression(node)) return;
      if (recorded.has(node)) return;
      recorded.add(node);
      const selected = selectTsonicRawLocationOperation(source.ast, source.sourceFacts, node);
      if (selected === undefined) return;
      if (selected.kind === "rejected") {
        issues.push(Object.freeze({ node, reason: selected.reason }));
        return;
      }
      if (selected.operation.operation !== "to-raw") return;
      const backing = queries.resolve(selected.expression);
      if (backing.kind === "unproven") {
        issues.push(...backing.issues);
        return;
      }
      for (const origin of backing.origins) {
        const previous = demands.get(origin.call);
        if (previous !== undefined && !sameBackingLayout(source.sourceFacts, previous.layout, selected.layout)) {
          issues.push(Object.freeze({ node, reason: "One pointer origin has incompatible physical layout demands." }));
        } else {
          demands.set(origin.call, Object.freeze({ origin, layout: selected.layout }));
        }
      }
    },
  });
}
