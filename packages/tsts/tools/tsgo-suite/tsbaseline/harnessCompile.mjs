// Faithful port of the pinned TS-Go test-runner compile pipeline:
//   - test_case_parser.go: tsconfig.json/jsconfig.json unit discovery and parsing
//   - compiler_runner.go newCompilerTest: currentDirectory, unit partition
//   - harnessutil.go CompileFiles/CompileFilesEx: default options, test-config option
//     parsing (getOptionValue + ParseCompilerOptions), in-memory vfs construction
//     (vfstest.FromMap over upstream unit coordinates, /.lib folder, symlinks),
//     program root names (.json/.tsbuildinfo excluded), program creation
//   - compileFilesWithHost: all-stage diagnostics, then emit
// The program compiles the AUTHORED unit contents over an in-memory vfs keyed by
// upstream coordinates (default currentDirectory /.src), so every baseline writer sees
// upstream unit names verbatim — no real-filesystem coordinate translation.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runHarnessCompile } from "./typeSymbolWalker.mjs";

const distRoot = new URL("../../../dist/src/", import.meta.url);
const dist = (p) => import(new URL(p, distRoot).href);

const [
  { FromMap, Symlink },
  { WrapFS, LibPath },
  { NewCompilerHost },
  { NewProgram },
  { OptionsDeclarations },
  { ParseCompilerOptions },
  { ParseListTypeOption },
  { CommandLineOption_Elements, CommandLineOption_EnumMap },
  { NewParsedCommandLine },
  { ParseJsonSourceFileConfigFileContent },
  { OrderedMap_Get },
  { ParseSourceFile },
  { ScriptKindJSON },
  { GetNormalizedAbsolutePath, GetBaseFileName, GetDirectoryPath, ToPath, CombinePaths },
  { NewLineKindCRLF, NewLineKindNone },
  { TSTrue, TSUnknown },
] = await Promise.all([
  dist("internal/vfs/vfstest/vfstest.js"),
  dist("internal/bundled/bundled.js"),
  dist("internal/compiler/host.js"),
  dist("internal/compiler/program.js"),
  dist("internal/tsoptions/declscompiler.js"),
  dist("internal/tsoptions/parsinghelpers.js"),
  dist("internal/tsoptions/commandlineparser.js"),
  dist("internal/tsoptions/commandlineoption.js"),
  dist("internal/tsoptions/parsedcommandline.js"),
  dist("internal/tsoptions/tsconfigparsing.js"),
  dist("internal/collections/ordered_map.js"),
  dist("internal/parser/parser/statements-declarations.js"),
  dist("internal/core/scriptkind.js"),
  dist("internal/tspath/path.js"),
  dist("internal/core/compileroptions.js"),
  dist("internal/core/tristate.js"),
]);

const srcFolder = "/.src";
const testLibFolder = "/.lib";
const vendorRoot = fileURLToPath(new URL("../../../_vendor/typescript-go/", import.meta.url));
const testLibRoot = join(vendorRoot, "_submodules/TypeScript/tests/lib");

// harnessutil.go extra compiler options accepted by tests beyond OptionsDeclarations.
const harnessExtraCompilerOptions = [
  { Name: "allowNonTsExtensions", Kind: "boolean" },
  { Name: "noErrorTruncation", Kind: "boolean" },
  { Name: "suppressOutputPathCheck", Kind: "boolean" },
  { Name: "noCheck", Kind: "boolean" },
];

// harnessutil.go harnessCommandLineOptions (typescriptversion is skipped before lookup).
const harnessOptionKinds = new Map([
  ["usecasesensitivefilenames", "boolean"],
  ["baselinefile", "string"],
  ["includebuiltfile", "string"],
  ["filename", "string"],
  ["libfiles", "list"],
  ["noimplicitreferences", "boolean"],
  ["currentdirectory", "string"],
  ["symlink", "string"],
  ["link", "string"],
  ["notypesandsymbols", "boolean"],
  ["fullemitpaths", "boolean"],
  ["reportdiagnostics", "boolean"],
  ["capturesuggestions", "boolean"],
]);

// harnessutil.go GetConfigNameFromFileName
export function getConfigNameFromFileName(fileName) {
  const basenameLower = GetBaseFileName(fileName).toLowerCase();
  if (basenameLower === "tsconfig.json" || basenameLower === "jsconfig.json") {
    return basenameLower;
  }
  return "";
}

function findCompilerOption(name) {
  const lower = name.toLowerCase();
  for (const option of OptionsDeclarations) {
    if (option.Name.toLowerCase() === lower) {
      return option;
    }
  }
  for (const option of harnessExtraCompilerOptions) {
    if (option.Name.toLowerCase() === lower) {
      return option;
    }
  }
  return undefined;
}

// harnessutil.go getOptionValue
function getOptionValue(option, value, cwd) {
  switch (option.Kind) {
    case "string":
      return option.IsFilePath ? GetNormalizedAbsolutePath(value, cwd) : value;
    case "number": {
      const parsed = globalThis.Number.parseInt(value, 10);
      if (globalThis.Number.isNaN(parsed)) {
        throw new globalThis.Error(`Value for option '${option.Name}' must be a number, got: ${value}`);
      }
      return parsed;
    }
    case "boolean":
      switch (value.toLowerCase()) {
        case "true":
          return true;
        case "false":
          return false;
        default:
          throw new globalThis.Error(`Value for option '${option.Name}' must be a boolean, got: ${value}`);
      }
    case "enum": {
      const enumMap = CommandLineOption_EnumMap(option);
      const [enumVal, ok] = enumMap !== undefined ? OrderedMap_Get(enumMap, value.toLowerCase()) : [undefined, false];
      if (!ok) {
        throw new globalThis.Error(`Unknown value '${value}' for compiler option '${option.Name}'`);
      }
      return enumVal;
    }
    case "list":
    case "listOrElement": {
      const [listVal, errors] = ParseListTypeOption(option, value);
      const elements = CommandLineOption_Elements(option);
      if (elements !== undefined && elements.IsFilePath) {
        return listVal.map((item) => GetNormalizedAbsolutePath(item, cwd));
      }
      if ((errors ?? []).length > 0) {
        throw new globalThis.Error(`Unknown value '${value}' for compiler option '${option.Name}'`);
      }
      return listVal;
    }
    default:
      throw new globalThis.Error(`Object type options like '${option.Name}' are not supported`);
  }
}

// harnessutil.go SetOptionsFromTestConfig
function setOptionsFromTestConfig(configuration, compilerOptions, harnessOptions, cwd) {
  for (const [name, value] of configuration) {
    if (name === "typescriptversion") {
      continue;
    }
    const commandLineOption = findCompilerOption(name);
    if (commandLineOption !== undefined) {
      const parsedValue = getOptionValue(commandLineOption, value, cwd);
      const errors = ParseCompilerOptions(commandLineOption.Name, parsedValue, compilerOptions);
      if ((errors ?? []).length > 0) {
        throw new globalThis.Error(`Error parsing value '${value}' for compiler option '${commandLineOption.Name}'.`);
      }
      continue;
    }
    const harnessKind = harnessOptionKinds.get(name);
    if (harnessKind !== undefined) {
      harnessOptions[name] = getOptionValue({ Name: name, Kind: harnessKind }, value, cwd);
      continue;
    }
    throw new globalThis.Error(`Unknown compiler option '${name}'.`);
  }
}

let testLibFolderMapCache;
function testLibFolderMap() {
  if (testLibFolderMapCache === undefined) {
    testLibFolderMapCache = new Map();
    const walk = (dir, prefix) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          walk(join(dir, entry.name), `${prefix}/${entry.name}`);
        } else if (entry.isFile()) {
          testLibFolderMapCache.set(`${prefix}/${entry.name}`, readFileSync(join(dir, entry.name), "utf8"));
        }
      }
    };
    walk(testLibRoot, testLibFolder);
  }
  return testLibFolderMapCache;
}

// test_case_parser.go: parse a tsconfig.json/jsconfig.json unit against a vfs holding
// every unit at its upstream coordinate.
function parseTsconfigUnit(tsconfigUnit, allUnits, currentDirectory) {
  const allFiles = new Map();
  for (const unit of allUnits) {
    allFiles.set(GetNormalizedAbsolutePath(unit.fileName, currentDirectory), unit.content);
  }
  const configFs = WrapFS(FromMap(allFiles, true));
  const parseConfigHost = {
    FS: () => configFs,
    GetCurrentDirectory: () => currentDirectory,
  };
  const configFileName = GetNormalizedAbsolutePath(tsconfigUnit.fileName, currentDirectory);
  const path = ToPath(tsconfigUnit.fileName, currentDirectory, true);
  const configJson = ParseSourceFile({ FileName: configFileName, Path: path }, tsconfigUnit.content, ScriptKindJSON);
  const tsConfigSourceFile = { SourceFile: configJson };
  const configDir = GetDirectoryPath(configFileName);
  // Go passes nil slices; the ported worker indexes .length, so empty arrays stand in.
  return ParseJsonSourceFileConfigFileContent(
    tsConfigSourceFile,
    parseConfigHost,
    configDir,
    undefined, /*existingOptions*/
    undefined, /*existingOptionsRaw*/
    configFileName,
    [], /*resolutionStack*/
    [], /*extraFileExtensions*/
    undefined, /*extendedConfigCache*/
  );
}

// The whole pipeline. `units` are the parsed test units ({fileName, content}, parsed
// order, tsconfig unit included); `symlinks` maps link -> target in unit coordinates;
// `configuration` is the merged global+variation option map (lowercased keys).
export function compileHarnessCase({ units, symlinks, configuration }) {
  // compiler_runner.go: currentDirectory from the harness config, default /.src.
  const currentDirectory = GetNormalizedAbsolutePath(configuration.get("currentdirectory") ?? "", srcFolder);

  // test_case_parser.go: extract the first tsconfig.json/jsconfig.json unit.
  let tsConfig;
  let tsConfigFileUnit;
  const testUnits = [];
  for (const unit of units) {
    if (tsConfigFileUnit === undefined && getConfigNameFromFileName(unit.fileName) !== "") {
      tsConfigFileUnit = unit;
      tsConfig = parseTsconfigUnit(unit, units, currentDirectory);
      continue;
    }
    testUnits.push(unit);
  }

  const makeTestFile = (unit) => ({
    unitName: GetNormalizedAbsolutePath(unit.fileName, currentDirectory),
    content: unit.content,
  });

  // compiler_runner.go newCompilerTest: unit partition.
  const tsConfigFiles = tsConfigFileUnit !== undefined ? [makeTestFile(tsConfigFileUnit)] : [];
  let toBeCompiled = [];
  let otherFiles = [];
  if (tsConfig !== undefined) {
    const configFileNames = new Set(tsConfig.ParsedConfig?.FileNames ?? []);
    for (const unit of testUnits) {
      if (configFileNames.has(GetNormalizedAbsolutePath(unit.fileName, currentDirectory))) {
        toBeCompiled.push(makeTestFile(unit));
      } else {
        otherFiles.push(makeTestFile(unit));
      }
    }
  } else {
    const lastUnit = testUnits.at(-1);
    const noImplicitReferencesValue = configuration.get("noimplicitreferences");
    if (lastUnit !== undefined &&
      ((noImplicitReferencesValue !== undefined && noImplicitReferencesValue !== "") ||
        lastUnit.content.includes("require(") ||
        /reference\spath/.test(lastUnit.content))) {
      toBeCompiled = [makeTestFile(lastUnit)];
      otherFiles = testUnits.slice(0, -1).map(makeTestFile);
    } else {
      toBeCompiled = testUnits.map(makeTestFile);
    }
  }

  // harnessutil.go CompileFiles: default options for tests.
  let compilerOptions = tsConfig?.ParsedConfig?.CompilerOptions !== undefined
    ? { ...tsConfig.ParsedConfig.CompilerOptions }
    : {};
  if ((compilerOptions.NewLine ?? NewLineKindNone) === NewLineKindNone) {
    compilerOptions.NewLine = NewLineKindCRLF;
  }
  if ((compilerOptions.SkipDefaultLibCheck ?? TSUnknown) === TSUnknown) {
    compilerOptions.SkipDefaultLibCheck = TSTrue;
  }
  compilerOptions.NoErrorTruncation = TSTrue;
  const harnessOptions = { usecasesensitivefilenames: true, currentdirectory: currentDirectory };
  setOptionsFromTestConfig(configuration, compilerOptions, harnessOptions, currentDirectory);

  return compileHarnessFiles({
    toBeCompiled,
    otherFiles,
    tsConfigFiles,
    compilerOptions,
    harnessOptions,
    currentDirectory,
    symlinks,
    configFile: tsConfig?.ConfigFile,
    configErrors: tsConfig?.Errors,
  });
}

// harnessutil.go CompileFilesEx (program-construction + compile half). Inputs are
// already in upstream absolute coordinates ({unitName, content} TestFiles).
export function compileHarnessFiles({ toBeCompiled, otherFiles, tsConfigFiles, compilerOptions, harnessOptions, currentDirectory, symlinks, configFile, configErrors }) {
  // Program root names exclude .json/.tsbuildinfo.
  const programFileNames = [];
  for (const file of toBeCompiled) {
    const lower = file.unitName.toLowerCase();
    if (!lower.endsWith(".json") && !lower.endsWith(".tsbuildinfo")) {
      programFileNames.push(file.unitName);
    }
  }
  let includeLibDir = [...toBeCompiled, ...otherFiles].some((file) => file.content.includes(`${testLibFolder}/`));
  for (const libFile of harnessOptions.libfiles ?? []) {
    if (libFile === "lib.d.ts" && compilerOptions.NoLib !== TSTrue) {
      continue;
    }
    programFileNames.push(CombinePaths(testLibFolder, libFile));
    includeLibDir = true;
  }

  const testfs = new Map();
  for (const file of [...toBeCompiled, ...otherFiles, ...(tsConfigFiles ?? [])]) {
    testfs.set(file.unitName, file.content);
  }
  for (const [link, target] of symlinks ?? []) {
    testfs.set(
      GetNormalizedAbsolutePath(link, currentDirectory),
      Symlink(GetNormalizedAbsolutePath(target, currentDirectory)),
    );
  }
  if (includeLibDir) {
    for (const [name, content] of testLibFolderMap()) {
      testfs.set(name, content);
    }
  }

  const fs = WrapFS(FromMap(testfs, harnessOptions.usecasesensitivefilenames !== false));
  const host = NewCompilerHost(currentDirectory, fs, LibPath(), undefined, undefined);
  const parsed = NewParsedCommandLine(compilerOptions, programFileNames, {
    UseCaseSensitiveFileNames: harnessOptions.usecasesensitivefilenames !== false,
    CurrentDirectory: currentDirectory,
  });
  if (configFile !== undefined) {
    parsed.ConfigFile = configFile;
    parsed.Errors = configErrors ?? [];
  }
  const program = NewProgram({
    Host: host,
    Config: parsed,
    UseSourceOfProjectReference: false,
    SingleThreaded: TSTrue,
    CreateCheckerPool: undefined,
    TypingsLocation: "",
    ProjectName: "",
    Tracing: undefined,
  });
  const compiled = runHarnessCompile(program);
  return {
    currentDirectory,
    // The program's own (normalized) options, exactly what its emit/checker consult.
    compilerOptions: parsed.ParsedConfig?.CompilerOptions ?? compilerOptions,
    harnessOptions,
    tsConfigFiles: tsConfigFiles ?? [],
    toBeCompiled,
    otherFiles,
    symlinks: symlinks ?? new Map(),
    program,
    parsed,
    diagnostics: compiled.diagnostics,
    emittedOutputs: compiled.outputs,
    emitResult: compiled.emitResult,
  };
}

// js_emit_baseline.go prepareDeclarationCompilationContext + compileDeclarationFiles:
// when declaration emit succeeded with no diagnostics, recompile the emitted .d.ts
// files (plus declaration/JSON inputs) and surface that compilation's diagnostics for
// the //// [DtsFileErrors] baseline block. Returns undefined when upstream would not
// run the declaration compilation.
export async function compileDeclarationFiles(vfsCase) {
  const { RemoveFileExtension, GetDeclarationEmitExtensionForPath, HasJSONFileExtension, HasTSFileExtension, HasJSFileExtension } = await dist("internal/tspath/extension.js");
  const { IsDeclarationFileName } = await dist("internal/tspath/extension.js");
  const { CompilerOptions_GetAllowJS } = await dist("internal/core/compileroptions.js");
  const { Program_GetSourceFile, Program_CommonSourceDirectory } = await dist("internal/compiler/program.js");
  const { SourceFile_FileName } = await dist("internal/ast/ast.js");

  const options = vfsCase.compilerOptions;
  const diagnostics = vfsCase.diagnostics ?? [];
  const dts = new Map();
  let jsFileCount = 0;
  for (const [name, content] of vfsCase.emittedOutputs) {
    if (/\.d\.[cm]?ts$/i.test(name)) {
      dts.set(name, content);
    } else if (/\.[cm]?jsx?$/i.test(name)) {
      jsFileCount++;
    }
  }

  if (options.Declaration === TSTrue && diagnostics.length === 0) {
    if (options.EmitDeclarationOnly === TSTrue) {
      if (jsFileCount > 0 || (dts.size === 0 && options.NoEmit !== TSTrue)) {
        throw new globalThis.Error("Only declaration files should be generated when emitDeclarationOnly:true");
      }
    } else if (dts.size !== jsFileCount) {
      throw new globalThis.Error("There were no errors and declFiles generated did not match number of js files generated");
    }
  }

  if (options.Declaration !== TSTrue || diagnostics.length !== 0 || dts.size === 0) {
    return undefined;
  }

  const declInputFiles = [];
  const declOtherFiles = [];
  const findUnit = (fileName, units) => units.find((unit) => unit.unitName === fileName);

  const findResultCodeFile = (fileName) => {
    const sourceFile = Program_GetSourceFile(vfsCase.program, fileName);
    if (sourceFile === undefined) {
      throw new globalThis.Error(`Program has no source file with name '${fileName}'`);
    }
    let sourceFileName;
    if ((options.OutDir ?? "") !== "") {
      let sourceFilePath = GetNormalizedAbsolutePath(SourceFile_FileName(sourceFile), vfsCase.currentDirectory);
      sourceFilePath = sourceFilePath.replace(Program_CommonSourceDirectory(vfsCase.program), "");
      sourceFileName = CombinePaths(options.OutDir, sourceFilePath);
    } else {
      sourceFileName = SourceFile_FileName(sourceFile);
    }
    const dTsFileName = RemoveFileExtension(sourceFileName) + GetDeclarationEmitExtensionForPath(sourceFileName);
    const content = dts.get(dTsFileName);
    return content === undefined ? undefined : { unitName: dTsFileName, content };
  };

  const addDtsFile = (file, dtsFiles) => {
    if (IsDeclarationFileName(file.unitName) || HasJSONFileExtension(file.unitName)) {
      dtsFiles.push(file);
    } else if (HasTSFileExtension(file.unitName) || (HasJSFileExtension(file.unitName) && CompilerOptions_GetAllowJS(options))) {
      const declFile = findResultCodeFile(file.unitName);
      if (declFile !== undefined && findUnit(declFile.unitName, declInputFiles) === undefined && findUnit(declFile.unitName, declOtherFiles) === undefined) {
        dtsFiles.push({ unitName: declFile.unitName, content: declFile.content.replace(/^﻿/, "") });
      }
    }
  };

  for (const file of vfsCase.toBeCompiled) {
    addDtsFile(file, declInputFiles);
  }
  for (const file of vfsCase.otherFiles) {
    addDtsFile(file, declOtherFiles);
  }

  const declResult = compileHarnessFiles({
    toBeCompiled: declInputFiles,
    otherFiles: declOtherFiles,
    tsConfigFiles: [],
    compilerOptions: { ...options },
    harnessOptions: vfsCase.harnessOptions,
    currentDirectory: vfsCase.currentDirectory,
    symlinks: vfsCase.symlinks,
    configFile: vfsCase.parsed?.ConfigFile,
  });
  return { declInputFiles, declOtherFiles, declResult };
}

// harnessutil.go CompilationResult.Repeat with {noCheck: "true"}: rerun the same
// compilation with NoCheck set, for js_emit_baseline.go's noCheck-repeat comparison.
export function repeatWithNoCheck(vfsCase) {
  return compileHarnessFiles({
    toBeCompiled: vfsCase.toBeCompiled,
    otherFiles: vfsCase.otherFiles,
    tsConfigFiles: vfsCase.tsConfigFiles,
    compilerOptions: { ...vfsCase.compilerOptions, NoCheck: TSTrue },
    harnessOptions: vfsCase.harnessOptions,
    currentDirectory: vfsCase.currentDirectory,
    symlinks: vfsCase.symlinks,
    configFile: vfsCase.parsed?.ConfigFile,
  });
}
