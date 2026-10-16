import type {
  AstReader,
  Node,
  SourceFile,
} from "@tsonic/tsts";
import type { SourcePropertyNameSelection } from "../source-semantics/property-names.js";
import type {
  SourceProgramDocuments,
  TargetSourceProgram,
} from "../source-semantics/types.js";

export interface TargetSourceSyntaxProgram {
  readonly ast: AstReader;
  readonly sourceFiles: readonly SourceFile[];
  readonly documents: SourceProgramDocuments;
  readonly propertyNames: { readonly get: (name: Node) => SourcePropertyNameSelection | undefined };
}

export function targetSourceSyntaxProgram(
  source: TargetSourceProgram,
): TargetSourceSyntaxProgram {
  const propertyNames = new WeakMap(source.navigation.sourceFiles.flatMap(sourceFile =>
    source.semantics.forFile(sourceFile).propertyNames.entries.map(entry => [entry.node, entry.selection] as const)));
  return Object.freeze({
    ast: source.ast,
    sourceFiles: Object.freeze([...source.sourceFiles]),
    documents: source.documents,
    propertyNames: Object.freeze({ get: (name: Node) => propertyNames.get(name) }),
  });
}
