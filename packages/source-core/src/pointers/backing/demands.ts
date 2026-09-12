import type { Node, ReadonlySourceFactResolver } from "@tsonic/tsts";
import type { TargetSourceProgram } from "@tsonic/target-api/source";
import type { TsonicMemoryLayoutFact } from "../../memory-layout/facts.js";
import { dataLayoutsEqual } from "../../memory-layout/facts.js";
import { readMemoryTypeMember, readTsonicMemoryType } from "../../memory-layout/type-contract/facts.js";
import { selectTsonicRawLocationOperation } from "../raw-memory/selection.js";
import { createTsonicPointerBackingQueries } from "./requirements.js";
import type { TsonicPointerBackingIssue, TsonicPointerBackingOrigin } from "./requirements.js";

export interface TsonicPointerBackingDemand {
  readonly origin: TsonicPointerBackingOrigin;
  readonly layout: TsonicMemoryLayoutFact;
}

export interface TsonicPointerBackingDemands {
  record(node: Node): void;
  entries(): readonly TsonicPointerBackingDemand[];
  issues(): readonly TsonicPointerBackingIssue[];
}

export function createTsonicPointerBackingDemands(source: TargetSourceProgram): TsonicPointerBackingDemands {
  const demands = new Map<Node, TsonicPointerBackingDemand>();
  const issues: TsonicPointerBackingIssue[] = [];
  const recorded = new WeakSet<Node>();
  const queries = createTsonicPointerBackingQueries(source, {
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

function sameBackingLayout(facts: ReadonlySourceFactResolver, left: TsonicMemoryLayoutFact, right: TsonicMemoryLayoutFact): boolean {
  const pending: [TsonicMemoryLayoutFact, TsonicMemoryLayoutFact][] = [[left, right]];
  const compared = new Map<TsonicMemoryLayoutFact, Set<TsonicMemoryLayoutFact>>();
  while (pending.length !== 0) {
    const [current, other] = pending.pop()!;
    if (current === other || compared.get(current)?.has(other)) continue;
    const currentType = readTsonicMemoryType(facts, current.call);
    const otherType = readTsonicMemoryType(facts, other.call);
    if (current.kind !== other.kind || currentType === undefined || otherType === undefined || currentType.identity !== otherType.identity ||
        !dataLayoutsEqual(current.dataLayout, other.dataLayout) ||
        current.byteSize !== other.byteSize || current.byteAlignment !== other.byteAlignment ||
        current.stride !== other.stride) return false;
    const peers = compared.get(current) ?? new Set<TsonicMemoryLayoutFact>();
    peers.add(other);
    compared.set(current, peers);
    if (current.kind === "array") {
      if (other.kind !== "array" || current.fixedArray.length !== other.fixedArray.length ||
          current.fixedArray.lengthRuntimeBase !== other.fixedArray.lengthRuntimeBase) return false;
      pending.push([current.elementLayout, other.elementLayout]);
    } else {
      if (other.kind !== "value" || current.fields.length !== other.fields.length) return false;
      const counterparts = new Map(other.fields.map(field =>
        [readMemoryTypeMember(facts, field.call, field.selectedDeclaration)?.member, field]));
      if (counterparts.has(undefined) || counterparts.size !== other.fields.length) return false;
      for (const field of current.fields) {
        const member = readMemoryTypeMember(facts, field.call, field.selectedDeclaration);
        const counterpart = member === undefined ? undefined : counterparts.get(member.member);
        if (member?.owner !== currentType.identity || counterpart === undefined ||
            readMemoryTypeMember(facts, counterpart.call, counterpart.selectedDeclaration)?.owner !== otherType.identity ||
            field.byteOffset !== counterpart.byteOffset || field.byteAlignment !== counterpart.byteAlignment) return false;
        pending.push([field.fieldLayout, counterpart.fieldLayout]);
      }
    }
  }
  return true;
}
