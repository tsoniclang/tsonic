# Phase 7: Backend (NativeAOT Compilation)

## Purpose

This phase orchestrates the .NET build process, generating .csproj files, restoring dependencies, and compiling C# code to native executables using NativeAOT.

---

## 1. Overview

**Responsibility:** .csproj generation, dotnet CLI orchestration, NativeAOT compilation

**Package:** `@tsonic/backend`

**Location:** `packages/backend/src/`

**Input:** C# source files (.cs) from Phase 6

**Output:** Native executable binary (.exe or no extension on Unix)

---

## 2. Key Components

### 2.1 Project File Generation

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net10.0</TargetFramework>
    <PublishAot>true</PublishAot>
    <InvariantGlobalization>true</InvariantGlobalization>
    <Nullable>enable</Nullable>
    <RootNamespace>MyApp</RootNamespace>
  </PropertyGroup>

  <ItemGroup>
    <!-- Include all generated C# files -->
    <Compile Include="**/*.cs" />
  </ItemGroup>

  <ItemGroup>
    <!-- Reference Tsonic.Runtime -->
    <PackageReference Include="Tsonic.Runtime" Version="1.0.0" />

    <!-- Additional .NET packages if needed -->
    <PackageReference Include="System.Collections.Immutable" Version="10.0.0" />
  </ItemGroup>
</Project>
```

### 2.2 Build Process

```typescript
const buildNativeExecutable = async (
  csharpFiles: Map<string, string>,
  outputDir: string,
  options: BuildOptions
): Promise<BuildResult> => {
  // 1. Create output directory
  await fs.mkdir(outputDir, { recursive: true });

  // 2. Write C# files
  for (const [path, content] of csharpFiles) {
    const fullPath = join(outputDir, path);
    await fs.mkdir(dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, "utf-8");
  }

  // 3. Generate .csproj file
  const projectContent = generateProjectFile(options);
  await fs.writeFile(join(outputDir, "project.csproj"), projectContent, "utf-8");

  // 4. Restore dependencies
  await execAsync("dotnet restore", { cwd: outputDir });

  // 5. Publish with NativeAOT
  const publishArgs = [
    "dotnet publish",
    "-c Release",
    "-r " + options.runtime, // win-x64, linux-x64, osx-arm64
    "-o bin",
    "--self-contained",
  ].join(" ");

  await execAsync(publishArgs, { cwd: outputDir });

  // 6. Return executable path
  const exeName = options.runtime.startsWith("win") ? "project.exe" : "project";
  return {
    success: true,
    executablePath: join(outputDir, "bin", exeName),
  };
};
```

---

## 3. NativeAOT Configuration

### 3.1 Required Properties

**PublishAot**: `true`
- Enables Native AOT compilation
- Produces single-file native executable
- No runtime dependencies required

**InvariantGlobalization**: `true`
- Disables culture-specific formatting
- Reduces binary size significantly
- Required for minimal runtime

**TrimMode**: `link`
- Removes unused code
- Reduces binary size
- Required for NativeAOT

### 3.2 Runtime Identifiers

```
win-x64        # Windows 64-bit
win-arm64      # Windows ARM64
linux-x64      # Linux 64-bit
linux-arm64    # Linux ARM64
osx-x64        # macOS Intel
osx-arm64      # macOS Apple Silicon
```

---

## 4. Build Optimizations

### 4.1 Size Optimization

```xml
<PropertyGroup>
  <OptimizationPreference>Size</OptimizationPreference>
  <IlcOptimizationPreference>Size</IlcOptimizationPreference>
  <IlcFoldIdenticalMethodBodies>true</IlcFoldIdenticalMethodBodies>
</PropertyGroup>
```

### 4.2 Speed Optimization

```xml
<PropertyGroup>
  <OptimizationPreference>Speed</OptimizationPreference>
  <IlcOptimizationPreference>Speed</IlcOptimizationPreference>
  <TieredCompilation>false</TieredCompilation>
</PropertyGroup>
```

---

## 5. Build Output

### 5.1 Directory Structure

```
output/
├── project.csproj           # Generated project file
├── *.cs                     # Generated C# files
├── obj/                     # Build intermediates
│   └── ...
└── bin/                     # Output binaries
    ├── project.exe          # Windows executable
    ├── project              # Unix executable
    └── project.pdb          # Debug symbols
```

### 5.2 Binary Characteristics

**Size:**
- Small program (~3-5 MB)
- Medium program (~8-15 MB)
- Large program (~20-40 MB)

**Startup Time:**
- Cold start: < 10ms
- No JIT compilation
- Instant execution

**Performance:**
- Native machine code
- Comparable to C/C++/Rust
- No GC pauses during execution

---

## 6. Error Handling

### 6.1 Common Errors

**AOT Analysis Warnings:**
```
IL3050: Using member 'X' which has RequiresDynamicCodeAttribute can break functionality when AOT compiling.
```

**Resolution:** Avoid reflection and dynamic code generation in Tsonic code.

**Missing Dependencies:**
```
error NU1101: Unable to find package Tsonic.Runtime
```

**Resolution:** Ensure Tsonic.Runtime is published to NuGet or local feed.

---

## 7. Performance Characteristics

### 7.1 Build Times

**Small Project (10 files, 1000 LOC):**
- C# generation: ~100ms
- dotnet restore: ~2s
- AOT compilation: ~10s
- **Total: ~12s**

**Medium Project (100 files, 10000 LOC):**
- C# generation: ~500ms
- dotnet restore: ~3s
- AOT compilation: ~30s
- **Total: ~34s**

**Large Project (1000 files, 100000 LOC):**
- C# generation: ~5s
- dotnet restore: ~5s
- AOT compilation: ~120s
- **Total: ~130s**

### 7.2 Incremental Builds

Incremental compilation is handled by dotnet CLI:
- Only recompiles changed files
- Caches intermediate build artifacts
- Typically 5-10x faster than clean builds

---

## 8. See Also

- [00-overview.md](00-overview.md) - System architecture
- [07-phase-emitter.md](07-phase-emitter.md) - C# emission (previous phase)
- [09-phase-runtime.md](09-phase-runtime.md) - Runtime APIs

---

**Document Statistics:**
- Lines: ~250
- Sections: 8
- Coverage: Complete backend compilation with NativeAOT
