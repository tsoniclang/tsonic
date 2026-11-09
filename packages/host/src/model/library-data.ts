import type { Presence } from "./foundation-data.js";

export type SourcePrimitive = "bool" | "char" | "int8" | "uint8"
  | "int16" | "uint16" | "int32" | "uint32" | "int64" | "uint64"
  | "native-int" | "native-uint" | "float16" | "float32" | "float64"
  | "decimal" | "int128" | "uint128";
export type PassingMode = "by-value" | "byref-readonly" | "byref-readwrite"
  | "byref-writeonly-must-init" | "borrow-shared" | "borrow-mut" | "move";
export type WellKnownSymbol = "asyncDispose" | "asyncIterator" | "dispose"
  | "hasInstance" | "isConcatSpreadable" | "iterator" | "match" | "matchAll"
  | "replace" | "search" | "species" | "split" | "toPrimitive"
  | "toStringTag" | "unscopables";
export type LibraryPropertyName = string
  | { readonly kind: "identifier"; readonly text: string }
  | { readonly kind: "string-literal"; readonly text: string }
  | { readonly kind: "number-literal"; readonly value: number }
  | { readonly kind: "well-known-symbol"; readonly name: WellKnownSymbol };
export interface LibraryTypeParameter {
  readonly name: string;
  readonly constraints: readonly LibraryType[];
  readonly defaultType: Presence<LibraryType>;
  readonly variance: "in" | "out" | "invariant";
}
export type LibraryType =
  | { readonly kind: "any" | "unknown" | "void" | "never" | "undefined"
      | "boolean" | "string" | "number" | "bigint" | "object" }
  | { readonly kind: "source-primitive"; readonly name: SourcePrimitive }
  | { readonly kind: "source-global"; readonly name: string;
      readonly typeArguments: readonly LibraryType[] }
  | { readonly kind: "type-parameter"; readonly name: string }
  | { readonly kind: "array"; readonly elementType: LibraryType }
  | { readonly kind: "tuple"; readonly elementTypes: readonly LibraryType[] }
  | { readonly kind: "union" | "intersection"; readonly types: readonly LibraryType[] }
  | { readonly kind: "function"; readonly id: string;
      readonly parameters: readonly LibraryParameter[];
      readonly returnType: LibraryType;
      readonly typeParameters: readonly LibraryTypeParameter[] }
  | { readonly kind: "literal"; readonly value: string | number | boolean | null }
  | { readonly kind: "bigint-literal"; readonly value: string }
  | { readonly kind: "provider-ref"; readonly moduleSpecifier: string;
      readonly exportName: string; readonly localName: Presence<string>;
      readonly namespaceImport: Presence<string>;
      readonly typeArguments: readonly LibraryType[] };
export interface LibraryParameter {
  readonly name: string;
  readonly type: LibraryType;
  readonly passingMode: PassingMode;
  readonly optional: boolean;
  readonly rest: boolean;
  readonly defaultType: Presence<LibraryType>;
}
export interface LibrarySignature {
  readonly id: string;
  readonly name: Presence<string>;
  readonly accessibility: "public" | "protected" | "protected-internal";
  readonly parameters: readonly LibraryParameter[];
  readonly returnType: Presence<LibraryType>;
  readonly typeParameters: readonly LibraryTypeParameter[];
  readonly documentation: Presence<string>;
}
export interface LibraryMember {
  readonly id: string;
  readonly name: LibraryPropertyName;
  readonly kind: "method" | "constructor" | "property" | "field" | "indexer";
  readonly static: boolean;
  readonly readonly: boolean;
  readonly optional: boolean;
  readonly type: Presence<LibraryType>;
  readonly signatures: readonly LibrarySignature[];
  readonly documentation: Presence<string>;
}
export interface LibraryDeclaration {
  readonly id: string;
  readonly name: string;
  readonly exportName: string;
  readonly exportKind: "named" | "default";
  readonly kind: "type" | "value" | "namespace" | "function"
    | "class" | "interface" | "enum";
  readonly typeFamily: Presence<{
    readonly exportName: string; readonly typeArgumentCount: number;
  }>;
  readonly type: Presence<LibraryType>;
  readonly typeParameters: readonly LibraryTypeParameter[];
  readonly heritage: readonly {
    readonly kind: "extends" | "implements"; readonly type: LibraryType;
  }[];
  readonly members: readonly LibraryMember[];
  readonly signatures: readonly LibrarySignature[];
  readonly documentation: Presence<string>;
}
export interface LibraryImport {
  readonly moduleSpecifier: string;
  readonly defaultImport: Presence<string>;
  readonly namespaceImport: Presence<string>;
  readonly typeOnly: boolean;
  readonly namedImports: readonly {
    readonly exportedName: string; readonly kind: "type" | "value" | "namespace";
  }[];
}
export interface LibraryModuleIdentity {
  readonly providerId: string;
  readonly providerVersion: string;
  readonly packageName: string;
  readonly moduleSpecifier: string;
  readonly providerModuleId: string;
}
export interface LibraryExportIdentity {
  readonly module: LibraryModuleIdentity;
  readonly exportId: string;
  readonly memberId: Presence<string>;
  readonly signatureId: Presence<string>;
}
export interface LibraryRole {
  readonly identity: LibraryExportIdentity;
  readonly role: string;
}
export interface LibraryModule {
  readonly identity: LibraryModuleIdentity;
  readonly imports: readonly LibraryImport[];
  readonly exports: readonly LibraryDeclaration[];
  readonly roles: readonly LibraryRole[];
}
export interface LibraryText {
  readonly fileName: string;
  readonly sourceText: string;
  readonly module: Presence<LibraryModuleIdentity>;
}
export interface SourceLibrary {
  readonly id: string;
  readonly modules: readonly LibraryModule[];
  readonly declarations: readonly LibraryText[];
}
