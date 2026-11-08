import type { Node } from "@tsonic/tsts";
import type { SourceInputApplication } from "../../host-input/call-input.js";
import type { SourceTypeFlowSource } from "./types.js";
import { sourceTransparentExpressionOperand } from "../../source-navigation/ast.js";

export function sourceApplicationStaticReceiver(source: Pick<SourceTypeFlowSource, "ast" | "navigation" | "profile">,
  application: SourceInputApplication): Node | undefined {
  const declaration = application.signature.declaration;
  if (declaration === undefined || source.profile.kind === "none") return undefined;
  const member = source.profile.value.member(declaration);
  if (member === undefined || member.receiver !== "static") return undefined;
  if (member.declaration !== declaration) throw new Error("A Source profile member must attest its exact selected original declaration.");
  const receiver = application.receiver;
  if (receiver === undefined) return undefined;
  let node = receiver.occurrence;
  const seen = new Set<Node>();
  for (;;) {
    if (seen.has(node)) throw new Error("An original direct receiver cannot contain a syntax cycle.");
    seen.add(node);
    const operand = sourceTransparentExpressionOperand(source.ast, node);
    if (operand === undefined) break;
    node = operand;
  }
  if (!source.ast.is.IsIdentifier(node) && !source.ast.is.IsPropertyAccessExpression(node)) return undefined;
  if (source.ast.is.IsPropertyAccessExpression(node)) {
    let base: Node | undefined = node;
    while (base !== undefined && source.ast.is.IsPropertyAccessExpression(base)) base = source.ast.as.AsPropertyAccessExpression(base)?.Expression;
    if (base === undefined || !source.ast.is.IsIdentifier(base) || source.navigation.sourceReferenceFor(base) === undefined) return undefined;
  }
  return source.navigation.sourceReferenceFor(node)?.declaration;
}
