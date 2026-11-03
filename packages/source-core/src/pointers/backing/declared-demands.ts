import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "@tsonic/target-api/source";
import type { TsonicMemoryLayoutFact } from "../../memory-layout/facts.js";
import { selectTsonicRawLocationOperation } from "../raw-memory/selection.js";
import { createTsonicPointerBackingQueries } from "./requirements.js";
import type { TsonicPointerBackingIssue, TsonicPointerBackingOrigin } from "./requirements.js";

export interface TsonicDeclaredPointerBackingUse {
  readonly call: Node;
  readonly origins: readonly TsonicPointerBackingOrigin[];
  readonly layout: TsonicMemoryLayoutFact;
}

export interface TsonicDeclaredPointerBackingDemands {
  record(node: Node): void;
  uses(): readonly TsonicDeclaredPointerBackingUse[];
  issues(): readonly TsonicPointerBackingIssue[];
}

export function createTsonicDeclaredPointerBackingDemands(source: TargetSourceProgram): TsonicDeclaredPointerBackingDemands {
  const uses: TsonicDeclaredPointerBackingUse[] = [];
  const issues: TsonicPointerBackingIssue[] = [];
  const recorded = new WeakSet<Node>();
  const identities = createTsonicPointerBackingQueries(source, {
    maximumValues: 131_072,
    hasClosedCallers(declaration) {
      return source.ast.is.IsFunctionDeclaration(declaration) &&
        !source.navigation.declarationUseSummary(declaration).exported;
    },
  });
  return Object.freeze({
    uses: () => Object.freeze([...uses]),
    issues: () => Object.freeze([...issues]),
    record(node: Node): void {
      if (!source.ast.is.IsCallExpression(node) || recorded.has(node)) return;
      recorded.add(node);
      const selected = selectTsonicRawLocationOperation(source.ast, source.sourceFacts, node);
      if (selected === undefined) return;
      if (selected.kind === "rejected") {
        issues.push(Object.freeze({ node, reason: selected.reason }));
        return;
      }
      if (selected.operation.operation !== "to-raw") return;
      const backing = identities.resolve(selected.expression);
      if (backing.kind === "unproven") {
        issues.push(...backing.issues);
        return;
      }
      uses.push(Object.freeze({ call: node, origins: backing.origins, layout: selected.layout }));
    },
  });
}
