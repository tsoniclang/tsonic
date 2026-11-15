import type { RawTypeId, TyId } from "../ids/contract.js";
import { encodeKey } from "../ids/index.js";
import type { Member, MemberOrigin } from "../ir-types/contract.js";
import type { LowerDeps, RawFact, RawMember } from "./contract.js";
import { lowerMemberKey, lowerMemberOrigin } from "./bindings.js";

export function lowerMembers(deps: LowerDeps, members: readonly RawMember[],
  converted: (type: RawTypeId) => TyId | undefined): readonly Member[] {
  const typeOf = (fact: RawFact<RawTypeId | null>): TyId | null => {
    if (fact.kind !== "available")
      throw new TypeError("front: a member requires its actual captured read/write type association (" + fact.reason + ")");
    if (fact.value === null) return null;
    const result = converted(fact.value);
    if (result === undefined) throw new TypeError("front: a member type dependency must complete before its containing shape");
    return result;
  };
  return members.map(member => {
    if (member.readKind !== "property" && member.readKind !== "method" && member.readKind !== "accessor")
      throw new TypeError("front: checked member conversion requires its actual selected member kind");
    const origins = new Map<string, MemberOrigin>();
    const readOrigins = new Map<string, MemberOrigin>();
    const writeOrigins = new Map<string, MemberOrigin>();
    for (const origin of member.origins) {
      if (origin.kind !== "declaration")
        throw new TypeError("front: checked member conversion requires its actual declared read/write origin association");
      const key = encodeKey([origin.kind, origin.declaration.module, origin.declaration.node]);
      const value = origins.get(key) ?? lowerMemberOrigin(deps, origin);
      origins.set(key, value);
      (origin.access === "read" ? readOrigins : writeOrigins).set(key, value);
    }
    if (origins.size === 0) throw new TypeError("front: a checked member requires its actual captured origins");
    return { key: lowerMemberKey(deps, member.key), origins: [...origins.values()],
      readOrigins: [...readOrigins.values()], writeOrigins: [...writeOrigins.values()],
      kind: member.readKind, read: typeOf(member.read), write: typeOf(member.write),
      optional: member.optional, readonly: member.readonly };
  });
}
