/**
 * Binding Layer — Call Signature Resolution.
 *
 * TSTS is the authority for call resolution. Tsonic only captures the selected
 * signature handle. If TSTS does not provide a selected signature, the frontend
 * leaves the call unresolved and later validation emits a deterministic error.
 */

import type { TstsNode } from "@tsonic/tsts";
import { TstsSyntax } from "@tsonic/tsts";
import type { SignatureId } from "../type-system/types.js";
import type { BindingContext } from "./binding-registry.js";
import { getOrCreateSignatureId } from "./binding-registry.js";

const isSuperCall = (node: TstsNode): boolean =>
  TstsSyntax.Node_Expression(node)?.Kind === TstsSyntax.KindSuperKeyword;

export const resolveCallSignature = (
  ctx: BindingContext,
  node: TstsNode
): SignatureId | undefined => {
  const signature = ctx.sourceSemantics.getResolvedSignature(node);
  if (!signature) {
    return undefined;
  }

  const signatureDeclaration =
    ctx.sourceSemantics.getSignatureDeclaration(signature);

  if (signatureDeclaration === undefined) {
    return isSuperCall(node) ? getOrCreateSignatureId(ctx, signature) : undefined;
  }

  return getOrCreateSignatureId(ctx, signature);
};
