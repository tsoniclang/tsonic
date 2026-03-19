import type * as ts from "typescript";
import type { SourceFunctionSignatureSurface as SourceFunctionSignatureDef } from "../../aikya/source-function-surfaces.js";

export type FacadeInfo = {
  readonly namespace: string;
  readonly facadeDtsPath: string;
  readonly facadeJsPath: string;
  readonly moduleSpecifier: string;
  readonly internalIndexDtsPath: string;
};

export type WrapperImport = {
  readonly source: string;
  readonly importedName: string;
  readonly localName: string;
  readonly aliasName: string;
};

export type MemberOverride = {
  readonly namespace: string;
  readonly className: string;
  readonly memberName: string;
  readonly sourceTypeText?: string;
  readonly replaceWithSourceType?: boolean;
  readonly isOptional?: boolean;
  readonly emitOptionalPropertySyntax?: boolean;
  readonly wrappers: readonly WrapperImport[];
};

export type SourceTypeAliasDef = {
  readonly typeParameters: readonly string[];
  readonly type: ts.TypeNode;
  readonly typeText: string;
};

export type SourceMemberTypeDef = {
  readonly typeNode: ts.TypeNode;
  readonly typeText: string;
  readonly isOptional: boolean;
};

export type SourceTypeImport = {
  readonly source: string;
  readonly importedName: string;
};

export type SourceTypeImportBinding = {
  readonly source: string;
  readonly importedName: string;
  readonly localName: string;
};

export type ModuleSourceIndex = {
  readonly fileKey: string;
  readonly wrapperImportsByLocalName: ReadonlyMap<string, SourceTypeImport>;
  readonly typeImportsByLocalName: ReadonlyMap<string, SourceTypeImport>;
  readonly typeAliasesByName: ReadonlyMap<string, SourceTypeAliasDef>;
  readonly exportedFunctionSignaturesByName: ReadonlyMap<
    string,
    readonly SourceFunctionSignatureDef[]
  >;
  readonly memberTypesByClassAndMember: ReadonlyMap<
    string,
    ReadonlyMap<string, SourceMemberTypeDef>
  >;
};

export type SourceModuleInfo = {
  readonly absoluteFilePath: string;
  readonly fileKey: string;
  readonly namespace: string;
  readonly sourceIndex: ModuleSourceIndex;
  readonly exportedClassNames: readonly string[];
  readonly exportedInterfaceNames: readonly string[];
  readonly exportedTypeAliasNames: readonly string[];
  readonly allInterfaceNames: readonly string[];
  readonly allTypeAliasNames: readonly string[];
  readonly localRelativeImports: readonly string[];
  readonly hasLocalReexports: boolean;
};
