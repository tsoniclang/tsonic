/**
 * .csproj file generation for multiple output types
 */

import {
  BuildConfig,
  NuGetPackage,
  OutputConfig,
  ExecutableConfig,
  LibraryConfig,
  ConsoleAppConfig,
  PackageMetadata,
} from "./types.js";

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
 * Capitalize first letter
 */
const capitalizeFirst = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 * Generate NuGet package metadata properties
 */
const generatePackageMetadata = (metadata: PackageMetadata): string => {
  const authors = metadata.authors.join(";");
  const tags = metadata.tags?.join(";") || "";

  return `
    <PackageId>${metadata.id}</PackageId>
    <Version>${metadata.version}</Version>
    <Authors>${authors}</Authors>
    <Description>${metadata.description}</Description>${metadata.projectUrl ? `\n    <PackageProjectUrl>${metadata.projectUrl}</PackageProjectUrl>` : ""}${metadata.license ? `\n    <PackageLicenseExpression>${metadata.license}</PackageLicenseExpression>` : ""}${tags ? `\n    <PackageTags>${tags}</PackageTags>` : ""}`;
};

/**
 * Generate property group for executable output
 */
const generateExecutableProperties = (
  config: BuildConfig,
  execConfig: ExecutableConfig
): string => {
  const nativeAotSettings = execConfig.nativeAot
    ? `
    <!-- NativeAOT settings -->
    <PublishAot>true</PublishAot>
    <PublishSingleFile>${execConfig.singleFile}</PublishSingleFile>
    <PublishTrimmed>${execConfig.trimmed}</PublishTrimmed>
    <InvariantGlobalization>${execConfig.invariantGlobalization}</InvariantGlobalization>
    <StripSymbols>${execConfig.stripSymbols}</StripSymbols>

    <!-- Optimization -->
    <OptimizationPreference>${capitalizeFirst(execConfig.optimization)}</OptimizationPreference>
    <IlcOptimizationPreference>${capitalizeFirst(execConfig.optimization)}</IlcOptimizationPreference>`
    : `
    <PublishSingleFile>${execConfig.singleFile}</PublishSingleFile>
    <SelfContained>${execConfig.selfContained}</SelfContained>`;

  return `  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>${config.dotnetVersion}</TargetFramework>
    <RootNamespace>${config.rootNamespace}</RootNamespace>
    <AssemblyName>${config.outputName}</AssemblyName>
    <Nullable>enable</Nullable>
    <ImplicitUsings>false</ImplicitUsings>${nativeAotSettings}
  </PropertyGroup>`;
};

/**
 * Generate property group for library output
 */
const generateLibraryProperties = (
  config: BuildConfig,
  libConfig: LibraryConfig
): string => {
  const targetFrameworks = libConfig.targetFrameworks.join(";");
  const isMultiTarget = libConfig.targetFrameworks.length > 1;
  const targetProp = isMultiTarget
    ? `<TargetFrameworks>${targetFrameworks}</TargetFrameworks>`
    : `<TargetFramework>${libConfig.targetFrameworks[0]}</TargetFramework>`;

  const docSettings = libConfig.generateDocumentation
    ? `
    <GenerateDocumentationFile>true</GenerateDocumentationFile>`
    : "";

  const symbolSettings = libConfig.includeSymbols
    ? `
    <DebugType>embedded</DebugType>
    <DebugSymbols>true</DebugSymbols>`
    : `
    <DebugType>none</DebugType>`;

  const packageSettings =
    libConfig.packable && libConfig.packageMetadata
      ? generatePackageMetadata(libConfig.packageMetadata)
      : "";

  return `  <PropertyGroup>
    <OutputType>Library</OutputType>
    ${targetProp}
    <RootNamespace>${config.rootNamespace}</RootNamespace>
    <AssemblyName>${config.outputName}</AssemblyName>
    <Nullable>enable</Nullable>
    <ImplicitUsings>false</ImplicitUsings>${docSettings}${symbolSettings}
    <IsPackable>${libConfig.packable}</IsPackable>${packageSettings}
  </PropertyGroup>`;
};

/**
 * Generate property group for console app output
 */
const generateConsoleAppProperties = (
  config: BuildConfig,
  consoleConfig: ConsoleAppConfig
): string => {
  return `  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>${consoleConfig.targetFramework}</TargetFramework>
    <RootNamespace>${config.rootNamespace}</RootNamespace>
    <AssemblyName>${config.outputName}</AssemblyName>
    <Nullable>enable</Nullable>
    <ImplicitUsings>false</ImplicitUsings>
    <PublishSingleFile>${consoleConfig.singleFile}</PublishSingleFile>
    <SelfContained>${consoleConfig.selfContained}</SelfContained>
  </PropertyGroup>`;
};

/**
 * Generate property group based on output type
 */
const generatePropertyGroup = (
  config: BuildConfig,
  outputConfig: OutputConfig
): string => {
  switch (outputConfig.type) {
    case "executable":
      return generateExecutableProperties(config, outputConfig);
    case "library":
      return generateLibraryProperties(config, outputConfig);
    case "console-app":
      return generateConsoleAppProperties(config, outputConfig);
  }
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

  const propertyGroup = generatePropertyGroup(config, config.outputConfig);

  return `<Project Sdk="Microsoft.NET.Sdk">
${propertyGroup}${packageRefs}${runtimeRef}
</Project>
`;
};

/**
 * Legacy function for backward compatibility
 * @deprecated Use generateCsproj with outputConfig instead
 */
export const generateCsprojLegacy = (
  config: BuildConfig & {
    invariantGlobalization?: boolean;
    stripSymbols?: boolean;
    optimizationPreference?: "Size" | "Speed";
  }
): string => {
  // Convert legacy config to new format
  const execConfig: ExecutableConfig = {
    type: "executable",
    nativeAot: true,
    singleFile: true,
    trimmed: true,
    stripSymbols: config.stripSymbols ?? true,
    optimization: config.optimizationPreference ?? "Speed",
    invariantGlobalization: config.invariantGlobalization ?? true,
    selfContained: true,
  };

  const newConfig: BuildConfig = {
    ...config,
    outputConfig: execConfig,
  };

  return generateCsproj(newConfig);
};
