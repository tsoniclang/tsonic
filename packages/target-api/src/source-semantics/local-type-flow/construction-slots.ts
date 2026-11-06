import type { AstReader, Node, SourcePrimitiveKind } from "@tsonic/tsts";
import type { SourceLiteralValue } from "../literal-values-model.js";
import { createSourceTypeFlowRefusal } from "./refusals.js";
import { sourcePrimitiveOperatorLiteralFits } from "./operator-decisions.js";
import type { SourceTypeFlowDeclaredSlot } from "./declared-slots.js";
import type { SourceTypeDescriptor } from "./types.js";

export type SourceTypeFlowScalarCalculationArm =
  | { readonly kind: "resolved"; readonly primitive: SourcePrimitiveKind }
  | { readonly kind: "unfitted" };

// C-2360 Q5 / C-2361 Q12 / C-2379 H3: int64 first, then fixed integers by width and signedness, then platform integers and C-2339 floats.
const wholeLiteralUnionArmPriority: Readonly<Record<SourcePrimitiveKind, number>> = Object.freeze({
  bool: 0, char: 1, int64: 2, int8: 3, uint8: 4, int16: 5, uint16: 6, int32: 7, uint32: 8, uint64: 9,
  int128: 10, uint128: 11, "native-int": 12, "native-uint": 13, decimal: 14, float16: 15, float32: 16, float64: 17,
});

export function sourceTypeFlowScalarCalculationArm(
  type: SourceTypeDescriptor, literal: SourceLiteralValue,
): SourceTypeFlowScalarCalculationArm {
  const seen = new Set<SourceTypeDescriptor>();
  let fixed: SourceTypeDescriptor | undefined = type;
  while (fixed !== undefined && !seen.has(fixed)) {
    seen.add(fixed);
    if (fixed.kind === "primitive") return Object.freeze({ kind: "resolved", primitive: fixed.primitive });
    fixed = fixed.kind === "declared" ? fixed.definition : fixed.kind === "optional" ? fixed.value : undefined;
  }
  const candidates = new Set<SourcePrimitiveKind>();
  const numericKinds = new Set<SourcePrimitiveKind>();
  const numeric = literal.form !== "array" && (literal.number !== undefined || literal.integer !== undefined ||
    literal.integerConstant !== undefined || literal.numeric !== undefined);
  const pending = [type];
  seen.clear();
  while (pending.length > 0) {
    const selected = pending.pop()!;
    if (seen.has(selected)) continue;
    seen.add(selected);
    if (selected.kind === "declared" && selected.definition !== undefined) pending.push(selected.definition);
    else if (selected.kind === "optional") pending.push(selected.value);
    else if (selected.kind === "union") pending.push(...selected.types);
    else if (selected.kind === "primitive") {
      if (numeric && selected.primitive !== "bool" && selected.primitive !== "char") numericKinds.add(selected.primitive);
      if (sourcePrimitiveOperatorLiteralFits(literal, selected.primitive)) candidates.add(selected.primitive);
    }
  }
  let primitive: SourcePrimitiveKind | undefined;
  for (const candidate of candidates) {
    if (primitive === undefined || wholeLiteralUnionArmPriority[candidate] < wholeLiteralUnionArmPriority[primitive]) primitive = candidate;
  }
  if (primitive === undefined && numericKinds.size === 1) primitive = numericKinds.values().next().value;
  return primitive === undefined ? Object.freeze({ kind: "unfitted" }) : Object.freeze({ kind: "resolved", primitive });
}

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
