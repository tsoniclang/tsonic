import type { HirBody, HirNode } from "../ir-hir/contract.js";
import type { DefId, TyId } from "../ids/contract.js";
import { decodeBodyId } from "../ids/index.js";
import { readSignature, readType } from "../ir-types/index.js";
import type { DeclaredSignatureRequest, GroupDeps, InferenceInputs } from "./contract.js";
import { callerDefect, notInferredYet } from "./frontier.js";

export function isLayoutOperand(body: HirBody): boolean {
  const decoded = decodeBodyId(body.body);
  return decoded.kind === "decoded" && decoded.value.role === "layout-operand";
}

export function layoutOperandType(node: HirNode, view: "read" | "contextual"): TyId | null {
  const checked = node.tsonic;
  if (checked === null) return null;
  const value = "value" in checked ? checked.value : checked;
  if (!("views" in value)) return null;
  const selected = view === "read" ? value.views.read : value.views.contextual;
  return selected.kind === "available" ? selected.value : null;
}

export function ownSignatureRequest(deps: GroupDeps, body: HirBody, port: string,
  ownDefinitions: ReadonlySet<DefId>): DeclaredSignatureRequest | null {
  if (isLayoutOperand(body)) return null;
  const owner = deps.itemOf(body.owner);
  if (owner.kind === "SourceFile") return null;
  if ((owner.kind === "Parameter" || owner.kind === "VariableDeclaration" || owner.kind === "PropertyDeclaration" || owner.kind === "EnumMember")
    && owner.tsonic.initializer === body.body) return null;
  if (owner.kind !== "FunctionDeclaration") return notInferredYet(port, `a body owned by a ${owner.kind}`, owner.origin);
  if (ownDefinitions.has(body.owner))
    return null;
  const endpoints = owner.tsonic.signatures;
  const position = endpoints.findIndex(endpoint => endpoint.body === body.body);
  const endpoint = endpoints[position];
  if (endpoint === undefined) return callerDefect(port, `body ${body.body} is not an execution body of its owner ${body.owner}`);
  const ordinal = endpoints.slice(0, position).filter(other => other.role === endpoint.role).length;
  return { kind: "declaredSignatureOf",
    request: { definition: endpoint.declaration, endpoint: endpoint.role, ordinal, bindings: { kind: "parametric" } } };
}

export function checkedVoidCompletion(deps: InferenceInputs, body: HirBody): TyId | null {
  const owner = deps.itemOf(body.owner);
  if (owner.kind !== "FunctionDeclaration" || owner.type !== null || owner.tsonic.body !== body.body
    || owner.body?.id !== body.root.id || body.root.kind !== "Block") return null;
  const [endpoint] = owner.tsonic.signatures;
  if (owner.tsonic.signatures.length !== 1 || endpoint?.role !== "api-body"
    || endpoint.declaration !== body.owner || endpoint.body !== body.body) return null;
  const signature = readSignature(deps.types, endpoint.signature);
  if (signature.kind !== "call" || signature.declaration !== endpoint.declaration) return null;
  const result = readType(deps.types, signature.result);
  return result.kind === "intrinsic" && result.intrinsic === "void" ? signature.result : null;
}
