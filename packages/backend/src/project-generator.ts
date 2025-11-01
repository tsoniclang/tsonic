/**
 * .csproj file generation for NativeAOT compilation
 */

import { BuildConfig, NuGetPackage } from "./types.js";

/**
 * Generate package references XML
 */
const formatPackageReferences = (packages: readonly NuGetPackage[]): string => {
  if (packages.length === 0) {
    return "";
  }

  const refs = packages
    .map(
      (pkg) =>
        `    <PackageReference Include="${pkg.name}" Version="${pkg.version}" />`
    )
    .join("\n");

  return `
  <ItemGroup>
${refs}
  </ItemGroup>`;
};

/**
 * Generate complete .csproj file content
 */
export const generateCsproj = (config: BuildConfig): string => {
  const packageRefs = formatPackageReferences(config.packages);
  const runtimeRef = config.runtimePath
    ? `
  <ItemGroup>
    <ProjectReference Include="${config.runtimePath}" />
  </ItemGroup>`
    : "";

  return `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>${config.dotnetVersion}</TargetFramework>
    <RootNamespace>${config.rootNamespace}</RootNamespace>
    <AssemblyName>${config.outputName}</AssemblyName>
    <Nullable>enable</Nullable>
    <ImplicitUsings>false</ImplicitUsings>

    <!-- NativeAOT settings -->
    <PublishAot>true</PublishAot>
    <PublishSingleFile>true</PublishSingleFile>
    <PublishTrimmed>true</PublishTrimmed>
    <InvariantGlobalization>${config.invariantGlobalization}</InvariantGlobalization>
    <StripSymbols>${config.stripSymbols}</StripSymbols>

    <!-- Optimization -->
    <OptimizationPreference>${config.optimizationPreference}</OptimizationPreference>
    <IlcOptimizationPreference>${config.optimizationPreference}</IlcOptimizationPreference>
  </PropertyGroup>${packageRefs}${runtimeRef}
</Project>
`;
};
