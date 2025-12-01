# Build Output

Understanding what Tsonic generates and how the build process works.

## What Gets Emitted

When you run `tsonic emit` or `tsonic build`, Tsonic generates C# code from your TypeScript.

### Example

**TypeScript Input** (`src/main.ts`):

```typescript
import { File } from "System.IO";

export function main(): void {
  const message = "Hello from Tsonic!";
  console.log(message);
  File.WriteAllText("output.txt", message);
}
```

**C# Output** (`main.cs`):

```csharp
using System.IO;
using Tsonic.Runtime;
using static Tsonic.Runtime.Globals;

namespace MyApp
{
    public static class main
    {
        public static void main()
        {
            var message = "Hello from Tsonic!";
            console.log(message);
            File.WriteAllText("output.txt", message);
        }
    }
}
```

**Generated Program.cs**:

```csharp
using MyApp;

public static class Program
{
    public static void Main(string[] args)
    {
        main.main();
    }
}
```

## Build Directory Structure

When building, Tsonic creates a temporary build directory:

```
.tsonic/
└── build/
    └── <hash>/
        ├── tsonic.csproj
        ├── Program.cs        # If needed
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

The final executable is copied to your specified output location (default: `./tsonic-app`).

## Generated .csproj File

Tsonic automatically generates a `.csproj` file with NativeAOT settings:

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
    <RootNamespace>MyApp</RootNamespace>
  </PropertyGroup>

  <!-- NuGet packages -->
  <ItemGroup>
    <!-- Tsonic runtime - always included -->
    <PackageReference Include="Tsonic.Runtime" Version="0.0.1" />

    <!-- Auto-detected from imports -->
    <PackageReference Include="System.Text.Json" Version="8.0.0" />
  </ItemGroup>
</Project>
```

## Output Characteristics

The final executable has these properties:

| Property         | Value                          |
| ---------------- | ------------------------------ |
| **Format**       | Single native executable       |
| **Runtime**      | None required (self-contained) |
| **Size**         | 10-50 MB (depends on features) |
| **Startup**      | Fast (no JIT compilation)      |
| **Platform**     | Native for target RID          |
| **Dependencies** | None (statically linked)       |

## Build Optimizations

### Speed Optimization (default)

```bash
tsonic build main.ts --optimize speed
```

Prioritizes runtime performance:

- Optimized for execution speed
- May be slightly larger
- Best for production services

### Size Optimization

```bash
tsonic build main.ts --optimize size
```

Prioritizes binary size:

- Smaller executable
- May sacrifice some performance
- Best for CLI tools, lambdas

## Keeping Build Artifacts

For debugging, keep temporary files:

```bash
tsonic build main.ts --keep-temp
```

The build directory stays at `.tsonic/build/<hash>/` and you can:

- Inspect generated C# code
- Check the `.csproj` file
- See compiler warnings
- Debug build issues

## Cross-Platform Builds

Build for different platforms:

```bash
# Windows
tsonic build main.ts --rid win-x64 --out dist/myapp.exe

# Linux
tsonic build main.ts --rid linux-x64 --out dist/myapp-linux

# macOS
tsonic build main.ts --rid osx-arm64 --out dist/myapp-mac
```

Each build creates a platform-specific native executable.

## NuGet Package Detection

Tsonic automatically detects required NuGet packages from your imports:

```typescript
// Your TypeScript
import { JsonSerializer } from "System.Text.Json";
import { DbContext } from "Microsoft.EntityFrameworkCore";
```

Tsonic adds to `.csproj`:

```xml
<PackageReference Include="System.Text.Json" Version="8.0.0" />
<PackageReference Include="Microsoft.EntityFrameworkCore" Version="8.0.0" />
```

You can also specify packages manually:

```bash
tsonic build main.ts --packages Newtonsoft.Json:13.0.3
```

## Debugging Build Output

View generated C# without building:

```bash
tsonic emit main.ts --out generated/
ls generated/
cat generated/main.cs
```

Build with verbose output:

```bash
tsonic build main.ts --verbose
```

See all dotnet publish output:

```bash
tsonic build main.ts --verbose --keep-temp
cat .tsonic/build/<hash>/bin/Release/net8.0/<rid>/publish/*.log
```

## Build Times

Typical build times:

| Project Size         | Time    |
| -------------------- | ------- |
| Single file          | 5-10s   |
| Small (5-10 files)   | 10-20s  |
| Medium (20-50 files) | 20-40s  |
| Large (100+ files)   | 1-2 min |

Most time is spent in:

1. TypeScript parsing (~10%)
2. C# emission (~10%)
3. dotnet publish (~80%)

The `run` command caches builds for faster iteration.

## Common Issues

### Build Failed - .NET SDK Not Found

```
ERROR TSN5001: .NET SDK not found
```

**Solution**: Install .NET SDK 8.0+ from [dot.net](https://dot.net)

### Build Failed - NativeAOT Not Supported

```
ERROR: Your platform doesn't support NativeAOT
```

**Solution**: Check [supported platforms](https://learn.microsoft.com/en-us/dotnet/core/deploying/native-aot/)

### Build Succeeded But Large File

If your executable is unexpectedly large:

```bash
# Try size optimization
tsonic build main.ts --optimize size

# Check what's included
tsonic build main.ts --keep-temp --verbose
dotnet build .tsonic/build/<hash>/tsonic.csproj -c Release -r <rid> -v detailed
```

## Next Steps

- **[CLI Reference](./cli.md)** - All build options
- **[Diagnostics](./diagnostics.md)** - Troubleshooting build errors
- **[Troubleshooting](./troubleshooting.md)** - Common issues
