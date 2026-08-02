import type {
  Node,
  Signature,
  SourceFile,
  Symbol,
  Type,
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

export interface SourceBindingWrite {
  readonly reference: Node;
  readonly operation: Node;
  readonly kind: "assignment" | "update" | "iteration";
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
  readonly selectedType: Type;
  readonly selectedTypeArguments: readonly Type[];
}

export interface SourceClassConstructorParameter {
  readonly parameterIndex: number;
  readonly parameterName: string;
  readonly parameterSymbol: Symbol;
  readonly parameterDeclaration: Node;
  readonly authoredTypeNode?: Node;
  readonly selectedType: Type;
  readonly acceptsOmission: boolean;
  readonly rest: boolean;
}

export interface SourceClassConstructorSignature {
  readonly signature: Signature;
  readonly declaration?: Node;
  readonly parameters: readonly SourceClassConstructorParameter[];
}

export type SourceClassConstructorResult =
  | {
      readonly kind: "resolved";
      readonly declaration: Node;
      readonly implicit: boolean;
      readonly signatures: readonly SourceClassConstructorSignature[];
    }
  | {
      readonly kind: "unresolved";
      readonly declaration: Node;
      readonly reason: string;
    };

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
  moduleHasTopLevelAwait(sourceFile: SourceFile): boolean;
  memberDispatch(node: Node | undefined): SourceProjectMemberDispatch | undefined;
  classConstructors(declaration: Node): SourceClassConstructorResult;
  declaredHeritage(declaration: Node): SourceDeclaredHeritageResult;
  declaredHeritagePath(
    sourceDeclaration: Node,
    targetDeclaration: Node,
  ): SourceHeritagePathResult;
  bindingWritesWithin(symbol: Symbol, root: Node): readonly SourceBindingWrite[];
  hasReferenceOutside(symbol: Symbol, excludedNode: Node): boolean;
  isProjectShape(node: Node | undefined): boolean;
  isProjectConstructibleObject(node: Node | undefined): boolean;
  isProjectDeclaration(node: Node | undefined): boolean;
}
