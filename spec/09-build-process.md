# Build Process (NativeAOT Compilation)

## Overview

The build process transforms TypeScript to a native executable via C# and NativeAOT.

## Build Pipeline

```
1. TypeScript → IR → C#
2. Generate .csproj
3. Copy runtime files
4. dotnet publish (NativeAOT)
5. Copy output binary
```

## Build Directory Structure

```
.tsonic/
└── build/
    └── <hash>/           # Unique per build
        ├── tsonic.csproj
        ├── Program.cs    # If needed
        ├── TsonicRuntime.cs
        ├── src/
        │   ├── main.cs
        │   ├── models/
        │   │   └── User.cs
        │   └── services/
        │       └── DataService.cs
        └── bin/
            └── Release/
                └── net8.0/
                    └── <rid>/
                        └── publish/
                            └── tsonic  # Final executable
```

## Project File Generation

### Minimal .csproj

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
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

    <!-- Output -->
    <AssemblyName>tsonic</AssemblyName>
    <RootNamespace>$(TsonicRootNamespace)</RootNamespace>
  </PropertyGroup>

  <!-- NuGet packages if needed -->
  <ItemGroup>
    <!-- Auto-detected from imports -->
    <PackageReference Include="System.Text.Json" Version="8.0.0" />
    <!-- Add others as needed -->
  </ItemGroup>
</Project>
```

### With Dependencies

```xml
<ItemGroup>
  <PackageReference Include="Microsoft.EntityFrameworkCore.Sqlite" Version="8.0.0" />
  <PackageReference Include="Microsoft.Extensions.Http" Version="8.0.0" />
</ItemGroup>
```

## Build Steps

### Step 1: Create Build Directory

```typescript
// backend/dotnet.ts
import { mkdirSync } from "fs";
import { createHash } from "crypto";

function createBuildDir(entryFile: string): string {
  const hash = createHash("md5").update(entryFile).digest("hex").slice(0, 8);
  const buildDir = `.tsonic/build/${hash}`;
  mkdirSync(buildDir, { recursive: true });
  return buildDir;
}
```

### Step 2: Copy Generated C# Files

Preserve directory structure:

```typescript
function copyGeneratedFiles(emittedFiles: Map<string, string>, buildDir: string) {
  for (const [tsPath, csContent] of emittedFiles) {
    // src/models/User.ts → <buildDir>/src/models/User.cs
    const csPath = tsPath.replace(/\.ts$/, ".cs");
    const fullPath = path.join(buildDir, csPath);

    mkdirSync(path.dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, csContent);
  }
}
```

### Step 3: Copy Runtime

```typescript
function copyRuntime(buildDir: string) {
  const runtimePath = path.join(__dirname, "../runtime/TsonicRuntime.cs");
  copyFileSync(runtimePath, path.join(buildDir, "TsonicRuntime.cs"));
}
```

### Step 4: Generate Program.cs

Only if entry doesn't have Main:

```typescript
function generateProgramCs(entryInfo: EntryInfo, buildDir: string): void {
  if (!entryInfo.needsProgram) return;

  const template = `
using System;
using System.Threading.Tasks;
using Tsonic.Runtime;
using static Tsonic.Runtime.Globals;
using ${entryInfo.namespace};

public static class Program
{
    public static ${entryInfo.isAsync ? "async Task" : "void"} Main(string[] args)
    {
        ${entryInfo.isAsync ? "await " : ""}${entryInfo.className}.${entryInfo.methodName}();
    }
}`;

  writeFileSync(path.join(buildDir, "Program.cs"), template.trim());
}
```

### Step 5: Generate .csproj

```typescript
function generateCsproj(config: BuildConfig, buildDir: string): void {
  const csproj = `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
    <RootNamespace>${config.rootNamespace}</RootNamespace>
    <AssemblyName>${config.outputName || "tsonic"}</AssemblyName>

    <PublishAot>true</PublishAot>
    <PublishSingleFile>true</PublishSingleFile>
    <PublishTrimmed>true</PublishTrimmed>
    <InvariantGlobalization>${config.invariantGlobalization}</InvariantGlobalization>
    <StripSymbols>${config.stripSymbols}</StripSymbols>
  </PropertyGroup>

  <ItemGroup>
    ${config.packages.map(p => `<PackageReference Include="${p.name}" Version="${p.version}" />`).join("\n    ")}
  </ItemGroup>
</Project>`;

  writeFileSync(path.join(buildDir, "tsonic.csproj"), csproj);
}
```

### Step 6: Execute dotnet publish

```typescript
import { spawnSync } from "child_process";

function publishNativeAot(buildDir: string, rid: string): void {
  const args = [
    "publish",
    "tsonic.csproj",
    "-c", "Release",
    "-r", rid,
    "-p:PublishAot=true",
    "-p:PublishSingleFile=true",
    "--no-self-contained"  // Use installed .NET runtime
  ];

  const result = spawnSync("dotnet", args, {
    cwd: buildDir,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    throw new Error(`dotnet publish failed with code ${result.status}`);
  }
}
```

### Step 7: Copy Output Binary

```typescript
function copyOutputBinary(buildDir: string, rid: string, outputPath: string): void {
  const publishDir = path.join(
    buildDir,
    "bin/Release/net8.0",
    rid,
    "publish"
  );

  const exeName = process.platform === "win32" ? "tsonic.exe" : "tsonic";
  const binaryPath = path.join(publishDir, exeName);

  copyFileSync(binaryPath, outputPath);
  chmodSync(outputPath, 0o755); // Make executable on Unix
}
```

## Runtime Identifiers (RID)

Common RIDs for NativeAOT:

| Platform | RID | Notes |
|----------|-----|-------|
| Windows x64 | `win-x64` | Windows 10+ |
| Windows ARM64 | `win-arm64` | Windows 11 ARM |
| Linux x64 | `linux-x64` | Most Linux distros |
| Linux ARM64 | `linux-arm64` | ARM Linux |
| Linux musl x64 | `linux-musl-x64` | Alpine Linux |
| macOS x64 | `osx-x64` | Intel Macs |
| macOS ARM64 | `osx-arm64` | M1/M2/M3 Macs |

## Auto-detection

```typescript
function detectRid(): string {
  const platform = process.platform;
  const arch = process.arch;

  const ridMap = {
    "darwin-x64": "osx-x64",
    "darwin-arm64": "osx-arm64",
    "linux-x64": "linux-x64",
    "linux-arm64": "linux-arm64",
    "win32-x64": "win-x64",
    "win32-arm64": "win-arm64"
  };

  const key = `${platform}-${arch}`;
  return ridMap[key] || "linux-x64"; // Default fallback
}
```

## Build Optimizations

### Release vs Debug

Always use Release for NativeAOT:

```xml
<Configuration>Release</Configuration>
<Optimize>true</Optimize>
<DebugType>none</DebugType>
```

### Size Optimizations

```xml
<!-- Minimize size -->
<OptimizationPreference>Size</OptimizationPreference>
<IlcOptimizationPreference>Size</IlcOptimizationPreference>
<IlcFoldIdenticalMethodBodies>true</IlcFoldIdenticalMethodBodies>
```

### Speed Optimizations

```xml
<!-- Maximize performance -->
<OptimizationPreference>Speed</OptimizationPreference>
<IlcOptimizationPreference>Speed</IlcOptimizationPreference>
<TieredCompilation>false</TieredCompilation>
```

## Package Detection

Scan imports to auto-add NuGet packages:

```typescript
const packageMap = {
  "Microsoft.EntityFrameworkCore": {
    name: "Microsoft.EntityFrameworkCore.Sqlite",
    version: "8.0.0"
  },
  "System.Data.SqlClient": {
    name: "System.Data.SqlClient",
    version: "4.8.6"
  },
  // Add more as needed
};

function detectPackages(imports: Set<string>): Package[] {
  const packages: Package[] = [];

  for (const imp of imports) {
    for (const [namespace, pkg] of Object.entries(packageMap)) {
      if (imp.startsWith(namespace)) {
        packages.push(pkg);
        break;
      }
    }
  }

  return packages;
}
```

## Error Handling

### Common Build Errors

1. **dotnet not found**
   ```
   ERROR: .NET SDK not found. Install from https://dot.net
   ```

2. **Unsupported RID**
   ```
   ERROR: Runtime identifier 'exotic-os' not supported for NativeAOT
   ```

3. **Missing dependencies**
   ```
   ERROR: Package 'Microsoft.EntityFrameworkCore' not found
   ```

4. **NativeAOT limitations**
   ```
   ERROR: Reflection-heavy code may not work with NativeAOT
   ```

## Clean Build

Remove temporary files:

```typescript
function cleanBuild(buildDir: string, keepTemp: boolean): void {
  if (!keepTemp) {
    rmSync(buildDir, { recursive: true, force: true });
  } else {
    console.log(`Build artifacts kept in: ${buildDir}`);
  }
}
```

## Complete Build Function

```typescript
export async function buildNativeAot(
  entryFile: string,
  options: BuildOptions
): Promise<string> {
  const buildDir = createBuildDir(entryFile);

  try {
    // 1. Emit C# files
    const emitted = await emitCSharp(entryFile);

    // 2. Copy files to build dir
    copyGeneratedFiles(emitted.files, buildDir);
    copyRuntime(buildDir);

    // 3. Generate project files
    if (emitted.entryInfo.needsProgram) {
      generateProgramCs(emitted.entryInfo, buildDir);
    }

    const packages = detectPackages(emitted.imports);
    generateCsproj({
      rootNamespace: options.namespace,
      packages,
      outputName: options.outputName,
      invariantGlobalization: true,
      stripSymbols: options.stripSymbols ?? true
    }, buildDir);

    // 4. Build with dotnet
    const rid = options.rid || detectRid();
    publishNativeAot(buildDir, rid);

    // 5. Copy output
    const outputPath = options.output || "./tsonic-app";
    copyOutputBinary(buildDir, rid, outputPath);

    // 6. Cleanup
    cleanBuild(buildDir, options.keepTemp);

    return outputPath;
  } catch (error) {
    cleanBuild(buildDir, false);
    throw error;
  }
}
```

## Build Output

Final executable characteristics:

- **Single file**: All dependencies included
- **No .NET runtime required**: Fully self-contained
- **Native code**: Platform-specific machine code
- **Fast startup**: No JIT compilation
- **Size**: 10-50MB depending on features used