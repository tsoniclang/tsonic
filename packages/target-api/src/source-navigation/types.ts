import type {
  Node,
  SourceFile,
  Symbol,
} from "@tsonic/tsts";

export interface SourceProjectReference {
  readonly symbol: Symbol;
  readonly declaration: Node;
  readonly sourceFile: SourceFile;
}

export interface SourceProjectModuleDependency {
  readonly sourceFile: SourceFile;
  readonly declaration: Node;
  readonly moduleSpecifier: Node;
  readonly kind: "import" | "export";
}

export interface SourceProjectMemberDispatch {
  readonly overridesBase: boolean;
  readonly hasDerivedOverride: boolean;
}

export interface SourceDeclarationReference {
  readonly symbol: Symbol;
  readonly declaration: Node;
  readonly sourceFile: SourceFile;
  readonly project: boolean;
}

export interface SourceDeclaredHeritageEdge {
  readonly kind: "extends" | "implements";
  readonly sourceDeclaration: Node;
  readonly heritage: Node;
  readonly target: SourceDeclarationReference;
  readonly typeArguments: readonly Node[];
}

export type SourceDeclaredHeritageResult =
  | {
      readonly kind: "resolved";
      readonly edges: readonly SourceDeclaredHeritageEdge[];
    }
  | {
      readonly kind: "unresolved";
      readonly heritage: Node;
      readonly reason: string;
    };

export type SourceHeritagePathResult =
  | {
      readonly kind: "related";
      readonly edges: readonly SourceDeclaredHeritageEdge[];
    }
  | { readonly kind: "unrelated" }
  | {
      readonly kind: "unresolved";
      readonly heritage: Node;
      readonly reason: string;
    };

export interface SourceProgramNavigation {
  readonly sourceFiles: readonly SourceFile[];
  referenceFor(node: Node | undefined): SourceProjectReference | undefined;
  declarationFor(node: Node | undefined): Node | undefined;
  moduleDependencies(sourceFile: SourceFile): readonly SourceProjectModuleDependency[];
  memberDispatch(node: Node | undefined): SourceProjectMemberDispatch | undefined;
  declaredHeritage(declaration: Node): SourceDeclaredHeritageResult;
  declaredHeritagePath(
    sourceDeclaration: Node,
    targetDeclaration: Node,
  ): SourceHeritagePathResult;
  hasReferenceOutside(symbol: Symbol, excludedNode: Node): boolean;
  isProjectShape(node: Node | undefined): boolean;
  isProjectConstructibleObject(node: Node | undefined): boolean;
  isProjectDeclaration(node: Node | undefined): boolean;
}
