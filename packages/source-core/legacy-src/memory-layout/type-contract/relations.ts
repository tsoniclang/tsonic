import type { Node, Symbol, Type, TypePropertyInfo } from "@tsonic/tsts";
import type { TsonicSourceFileAnalysisContext } from "../../analysis/context.js";
import type { MemoryTypeDomain } from "./domains.js";

export interface MemoryRecordMember {
  readonly property: TypePropertyInfo;
  readonly declarations: readonly Node[];
  readonly domain: MemoryTypeDomain;
}

export interface MemoryRecordShape {
  readonly type: Type;
  readonly members: ReadonlyMap<Symbol, MemoryRecordMember>;
}

function correspondingMemoryMember(
  context: Pick<TsonicSourceFileAnalysisContext, "checker">,
  record: MemoryRecordShape,
  member: MemoryRecordMember,
): MemoryRecordMember | undefined {
  const symbol = context.checker.getPropertyOfType(record.type, context.checker.getSymbolName(member.property.symbol));
  return symbol === undefined ? undefined : record.members.get(symbol);
}

export function createMemoryDomainRelation(
  context: Pick<TsonicSourceFileAnalysisContext, "checker" | "typeShape">,
  reference: (domain: MemoryTypeDomain) => Symbol | undefined,
  record: (domain: MemoryTypeDomain) => MemoryRecordShape | undefined,
): (left: MemoryTypeDomain, right: MemoryTypeDomain) => boolean {
  const cache = new Map<MemoryTypeDomain, Map<MemoryTypeDomain, boolean>>();
  return (left, right) => {
    if (left === right) return true;
    const cached = cache.get(left)?.get(right);
    if (cached !== undefined) return cached;
    const active = new Map<MemoryTypeDomain, Set<MemoryTypeDomain>>();
    const completed = new Map<MemoryTypeDomain, Map<MemoryTypeDomain, boolean>>();
    let visited = 0;
    let cycles = 0;
    function equal(current: MemoryTypeDomain, other: MemoryTypeDomain, depth: number): boolean {
      if (current === other) return true;
      if (++visited > 131072 || depth >= 128) return false;
      const known = completed.get(current)?.get(other);
      if (known !== undefined) return known;
      if (active.get(current)?.has(other)) { cycles += 1; return true; }
      const peers = active.get(current) ?? new Set<MemoryTypeDomain>();
      peers.add(other);
      active.set(current, peers);
      const previousCycles = cycles;
      let result: boolean;
      try {
        result = compare(current, other, depth);
      } finally {
        peers.delete(other);
      }
      if (!result || previousCycles === cycles) {
        const results = completed.get(current) ?? new Map<MemoryTypeDomain, boolean>();
        results.set(other, result);
        completed.set(current, results);
      }
      return result;
    }
    function compare(current: MemoryTypeDomain, other: MemoryTypeDomain, depth: number): boolean {
      if (current.kind !== other.kind) {
        if (current.kind === "union" || current.kind === "intersection") {
          return current.children.every(child => equal(child, other, depth + 1));
        }
        if (other.kind === "union" || other.kind === "intersection") {
          return other.children.every(child => equal(current, child, depth + 1));
        }
        return false;
      }
      if (current.kind === "union" || current.kind === "intersection") {
        return current.children.every(child => other.children.some(candidate => equal(child, candidate, depth + 1))) &&
          other.children.every(child => current.children.some(candidate => equal(child, candidate, depth + 1)));
      }
      if (current.kind === "pointer" || current.kind === "fixed-array") {
        return current.head === other.head && current.children.length === other.children.length &&
          current.children.every((child, index) => equal(child, other.children[index]!, depth + 1));
      }
      if (current.kind !== "reference") return false;
      if (reference(current) === reference(other) && reference(current) !== undefined) {
        return current.children.length === other.children.length &&
          current.children.every((child, index) => equal(child, other.children[index]!, depth + 1));
      }
      const source = record(current);
      const destination = record(other);
      if (source === undefined || destination === undefined || source.members.size !== destination.members.size ||
          !context.typeShape.isTypeIdenticalTo(source.type, destination.type)) return false;
      for (const member of destination.members.values()) {
        const counterpart = correspondingMemoryMember(context, source, member);
        if (counterpart === undefined || counterpart.property.optional !== member.property.optional ||
            counterpart.property.readonly !== member.property.readonly ||
            !equal(counterpart.domain, member.domain, depth + 1)) return false;
      }
      return true;
    }
    const result = equal(left, right, 0);
    const peers = cache.get(left) ?? new Map<MemoryTypeDomain, boolean>();
    peers.set(right, result);
    cache.set(left, peers);
    return result;
  };
}
