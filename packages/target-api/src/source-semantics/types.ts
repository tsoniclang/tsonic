import type {
  AstReader,
  ExtensionFactSubject,
  Node,
  ReadonlySourceFactResolver,
  SourceFile,
  Symbol,
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
import type {
  ResolvedSourceCallInfo,
  SourceCallResultSelection,
} from "./call-result-selection.js";

export type SourceFileSemantics = Readonly<
  & { readonly sourceFile: SourceFile }
  & {
    getEffectiveTypeArguments(type: Type): readonly Type[] | undefined;
    getAuthoredTypeFactSubjects(
      node: Node,
    ): readonly ExtensionFactSubject[];
    getDeclaredValueType(declaration: Node): Type | undefined;
    selectCallResult(
      source: ResolvedSourceCallInfo,
    ): SourceCallResultSelection | undefined;
    selectAuthoredType(
      authoredTypeNode: Node,
      selectedType: Type,
    ): SourceAuthoredTypeSelection;
    selectContextualValueType(node: Node): SourceContextualValueTypeSelection;
    getSelectedFactSubjects(
      symbol: Symbol | undefined,
      declaration: Node | undefined,
    ): readonly ExtensionFactSubject[];
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
  ResolvedSourceCallInfo,
  SourceCallResultSelection,
} from "./call-result-selection.js";
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
