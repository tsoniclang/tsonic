import type {
  IrClassDeclaration,
  IrEnumDeclaration,
  IrExpression,
  IrInterfaceDeclaration,
  IrOverloadFamilyMember,
  IrModule,
  IrParameter,
  IrStatement,
  IrType,
  IrTypeAliasDeclaration,
} from "@tsonic/frontend";
import * as ts from "typescript";
import type { FirstPartySemanticSurface } from "./semantic-surface.js";
import type { SourceFunctionSignatureSurface as SourceFunctionSignatureDef } from "../../package-manifests/source-function-surfaces.js";

export type FirstPartyBindingsMethod = {
  readonly stableId: string;
  readonly clrName: string;
  readonly normalizedSignature: string;
  readonly semanticSignature?: {
    readonly typeParameters?: readonly string[];
    readonly parameters: readonly IrParameter[];
    readonly returnType?: IrType;
  };
  readonly overloadFamily?: IrOverloadFamilyMember;
  readonly emitScope?: string;
  readonly provenance?: string;
  readonly arity: number;
  readonly parameterCount: number;
  readonly isStatic: boolean;
  readonly isAbstract: boolean;
  readonly isVirtual: boolean;
  readonly isOverride: boolean;
  readonly isSealed: boolean;
  readonly declaringClrType: string;
  readonly declaringAssemblyName: string;
  readonly parameterModifiers?: ReadonlyArray<{
    readonly index: number;
    readonly modifier: "ref" | "out" | "in";
  }>;
  readonly isExtensionMethod: boolean;
  readonly metadataToken?: number;
};

export type FirstPartyBindingsProperty = {
  readonly stableId: string;
  readonly clrName: string;
  readonly normalizedSignature: string;
  readonly semanticType?: IrType;
  readonly semanticOptional?: boolean;
  readonly isStatic: boolean;
  readonly isAbstract: boolean;
  readonly isVirtual: boolean;
  readonly isOverride: boolean;
  readonly isIndexer: boolean;
  readonly hasGetter: boolean;
  readonly hasSetter: boolean;
  readonly declaringClrType: string;
  readonly declaringAssemblyName: string;
  readonly metadataToken?: number;
};

export type FirstPartyBindingsField = {
  readonly stableId: string;
  readonly clrName: string;
  readonly normalizedSignature: string;
  readonly semanticType?: IrType;
  readonly semanticOptional?: boolean;
  readonly isStatic: boolean;
  readonly isReadOnly: boolean;
  readonly isLiteral: boolean;
  readonly declaringClrType: string;
  readonly declaringAssemblyName: string;
  readonly metadataToken?: number;
};

export type FirstPartyBindingsConstructor = {
  readonly normalizedSignature: string;
  readonly isStatic: boolean;
  readonly parameterCount: number;
};

export type FirstPartyBindingsType = {
  readonly stableId: string;
  readonly clrName: string;
  readonly alias: string;
  readonly assemblyName: string;
  readonly kind: "Class" | "Interface" | "Struct" | "Enum";
  readonly accessibility: "Public" | "Internal" | "Private" | "Protected";
  readonly isAbstract: boolean;
  readonly isSealed: boolean;
  readonly isStatic: boolean;
  readonly arity: number;
  readonly typeParameters?: readonly string[];
  readonly methods: readonly FirstPartyBindingsMethod[];
  readonly properties: readonly FirstPartyBindingsProperty[];
  readonly fields: readonly FirstPartyBindingsField[];
  readonly events: readonly unknown[];
  readonly constructors: readonly FirstPartyBindingsConstructor[];
  readonly metadataToken?: number;
};

export type FirstPartyBindingsExport = {
  readonly kind: "method" | "property" | "field" | "functionType";
  readonly clrName: string;
  readonly declaringClrType: string;
  readonly declaringAssemblyName: string;
  readonly semanticType?: IrType;
  readonly semanticOptional?: boolean;
  readonly semanticSignature?: {
    readonly typeParameters?: readonly string[];
    readonly parameters: readonly IrParameter[];
    readonly returnType?: IrType;
  };
};

export type FirstPartyBindingsFile = {
  readonly namespace: string;
  readonly contributingAssemblies: readonly string[];
  readonly semanticSurface: FirstPartySemanticSurface;
  readonly dotnet: {
    readonly types: readonly FirstPartyBindingsType[];
    readonly exports?: Readonly<Record<string, FirstPartyBindingsExport>>;
  };
  readonly producer: {
    readonly tool: "tsonic";
    readonly mode: "tsonic-firstparty";
  };
};

export type ExportedSymbolKind =
  | "function"
  | "variable"
  | "class"
  | "interface"
  | "enum"
  | "typeAlias";

export type ExportedSymbol = {
  readonly exportName: string;
  readonly localName: string;
  readonly kind: ExportedSymbolKind;
  readonly declaration: IrStatement;
  readonly declaringNamespace: string;
  readonly declaringClassName: string;
  readonly declaringFilePath: string;
};

export type ResolvedExportDeclaration = {
  readonly declaration: IrStatement;
  readonly module: IrModule;
  readonly clrName: string;
};

export type ModuleContainerEntry = {
  readonly module: IrModule;
  readonly methods: {
    readonly exportName: string;
    readonly localName: string;
    readonly declaration: Extract<IrStatement, { kind: "functionDeclaration" }>;
    readonly localTypeNameRemaps: ReadonlyMap<string, string>;
    readonly sourceSignatures: readonly SourceFunctionSignatureDef[];
  }[];
  readonly variables: {
    readonly exportName: string;
    readonly localName: string;
    readonly declaration: Extract<IrStatement, { kind: "variableDeclaration" }>;
    readonly declarator: FirstPartyValueDeclarator | undefined;
    readonly localTypeNameRemaps: ReadonlyMap<string, string>;
    readonly sourceType: SourceValueTypeDef | undefined;
    readonly sourceSignatures: readonly SourceFunctionSignatureDef[];
  }[];
};

export type FirstPartyValueDeclarator = {
  readonly kind: "variableDeclarator";
  readonly name: {
    readonly kind: "identifierPattern";
    readonly name: string;
  };
  readonly type?: IrType;
  readonly initializer?: IrExpression;
};

export type FirstPartyValueExportFacade =
  | {
      readonly kind: "function";
      readonly declaration: Extract<
        IrStatement,
        { kind: "functionDeclaration" }
      >;
      readonly sourceSignatures?: readonly SourceFunctionSignatureDef[];
      readonly localTypeNameRemaps: ReadonlyMap<string, string>;
    }
  | {
      readonly kind: "variable";
      readonly declarator: FirstPartyValueDeclarator | undefined;
      readonly localTypeNameRemaps: ReadonlyMap<string, string>;
      readonly sourceType?: SourceValueTypeDef;
      readonly sourceSignatures?: readonly SourceFunctionSignatureDef[];
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

export type SourceTypeAliasDef = {
  readonly typeParametersText: string;
  readonly typeParameterNames: readonly string[];
  readonly type: ts.TypeNode;
  readonly typeText: string;
};

export type SourceMemberTypeDef = {
  readonly typeNode: ts.TypeNode;
  readonly typeText: string;
  readonly isOptional: boolean;
};

export type SourceAnonymousTypeLiteralDef = {
  readonly typeText: string;
  readonly members: ReadonlyMap<string, SourceMemberTypeDef>;
};

export type SourceValueTypeDef = {
  readonly typeText: string;
};

export type AnonymousStructuralAliasInfo = {
  readonly name: string;
  readonly typeParameters: readonly string[];
};

export type ModuleSourceIndex = {
  readonly fileKey: string;
  readonly wrapperImportsByLocalName: ReadonlyMap<string, SourceTypeImport>;
  readonly typeImportsByLocalName: ReadonlyMap<string, SourceTypeImport>;
  readonly typeAliasesByName: ReadonlyMap<string, SourceTypeAliasDef>;
  readonly exportedTypeDeclarationNames: ReadonlySet<string>;
  readonly exportedFunctionSignaturesByName: ReadonlyMap<
    string,
    readonly SourceFunctionSignatureDef[]
  >;
  readonly exportedValueTypesByName: ReadonlyMap<string, SourceValueTypeDef>;
  readonly memberTypesByClassAndMember: ReadonlyMap<
    string,
    ReadonlyMap<string, SourceMemberTypeDef>
  >;
  readonly anonymousTypeLiteralsByShape: ReadonlyMap<
    string,
    SourceAnonymousTypeLiteralDef
  >;
};

export type InternalHelperTypeKind =
  | "class"
  | "interface"
  | "enum"
  | "typeAlias";

export type InternalHelperTypeDeclaration = {
  readonly key: string;
  readonly moduleFileKey: string;
  readonly declaringNamespace: string;
  readonly emittedName: string;
  readonly originalName: string;
  readonly kind: InternalHelperTypeKind;
  readonly declaration:
    | IrClassDeclaration
    | IrInterfaceDeclaration
    | IrEnumDeclaration
    | IrTypeAliasDeclaration;
};

export type WrapperImport = {
  readonly source: string;
  readonly importedName: string;
  readonly localName: string;
  readonly aliasName: string;
};

export type MemberOverride = {
  readonly className: string;
  readonly memberName: string;
  readonly sourceTypeText?: string;
  readonly replaceWithSourceType?: boolean;
  readonly isOptional?: boolean;
  readonly emitOptionalPropertySyntax?: boolean;
  readonly wrappers: readonly WrapperImport[];
};

export type SourceAliasPlan = {
  readonly declaration: IrTypeAliasDeclaration;
  readonly sourceAlias?: SourceTypeAliasDef;
  readonly typeImportsByLocalName: ReadonlyMap<string, SourceTypeImport>;
};

export type NamespacePlan = {
  readonly namespace: string;
  readonly typeDeclarations: readonly ExportedSymbol[];
  readonly internalHelperTypeDeclarations: readonly InternalHelperTypeDeclaration[];
  readonly moduleContainers: readonly ModuleContainerEntry[];
  readonly crossNamespaceReexports: {
    readonly dtsStatements: readonly string[];
    readonly jsValueStatements: readonly string[];
    readonly valueExportNames: ReadonlySet<string>;
  };
  readonly crossNamespaceTypeDeclarations: readonly ExportedSymbol[];
  readonly sourceAliases: readonly SourceAliasPlan[];
  readonly memberOverrides: readonly MemberOverride[];
  readonly internalTypeImports: readonly SourceTypeImportBinding[];
  readonly facadeTypeImports: readonly SourceTypeImportBinding[];
  readonly wrapperImports: readonly WrapperImport[];
  readonly valueExports: readonly {
    readonly exportName: string;
    readonly binding: FirstPartyBindingsExport;
    readonly facade: FirstPartyValueExportFacade;
  }[];
};
