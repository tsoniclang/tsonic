import type { AstReader, Node } from "@tsonic/tsts";
import { BreakOrContinueStatement_Label, LabeledStatement_Label, LabeledStatement_Statement } from "./ast.js";
import { sourceBindingCallableKinds } from "./binding-mutation-exposure.js";

export function sourceControlTransferTarget(ast: AstReader, node: Node): Node | undefined {
  const kind = ast.kindName(node);
  if (kind !== "KindBreakStatement" && kind !== "KindContinueStatement") return undefined;
  const label = BreakOrContinueStatement_Label(ast, node);
  const labelText = label === undefined ? undefined : ast.text(label);
  let remaining = 2_048;
  for (let parent = ast.parent(node); parent !== undefined && remaining > 0; parent = ast.parent(parent)) {
    remaining -= 1;
    const parentKind = ast.kindName(parent);
    if (sourceBindingCallableKinds.has(parentKind)) return undefined;
    if (labelText !== undefined) {
      if (parentKind !== "KindLabeledStatement") continue;
      const declaration = LabeledStatement_Label(ast, parent);
      if (declaration === undefined || ast.text(declaration) !== labelText) continue;
      if (kind === "KindBreakStatement") return parent;
      let statement = LabeledStatement_Statement(ast, parent);
      while (statement !== undefined && ast.is.IsLabeledStatement(statement) && remaining > 0) {
        remaining -= 1;
        statement = LabeledStatement_Statement(ast, statement);
      }
      return statement !== undefined && sourceNodeIsIteration(ast, statement) ? statement : undefined;
    }
    if (sourceNodeIsIteration(ast, parent) || kind === "KindBreakStatement" && parentKind === "KindSwitchStatement") return parent;
  }
  return undefined;
}

export function sourceNodeIsIteration(ast: AstReader, node: Node): boolean {
  const kind = ast.kindName(node);
  return kind === "KindWhileStatement" || kind === "KindForStatement" || kind === "KindForOfStatement" ||
    kind === "KindForInStatement" || kind === "KindDoStatement";
}
