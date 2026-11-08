import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceAdmissionFacts, SourceResult } from "../public/source/contracts.js";

export function createSourceAdmissionFacts(input: {
  readonly ast: AstReader;
  assertNode(node: Node): void;
  observe<Value>(result: SourceResult<Value>): SourceResult<Value>;
}): SourceAdmissionFacts {
  const completed = new WeakMap<Node, SourceResult<{ readonly kind: "supported" }>>();
  const supported: SourceResult<{ readonly kind: "supported" }> = Object.freeze({ kind: "resolved",
    value: Object.freeze({ kind: "supported" }) });
  return Object.freeze({ form(original: Node): SourceResult<{ readonly kind: "supported" }> {
    input.assertNode(original);
    const previous = completed.get(original);
    if (previous !== undefined) return previous;
    const { ast } = input;
    const message = ast.is.IsModuleDeclaration(original) ? "Namespace declarations have no supported Source runtime value form."
      : ast.is.IsTaggedTemplateExpression(original) ? "Tagged template expressions have no supported Source runtime application form."
      : ast.is.IsExportAssignment(original) && ast.as.AsExportAssignment(original)?.IsExportEquals
        ? "Export-equals assignments have no supported Source module value form." : undefined;
    const result: SourceResult<{ readonly kind: "supported" }> = message === undefined ? supported
      : Object.freeze({ kind: "refused", source: "tsonic", code: "TSONIC_SOURCE_FORM_UNSUPPORTED", site: original, message });
    completed.set(original, result);
    return input.observe(result);
  } });
}
