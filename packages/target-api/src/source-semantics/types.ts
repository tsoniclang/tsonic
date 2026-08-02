import type {
  AstReader,
  Node,
  ReadonlySourceFactResolver,
  SourceFile,
  TypeCheckerQueries,
  TypeShapeQueries,
} from "@tsonic/tsts";
import type {
  SourceProgramNavigation,
} from "../source-navigation/index.js";

export type SourceFileSemantics = Readonly<
  & { readonly sourceFile: SourceFile }
  & TypeCheckerQueries
  & TypeShapeQueries
>;

export interface SourceProgramSemantics {
  forFile(sourceFile: SourceFile): SourceFileSemantics;
  forNode(node: Node): SourceFileSemantics;
}

export interface TargetSourceProgram {
  readonly ast: AstReader;
  readonly sourceFiles: readonly SourceFile[];
  readonly sourceFacts: ReadonlySourceFactResolver;
  readonly navigation: SourceProgramNavigation;
  readonly semantics: SourceProgramSemantics;
}
