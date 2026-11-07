import type { AstReader, Node, SourceFile } from "@tsonic/tsts";
import type { SourcePropertyName } from "../public/source/analyses.js";
import type { TargetSourceProgramFacts } from "../public/source/index.js";
import type { SourceProgramDocuments } from "../source-semantics/types.js";

/** The authored-syntax view a target emits from: syntax reader, files, documents and static property names. */
export interface TargetSourceSyntaxProgram {
  readonly ast: AstReader;
  readonly sourceFiles: readonly SourceFile[];
  readonly documents: SourceProgramDocuments;
  readonly propertyNames: { readonly get: (name: Node) => SourcePropertyName | undefined };
}

/** Program-free composition over the published target handle (no Host program access). */
export function targetSourceSyntaxProgram(source: TargetSourceProgramFacts): TargetSourceSyntaxProgram {
  const { analyses } = source.facts;
  return Object.freeze({
    ast: source.syntax,
    sourceFiles: Object.freeze([...source.sourceFiles]),
    documents: source.documents,
    propertyNames: Object.freeze({ get: (name: Node) => analyses.propertyName(name) }),
  });
}
