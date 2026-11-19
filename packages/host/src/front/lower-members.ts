import type { BodyId, NodeId, RawTypeId, TyId } from "../ids/contract.js";
import { encodeKey } from "../ids/index.js";
import type * as Hir from "../ir-hir/contract.js";
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
      if (origin.kind !== "declaration" && origin.kind !== "intrinsic" && origin.kind !== "source-member")
        throw new TypeError("front: checked member conversion requires its actual read/write origin association");
      const key = origin.kind === "intrinsic" ? encodeKey([origin.kind, origin.symbol])
        : origin.kind === "source-member" ? encodeKey([origin.kind, origin.occurrence.module, origin.occurrence.node])
        : encodeKey([origin.kind, origin.declaration.module, origin.declaration.node]);
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

export function lowerObjectProperties(node: Hir.ObjectLiteralExpression<Hir.SyntaxPhase>, body: BodyId, members: readonly Member[],
  coreOf: (node: NodeId) => Hir.HirCoreCapture, valueOf: (node: Hir.Expression<Hir.SyntaxPhase>) => Hir.Expression<Hir.CheckedPhase>):
  Hir.NodeList<Hir.ObjectLiteralElementLike<Hir.CheckedPhase>> {
  const selections = new Map<NodeId, Member>();
  for (const member of members) for (const origin of member.origins) {
    if (origin.kind !== "source-member" || origin.occurrence.body !== body) continue;
    if (selections.has(origin.occurrence.node))
      throw new TypeError("front: a data-property occurrence cannot select two checked members");
    selections.set(origin.occurrence.node, member);
  }
  return { loc: node.properties.loc, nodes: node.properties.nodes.map(property => {
    if (property.kind !== "PropertyAssignment" || property.name.kind !== "Identifier" ||
      property.modifiers !== null || property.postfixToken !== null || property.type !== null)
      throw new TypeError("front: checked object property must be a plain data-property assignment");
    const selected = selections.get(property.id);
    if (selected === undefined || selected.kind !== "property")
      throw new TypeError("front: object data-property requires its actual checked member occurrence");
    const key: Hir.CapturedFact<Member["key"]> = { kind: "available", value: selected.key };
    const origins: Hir.CapturedFact<Member["origins"]> = { kind: "available", value: selected.origins };
    return { ...property, modifiers: null, postfixToken: null, type: null, initializer: valueOf(property.initializer),
      name: { ...property.name, tsonic: { core: coreOf(property.name.id), role: "property-name", key, origins } },
      tsonic: { core: coreOf(property.id), key, origins } };
  }) };
}
