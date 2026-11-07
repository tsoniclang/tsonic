import { argumentPassingFactKey, pointerOperationFactKey } from "@tsonic/tsts";
import type { AstReader, Node, ReadonlySourceFactResolver } from "@tsonic/tsts";
import type { SourceDeclarationUseSummary } from "./types.js";
import { sourceNodeHasRole } from "./callable-boundaries.js";

export function sourceBindingHasMutableExposure(
  input: { readonly ast: AstReader; readonly sourceFacts?: Pick<ReadonlySourceFactResolver, "getFact"> },
  summary: SourceDeclarationUseSummary,
  enter: (node: Node) => boolean,
): boolean {
  for (const use of summary.uses) {
    if (!enter(use.reference)) return true;
    const visited = new Set<Node>();
    for (let node: Node | undefined = use.reference; node !== undefined; node = input.ast.parent(node)) {
      if (!enter(node) || visited.has(node)) return true;
      visited.add(node);
      const passing = input.sourceFacts?.getFact(node, argumentPassingFactKey);
      if (passing !== undefined && !immutablePassingModes.has(passing.mode)) return true;
      const pointer = input.sourceFacts?.getFact(node, pointerOperationFactKey);
      if (pointer?.operation === "address-of") return true;
      if (input.ast.kindName(node).endsWith("Statement") || sourceNodeHasRole(input.ast, node, "execution-barrier")) break;
    }
  }
  return false;
}

const immutablePassingModes = new Set(["by-value", "byref-readonly", "borrow-shared"]);
