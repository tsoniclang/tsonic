import type { AstReader, ExtensionFactSubject, ReadonlySourceFactResolver } from "@tsonic/tsts";
import { tsonicPointerViewFactKey } from "./facts.js";
import type { TsonicPointerViewFact } from "./facts.js";

export type TsonicPointerViewSelection =
  | { readonly kind: "resolved"; readonly operation: TsonicPointerViewFact }
  | { readonly kind: "rejected"; readonly reason: string };

export function selectTsonicPointerView(
  ast: AstReader, facts: ReadonlySourceFactResolver, subject: ExtensionFactSubject,
): TsonicPointerViewSelection | undefined {
  const operation = facts.getFact(subject, tsonicPointerViewFactKey);
  if (operation === undefined) return undefined;
  const arguments_ = ast.arguments(operation.call);
  if (operation.call !== subject || arguments_.length !== 3 || arguments_[0] !== operation.pointerExpression ||
      arguments_[1] !== operation.readExpression || arguments_[2] !== operation.writeExpression) {
    return Object.freeze({ kind: "rejected", reason: "Pointer view requires its exact base, read and write operands." });
  }
  return Object.freeze({ kind: "resolved", operation });
}
