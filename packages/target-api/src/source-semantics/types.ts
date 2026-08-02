import type {
  AstReader,
  Node,
  ReadonlySourceFactResolver,
  SourceFile,
  TypeCheckerQueries,
  TypeShapeQueries,
  Type,
} from "@tsonic/tsts";
import type {
  SourceProgramNavigation,
} from "../source-navigation/index.js";

export type SourceFileSemantics = Readonly<
  & { readonly sourceFile: SourceFile }
  & {
    getEffectiveTypeArguments(type: Type): readonly Type[] | undefined;
  }
  & TypeCheckerQueries
  & TypeShapeQueries
>;

export interface SourceProgramSemantics {
  includes(sourceFile: SourceFile): boolean;
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
