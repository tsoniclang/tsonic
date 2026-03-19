import type {
  FrameworkReferenceConfig,
  PackageReferenceConfig,
} from "../../types.js";

export type ManifestDotnet = {
  readonly frameworkReferences?: readonly FrameworkReferenceConfig[];
  readonly packageReferences?: readonly PackageReferenceConfig[];
  readonly msbuildProperties?: Readonly<Record<string, string>>;
};

export type ManifestSurfaceMode = string;

export type AikyaProducer = {
  readonly tool: "tsonic" | "tsbindgen";
  readonly version: string;
  readonly mode: "aikya-firstparty" | "external-clr";
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
  readonly sourceManifest: "aikya" | "legacy";
  readonly packageName: string;
  readonly packageVersion: string;
  readonly surfaceMode: ManifestSurfaceMode;
  readonly requiredTypeRoots: readonly string[];
  readonly assemblyName?: string;
  readonly assemblyVersion?: string;
  readonly targetFramework?: string;
  readonly bindingsRoot?: string;
  readonly runtimePackages: readonly string[];
  readonly nugetDependencies: readonly NormalizedNugetDependency[];
  readonly producer?: AikyaProducer;
  readonly dotnet?: ManifestDotnet;
  readonly testDotnet?: ManifestDotnet;
};
