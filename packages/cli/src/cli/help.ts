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
  project init              Initialize a new Tsonic project
  add js                    Add JSRuntime interop (@tsonic/js + DLLs)
  add nodejs                Add Node.js interop (@tsonic/nodejs + DLLs)
  add package <dll> [types] Add a local DLL (and optional bindings) to the project
  add nuget <id> <ver> [t]  Add a NuGet package (and optional bindings) to the project
  add framework <ref> [t]   Add a .NET FrameworkReference (and optional bindings) to the project
  remove nuget <id>         Remove a NuGet package reference from the project
  update nuget <id> <ver>   Update a NuGet package reference in the project
  restore                   Restore NuGet deps and (re)generate local bindings
  generate [entry]          Generate C# code only
  build [entry]             Build executable or library
  run [entry] [-- args...]  Build and run executable
  pack                      Create a NuGet package from a library

GLOBAL OPTIONS:
  -h, --help                Show help
  -v, --version             Show version
  -V, --verbose             Verbose output
  -q, --quiet               Suppress output
  -c, --config <file>       Config file path (default: tsonic.json)
  --strict                  Strict bindings generation (fail on constructor-constraint loss)

GENERATE/BUILD/RUN OPTIONS:
  -s, --src <dir>           Source root directory
  -o, --out <name>          Output name (binary/assembly)
  -n, --namespace <ns>      Root namespace override
  -r, --rid <rid>           Runtime identifier (e.g., linux-x64)
  -O, --optimize <level>    Optimization: size or speed
  -k, --keep-temp           Keep build artifacts
  --no-strip                Keep debug symbols
  -L, --lib <path>          External library path (repeatable)

ADD/RESTORE OPTIONS:
  --deps <dir>              Additional directory to probe for referenced assemblies (repeatable)
  --incremental             Skip bindings re-generation when inputs are unchanged

PROJECT INIT OPTIONS:
  --js                     Enable JSRuntime interop (installs @tsonic/js)
  --nodejs                  Enable Node.js interop (installs @tsonic/nodejs)
  --pure                    Use PascalCase .NET bindings
  --skip-types              Skip installing type declarations
  --types-version <ver>     Version of type declarations to install

EXAMPLES:
  tsonic project init
  tsonic project init --js
  tsonic project init --nodejs
  tsonic project init --pure
  tsonic restore
  tsonic restore --incremental
  tsonic add js
  tsonic add nodejs
  tsonic add package ./lib/MyLib.dll @company/mylib-types
  tsonic add package ./path/MyLib.dll                  # auto-generate types (tsbindgen)
  tsonic add nuget Microsoft.Extensions.Logging 10.0.0  # auto-generate types (tsbindgen)
  tsonic add framework Microsoft.AspNetCore.App @tsonic/aspnetcore
  tsonic remove nuget Microsoft.Extensions.Logging
  tsonic update nuget Microsoft.Extensions.Logging 10.0.1
  tsonic restore --strict
  tsonic generate src/App.ts
  tsonic build src/App.ts --rid linux-x64
  tsonic run src/App.ts -- --arg1 value1
  tsonic pack

LEARN MORE:
  Documentation: https://tsonic.org/docs
  GitHub: https://github.com/tsoniclang/tsonic
`);
};
