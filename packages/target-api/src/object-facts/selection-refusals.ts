// Eager selection refusals: SourceProgramFacts.refusals() is complete before a target analyzes anything (R5). The
// selections are computed on demand, so their refusals are collected here by asking every selection site of the
// program once: calls (untyped callee, undeclared signature, profile call refusals such as Generator.throw),
// iterations (untyped or per-arm-mixed for-of / for-await / spread), `using` declarations (untyped disposal) and
// yield expressions (refused delegation). Each refusal has one owner; this module only asks.
import type { AstReader, Node, SourceFile } from "@tsonic/tsts";
import type { SourceRefusal } from "../public/source/facts.js";
import type { SourceJsApiFacts } from "../public/source/objects.js";
import type { SourceSelectionFacts } from "../public/source/selections.js";

export interface SourceSelectionRefusalInput {
  readonly ast: AstReader;
  readonly sourceFiles: readonly SourceFile[];
  readonly selections: SourceSelectionFacts & {
    refusals(): readonly SourceRefusal[];
    iterationProtocolRefusal(site: Node): SourceRefusal | undefined;
  };
  readonly profile: SourceJsApiFacts;
}

/** Every selection refusal of the program, in source order of first request, computed once. */
export function createSourceSelectionRefusals(input: SourceSelectionRefusalInput): () => readonly SourceRefusal[] {
  let collected: readonly SourceRefusal[] | undefined;
  return () => {
    collected ??= collect(input);
    return collected;
  };
}

function collect(input: SourceSelectionRefusalInput): readonly SourceRefusal[] {
  const { ast, selections, profile } = input;
  const profileRefusals: SourceRefusal[] = [];
  const visit = (node: Node): void => {
    if (ast.is.IsCallExpression(node) || ast.is.IsNewExpression(node) || ast.is.IsTaggedTemplateExpression(node)) {
      const call = selections.call(node);
      if (call !== undefined && call.kind !== "refused" && call.declaration !== undefined) {
        const refusal = profile.callRefusal(call.declaration);
        if (refusal !== undefined) {
          profileRefusals.push(Object.freeze({ kind: "refused", code: refusal.code, message: refusal.message, site: node }));
        }
      }
    } else if (ast.is.IsForOfStatement(node) || ast.is.IsSpreadElement(node)) {
      // The protocol witness only: a SpreadElement is not a value node, and the iterable / element value refusals are
      // the value model's own (R2 #28).
      selections.iterationProtocolRefusal(node);
    } else if (ast.is.IsVariableDeclarationList(node)) {
      const kind = ast.variableDeclarationKind(node);
      if (kind === "using" || kind === "await using") {
        for (const declaration of ast.as.AsVariableDeclarationList(node)?.Declarations?.Nodes ?? []) {
          if (declaration !== undefined) selections.resource(declaration);
        }
      }
    } else if (ast.is.IsYieldExpression(node)) {
      selections.yield(node);
    }
    ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  for (const file of input.sourceFiles) visit(file);
  return Object.freeze([...selections.refusals(), ...profileRefusals]);
}
