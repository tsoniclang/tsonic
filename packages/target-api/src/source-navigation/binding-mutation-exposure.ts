import { argumentPassingFactKey, pointerOperationFactKey } from "@tsonic/tsts";
import type { AstReader, Node, ReadonlySourceFactResolver } from "@tsonic/tsts";
import type { SourceDeclarationUseSummary } from "./types.js";

export function sourceBindingHasMutableExposure(
  input: { readonly ast: AstReader; readonly sourceFacts?: ReadonlySourceFactResolver },
  summary: SourceDeclarationUseSummary,
  enter: () => boolean,
): boolean {
  for (const use of summary.uses) {
    if (!enter()) return true;
    for (let node: Node | undefined = use.reference; node !== undefined; node = input.ast.parent(node)) {
      if (!enter()) return true;
      const passing = input.sourceFacts?.getFact(node, argumentPassingFactKey);
      if (passing !== undefined && !immutablePassingModes.has(passing.mode)) return true;
      const pointer = input.sourceFacts?.getFact(node, pointerOperationFactKey);
      if (pointer?.operation === "address-of") return true;
      const kind = input.ast.kindName(node);
      if (kind.endsWith("Statement") || sourceBindingCallableKinds.has(kind)) break;
    }
  }
  return false;
}

export const sourceBindingCallableKinds: ReadonlySet<string> = new Set(["KindFunctionDeclaration", "KindFunctionExpression", "KindArrowFunction",
  "KindMethodDeclaration", "KindConstructor", "KindGetAccessor", "KindSetAccessor"]);
const immutablePassingModes = new Set(["by-value", "byref-readonly", "borrow-shared"]);
