import type { BodyId, DefId } from "../ids/contract.js";
import type { BinaryExpression, CheckedPhase, NumericLiteral } from "../ir-hir/contract.js";
import { compoundAssignmentOperatorOf, readWriteRootStorageOf } from "../ir-hir/index.js";
import type { GroupDeps } from "./contract.js";

export interface StorageInitializer {
  readonly body: BodyId;
  readonly definition: DefId;
  readonly literal: NumericLiteral<CheckedPhase>;
}

export function compoundStorageInitializer(deps: GroupDeps, node: BinaryExpression<CheckedPhase>,
  admit: () => boolean): StorageInitializer | null {
  if (node.tsonic.role !== "assignment" || compoundAssignmentOperatorOf(node.operatorToken.kind) === null) return null;
  if (!admit()) return null;
  let target = node.left;
  while (target.kind === "ParenthesizedExpression") {
    if (!admit() || deps.structuralCuts.syntax(target)) return null;
    target = target.expression;
  }
  if (target.kind !== "Identifier" || deps.structuralCuts.syntax(target) || target.tsonic.role !== "assignment-target"
    || target.tsonic.access !== "read-write" || target.tsonic.resolution.kind !== "local") return null;
  const resolution = target.tsonic.resolution;
  if (!admit()) return null;
  const body = deps.hirBody(resolution.local.body);
  const local = body.locals[resolution.local.local];
  const storage = readWriteRootStorageOf(target.tsonic.place, resolution);
  if (body.body !== resolution.local.body || local?.id !== resolution.local.local || local.role !== "binding" || !local.mutable
    || local.declaration.kind !== "item" || storage === null || storage !== readWriteRootStorageOf(node.tsonic.target, resolution)
    || local.checkerSlot.kind !== "available" || local.checkerSlot.value !== storage) return null;
  const { owner, node: declarationNode } = local.declaration.value;
  if (!admit() || deps.structuralCuts.declaration(owner)) return null;
  const declaration = deps.itemOf(owner);
  if (declaration.kind !== "VariableDeclaration" || declaration.id !== declarationNode || declaration.type !== null
    || !("declaration" in declaration.tsonic) || declaration.tsonic.declaration.kind !== "local"
    || declaration.tsonic.declaration.local.body !== resolution.local.body || declaration.tsonic.declaration.local.local !== resolution.local.local
    || declaration.tsonic.declaredType.kind !== "available" || declaration.tsonic.declaredType.value !== null) return null;
  const initializer = declaration.tsonic.initializer;
  if (initializer === null || !admit() || deps.structuralCuts.body(initializer)) return null;
  const placed = deps.hirBody(initializer);
  if (placed.body !== initializer || placed.owner !== owner || placed.root !== declaration.initializer) return null;
  let value = placed.root;
  while (value.kind === "ParenthesizedExpression") {
    if (!admit() || deps.structuralCuts.syntax(value)) return null;
    value = value.expression;
  }
  return value.kind === "NumericLiteral" && !deps.structuralCuts.syntax(value)
    && value.tsonic.role === "value" && value.tsonic.literal.kind === "number"
    ? { body: initializer, definition: owner, literal: value } : null;
}
