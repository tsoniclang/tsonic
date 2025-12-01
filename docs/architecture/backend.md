# Backend Package

The backend handles .NET compilation.

## Overview

The backend:

1. Generates .csproj project files
2. Generates Program.cs entry points
3. Invokes dotnet CLI commands
4. Handles NativeAOT configuration

## Project Generation

### generateCsproj

`project-generator.ts`:

```typescript
const csproj = generateCsproj({
  rootNamespace: "MyApp",
  outputName: "app",
  dotnetVersion: "net10.0",
  outputConfig: {
    type: "executable",
    nativeAot: true,
    singleFile: true,
    trimmed: true,
    stripSymbols: true,
    optimization: "Speed",
    invariantGlobalization: true,
    selfContained: true,
  },
  packages: [{ name: "Newtonsoft.Json", version: "13.0.3" }],
  assemblyReferences: [
    { name: "Tsonic.Runtime", hintPath: "../runtime/Tsonic.Runtime.dll" },
  ],
});
```

### Generated .csproj

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net10.0</TargetFramework>
    <RootNamespace>MyApp</RootNamespace>
    <AssemblyName>app</AssemblyName>
    <Nullable>enable</Nullable>
    <ImplicitUsings>false</ImplicitUsings>

    <!-- NativeAOT settings -->
    <PublishAot>true</PublishAot>
    <PublishSingleFile>true</PublishSingleFile>
    <PublishTrimmed>true</PublishTrimmed>
    <InvariantGlobalization>true</InvariantGlobalization>
    <StripSymbols>true</StripSymbols>

    <!-- Optimization -->
    <OptimizationPreference>Speed</OptimizationPreference>
    <IlcOptimizationPreference>Speed</IlcOptimizationPreference>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Newtonsoft.Json" Version="13.0.3" />
  </ItemGroup>

  <ItemGroup>
    <Reference Include="Tsonic.Runtime">
      <HintPath>../runtime/Tsonic.Runtime.dll</HintPath>
    </Reference>
  </ItemGroup>
</Project>
```

## Program Generation

### generateProgramCs

`program-generator.ts`:

```typescript
const programCs = generateProgramCs({
  namespace: "MyApp.src",
  className: "App",
  methodName: "main",
  isAsync: false,
  needsProgram: true,
  runtime: "js",
});
```

### Generated Program.cs

Sync main:

```csharp
public class Program
{
    public static void Main(string[] args)
    {
        MyApp.src.App.main();
    }
}
```

Async main:

```csharp
public class Program
{
    public static async Task Main(string[] args)
    {
        await MyApp.src.App.main();
    }
}
```

With JS runtime initialization:

```csharp
public class Program
{
    public static void Main(string[] args)
    {
        Tsonic.Runtime.Runtime.Initialize();
        MyApp.src.App.main();
    }
}
```

## dotnet CLI Wrapper

### checkDotnetInstalled

`dotnet.ts`:

```typescript
const checkDotnetInstalled = (): Result<string, string> => {
  const result = spawnSync("dotnet", ["--version"]);
  if (result.status !== 0) {
    return error("dotnet SDK not found");
  }
  return ok(result.stdout.toString().trim());
};
```

### detectRid

Runtime identifier detection:

```typescript
const detectRid = (): string => {
  const platform = process.platform;
  const arch = process.arch;

  const platformMap: Record<string, string> = {
    linux: "linux",
    darwin: "osx",
    win32: "win",
  };

  const archMap: Record<string, string> = {
    x64: "x64",
    arm64: "arm64",
  };

  return `${platformMap[platform]}-${archMap[arch]}`;
};
```

## Build Orchestration

### Executable Build

```typescript
const buildExecutable = (config, generatedDir): Result<string, string> => {
  // 1. Run dotnet publish
  const publishArgs = [
    "publish",
    "tsonic.csproj",
    "-c",
    "Release",
    "-r",
    config.rid,
    "--nologo",
  ];

  const result = spawnSync("dotnet", publishArgs, {
    cwd: generatedDir,
  });

  if (result.status !== 0) {
    return error(`dotnet publish failed: ${result.stderr}`);
  }

  // 2. Copy output binary
  const publishDir = `${generatedDir}/bin/Release/${config.dotnetVersion}/${config.rid}/publish`;
  const sourceBinary = `${publishDir}/${config.outputName}`;
  const targetBinary = `out/${config.outputName}`;

  copyFileSync(sourceBinary, targetBinary);
  chmodSync(targetBinary, 0o755);

  return ok(targetBinary);
};
```

### Library Build

```typescript
const buildLibrary = (config, generatedDir): Result<string, string> => {
  // 1. Run dotnet build
  const buildArgs = ["build", "tsonic.csproj", "-c", "Release", "--nologo"];

  const result = spawnSync("dotnet", buildArgs, {
    cwd: generatedDir,
  });

  // 2. Copy artifacts to dist/
  for (const framework of config.targetFrameworks) {
    const buildDir = `${generatedDir}/bin/Release/${framework}`;
    copyFileSync(`${buildDir}/${config.outputName}.dll`, `dist/${framework}/`);
  }

  return ok("dist/");
};
```

## Output Types

### ExecutableConfig

```typescript
type ExecutableConfig = {
  type: "executable";
  nativeAot: boolean;
  singleFile: boolean;
  trimmed: boolean;
  stripSymbols: boolean;
  optimization: "Size" | "Speed";
  invariantGlobalization: boolean;
  selfContained: boolean;
};
```

### LibraryConfig

```typescript
type LibraryConfig = {
  type: "library";
  targetFrameworks: string[];
  generateDocumentation: boolean;
  includeSymbols: boolean;
  packable: boolean;
  packageMetadata?: PackageMetadata;
};
```

### ConsoleAppConfig

Non-AOT executable:

```typescript
type ConsoleAppConfig = {
  type: "console-app";
  selfContained: boolean;
  singleFile: boolean;
  targetFramework: string;
};
```

## NuGet Integration

### Package References

```typescript
type NuGetPackage = {
  name: string;
  version: string;
};

// In .csproj
<PackageReference Include="Newtonsoft.Json" Version="13.0.3" />
```

### Assembly References

For local DLLs (like Tsonic.Runtime):

```typescript
type AssemblyReference = {
  name: string;
  hintPath: string;
};

// In .csproj
<Reference Include="Tsonic.Runtime">
  <HintPath>../runtime/Tsonic.Runtime.dll</HintPath>
</Reference>
```

## Error Handling

Build errors include:

- dotnet not installed
- Compilation errors
- Missing dependencies
- NativeAOT failures

```typescript
type BuildResult =
  | { ok: true; outputPath: string; buildDir: string }
  | { ok: false; error: string; buildDir?: string };
```
