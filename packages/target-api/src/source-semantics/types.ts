import type {
  AstReader,
  ExtensionFactSubject,
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
import type {
  SourceTypeRelationship,
} from "./type-relationship.js";

export type SourceFileSemantics = Readonly<
  & { readonly sourceFile: SourceFile }
  & {
    getEffectiveTypeArguments(type: Type): readonly Type[] | undefined;
    getTypeFactSubjects(type: Type): readonly ExtensionFactSubject[];
    getTypeRelationship(left: Type, right: Type): SourceTypeRelationship;
  }
  & TypeCheckerQueries
  & TypeShapeQueries
>;

export interface SourceProgramSemantics {
  includes(sourceFile: SourceFile): boolean;
  forFile(sourceFile: SourceFile): SourceFileSemantics;
  forNode(node: Node): SourceFileSemantics;
}

export type {
  SourceTypeRelationship,
} from "./type-relationship.js";

export interface TargetSourceProgram {
  readonly ast: AstReader;
  readonly sourceFiles: readonly SourceFile[];
  readonly sourceFacts: ReadonlySourceFactResolver;
  readonly navigation: SourceProgramNavigation;
  readonly semantics: SourceProgramSemantics;
}
