import type { UnitRequest } from "../diag/contract.js";
import type { DefId, SigId } from "../ids/contract.js";
import { internType, readSignature, readType } from "../ir-types/index.js";
import type { AccessorCorrespondence, ConstructorCorrespondence, MemberInventory, MemberUnavailableReason } from "../ir-types/contract.js";
import type { HirNode } from "../ir-hir/contract.js";
import type { DeclsDeps, MembersOf, MemberTypeOf } from "./contract.js";
import { findAscending, moduleOf } from "./signatures.js";

function declarationNode(deps: DeclsDeps, declaration: DefId, unit: UnitRequest): HirNode {
  const checked = moduleOf(deps, declaration, unit);
  const entry = findAscending(checked.module.items, declaration, item => item.definition);
  const node = entry === undefined ? undefined : checked.nodes[entry.node];
  if (entry === undefined || node === undefined || node.id !== entry.node)
    throw new TypeError("decls: a member correspondence requires its actual checked declaration");
  return node;
}

function constructorOf(deps: DeclsDeps, identity: SigId, unit: UnitRequest): ConstructorCorrespondence {
  const signature = readSignature(deps.types, identity);
  if (signature.kind !== "construct") throw new TypeError("decls: a construct inventory requires an actual construct signature");
  if (signature.declaration === null) return { signature: identity, declaration: null, body: null };
  const node = declarationNode(deps, signature.declaration, unit);
  if (node.tsonic === null || !("signatures" in node.tsonic))
    throw new TypeError("decls: a constructor correspondence requires its actual checked endpoint");
  const endpoints = node.tsonic.signatures.filter(endpoint => endpoint.signature === identity);
  const first = endpoints[0];
  if (first === undefined || endpoints.some(endpoint => endpoint.body !== first.body))
    throw new TypeError("decls: a constructor correspondence requires one agreeing actual body association");
  return { signature: identity, declaration: signature.declaration, body: first.body };
}

export const membersOf: MembersOf = (deps, receiver) => {
  const term = readType(deps.types, receiver);
  const open = (reason: MemberUnavailableReason): MemberInventory => ({ receiver, members: [], indexes: [], calls: [],
    constructs: [], accessors: [], constructors: [], completeness: { kind: "open", reasons: [reason] } });
  let inventory: MemberInventory;
  if (term.kind === "param") inventory = open({ kind: "parameter", parameter: term.parameter });
  else if (term.kind === "intrinsic" && (term.intrinsic === "any" || term.intrinsic === "unknown"))
    inventory = open({ kind: "dynamic" });
  else if (term.kind === "source-environment") inventory = { receiver, members: term.members, indexes: [], calls: [],
    constructs: [], accessors: [], constructors: [], completeness: { kind: "complete" } };
  else if (term.kind === "shape" || term.kind === "callable") {
    const unit: UnitRequest = { query: "membersOf", key: receiver };
    const members = term.kind === "shape" ? term.members.map(member => ({ key: member.key, origins: member.origins,
      readOrigins: member.readOrigins, writeOrigins: member.writeOrigins, kind: member.kind,
      optional: member.optional, readonly: member.readonly })) : [];
    const indexes = term.kind === "shape" ? term.indexes.map(index => ({ origin: index.origin, key: index.key,
      readonly: index.readonly })) : [];
    const accessors: AccessorCorrespondence[] = [];
    for (const member of members) {
      if (member.kind !== "accessor") continue;
      for (const origin of member.origins) {
        if (origin.kind !== "declared")
          throw new TypeError("decls: an accessor inventory requires its actual checked origin correspondence");
        const node = declarationNode(deps, origin.declaration, unit);
        if (node.kind !== "GetAccessor" && node.kind !== "SetAccessor")
          throw new TypeError("decls: an accessor origin must name its actual getter or setter declaration");
        accessors.push({ origin, getter: node.kind === "GetAccessor" ? origin.declaration : null,
          setter: node.kind === "SetAccessor" ? origin.declaration : null });
      }
    }
    inventory = { receiver, members, indexes, calls: term.calls, constructs: term.constructs, accessors,
      constructors: term.constructs.map(signature => constructorOf(deps, signature, unit)), completeness: { kind: "complete" } };
  } else throw new TypeError(`decls: membersOf requires the actual retained checker inventory for ${term.kind}`);
  return { kind: "done", value: { kind: "ok", value: inventory, positions: [{ position: { kind: "result" }, error: null }],
    diagnostics: [], emissions: [] } };
};

export const memberTypeOf: MemberTypeOf = (deps, request) => {
  const receiver = readType(deps.types, request.receiver);
  if (receiver.kind !== "shape" && receiver.kind !== "source-environment")
    throw new TypeError("decls: memberTypeOf requires an actual retained typed member inventory");
  const ordinal = request.member;
  if (!Number.isSafeInteger(ordinal) || ordinal < 0 || Object.is(ordinal, -0) || ordinal >= receiver.members.length)
    throw new TypeError("decls: memberTypeOf requires an actual member of the receiver inventory");
  const member = receiver.members[ordinal];
  if (member === undefined) throw new TypeError("decls: the requested member is missing from its canonical inventory");
  if (member.kind !== "property" || member.origins.length === 0)
    throw new TypeError("decls: memberTypeOf requires the retained type producer for this member kind");
  const unit: UnitRequest = { query: "memberTypeOf", key: [request.receiver, ordinal] };
  if (receiver.kind === "source-environment") {
    const origin = member.readOrigins.length === 1 ? member.readOrigins[0] : undefined;
    let read;
    if (origin?.kind === "intrinsic") read = origin.symbol === "global-this" ? request.receiver
      : internType(deps.types, { kind: "intrinsic", intrinsic: "absence" });
    else if (origin?.kind === "declared") {
      const node = declarationNode(deps, origin.declaration, unit);
      if (node.kind === "VariableDeclaration" && node.tsonic.declaredType.kind === "available")
        read = node.tsonic.declaredType.value ?? undefined;
    }
    if (read === undefined || readType(deps.types, read).kind === "error")
      throw new TypeError("decls: a global member requires its exact checked selected value");
    return { kind: "done", value: { kind: "ok", value: { read, write: member.readonly ? null : read },
      positions: [{ position: { kind: "result" }, error: null }], diagnostics: [], emissions: [] } };
  }
  for (const origin of member.origins) {
    if (origin.kind !== "declared")
      throw new TypeError("decls: memberTypeOf requires the retained type producer for this member origin");
    const node = declarationNode(deps, origin.declaration, unit);
    if (node.kind !== "PropertySignature" || node.type === null)
      throw new TypeError("decls: memberTypeOf requires the actual type of this property's declaration or inferred part");
  }
  if (!("read" in member)) throw new TypeError("decls: a structural field requires its checked read and write types");
  const { read, write } = member;
  if (read === null) throw new TypeError("decls: a declared structural field requires its actual read type");
  if (readType(deps.types, read).kind === "error"
    || (write !== null && write !== read && readType(deps.types, write).kind === "error"))
    throw new TypeError("decls: memberTypeOf cannot publish an error type without its actual cause");
  return { kind: "done", value: { kind: "ok", value: { read, write },
    positions: [{ position: { kind: "result" }, error: null }], diagnostics: [], emissions: [] } };
};
