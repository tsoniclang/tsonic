import type { HirBody } from "../ir-hir/contract.js";
import type { DefId } from "../ids/contract.js";
import type { DeclaredSignatureRequest, InferDeps } from "./contract.js";
import { callerDefect, notInferredYet } from "./frontier.js";

export function ownSignatureRequest(deps: InferDeps, body: HirBody, port: string,
  ownDefinitions: ReadonlySet<DefId>): DeclaredSignatureRequest | null {
  const owner = deps.itemOf(body.owner);
  if (owner.kind === "SourceFile") return null;
  if (owner.kind === "Parameter" && owner.tsonic.initializer === body.body) return null;
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
