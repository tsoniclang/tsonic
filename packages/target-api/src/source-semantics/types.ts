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
  SourceAuthoredTypeSelection,
} from "./authored-type-selection.js";
import type {
  SourceContextualValueTypeSelection,
} from "./contextual-type-selection.js";
import type {
  SourceTypeRelationship,
} from "./type-relationship.js";
import type {
  SourceTypeRefinement,
} from "./type-refinement.js";

export type SourceFileSemantics = Readonly<
  & { readonly sourceFile: SourceFile }
  & {
    getEffectiveTypeArguments(type: Type): readonly Type[] | undefined;
    getDeclaredValueType(declaration: Node): Type | undefined;
    selectAuthoredType(
      authoredTypeNode: Node,
      selectedType: Type,
    ): SourceAuthoredTypeSelection;
    selectContextualValueType(node: Node): SourceContextualValueTypeSelection;
    getTypeFactSubjects(type: Type): readonly ExtensionFactSubject[];
    selectTypeRefinement(
      declaredType: Type,
      selectedType: Type,
    ): SourceTypeRefinement;
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
  SourceAuthoredTypeSelection,
} from "./authored-type-selection.js";
export type {
  SourceContextualValueTypeSelection,
} from "./contextual-type-selection.js";
export type {
  SourceTypeRelationship,
} from "./type-relationship.js";
export type {
  SourceTypeRefinement,
} from "./type-refinement.js";

export interface TargetSourceProgram {
  readonly ast: AstReader;
  readonly sourceFiles: readonly SourceFile[];
  readonly sourceFacts: ReadonlySourceFactResolver;
  readonly navigation: SourceProgramNavigation;
  readonly semantics: SourceProgramSemantics;
}
