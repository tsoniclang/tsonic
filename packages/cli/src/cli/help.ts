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
  emit [entry]              Generate C# code only
  build [entry]             Build native executable
  run [entry] [-- args...]  Build and run executable

GLOBAL OPTIONS:
  -h, --help                Show help
  -v, --version             Show version
  -V, --verbose             Verbose output
  -q, --quiet               Suppress output
  -c, --config <file>       Config file path (default: tsonic.json)

EMIT/BUILD/RUN OPTIONS:
  -s, --src <dir>           Source root directory
  -o, --out <path>          Output directory (emit) or file (build)
  -n, --namespace <ns>      Root namespace override
  -r, --rid <rid>           Runtime identifier (e.g., linux-x64)
  -O, --optimize <level>    Optimization: size or speed
  -k, --keep-temp           Keep build artifacts
  --no-strip                Keep debug symbols

EXAMPLES:
  tsonic project init
  tsonic emit src/main.ts
  tsonic build src/main.ts --rid linux-x64
  tsonic run src/main.ts -- --arg1 value1

LEARN MORE:
  Documentation: https://tsonic.dev/docs
  GitHub: https://github.com/tsoniclang/tsonic
`);
};
