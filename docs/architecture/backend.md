# Backend

The backend owns generated project layout and .NET toolchain execution.

## Responsibilities

- write `Program.cs`
- write `tsonic.csproj`
- place emitted `.cs` files
- invoke `dotnet build` / `publish` / `test` / `pack`
- manage NativeAOT vs managed output differences

## Output Modes

- executable
- managed library
- NativeAOT shared library
- NativeAOT static library

## Important Runtime Inputs

- `Tsonic.Runtime`
- optional surface/runtime DLLs such as `Tsonic.JSRuntime` or `nodejs.dll`
- workspace `libraries`
- workspace/package/framework references

## Build Reuse

`--no-generate` exists for workflows where generated C# is intentionally augmented by external tooling before the backend build step.
