import type { Node } from "@tsonic/tsts";
import type { SourceProductionResult } from "../../source-model/production.js";
import { sourceSemanticRefusal } from "./semantic-production.js";
import type { SourceSemanticProduction } from "./production-context.js";

export function produceSourceDefinitionParameters(context: Pick<SourceSemanticProduction, "ast" | "input">,
  declaration: Node): SourceProductionResult<readonly Node[]> {
  const { ast, input } = context;
  input.assertNode(declaration);
  if (ast.is.IsTypeAliasDeclaration(declaration)) {
    const parameters: Node[] = [];
    for (const parameter of ast.typeParameters(declaration)) {
      if (parameter === undefined) throw new Error("An original alias binder vector must retain every original declaration.");
      parameters.push(parameter);
    }
    return { kind: "resolved", value: Object.freeze(parameters) };
  }
  const parameters = input.describe(input.syntax(declaration)).definitionParameters;
  if (parameters === undefined) return sourceSemanticRefusal(declaration,
    "An original class or interface definition requires its complete outer and local binder inventory.", "TSONIC_LOCAL_TYPE_GENERIC");
  if (new Set(parameters).size !== parameters.length) throw new Error("An original definition binder inventory cannot repeat a declaration.");
  return { kind: "resolved", value: parameters };
}
