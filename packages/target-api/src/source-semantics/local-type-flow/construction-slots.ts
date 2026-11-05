import type { AstReader, Node } from "@tsonic/tsts";
import { createSourceTypeFlowRefusal } from "./refusals.js";
import type { SourceTypeFlowDeclaredSlot } from "./declared-slots.js";
import type { SourceTypeDescriptor } from "./types.js";

export function sourceTypeFlowConstructionSlot(
  ast: AstReader, node: Node, type: SourceTypeDescriptor, authority: SourceTypeFlowDeclaredSlot["authority"],
): SourceTypeFlowDeclaredSlot {
  if (!(ast.is.IsArrayLiteralExpression(node) || ast.is.IsObjectLiteralExpression(node) ||
    ast.is.IsArrowFunction(node) || ast.is.IsFunctionExpression(node))) return Object.freeze({ type, authority });
  let split = false;
  function branches(selected: SourceTypeDescriptor, original = selected): readonly SourceTypeDescriptor[] {
    if (selected.kind === "declared" && selected.definition !== undefined) return branches(selected.definition, original);
    if (selected.kind === "optional") { split = true; return branches(selected.value); }
    if (selected.kind === "union") { split = true; return selected.types.flatMap(member => branches(member)); }
    return [original];
  }
  function matches(selected: SourceTypeDescriptor): boolean {
    if (selected.kind === "optional") return matches(selected.value);
    if (selected.kind === "declared") return selected.definition !== undefined ? matches(selected.definition)
      : ast.is.IsObjectLiteralExpression(node) &&
        (ast.is.IsClassDeclaration(selected.declaration) || ast.is.IsInterfaceDeclaration(selected.declaration));
    if (selected.kind === "intrinsic") return selected.intrinsic === "object" || selected.intrinsic === "unknown" || selected.intrinsic === "any";
    if (ast.is.IsArrayLiteralExpression(node)) return selected.kind === "array" || selected.kind === "tuple";
    if (ast.is.IsObjectLiteralExpression(node)) return selected.kind === "shape";
    return selected.kind === "callable" || selected.kind === "shape" && selected.calls.length > 0;
  }
  const alternatives = branches(type);
  if (!split) return Object.freeze({ type, authority });
  const candidates = alternatives.filter(matches);
  return candidates.length === 1 ? Object.freeze({ type: candidates[0]!, authority })
    : Object.freeze({ refusal: createSourceTypeFlowRefusal("TSONIC_LOCAL_TYPE_UNION", node), authority });
}
