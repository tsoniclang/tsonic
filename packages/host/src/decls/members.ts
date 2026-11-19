import type { DefId, SigId } from "../ids/contract.js";
import { readSignature, readType } from "../ir-types/index.js";
import type { AccessorCorrespondence, ConstructorCorrespondence, MemberInventory, MemberUnavailableReason } from "../ir-types/contract.js";
import type { HirNode } from "../ir-hir/contract.js";
import type { DeclsDeps, MembersOf } from "./contract.js";
import { findAscending, moduleOf } from "./signatures.js";

function declarationNode(deps: DeclsDeps, declaration: DefId): HirNode {
  const checked = moduleOf(deps, declaration, { query: "membersOf", key: declaration });
  const entry = findAscending(checked.module.items, declaration, item => item.definition);
  const node = entry === undefined ? undefined : checked.nodes[entry.node];
  if (entry === undefined || node === undefined || node.id !== entry.node)
    throw new TypeError("decls: a member correspondence requires its actual checked declaration");
  return node;
}

function constructorOf(deps: DeclsDeps, identity: SigId): ConstructorCorrespondence {
  const signature = readSignature(deps.types, identity);
  if (signature.kind !== "construct") throw new TypeError("decls: a construct inventory requires an actual construct signature");
  if (signature.declaration === null) return { signature: identity, declaration: null, body: null };
  const node = declarationNode(deps, signature.declaration);
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
  else if (term.kind === "shape" || term.kind === "callable") {
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
        const node = declarationNode(deps, origin.declaration);
        if (node.kind !== "GetAccessor" && node.kind !== "SetAccessor")
          throw new TypeError("decls: an accessor origin must name its actual getter or setter declaration");
        accessors.push({ origin, getter: node.kind === "GetAccessor" ? origin.declaration : null,
          setter: node.kind === "SetAccessor" ? origin.declaration : null });
      }
    }
    inventory = { receiver, members, indexes, calls: term.calls, constructs: term.constructs, accessors,
      constructors: term.constructs.map(signature => constructorOf(deps, signature)), completeness: { kind: "complete" } };
  } else throw new TypeError(`decls: membersOf requires the actual retained checker inventory for ${term.kind}`);
  return { kind: "done", value: { kind: "ok", value: inventory, positions: [{ position: { kind: "result" }, error: null }],
    diagnostics: [], emissions: [] } };
};
