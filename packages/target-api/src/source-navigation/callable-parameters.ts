import type { Node } from "@tsonic/tsts";
import type { SourceApplication, SourcePresence, SourceResult } from "../public/source/contracts.js";
import type { SourceNavigationQueryContext } from "./query-context.js";

export function sourceCallableValueParameters(source: SourceNavigationQueryContext, declaration: Node,
  application: SourceApplication | undefined): SourceResult<SourcePresence<readonly Node[]>> {
  const { ast } = source;
  const navigation = source.facts.navigation;
  if (!navigation.includes(declaration)) throw new Error("Source callable parameters require their original declaration.");
  const none = Object.freeze({ kind: "resolved", value: Object.freeze({ kind: "none" }) } as const);
  let owner = declaration;
  if (application !== undefined) {
    const original = source.facts.applications.application(application.identity.invocation);
    if (original.kind === "refused") return original;
    if (original.value !== application) throw new Error("Selected callable parameters require their exact original application.");
    const selected = application.identity.signature.declaration;
    if (selected === undefined) return none;
    owner = selected;
  }
  if (!navigation.callableRoles(owner).signature) return none;
  const parameters: Node[] = [];
  const seen = new Set<Node>();
  for (const parameter of ast.parameters(owner)) {
    if (parameter === undefined || !ast.is.IsParameterDeclaration(parameter) || seen.has(parameter)) return none;
    if (!navigation.includes(parameter)) throw new Error("A callable parameter requires its exact original identity.");
    seen.add(parameter);
    parameters.push(parameter);
  }
  return Object.freeze({ kind: "resolved", value: Object.freeze({ kind: "present", value: Object.freeze(parameters) }) });
}
