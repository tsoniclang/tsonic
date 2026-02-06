/**
 * CLI help message
 */

import { VERSION } from "./constants.js";

/**
 * Show help message
 */
export const showHelp = (): void => {
  console.log(`
Tsonic - TypeScript to C# to NativeAOT compiler v${VERSION}

USAGE:
  tsonic <command> [options]

COMMANDS:
  init                     Initialize a new Tsonic workspace (and default project)
  add js                    Add JSRuntime interop (@tsonic/js + DLLs)
  add nodejs                Add Node.js interop (@tsonic/nodejs + DLLs)
  add package <dll> [types] Add a local DLL (and optional bindings) to the workspace
  add nuget <id> <ver> [t]  Add a NuGet package (and optional bindings) to the workspace
  add framework <ref> [t]   Add a .NET FrameworkReference (and optional bindings) to the workspace
  remove nuget <id>         Remove a NuGet package reference from the workspace
  update nuget <id> <ver>   Update a NuGet package reference in the workspace
  restore                   Restore NuGet deps and (re)generate local bindings (workspace-scoped)
  generate [entry]          Generate C# code only
  build [entry]             Build executable or library
  run [entry] [-- args...]  Build and run executable
  test                      Generate a test assembly and run dotnet test
  pack                      Create a NuGet package from a library

GLOBAL OPTIONS:
  -h, --help                Show help
  -v, --version             Show version
  -V, --verbose             Verbose output
  -q, --quiet               Suppress output
  -c, --config <file>       Workspace config path (default: auto-detect tsonic.workspace.json)
  --strict                  Strict bindings generation (fail on constructor-constraint loss)
  --project <name>          Select project under packages/<name>/

GENERATE/BUILD/RUN OPTIONS:
  -s, --src <dir>           Source root directory
  -o, --out <name>          Output name (binary/assembly)
  -n, --namespace <ns>      Root namespace override
  -r, --rid <rid>           Runtime identifier (e.g., linux-x64)
  -O, --optimize <level>    Optimization: size or speed
  -k, --keep-temp           Keep build artifacts
  --no-generate             Build/run from existing generated output (do not re-run generate)
  --no-strip                Keep debug symbols
  -L, --lib <path>          External library path (repeatable)

ADD/RESTORE OPTIONS:
  --deps <dir>              Additional directory to probe for referenced assemblies (repeatable)

PROJECT INIT OPTIONS:
  --js                     Enable JSRuntime interop (installs @tsonic/js)
  --nodejs                  Enable Node.js interop (installs @tsonic/nodejs)
  --skip-types              Skip installing type declarations
  --types-version <ver>     Version of type declarations to install

EXAMPLES:
  tsonic init
  tsonic init --js
  tsonic init --nodejs
  tsonic restore
  tsonic add js
  tsonic add nodejs
  tsonic add package ./lib/MyLib.dll @company/mylib-types
  tsonic add package ./path/MyLib.dll                  # auto-generate types (tsbindgen)
  tsonic add nuget Microsoft.Extensions.Logging 10.0.0  # auto-generate types (tsbindgen)
  tsonic add framework Microsoft.AspNetCore.App @tsonic/aspnetcore
  tsonic remove nuget Microsoft.Extensions.Logging
  tsonic update nuget Microsoft.Extensions.Logging 10.0.1
  tsonic restore --strict
  tsonic generate src/App.ts --project my-app
  tsonic build src/App.ts --rid linux-x64 --project my-app
  tsonic run src/App.ts --project my-app -- --arg1 value1
  tsonic test --project my-app
  tsonic pack

LEARN MORE:
  Documentation: https://tsonic.org/docs
  GitHub: https://github.com/tsoniclang/tsonic
`);
};
