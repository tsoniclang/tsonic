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
  add package <dll> <types> Add a CLR package to the project
  generate [entry]          Generate C# code only
  build [entry]             Build native executable
  run [entry] [-- args...]  Build and run executable

GLOBAL OPTIONS:
  -h, --help                Show help
  -v, --version             Show version
  -V, --verbose             Verbose output
  -q, --quiet               Suppress output
  -c, --config <file>       Config file path (default: tsonic.json)

GENERATE/BUILD/RUN OPTIONS:
  -s, --src <dir>           Source root directory
  -o, --out <path>          Output directory (generate) or file (build)
  -n, --namespace <ns>      Root namespace override
  -r, --rid <rid>           Runtime identifier (e.g., linux-x64)
  -O, --optimize <level>    Optimization: size or speed
  -k, --keep-temp           Keep build artifacts
  --no-strip                Keep debug symbols

PROJECT INIT OPTIONS:
  --nodejs                  Enable Node.js interop (installs @tsonic/nodejs)
  --js                      Enable JS stdlib (installs @tsonic/js)
  --pure                    Use PascalCase CLR naming
  --skip-types              Skip installing type declarations
  --types-version <ver>     Version of type declarations to install

EXAMPLES:
  tsonic project init
  tsonic project init --nodejs
  tsonic project init --js
  tsonic project init --pure
  tsonic add package ./lib/MyLib.dll @company/mylib-types
  tsonic generate src/App.ts
  tsonic build src/App.ts --rid linux-x64
  tsonic run src/App.ts -- --arg1 value1

LEARN MORE:
  Documentation: https://tsonic.dev/docs
  GitHub: https://github.com/tsoniclang/tsonic
`);
};
