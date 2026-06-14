import type {
  FrameworkReferenceConfig,
  PackageReferenceConfig,
} from "../../types.js";

export type SerializedSourceTypeDescriptor = {
  readonly kind: string;
  readonly [key: string]: unknown;
};

export type SerializedOverloadFamilyDescriptor = {
  readonly familyId: string;
  readonly ownerKind: "function" | "method" | "constructor";
  readonly publicName: string;
  readonly publicMembers: readonly unknown[];
  readonly resolutionMetadata: Readonly<Record<string, unknown>>;
  readonly [key: string]: unknown;
};

export type ManifestDotnet = {
  readonly frameworkReferences?: readonly FrameworkReferenceConfig[];
  readonly packageReferences?: readonly PackageReferenceConfig[];
  readonly msbuildProperties?: Readonly<Record<string, string>>;
};

export type ManifestSurfaceMode = string;

export type PackageManifestProducer = {
  readonly tool: "tsonic" | "tsbindgen";
  readonly version: string;
  readonly mode: "tsonic-firstparty" | "external-clr";
};

export type NormalizedNugetDependency = {
  readonly source:
    | "dotnet.framework"
    | "dotnet.package"
    | "testDotnet.framework"
    | "testDotnet.package";
  readonly id: string;
  readonly version?: string;
};

export type NormalizedBindingsManifest = {
  readonly bindingVersion: 1;
  readonly sourceManifest: "tsonic-package" | "tsonic-bindings";
  readonly packageName: string;
  readonly packageVersion: string;
  readonly surfaceMode: ManifestSurfaceMode;
  readonly requiredTypeRoots: readonly string[];
  readonly assemblyName?: string;
  readonly assemblyVersion?: string;
  readonly targetFramework?: string;
  readonly runtimePackages: readonly string[];
  readonly nugetDependencies: readonly NormalizedNugetDependency[];
  readonly producer?: PackageManifestProducer;
  readonly dotnet?: ManifestDotnet;
  readonly testDotnet?: ManifestDotnet;
  readonly semanticMetadata?: {
    readonly version: 1;
    readonly aliases?: Readonly<Record<string, AliasMetadataV1>>;
    readonly overloadFamilies?: Readonly<
      Record<string, SerializedOverloadFamilyDescriptor>
    >;
  };
};

export type AliasMetadataV1 = {
  readonly aliasId: string;
  readonly definition: SerializedSourceTypeDescriptor;
  readonly isRecursive: boolean;
  readonly typeParameters: readonly string[];
};
