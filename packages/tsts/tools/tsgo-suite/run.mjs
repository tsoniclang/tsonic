#!/usr/bin/env node
import { spawn, fork } from "node:child_process";
import { cpus } from "node:os";
import { dirname, isAbsolute, join, posix as posixPath, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { appendFile, cp, mkdir, readFile, readdir, stat, symlink, writeFile } from "node:fs/promises";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import ts from "typescript";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = join(dirname(scriptPath), "../../../..");
const packageRoot = join(repoRoot, "packages/tsts");
const vendorRoot = join(packageRoot, "_vendor/typescript-go");
const caseRoot = join(vendorRoot, "testdata/tests/cases");
const baselineRoot = join(vendorRoot, "testdata/baselines/reference");
const typeScriptSubmoduleCaseRoot = join(vendorRoot, "_submodules/TypeScript/tests/cases");
const typeScriptSubmoduleBaselineRoot = join(vendorRoot, "_submodules/TypeScript/tests/baselines/reference");
const testLibRoot = join(vendorRoot, "_submodules/TypeScript/tests/lib");
const typeScriptApiDeclarationRoot = join(typeScriptSubmoduleBaselineRoot, "api");
const vendoredTypeScriptLibRoot = join(vendorRoot, "node_modules/typescript/lib");
const cliPath = join(packageRoot, "dist/src/cli/index.js");
const apiPath = join(packageRoot, "dist/src/index.js");
const tsgoAcceptedRoot = join(dirname(scriptPath), "tsgo-accepted");
const utf8Decoder = new TextDecoder("utf-8");
const utf16LittleEndianDecoder = new TextDecoder("utf-16le");
const utf16BigEndianDecoder = new TextDecoder("utf-16be");
const harnessSourceFilePattern = /\.(?:[cm]?tsx?|[cm]?jsx?)$/i;
const harnessJavaScriptFilePattern = /\.(?:[cm]?jsx?)$/i;
let tstsApi;

const supportedSuitesByCorpus = new Map([
  ["current", new Set(["compiler", "conformance"])],
  ["typescript", new Set(["compiler", "conformance", "project", "transpile"])],
]);
const caseRootByCorpus = new Map([
  ["current", caseRoot],
  ["typescript", typeScriptSubmoduleCaseRoot],
]);
const inScopeTypeScriptSuites = new Set(["compiler", "conformance", "project", "transpile", "unittests"]);
const outOfScopeTypeScriptSuites = new Set(["fourslash"]);
const fixtureOnlyTypeScriptSuites = new Set(["projects"]);
const inScopeBaselineCategories = new Set(["api", "astnav", "compiler", "config", "conformance", "submodule", "submoduleAccepted", "submoduleTriaged", "tsbuild", "tsbuildWatch", "tsc", "tscWatch", "tsoptions"]);
const outOfScopeBaselineCategories = new Set(["fourslash", "lsp"]);
// compiler_runner.go getCompilerVaryByMap: every non-command-line-only boolean/enum
// option with an Affects* flag varies, plus noEmit and isolatedModules.
const { OptionsDeclarations: tstsOptionsDeclarations } = await import(new URL("../../dist/src/internal/tsoptions/declscompiler.js", import.meta.url).href);
const compilerVaryByOptions = new Set([
  ...tstsOptionsDeclarations
    .filter((option) =>
      !option.IsCommandLineOnly &&
      (option.Kind === "boolean" || option.Kind === "enum") &&
      (option.AffectsProgramStructure ||
        option.AffectsEmit ||
        option.AffectsModuleResolution ||
        option.AffectsBindDiagnostics ||
        option.AffectsSemanticDiagnostics ||
        option.AffectsSourceFile ||
        option.AffectsDeclarationPath ||
        option.AffectsBuildInfo))
    .map((option) => option.Name.toLowerCase()),
  "noemit",
  "isolatedmodules",
]);
const booleanOptions = new Set([
  "allowjs",
  "allowimportingtsextensions",
  "allowarbitraryextensions",
  "allowumdglobalaccess",
  "allowunusedlabels",
  "allowunreachablecode",
  "allowsyntheticdefaultimports",
  "alwaysstrict",
  "checkjs",
  "composite",
  "declaration",
  "declarationmap",
  "deduplicatepackages",
  "downleveliteration",
  "emitdeclarationonly",
  "emitdecoratormetadata",
  "erasablesyntaxonly",
  "esmoduleinterop",
  "exactoptionalpropertytypes",
  "experimentaldecorators",
  "incremental",
  "inlinesourcemap",
  "importhelpers",
  "keyofstringsonly",
  "isolatedmodules",
  "isolateddeclarations",
  "noemit",
  "noemithelpers",
  "noerrortruncation",
  "noimplicitany",
  "noimplicitreturns",
  "noimplicitthis",
  "noimplicitoverride",
  "noimplicitusestrict",
  "noresolve",
  "nolib",
  "nopropertyaccessfromindexsignature",
  "nofallthroughcasesinswitch",
  "nocheck",
  "nouncheckedindexedaccess",
  "nouncheckedsideeffectimports",
  "nounusedlocals",
  "nounusedparameters",
  "libreplacement",
  "preserveconstenums",
  "preservevalueimports",
  "pretty",
  "removecomments",
  "resolvejsonmodule",
  "resolvepackagejsonexports",
  "rewriterelativeimportextensions",
  "skipdefaultlibcheck",
  "skiplibcheck",
  "strict",
  "strictbuiltiniteratorreturn",
  "strictnullchecks",
  "strictpropertyinitialization",
  "sourcemap",
  "traceresolution",
  "usedefineforclassfields",
  "useunknownincatchvariables",
  "verbatimmodulesyntax",
]);
const stringOptions = new Map([
  ["baseurl", "baseUrl"],
  ["declarationdir", "declarationDir"],
  ["jsx", "jsx"],
  ["jsxfactory", "jsxFactory"],
  ["jsxfragmentfactory", "jsxFragmentFactory"],
  ["jsximportsource", "jsxImportSource"],
  ["maproot", "mapRoot"],
  ["module", "module"],
  ["moduledetection", "moduleDetection"],
  ["moduleresolution", "moduleResolution"],
  ["importsnotusedasvalues", "importsNotUsedAsValues"],
  ["out", "out"],
  ["outdir", "outDir"],
  ["outfile", "outFile"],
  ["reactnamespace", "reactNamespace"],
  ["rootdir", "rootDir"],
  ["target", "target"],
  ["tsbuildinfofile", "tsBuildInfoFile"],
]);
const pathStringOptions = new Set([
  "baseurl",
  "declarationdir",
  "out",
  "outdir",
  "outfile",
  "rootdir",
  "tsbuildinfofile",
]);
const listOptions = new Map([
  ["lib", "lib"],
  ["typeroots", "typeRoots"],
  ["types", "types"],
]);
const pathListOptions = new Set([
  "typeroots",
]);
const numberOptions = new Map([
  ["maxnodemodulejsdepth", "maxNodeModuleJsDepth"],
]);
const booleanOptionNames = new Map([
  ["allowjs", "allowJs"],
  ["allowimportingtsextensions", "allowImportingTsExtensions"],
  ["allowarbitraryextensions", "allowArbitraryExtensions"],
  ["allowumdglobalaccess", "allowUmdGlobalAccess"],
  ["allowunusedlabels", "allowUnusedLabels"],
  ["allowunreachablecode", "allowUnreachableCode"],
  ["allowsyntheticdefaultimports", "allowSyntheticDefaultImports"],
  ["alwaysstrict", "alwaysStrict"],
  ["checkjs", "checkJs"],
  ["composite", "composite"],
  ["declaration", "declaration"],
  ["declarationmap", "declarationMap"],
  ["deduplicatepackages", "deduplicatePackages"],
  ["downleveliteration", "downlevelIteration"],
  ["emitdeclarationonly", "emitDeclarationOnly"],
  ["emitdecoratormetadata", "emitDecoratorMetadata"],
  ["erasablesyntaxonly", "erasableSyntaxOnly"],
  ["esmoduleinterop", "esModuleInterop"],
  ["exactoptionalpropertytypes", "exactOptionalPropertyTypes"],
  ["experimentaldecorators", "experimentalDecorators"],
  ["incremental", "incremental"],
  ["inlinesourcemap", "inlineSourceMap"],
  ["importhelpers", "importHelpers"],
  ["keyofstringsonly", "keyofStringsOnly"],
  ["isolatedmodules", "isolatedModules"],
  ["isolateddeclarations", "isolatedDeclarations"],
  ["noemit", "noEmit"],
  ["noemithelpers", "noEmitHelpers"],
  ["noerrortruncation", "noErrorTruncation"],
  ["noimplicitany", "noImplicitAny"],
  ["noimplicitreturns", "noImplicitReturns"],
  ["noimplicitthis", "noImplicitThis"],
  ["noimplicitoverride", "noImplicitOverride"],
  ["noimplicitusestrict", "noImplicitUseStrict"],
  ["noresolve", "noResolve"],
  ["nolib", "noLib"],
  ["nopropertyaccessfromindexsignature", "noPropertyAccessFromIndexSignature"],
  ["nofallthroughcasesinswitch", "noFallthroughCasesInSwitch"],
  ["nocheck", "noCheck"],
  ["nouncheckedindexedaccess", "noUncheckedIndexedAccess"],
  ["nouncheckedsideeffectimports", "noUncheckedSideEffectImports"],
  ["nounusedlocals", "noUnusedLocals"],
  ["nounusedparameters", "noUnusedParameters"],
  ["libreplacement", "libReplacement"],
  ["preserveconstenums", "preserveConstEnums"],
  ["preservevalueimports", "preserveValueImports"],
  ["pretty", "pretty"],
  ["removecomments", "removeComments"],
  ["resolvejsonmodule", "resolveJsonModule"],
  ["resolvepackagejsonexports", "resolvePackageJsonExports"],
  ["rewriterelativeimportextensions", "rewriteRelativeImportExtensions"],
  ["skipdefaultlibcheck", "skipDefaultLibCheck"],
  ["skiplibcheck", "skipLibCheck"],
  ["strict", "strict"],
  ["strictbuiltiniteratorreturn", "strictBuiltinIteratorReturn"],
  ["strictnullchecks", "strictNullChecks"],
  ["strictpropertyinitialization", "strictPropertyInitialization"],
  ["sourcemap", "sourceMap"],
  ["traceresolution", "traceResolution"],
  ["usedefineforclassfields", "useDefineForClassFields"],
  ["useunknownincatchvariables", "useUnknownInCatchVariables"],
  ["verbatimmodulesyntax", "verbatimModuleSyntax"],
]);

export function parseArgs(argv) {
  const parsed = {
    corpus: "current",
    suite: "all",
    filter: "",
    limit: 0,
    jobs: Math.max(1, cpus().length),
    failFast: false,
    keepGoing: true,
    inventory: false,
    // Exact-baseline comparison is the only mode. Weak mode (error-count-only)
    // was deleted: it green-lit emitted-output bugs (wrong .d.ts/.types/.js that
    // still produced the right number of errors). Concurrency is controlled by
    // --jobs: default = all cores (parallel), --jobs 1 = serial.
    exactBaselines: true,
    // When set, every case ALSO runs the real on-disk CLI compile and asserts it
    // agrees with the fast in-memory harness (error verdict AND emitted .js/.d.ts).
    // This is the provable on-disk-coverage gate; default off (harness-only fast
    // path) since 0 divergences over the corpus proves the two paths equivalent.
    verifyOnDisk: false,
    // Resume a suspended run: path to a prior reportRoot. The runner skips cases
    // already recorded in that run's results.ndjson and runs only the remainder,
    // appending to the same file. Empty = fresh run.
    resume: "",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--corpus") {
      parsed.corpus = argv[++index] ?? parsed.corpus;
    } else if (arg === "--suite") {
      parsed.suite = argv[++index] ?? parsed.suite;
    } else if (arg === "--filter") {
      parsed.filter = argv[++index] ?? "";
    } else if (arg === "--limit") {
      parsed.limit = Number(argv[++index] ?? "0");
    } else if (arg === "--jobs") {
      parsed.jobs = Math.max(1, Number(argv[++index] ?? "1"));
    } else if (arg === "--fail-fast") {
      parsed.failFast = true;
      parsed.keepGoing = false;
    } else if (arg === "--inventory") {
      parsed.inventory = true;
    } else if (arg === "--exact-baselines") {
      parsed.exactBaselines = true;
    } else if (arg === "--verify-on-disk") {
      parsed.verifyOnDisk = true;
    } else if (arg === "--resume") {
      parsed.resume = argv[++index] ?? "";
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  const supportedSuites = supportedSuitesByCorpus.get(parsed.corpus);
  if (supportedSuites === undefined) {
    throw new Error(`Unsupported corpus '${parsed.corpus}'. Expected one of: ${[...supportedSuitesByCorpus.keys()].join(", ")}`);
  }
  if (parsed.suite !== "all" && !supportedSuites.has(parsed.suite)) {
    throw new Error(`Unsupported suite '${parsed.suite}' for corpus '${parsed.corpus}'. Expected one of: all, ${[...supportedSuites].join(", ")}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node packages/tsts/tools/tsgo-suite/run.mjs [options]

Runs upstream TS-Go/TypeScript file-based tests through the TSTS CLI.

Options:
  --corpus <current|typescript>        current=testdata/tests/cases; typescript=_submodules/TypeScript/tests/cases. Default: current.
  --suite <all|compiler|conformance|project|transpile>
                                      Suite to run. Default: all.
  --filter <substring>                Run cases whose relative path contains the substring.
  --limit <n>                         Run at most n cases after filtering.
  --jobs <n>                          Worker processes (concurrency). Default: all CPU cores. --jobs 1 = serial.
  --fail-fast                         Stop after the first failure.
  --exact-baselines                   Deprecated no-op: exact-baseline comparison is always on (weak mode removed).
  --verify-on-disk                    Also run the real on-disk CLI compile per case and prove it matches the in-memory harness (error verdict + emitted .js/.d.ts). Full on-disk-coverage gate; default off (fast harness-only path).
  --resume <reportRoot>               Resume a suspended run: skip cases already recorded in that run's results.ndjson and run only the remainder. Re-use the SAME --corpus/--suite/--filter/--limit. To suspend, just stop the process.
  --inventory                         Print the tracked upstream test universe and exit.
`);
}

export async function buildTestUniverseInventory() {
  const currentHarness = await countFilesByChild(caseRoot, (file) => harnessSourceFilePattern.test(file));
  const typeScriptCases = await countTypeScriptCaseFilesByChild(typeScriptSubmoduleCaseRoot);
  const baselines = await countFilesByChild(baselineRoot, () => true);
  const goTests = await countGoTestFilesByPackage(vendorRoot);
  return {
    currentHarness: summarizeNamedCounts(currentHarness, supportedSuitesByCorpus.get("current")),
    typeScriptCases: summarizeTypeScriptCaseCounts(typeScriptCases),
    baselines: summarizeNamedCounts(baselines, inScopeBaselineCategories, outOfScopeBaselineCategories),
    goTests,
  };
}

function summarizeTypeScriptCaseCounts(typeScriptCases) {
  const summary = summarizeNamedCounts(typeScriptCases.entries, inScopeTypeScriptSuites, outOfScopeTypeScriptSuites);
  return {
    ...summary,
    inScope: summary.inScope - typeScriptCases.languageServiceHarnessCases,
    outOfScope: summary.outOfScope + typeScriptCases.languageServiceHarnessCases,
    languageServiceHarnessCases: typeScriptCases.languageServiceHarnessCases,
  };
}

function summarizeNamedCounts(counts, inScopeNames, outOfScopeNames = new Set()) {
  const entries = Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
  let inScope = 0;
  let outOfScope = 0;
  let unclassified = 0;
  for (const [name, count] of Object.entries(entries)) {
    if (inScopeNames.has(name)) {
      inScope += count;
    } else if (outOfScopeNames.has(name)) {
      outOfScope += count;
    } else {
      unclassified += count;
    }
  }
  return {
    total: Object.values(entries).reduce((sum, count) => sum + count, 0),
    inScope,
    outOfScope,
    unclassified,
    entries,
  };
}

async function countFilesByChild(root, includeFile) {
  if (!existsSync(root)) {
    return {};
  }
  const counts = {};
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) {
      counts[entry.name] = (await walkFiles(fullPath)).filter(includeFile).length;
    } else if (entry.isFile() && includeFile(fullPath)) {
      counts["."] = (counts["."] ?? 0) + 1;
    }
  }
  return counts;
}

async function countTypeScriptCaseFilesByChild(root) {
  if (!existsSync(root)) {
    return { entries: {}, languageServiceHarnessCases: 0 };
  }
  const entries = {};
  let languageServiceHarnessCases = 0;
  const children = await readdir(root, { withFileTypes: true });
  for (const child of children) {
    const fullPath = join(root, child.name);
    if (child.isDirectory()) {
      if (child.name === "project") {
        entries[child.name] = (await walkFiles(fullPath)).filter((file) => /\.json$/i.test(file)).length;
        continue;
      }
      if (fixtureOnlyTypeScriptSuites.has(child.name)) {
        entries[child.name] = 0;
        continue;
      }
      const files = (await walkFiles(fullPath)).filter((file) => harnessSourceFilePattern.test(file));
      entries[child.name] = files.length;
      if (inScopeTypeScriptSuites.has(child.name)) {
        for (const file of files) {
          if (isLanguageServiceHarnessCase(await readSourceText(file))) {
            languageServiceHarnessCases += 1;
          }
        }
      }
    } else if (child.isFile() && harnessSourceFilePattern.test(fullPath)) {
      entries["."] = (entries["."] ?? 0) + 1;
    }
  }
  return { entries, languageServiceHarnessCases };
}

async function countGoTestFilesByPackage(root) {
  const counts = {};
  for (const file of await walkFiles(root, (entryPath) => entryPath.endsWith(`${sep}node_modules`))) {
    if (!file.endsWith("_test.go")) {
      continue;
    }
    const relativePath = relative(root, file).split(sep);
    const packageName = relativePath.length >= 2 ? `${relativePath[0]}/${relativePath[1]}` : relativePath[0];
    counts[packageName] = (counts[packageName] ?? 0) + 1;
  }
  const outOfScope = Object.entries(counts)
    .filter(([packageName]) => packageName === "internal/fourslash" || packageName === "internal/lsp" || packageName === "internal/ls")
    .reduce((sum, [, count]) => sum + count, 0);
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  return {
    total,
    inScope: total - outOfScope,
    outOfScope,
    unclassified: 0,
    entries: Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right))),
  };
}

export async function discoverCases(options) {
  const supportedSuites = supportedSuitesByCorpus.get(options.corpus);
  if (supportedSuites === undefined) {
    throw new Error(`Unsupported corpus '${options.corpus}'.`);
  }
  const selectedCaseRoot = caseRootByCorpus.get(options.corpus);
  if (selectedCaseRoot === undefined) {
    throw new Error(`No case root registered for corpus '${options.corpus}'.`);
  }
  const suites = options.suite === "all" ? [...supportedSuites] : [options.suite];
  const caseFiles = [];
  for (const suite of suites) {
    if (options.corpus === "typescript" && suite === "project") {
      caseFiles.push(...await discoverProjectCases(selectedCaseRoot, options));
      continue;
    }
    const suiteRoot = join(selectedCaseRoot, suite);
    for (const file of await walkFiles(suiteRoot)) {
      if (!harnessSourceFilePattern.test(file)) {
        continue;
      }
      if (isEmittedJavaScriptSibling(file)) {
        continue;
      }
      const sourceText = await readSourceText(file);
      if (options.corpus === "typescript" && isLanguageServiceHarnessCase(sourceText)) {
        continue;
      }
      const parsed = parseFileBasedTest(sourceText, file.split(sep).at(-1));
      const configurations = getFileBasedTestConfigurations(parsed.globalOptions);
      const relativePath = relative(selectedCaseRoot, file).split(sep).join("/");
      if (options.filter !== "" && !relativePath.includes(options.filter)) {
        continue;
      }
      for (const configuration of configurations) {
        caseFiles.push({
          corpus: options.corpus,
          suite,
          sourcePath: file,
          relativePath,
          caseName: relativePath.replace(harnessSourceFilePattern, "").split("/").at(-1),
          sourceBaseName: relativePath.split("/").at(-1),
          configurationName: configuration.name,
          configuration: configuration.settings,
        });
      }
    }
  }
  caseFiles.sort((left, right) => `${left.relativePath}:${left.configurationName}`.localeCompare(`${right.relativePath}:${right.configurationName}`));
  return options.limit > 0 ? caseFiles.slice(0, options.limit) : caseFiles;
}

async function discoverProjectCases(selectedCaseRoot, options) {
  const suiteRoot = join(selectedCaseRoot, "project");
  const cases = [];
  for (const file of await walkFiles(suiteRoot)) {
    if (!/\.json$/i.test(file)) {
      continue;
    }
    const relativePath = relative(selectedCaseRoot, file).split(sep).join("/");
    if (options.filter !== "" && !relativePath.includes(options.filter)) {
      continue;
    }
    const descriptor = await readProjectTestDescriptor(file);
    const caseName = relativePath.split("/").at(-1).replace(/\.json$/i, "");
    for (const moduleKind of ["commonjs", "amd"]) {
      cases.push({
        corpus: options.corpus,
        suite: "project",
        kind: "project",
        sourcePath: file,
        relativePath,
        caseName,
        sourceBaseName: relativePath.split("/").at(-1),
        configurationName: `module=${moduleKind}`,
        configuration: new Map([["module", moduleKind]]),
        descriptor,
        moduleKind,
      });
    }
  }
  return cases;
}

async function readProjectTestDescriptor(file) {
  const sourceText = await readSourceText(file);
  try {
    const descriptor = JSON.parse(sourceText);
    assertProjectTestDescriptor(file, descriptor);
    return descriptor;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Invalid project test descriptor '${file}': ${error.message}`);
    }
    throw error;
  }
}

function assertProjectTestDescriptor(file, descriptor) {
  if (descriptor === null || typeof descriptor !== "object" || Array.isArray(descriptor)) {
    throw new Error("descriptor must be an object");
  }
  if (typeof descriptor.scenario !== "string" || descriptor.scenario === "") {
    throw new Error("descriptor.scenario must be a non-empty string");
  }
  if (typeof descriptor.projectRoot !== "string" || descriptor.projectRoot === "") {
    throw new Error("descriptor.projectRoot must be a non-empty string");
  }
  if (descriptor.inputFiles !== undefined && (!Array.isArray(descriptor.inputFiles) || !descriptor.inputFiles.every((entry) => typeof entry === "string"))) {
    throw new Error("descriptor.inputFiles must be an array of strings when present");
  }
  const projectRoot = projectRootRelativeToCaseRoot(descriptor.projectRoot);
  if (!projectRoot.startsWith("projects/")) {
    throw new Error(`descriptor.projectRoot must point under tests/cases/projects in '${file}'`);
  }
  if (descriptor.project !== undefined && typeof descriptor.project !== "string") {
    throw new Error("descriptor.project must be a string when present");
  }
}

export function isLanguageServiceHarnessCase(sourceText) {
  return /\/\/\/\s*<reference\s+path=['"][^'"]*(?:services[\\/]typescriptServices|typescriptServices|formatting)\.ts['"]/i.test(sourceText) ||
    (/declare\s+var\s+assert\s*:\s*Harness\.Assert\b/.test(sourceText) && /declare\s+var\s+(?:describe|it|run|IO)\b/.test(sourceText)) ||
    /\b(?:ILineIndenationResolver|ITextSnapshot|Services\.EditorOptions)\b/.test(sourceText);
}

export function isEmittedJavaScriptSibling(file) {
  if (!/\.jsx?$/.test(file)) {
    return false;
  }
  const withoutExtension = file.replace(/\.jsx?$/, "");
  return existsSync(`${withoutExtension}.ts`) || existsSync(`${withoutExtension}.tsx`);
}

async function walkFiles(root, excludeDirectory = () => false) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory() && !excludeDirectory(fullPath)) {
      files.push(...await walkFiles(fullPath, excludeDirectory));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

export function parseFileBasedTest(sourceText, fallbackFileName) {
  const units = [];
  const globalOptions = new Map();
  const symlinks = new Map();
  const lines = sourceText.split(/\r?\n/);
  let currentFileName = "";
  let currentFileLines = [];
  let sawFileDirective = false;

  const flush = (trimTrailingBlankLines = false) => {
    if (currentFileName === "") {
      return;
    }
    if (trimTrailingBlankLines) {
      while (currentFileLines.length !== 0 && currentFileLines.at(-1) === "") {
        currentFileLines.pop();
      }
    }
    units.push({
      fileName: currentFileName,
      content: currentFileLines.join("\n"),
    });
    currentFileLines = [];
  };

  for (const line of lines) {
    const directiveLine = line.replace(/^\uFEFF/, "");
    const linkMatch = /^\/\/\s*@link\s*:\s*([^\r\n]*)\s*->\s*([^\r\n]*)/.exec(directiveLine);
    if (linkMatch !== null) {
      symlinks.set(linkMatch[2].trim(), linkMatch[1].trim());
      continue;
    }
    const optionMatch = /^\/\/\s*@(\w+)\s*:\s*([^\r\n]*)/.exec(directiveLine);
    if (optionMatch !== null) {
      const optionName = optionMatch[1].toLowerCase();
      const optionValue = optionMatch[2].trim().replace(/;$/, "");
      if (optionName === "filename") {
        if (!sawFileDirective && currentFileName === "") {
          currentFileLines = [];
        }
        flush();
        sawFileDirective = true;
        currentFileName = optionValue;
      } else if (optionName === "symlink" && currentFileName !== "") {
        for (const link of optionValue.split(",")) {
          const trimmed = link.trim();
          if (trimmed !== "") {
            symlinks.set(trimmed, currentFileName);
          }
        }
      } else {
        globalOptions.set(optionName, optionValue);
      }
      continue;
    }
    if (currentFileName === "" && sawFileDirective) {
      currentFileName = fallbackFileName;
    }
    if (line === "" && currentFileLines.length === 0) {
      // test_case_parser.go only writes a separating newline once content exists, which
      // drops every leading blank line of a unit (matching the TS harness behavior).
      continue;
    }
    currentFileLines.push(line);
  }

  if (currentFileName === "") {
    currentFileName = fallbackFileName;
  }
  flush();

  return {
    units,
    globalOptions,
    symlinks,
    currentDirectory: globalOptions.get("currentdirectory") ?? "/src",
  };
}

export function decodeSourceText(bytes) {
  if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
    return utf16LittleEndianDecoder.decode(bytes);
  }
  if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
    return utf16BigEndianDecoder.decode(bytes);
  }
  return utf8Decoder.decode(bytes);
}

async function readSourceText(file) {
  return decodeSourceText(await readFile(file));
}

export function compilerOptionsFromSettings(settings) {
  const compilerOptions = defaultCompilerOptions();
  Object.assign(compilerOptions, explicitCompilerOptionsFromSettings(settings));
  return compilerOptions;
}

function defaultCompilerOptions() {
  return {
    newLine: "crlf",
    noErrorTruncation: true,
    skipDefaultLibCheck: true,
    target: "ES2024",
  };
}

function explicitCompilerOptionsFromSettings(settings) {
  const compilerOptions = {};
  const pathOptions = harnessPathOptionsFromSettings(settings);
  for (const [rawName, rawValue] of settings) {
    if (rawName === "filename" || rawName === "currentdirectory" || rawName === "symlink") {
      continue;
    }
    const listName = listOptions.get(rawName);
    if (listName !== undefined) {
      compilerOptions[listName] = rawValue.replace(/;$/, "").split(",").map((entry) => entry.trim()).filter(Boolean).map((entry) =>
        pathListOptions.has(rawName) ? normalizeHarnessOptionPath(entry, pathOptions) : entry
      );
      continue;
    }
    const value = firstConcreteOptionValue(rawValue);
    if (value === undefined) {
      continue;
    }
    const numberName = numberOptions.get(rawName);
    if (numberName !== undefined) {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) {
        compilerOptions[numberName] = parsed;
      }
      continue;
    }
    if (booleanOptions.has(rawName)) {
      compilerOptions[booleanOptionNames.get(rawName)] = parseBoolean(value);
      continue;
    }
    const stringName = stringOptions.get(rawName);
    if (stringName !== undefined) {
      compilerOptions[stringName] = rawName === "jsximportsource"
        ? normalizeHarnessModuleSpecifier(value, pathOptions)
        : pathStringOptions.has(rawName)
        ? normalizeHarnessOptionPath(value, pathOptions)
        : value;
      continue;
    }
  }

  return compilerOptions;
}

export function compilerOptionsForExistingProjectConfig(config, settings) {
  const normalizedConfig = normalizeEmbeddedProjectConfig(config);
  const compilerOptions = {
    ...defaultCompilerOptions(),
    ...(normalizedConfig.compilerOptions ?? {}),
    ...explicitCompilerOptionsFromSettings(settings),
  };
  return {
    ...normalizedConfig,
    compilerOptions,
  };
}

function normalizeEmbeddedProjectConfig(config) {
  const normalized = { ...config };
  for (const listKey of ["files", "include", "exclude"]) {
    const value = normalized[listKey];
    if (typeof value === "string") {
      normalized[listKey] = [value];
    }
  }
  return normalized;
}

export function compilerOptionsForMaterializedCase(settings, parsed, inputFiles) {
  const compilerOptions = compilerOptionsFromSettings(settings);
  applySafeJavaScriptEmitOutputDirectory(compilerOptions, settings, inputFiles);
  applyVirtualTypeRoots(compilerOptions, settings, parsed);
  applyVirtualRootCommonSourceDirectory(compilerOptions, settings, parsed, inputFiles);
  return compilerOptions;
}

export function compilerCommandLineArgsForMaterializedCase(compilerOptions, inputFiles) {
  const args = ["--ignoreConfig"];
  for (const key of Object.keys(compilerOptions).sort()) {
    const value = compilerOptions[key];
    if (value === undefined) {
      continue;
    }
    args.push(`--${key}`);
    if (value === true) {
      continue;
    }
    if (Array.isArray(value)) {
      args.push(value.join(","));
      continue;
    }
    args.push(String(value));
  }
  args.push("--pretty", "false");
  args.push(...inputFiles);
  return args;
}

export function compilerCommandLineArgsForTranspileInvocation(compilerOptions, inputFile, kind) {
  return compilerCommandLineArgsForMaterializedCase(compilerOptionsForTranspileInvocation(compilerOptions, kind), [inputFile]);
}

export function compilerOptionsForTranspileInvocation(compilerOptions, kind) {
  const transpileOptions = {
    ...compilerOptions,
    noCheck: true,
  };
  delete transpileOptions.noEmit;
  if (kind === "module") {
    delete transpileOptions.declaration;
    delete transpileOptions.declarationMap;
    delete transpileOptions.emitDeclarationOnly;
  } else if (kind === "declaration") {
    transpileOptions.declaration = true;
    transpileOptions.emitDeclarationOnly = true;
    transpileOptions.isolatedDeclarations = true;
  } else {
    throw new Error(`Unsupported transpile invocation kind '${kind}'`);
  }
  return transpileOptions;
}

function applyVirtualTypeRoots(compilerOptions, settings, parsed) {
  if (compilerOptions.typeRoots !== undefined || !settings.has("types")) {
    return;
  }
  const pathOptions = harnessPathOptionsFromSettings(settings);
  const roots = [];
  const seen = new Set();
  const files = parsed.units.map((unit) => normalizeHarnessPath(unit.fileName, pathOptions));
  for (const unit of parsed.units) {
    const filePath = normalizeHarnessPath(unit.fileName, pathOptions);
    const marker = "node_modules/@types/";
    const index = filePath.toLowerCase().indexOf(marker);
    if (index < 0) {
      continue;
    }
    const root = filePath.slice(0, index + marker.length - 1);
    if (!seen.has(root)) {
      seen.add(root);
      roots.push(root);
    }
  }
  if (roots.length !== 0) {
    compilerOptions.typeRoots = roots;
  } else if (!hasMaterializedExplicitTypePackage(compilerOptions.types, files)) {
    compilerOptions.typeRoots = [".empty-types"];
  }
}

function hasMaterializedExplicitTypePackage(typeNames, files) {
  if (!Array.isArray(typeNames)) {
    return false;
  }
  const normalizedFiles = new Set(files.map((file) => file.toLowerCase()));
  for (const typeName of typeNames) {
    const packagePath = `node_modules/${typeName.toLowerCase()}/`;
    if (
      normalizedFiles.has(`${packagePath}package.json`) ||
      normalizedFiles.has(`${packagePath}index.d.ts`) ||
      files.some((file) => file.toLowerCase().startsWith(packagePath))
    ) {
      return true;
    }
  }
  return false;
}

function applySafeJavaScriptEmitOutputDirectory(compilerOptions, settings, inputFiles) {
  if (settings.get("suppressoutputpathcheck")?.toLowerCase() !== "true") {
    return;
  }
  if (compilerOptions.noEmit === true || compilerOptions.emitDeclarationOnly === true) {
    return;
  }
  if (compilerOptions.outDir !== undefined || compilerOptions.outFile !== undefined) {
    return;
  }
  if (inputFiles.some((file) => harnessJavaScriptFilePattern.test(file))) {
    compilerOptions.outDir = ".out";
  }
}

export function getFileBasedTestConfigurations(settings) {
  const nonVaryingOptions = new Map();
  const varyingEntries = [];
  let variationCount = 1;

  for (const [option, value] of settings) {
    if (compilerVaryByOptions.has(option)) {
      const entries = splitOptionValues(value, option);
      if (entries.length > 1) {
        variationCount *= entries.length;
        if (variationCount > 25) {
          throw new Error(`Provided test options exceeded the maximum number of variations`);
        }
        varyingEntries.push([option, entries]);
        continue;
      }
      if (entries.length === 1) {
        nonVaryingOptions.set(option, entries[0]);
        continue;
      }
    }
    nonVaryingOptions.set(option, value);
  }

  if (varyingEntries.length === 0) {
    return [{ name: "", settings: nonVaryingOptions }];
  }

  const configurations = [];
  const visit = (index, current) => {
    if (index === varyingEntries.length) {
      const varyingSettings = new Map(current);
      const name = [...varyingSettings]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([option, value]) => `${option}=${value.toLowerCase()}`)
        .join(",");
      const merged = new Map(nonVaryingOptions);
      for (const [option, value] of varyingSettings) {
        merged.set(option, value);
      }
      configurations.push({ name, settings: merged });
      return;
    }
    const [option, values] = varyingEntries[index];
    for (const value of values) {
      current.set(option, value);
      visit(index + 1, current);
    }
    current.delete(option);
  };
  visit(0, new Map());
  return configurations;
}

function splitOptionValues(rawValue, option) {
  const values = rawValue.replace(/;$/, "").split(",").map((value) => value.trim()).filter(Boolean);
  let includeAll = false;
  const includes = [];
  const excludes = new Set();
  for (const value of values) {
    if (value === "*") {
      includeAll = true;
    } else if (value.startsWith("-") || value.startsWith("!")) {
      excludes.add(optionValueIdentity(option, value.slice(1)));
    } else {
      includes.push(normalizeOptionValue(option, value));
    }
  }

  const candidates = [];
  if (includeAll) {
    candidates.push(...allOptionValues(option));
  }
  candidates.push(...includes);
  const deduped = [];
  const seen = new Set();
  for (const value of candidates) {
    const identity = optionValueIdentity(option, value);
    if (!excludes.has(identity) && !seen.has(identity)) {
      seen.add(identity);
      deduped.push(value);
    }
  }
  return deduped;
}

function normalizeOptionValue(option, value) {
  return value.trim().replace(/;$/, "");
}

function optionValueIdentity(option, value) {
  const normalizedOption = option.toLowerCase();
  const normalizedValue = normalizeOptionValue(option, value).toLowerCase();
  if ((normalizedOption === "target" || normalizedOption === "module") && (normalizedValue === "es6" || normalizedValue === "es2015")) {
    return `${normalizedOption}:es2015`;
  }
  if (normalizedOption === "moduleresolution" && (normalizedValue === "node" || normalizedValue === "node10")) {
    return `${normalizedOption}:node10`;
  }
  return `${normalizedOption}:${normalizedValue}`;
}

function allOptionValues(option) {
  if (booleanOptions.has(option)) {
    return ["true", "false"];
  }
  if (option === "target") {
    return [
      "es5",
      "es6",
      "es2015",
      "es2016",
      "es2017",
      "es2018",
      "es2019",
      "es2020",
      "es2021",
      "es2022",
      "es2023",
      "es2024",
      "es2025",
      "esnext",
    ];
  }
  if (option === "module") {
    return [
      "commonjs",
      "amd",
      "umd",
      "system",
      "es6",
      "es2015",
      "es2020",
      "es2022",
      "esnext",
      "node16",
      "node18",
      "node20",
      "nodenext",
      "preserve",
    ];
  }
  return [];
}

function firstConcreteOptionValue(rawValue) {
  const values = rawValue.replace(/;$/, "").split(",").map((value) => value.trim()).filter(Boolean);
  for (const value of values) {
    if (value === "*" || value === "!true" || value === "!false") {
      continue;
    }
    return value;
  }
  return undefined;
}

function parseBoolean(value) {
  return value === "true" || value === "1";
}

export function baselineHasErrors(testCase) {
  if (testCase.corpus === "typescript" && testCase.suite === "project") {
    return projectBaselineHasErrors(testCase);
  }
  for (const baselineDir of baselineDirectories(testCase)) {
    const expected = baselineDirectoryHasErrors(baselineDir, testCase);
    if (expected !== undefined) {
      return expected;
    }
  }
  return false;
}

const diagnosticHeadlinePattern = /\b(?:error|message) TS\d+:/;

function projectBaselineHasErrors(testCase) {
  const moduleFolder = testCase.moduleKind === "amd" ? "amd" : "node";
  const errorsPath = join(typeScriptSubmoduleBaselineRoot, "project", testCase.caseName, moduleFolder, `${testCase.caseName}.errors.txt`);
  if (!existsSync(errorsPath)) {
    return false;
  }
  return diagnosticHeadlinePattern.test(stripAnsiEscapes(readFileSync(errorsPath, "utf8")));
}

function baselineDirectoryHasErrors(baselineDir, testCase) {
  for (const caseName of configuredBaselineCaseNames(testCase)) {
    const directPath = join(baselineDir, `${caseName}.errors.txt`);
    if (existsSync(directPath)) {
      return true;
    }
    const diffPath = `${directPath}.diff`;
    if (existsSync(diffPath)) {
      return errorDiffNewSideHasErrors(diffPath);
    }
  }
  if (!existsSync(baselineDir)) {
    return undefined;
  }
  return undefined;
}

export function errorDiffNewSideHasErrors(diffPath) {
  const text = stripAnsiEscapes(readFileSync(diffPath, "utf8"));
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith("---") || line.startsWith("+++") || line.startsWith("@@")) {
      const compactHunk = /^@@= skipped -\d+, \+(\d+) lines =@@/.exec(line);
      if (compactHunk !== null && Number(compactHunk[1]) > 0) {
        return true;
      }
      continue;
    }
    if (line === "+<no content>") {
      return false;
    }
    if ((line.startsWith("+") || line.startsWith(" ")) && diagnosticHeadlinePattern.test(line)) {
      return true;
    }
  }
  return false;
}

function stripAnsiEscapes(text) {
  return text.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "");
}

// True when the reference baselines for this case are pinned TS-Go's own outputs
// (testdata/baselines/reference), gated with the whole-file writers and the
// harness-mirror compile. baseline.Run writes the FULL submodule output to
// reference/submodule/<suite>/<name> for every submodule test; the .diff files beside
// them (and in submoduleAccepted/, submoduleTriaged/) only record the divergence from
// Strada and are not the gate.
function usesTsgoAuthorityBaselines(testCase) {
  if ((testCase.corpus ?? "current") === "current") {
    return true;
  }
  return testCase.corpus === "typescript" && (testCase.suite === "compiler" || testCase.suite === "conformance");
}

function baselineDirectories(testCase) {
  if (testCase.corpus === "typescript") {
    if (usesTsgoAuthorityBaselines(testCase)) {
      return [join(baselineRoot, "submodule", testCase.suite)];
    }
    return [
      join(baselineRoot, "submoduleTriaged", testCase.suite),
      join(baselineRoot, "submoduleAccepted", testCase.suite),
      join(baselineRoot, "submodule", testCase.suite),
      join(typeScriptSubmoduleBaselineRoot, testCase.suite),
      typeScriptSubmoduleBaselineRoot,
    ];
  }
  return [join(baselineRoot, testCase.suite)];
}

const comparableBaselineFilePattern = /\.(?:[cm]?jsx?|d\.[cm]?ts|map)$/i;
const diagnosticBaselineFilePattern = /\.errors\.txt$/i;
const typeSymbolBaselineFilePattern = /\.(?:symbols|types)$/i;
const unsupportedExactBaselineFilePattern = /$^/;
const emittedOutputFilePattern = /\.(?:[cm]?jsx?|d\.[cm]?ts|map)$/i;

function exactBaselineArtifacts(testCase) {
  if (testCase.corpus === "typescript" && testCase.suite === "project") {
    return exactProjectBaselineArtifacts(testCase);
  }
  const selected = new Map();
  const baseNames = configuredBaselineCaseNames(testCase);
  const skipDiffArtifacts = usesTsgoAuthorityBaselines(testCase);
  for (const baselineDir of baselineDirectories(testCase)) {
    if (!existsSync(baselineDir)) {
      continue;
    }
    for (const entry of readdirSync(baselineDir, { withFileTypes: true })) {
      if (!entry.isFile()) {
        continue;
      }
      if (skipDiffArtifacts && entry.name.endsWith(".diff")) {
        // Strada-divergence bookkeeping next to the full TS-Go baselines; not a gate.
        continue;
      }
      const artifactName = entry.name.endsWith(".diff") ? entry.name.slice(0, -".diff".length) : entry.name;
      // For TS-Go-authority baselines the writers produce exactly these artifact kinds;
      // a bare prefix match would let a case swallow a sibling case's baselines
      // (asyncFunctionReturnType.ts vs asyncFunctionReturnType.2.ts).
      const matchesCase = skipDiffArtifacts
        ? baseNames.some((baseName) =>
          artifactName.startsWith(`${baseName}.`) &&
          ["js", "js.map", "symbols", "types", "errors.txt"].includes(artifactName.slice(baseName.length + 1)))
        : baseNames.some((baseName) => artifactName.startsWith(`${baseName}.`));
      if (!matchesCase || selected.has(artifactName)) {
        continue;
      }
      selected.set(artifactName, {
        name: artifactName,
        path: join(baselineDir, entry.name),
        diff: entry.name.endsWith(".diff"),
      });
    }
  }
  return [...selected.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function exactProjectBaselineArtifacts(testCase) {
  const moduleFolder = testCase.moduleKind === "amd" ? "amd" : "node";
  const baselineDir = join(typeScriptSubmoduleBaselineRoot, "project", testCase.caseName, moduleFolder);
  if (!existsSync(baselineDir)) {
    return [];
  }
  return readdirSync(baselineDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.startsWith(`${testCase.caseName}.`))
    .map((entry) => ({
      name: entry.name.endsWith(".diff") ? entry.name.slice(0, -".diff".length) : entry.name,
      path: join(baselineDir, entry.name),
      diff: entry.name.endsWith(".diff"),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function parseBaselineSections(text) {
  const lines = normalizeComparableText(text).split("\n");
  const sections = [];
  let currentName = "";
  let currentLines = [];
  const flush = (trimTrailingBlankLines = false) => {
    if (currentName === "") {
      return;
    }
    if (trimTrailingBlankLines) {
      while (currentLines.length !== 0 && currentLines.at(-1) === "") {
        currentLines.pop();
      }
    }
    sections.push({
      name: currentName,
      content: currentLines.join("\n"),
    });
    currentLines = [];
  };
  for (const line of lines) {
    const marker = /^\/\/\/\/ \[(.*)](?: \/\/\/\/)?$/.exec(line);
    if (marker !== null) {
      const nextName = marker[1];
      flush(nextName === "Diagnostics reported");
      currentName = nextName;
      continue;
    }
    if (currentName !== "") {
      currentLines.push(line);
    }
  }
  flush();
  return sections;
}

// Sentinel a tsgo-accepted overlay uses to declare that pinned TS-Go intentionally emits NO
// output for a section the Strada reference baseline still contains — e.g. a .d.ts/.d.ts.map the
// new pin blocks under --isolatedDeclarations. capture-tsgo-accepted.mjs writes it (after proving
// the section exists in Strada but is absent from real pinned output); applyTsgoAcceptedOverlay
// drops the section from the expected outputs so the gate does not treat the intentional
// non-emission as a missing baseline output.
export const TSGO_ACCEPTED_ABSENT_MARKER = "<<< pinned TS-Go intentionally emits no output for this section >>>";

// TS-Go-accepted overlays: where the pinned TS-Go compiler demonstrably diverges from the
// Strada-generated reference baselines, the committed files under tools/tsgo-suite/tsgo-accepted/
// capture pinned TS-Go's actual output for the divergent sections. TSTS mirrors TS-Go, so the
// gate compares against the overlay for exactly those sections and against the Strada baseline
// for everything else. Overlays are generated from real pinned-TS-Go runs by
// capture-tsgo-accepted.mjs — never hand-edited, never derived from TSTS output.
export function loadTsgoAcceptedOverlay(corpus, suite, artifactName) {
  const overlayPath = join(tsgoAcceptedRoot, corpus, suite, artifactName);
  if (!existsSync(overlayPath)) {
    return undefined;
  }
  return parseBaselineSections(readFileSync(overlayPath, "utf8"));
}

export function applyTsgoAcceptedOverlay(artifactName, overlaySections, expectedOutputs, expectedDiagnosticHeadlines, expectedDiagnosticSources) {
  const used = [];
  const problems = [];
  for (const section of overlaySections) {
    if (section.name === "Diagnostics reported") {
      // The overlay carries the COMPLETE diagnostic expectation for the artifact, so it
      // supersedes every 'Diagnostics reported' section the reference baseline declares.
      const indices = [];
      for (let index = 0; index < expectedDiagnosticSources.length; index++) {
        if (expectedDiagnosticSources[index] === `${artifactName}#Diagnostics reported`) {
          indices.push(index);
        }
      }
      if (indices.length === 0) {
        problems.push(`tsgo-accepted overlay '${artifactName}' overrides 'Diagnostics reported' but the reference baseline has no such section.`);
        continue;
      }
      const headline = diagnosticHeadlineText(section.content);
      const baselineHeadline = indices.map((index) => expectedDiagnosticHeadlines[index]).filter((text) => text !== "").join("\n");
      if (baselineHeadline === headline) {
        problems.push(`tsgo-accepted overlay '${artifactName}#Diagnostics reported' matches the reference baseline; remove the stale overlay.`);
        continue;
      }
      expectedDiagnosticHeadlines[indices[0]] = headline;
      expectedDiagnosticSources[indices[0]] = `${artifactName}#Diagnostics reported (tsgo-accepted)`;
      for (const index of indices.slice(1)) {
        expectedDiagnosticHeadlines[index] = "";
        expectedDiagnosticSources[index] = `${artifactName}#Diagnostics reported (tsgo-accepted)`;
      }
      used.push(`${artifactName}#Diagnostics reported`);
      continue;
    }
    const key = normalizedBaselineSectionPath(section.name);
    if (section.content.trim() === TSGO_ACCEPTED_ABSENT_MARKER) {
      // Pinned TS-Go intentionally emits nothing here while Strada still has the section.
      // Drop it from the expected outputs so the intentional non-emission is not flagged as a
      // missing baseline output, and count it as a tsgo-accepted divergence.
      if (!expectedOutputs.has(key)) {
        problems.push(`tsgo-accepted overlay '${artifactName}' marks '${section.name}' absent but the reference baseline has no such emitted output.`);
        continue;
      }
      expectedOutputs.delete(key);
      used.push(`${artifactName}#${section.name} (absent)`);
      continue;
    }
    if (!expectedOutputs.has(key)) {
      problems.push(`tsgo-accepted overlay '${artifactName}' overrides '${section.name}' but the reference baseline has no such emitted output.`);
      continue;
    }
    if (expectedOutputs.get(key) === section.content) {
      problems.push(`tsgo-accepted overlay '${artifactName}#${section.name}' matches the reference baseline; remove the stale overlay.`);
      continue;
    }
    expectedOutputs.set(key, section.content);
    used.push(`${artifactName}#${section.name}`);
  }
  return { used, problems };
}


const emittedSourceExtensionPattern = /\.(?:d\.[cm]?ts|[cm]?[jt]sx?)$/i;

// Strips test-path prefixes the same way tsbaseline/util.go removeTestPathPrefixes does
// (retainTrailingDirectorySeparator=false branch).
export function removeTestPathPrefixes(text) {
  return text
    .replaceAll("/.ts/", "")
    .replaceAll("/.lib/", "")
    .replaceAll("/.src/", "")
    .replaceAll("bundled:///libs/", "")
    .replaceAll("file:///./ts/", "file:///")
    .replaceAll("file:///./lib/", "file:///")
    .replaceAll("file:///./src/", "file:///");
}

// Maps a materialized emitted-output path (relative to the case dir) back to the name the
// upstream baseline writer uses for it. js_emit_baseline.go fileOutput keys each emitted
// file by the emitted file's unit name: basename-only unless @fullEmitPaths.
export function upstreamOutputName(materialized, outputFile) {
  if (materialized.units === undefined) {
    return outputFile;
  }
  if (materialized.fullEmitPaths === true) {
    return normalizedBaselineSectionPath(removeTestPathPrefixes(outputFile));
  }
  return outputFile.split("/").at(-1);
}

// Rewrites materialized file paths in diagnostic output back to the upstream unit-name
// coordinates so headline comparison happens in the upstream coordinate system. Upstream
// compiles with the unit names verbatim (a vfs), so message-embedded paths print exactly
// as authored; on the real filesystem the CLI prints absolute case paths instead.
export function translateDiagnosticPathsToUnitNames(materialized, text) {
  const units = materialized.units;
  if (units === undefined) {
    return text;
  }
  const caseDirPrefix = `${materialized.caseDir.split(sep).join("/")}/`;
  const sourceExtension = /\.(?:d\.[cm]?ts|[cm]?[jt]sx?)$/i;
  const replacements = [];
  for (const unit of units) {
    if (unit.unitName === unit.filePath) {
      continue;
    }
    replacements.push([`${caseDirPrefix}${unit.filePath}`, removeTestPathPrefixes(unit.unitName)]);
    const stem = unit.filePath.replace(sourceExtension, "");
    if (stem !== unit.filePath) {
      replacements.push([`${caseDirPrefix}${stem}`, removeTestPathPrefixes(unit.unitName.replace(sourceExtension, ""))]);
    }
  }
  replacements.sort(([left], [right]) => right.length - left.length);
  let translated = text;
  for (const [from, to] of replacements) {
    translated = translated.replaceAll(from, to);
  }
  translated = translated.replaceAll(caseDirPrefix, "");
  return translated.split("\n").map((line) => {
    for (const unit of units) {
      if (unit.unitName !== unit.filePath && line.startsWith(`${unit.filePath}(`)) {
        return removeTestPathPrefixes(unit.unitName) + line.slice(unit.filePath.length);
      }
    }
    return line;
  }).join("\n");
}

async function evaluateExactBaselines(testCase, materialized, commandOutput) {
  const artifacts = exactBaselineArtifacts(testCase);
  const unsupported = artifacts
    .filter((artifact) => artifact.diff || unsupportedExactBaselineFilePattern.test(artifact.name))
    .map((artifact) => artifact.diff ? `${artifact.name}.diff` : artifact.name);
  const comparable = artifacts.filter((artifact) => !artifact.diff && comparableBaselineFilePattern.test(artifact.name));
  const diagnostics = artifacts.filter((artifact) => !artifact.diff && diagnosticBaselineFilePattern.test(artifact.name));
  const typeSymbol = artifacts.filter((artifact) => !artifact.diff && typeSymbolBaselineFilePattern.test(artifact.name));
  // TS-Go-authority baselines (current corpus testdata and the reference/submodule
  // trees) are whole-file: a single `<case>.js` assembled by js_emit_baseline.go
  // (inputs + emitted JS + emitted DTS) instead of the per-section layout of the
  // Strada-era baselines used by the transpile/project suites.
  const isCurrentCorpus = usesTsgoAuthorityBaselines(testCase);
  const mismatches = [];
  // TS-Go-authority cases compile in an in-memory harness vfs (harnessCompile.mjs):
  // upstream unit coordinates end to end, all-stage diagnostics collected before emit
  // (mirroring compiler_runner.go's verify order), no real-filesystem translation. The
  // CLI invocation on the materialized directory remains the product-behavior signal.
  const usesVfsHarness = isCurrentCorpus && materialized.units !== undefined && materialized.invocation !== undefined;
  let sharedVfsCase;
  const ensureVfsCase = async () => {
    if (sharedVfsCase === undefined) {
      const { compileHarnessCase } = await import("./tsbaseline/harnessCompile.mjs");
      try {
        sharedVfsCase = compileHarnessCase({
          units: (materialized.units ?? []).map((unit) => ({ fileName: unit.unitName, content: unit.content })),
          symlinks: materialized.symlinks ?? new Map(),
          configuration: testCase.configuration ?? new Map(),
        });
      } catch (error) {
        // A failed harness compile must fail THIS case loudly, not kill the runner.
        sharedVfsCase = {
          error,
          harnessOptions: {},
          toBeCompiled: [],
          otherFiles: [],
          diagnostics: [],
          emittedOutputs: new Map(),
        };
        mismatches.push(`Harness compile failed: ${error?.stack?.split("\n").slice(0, 2).join(" | ") ?? error}.`);
      }
    }
    return sharedVfsCase;
  };
  const wholeFileJs = [];
  let sectionComparable = comparable;
  const wholeFileSourceMaps = [];
  if (isCurrentCorpus) {
    sectionComparable = [];
    for (const artifact of comparable) {
      if (/\.js$/i.test(artifact.name)) {
        wholeFileJs.push(artifact);
      } else if (/\.js\.map$/i.test(artifact.name)) {
        wholeFileSourceMaps.push(artifact);
      } else {
        mismatches.push(`Exact baseline artifact '${artifact.name}' is not supported for the current corpus yet.`);
      }
    }
  }
  const expectedDiagnosticHeadlines = [];
  const expectedDiagnosticSources = [];
  if (artifacts.length === 0) {
    // Upstream legitimately writes zero reference baselines when every writer yields no
    // content: baseline.Run treats NoContent as "this baseline file must not exist".
    // That requires zero diagnostics (gated separately below), @noTypesAndSymbols
    // disabling the type/symbol writers (compiler_runner.go verifyTypesAndSymbols), and
    // a compilation that emits nothing (the js/sourcemap writers then produce
    // NoContent). Anything else with zero reference artifacts is a real mismatch.
    const vfsCase = usesVfsHarness ? await ensureVfsCase() : undefined;
    const emitted = vfsCase !== undefined ? vfsCase.emittedOutputs : await emittedOutputsForCase(materialized);
    const noTypesAndSymbols = vfsCase !== undefined
      ? vfsCase.harnessOptions.notypesandsymbols === true
      : materialized.noTypesAndSymbols === true;
    if (!noTypesAndSymbols) {
      mismatches.push("No reference baseline artifacts were found for this case, and type/symbol baselines are enabled (no @noTypesAndSymbols).");
    } else if (emitted.size !== 0) {
      mismatches.push(`No reference baseline artifacts were found for this case, but the compilation emitted ${[...emitted.keys()].sort().join(", ")}.`);
    }
  }
  const expectedOutputs = new Map();
  for (const artifact of sectionComparable) {
    const sections = parseBaselineSections(readFileSync(artifact.path, "utf8"));
    const sectionNameCounts = new Map();
    for (const section of sections) {
      const key = normalizedBaselineSectionPath(section.name);
      sectionNameCounts.set(key, (sectionNameCounts.get(key) ?? 0) + 1);
    }
    const seen = new Map();
    for (const section of sections) {
      if (section.name === "Diagnostics reported") {
        expectedDiagnosticHeadlines.push(diagnosticHeadlineText(section.content));
        expectedDiagnosticSources.push(`${artifact.name}#Diagnostics reported`);
        continue;
      }
      const key = normalizedBaselineSectionPath(section.name);
      const occurrence = (seen.get(key) ?? 0) + 1;
      seen.set(key, occurrence);
      if (!emittedOutputFilePattern.test(key)) {
        continue;
      }
      if (materialized.writtenFileSet.has(key) && (sectionNameCounts.get(key) ?? 0) > 1 && occurrence === sectionNameCounts.get(key)) {
        expectedOutputs.set(key, section.content);
      } else if (!materialized.writtenFileSet.has(key)) {
        expectedOutputs.set(key, section.content);
      }
    }
  }
  for (const artifact of diagnostics) {
    expectedDiagnosticHeadlines.push(diagnosticHeadlineText(readFileSync(artifact.path, "utf8")));
    expectedDiagnosticSources.push(artifact.name);
  }
  const tsgoAccepted = [];
  for (const artifact of [...sectionComparable, ...diagnostics]) {
    const overlaySections = loadTsgoAcceptedOverlay(testCase.corpus, testCase.suite, artifact.name);
    if (overlaySections === undefined) {
      continue;
    }
    const { used, problems } = applyTsgoAcceptedOverlay(artifact.name, overlaySections, expectedOutputs, expectedDiagnosticHeadlines, expectedDiagnosticSources);
    tsgoAccepted.push(...used);
    mismatches.push(...problems);
  }
  const baselineHeader = `tests/cases/${testCase.relativePath}`;
  // The reference baselines are HARNESS output: harnessutil.go collects every
  // diagnostics stage unconditionally (program, syntactic, SEMANTIC, global,
  // declaration) and then emits, while the CLI's staged pipeline skips the semantic
  // check when an earlier stage reported — and declaration-emit node reuse depends on
  // the links that check populates. Diagnostics for the errors.txt comparison come from
  // the vfs harness compile, already rendered in upstream coordinates.
  let actualDiagnostics = translateDiagnosticPathsToUnitNames(materialized, diagnosticHeadlineText(commandOutput));
  let harnessDiagnostics;
  if (usesVfsHarness) {
    const vfsCase = await ensureVfsCase();
    harnessDiagnostics = vfsCase.diagnostics;
    const { formatHarnessDiagnostics } = await import("./tsbaseline/typeSymbolWalker.mjs");
    const tristateTruePretty = 2;
    actualDiagnostics = diagnosticHeadlineText(formatHarnessDiagnostics("", harnessDiagnostics, vfsCase.compilerOptions?.Pretty === tristateTruePretty));
  }
  const expectedDiagnostics = expectedDiagnosticHeadlines.filter((text) => text !== "").join("\n");
  if (expectedDiagnosticSources.length !== 0 && expectedDiagnostics !== actualDiagnostics) {
    mismatches.push(`Diagnostic headline baseline '${expectedDiagnosticSources.join(", ")}' does not match actual compiler diagnostics.`);
    const diagnosticArtifactName = diagnostics[0]?.name ?? "diagnostics.errors.txt";
    await writeFile(join(materialized.caseDir, `${diagnosticArtifactName}.actual`), actualDiagnostics);
  } else if (expectedDiagnosticSources.length === 0 && actualDiagnostics !== "") {
    mismatches.push("Unexpected compiler diagnostics with no reference diagnostic baseline.");
    await writeFile(join(materialized.caseDir, "diagnostics.errors.txt.actual"), actualDiagnostics);
  }

  // compiler_runner.go passes hasErrorBaseline = len(result.Diagnostics) > 0, where
  // result.Diagnostics is the harness compile's all-stage diagnostics.
  const hasDiagnostics = harnessDiagnostics !== undefined ? harnessDiagnostics.length > 0 : diagnosticHeadlineText(commandOutput) !== "";
  if (typeSymbol.length !== 0 && materialized.noTypesAndSymbols === true) {
    // compiler_runner.go verifyTypesAndSymbols returns early under @noTypesAndSymbols,
    // so a committed type/symbol reference baseline is unreachable upstream: stale.
    mismatches.push(`Type/symbol baselines exist but @noTypesAndSymbols disables them upstream: ${typeSymbol.map((artifact) => artifact.name).join(", ")}.`);
  } else if (typeSymbol.length !== 0) {
    if (!usesVfsHarness) {
      mismatches.push(`Type/symbol baselines are not supported for this case kind: ${typeSymbol.map((artifact) => artifact.name).join(", ")}.`);
    } else {
      try {
        const { generateTypeAndSymbolBaselines } = await import("./tsbaseline/typeSymbolWalker.mjs");
        const vfsCase = await ensureVfsCase();
        const allFiles = [...vfsCase.toBeCompiled, ...vfsCase.otherFiles].map((file) => ({
          unitName: file.unitName,
          programPath: file.unitName,
          content: file.content,
        }));
        const generated = generateTypeAndSymbolBaselines({
          allFiles,
          header: baselineHeader,
          hasErrorBaseline: hasDiagnostics,
          program: vfsCase.program,
        });
        for (const artifact of typeSymbol) {
          const expected = normalizeEmittedOutputText(readFileSync(artifact.path, "utf8"));
          const actual = normalizeEmittedOutputText(artifact.name.endsWith(".symbols") ? generated.symbols : generated.types);
          if (actual !== expected) {
            mismatches.push(`Type/symbol baseline '${artifact.name}' does not match the generated baseline.`);
            // Mirror upstream baseline.Run, which writes the actual ("local") baseline on
            // every difference so it can be diffed against the reference.
            await writeFile(join(materialized.caseDir, `${artifact.name}.actual`), actual);
          }
        }
      } catch (error) {
        mismatches.push(`Type/symbol baseline generation failed: ${error?.message ?? error}.`);
      }
    }
  }

  if (wholeFileJs.length !== 0) {
    if (!usesVfsHarness) {
      mismatches.push(`JS emit baselines are not supported for this case kind: ${wholeFileJs.map((artifact) => artifact.name).join(", ")}.`);
    } else {
      try {
        const { generateJsEmitBaseline } = await import("./tsbaseline/jsEmitBaseline.mjs");
        const { compileDeclarationFiles, repeatWithNoCheck } = await import("./tsbaseline/harnessCompile.mjs");
        const vfsCase = await ensureVfsCase();
        const declarationCompilation = vfsCase.error === undefined ? await compileDeclarationFiles(vfsCase) : undefined;
        // js_emit_baseline.go: rerun with noCheck unless the case sets noCheck/noEmit.
        const tristateTrue = 2;
        const noCheckRepeat = vfsCase.error === undefined &&
          vfsCase.compilerOptions.NoCheck !== tristateTrue &&
          vfsCase.compilerOptions.NoEmit !== tristateTrue
          ? repeatWithNoCheck(vfsCase)
          : undefined;
        const assembled = generateJsEmitBaseline({
          program: vfsCase.program,
          toBeCompiled: vfsCase.toBeCompiled,
          otherFiles: vfsCase.otherFiles,
          tsConfigFiles: vfsCase.tsConfigFiles,
          header: baselineHeader,
          hasDiagnostics,
          fullEmitPaths: vfsCase.harnessOptions.fullemitpaths === true,
          emittedOutputs: vfsCase.emittedOutputs,
          declarationCompilation,
          noCheckRepeat,
        });
        const actual = normalizeEmittedOutputText(assembled);
        for (const artifact of wholeFileJs) {
          const expected = normalizeEmittedOutputText(readFileSync(artifact.path, "utf8"));
          if (actual !== expected) {
            mismatches.push(`JS emit baseline '${artifact.name}' does not match the assembled baseline.`);
            await writeFile(join(materialized.caseDir, `${artifact.name}.actual`), actual);
          }
        }
      } catch (error) {
        mismatches.push(`JS emit baseline generation failed: ${error?.message ?? error}.`);
      }
    }
  }

  if (wholeFileSourceMaps.length !== 0) {
    if (!usesVfsHarness) {
      mismatches.push(`Source map baselines are not supported for this case kind: ${wholeFileSourceMaps.map((artifact) => artifact.name).join(", ")}.`);
    } else {
      try {
        const { generateSourceMapBaseline } = await import("./tsbaseline/sourceMapBaseline.mjs");
        const vfsCase = await ensureVfsCase();
        const assembled = generateSourceMapBaseline({
          program: vfsCase.program,
          compilerOptions: vfsCase.compilerOptions,
          hasDiagnostics,
          fullEmitPaths: vfsCase.harnessOptions.fullemitpaths === true,
          emittedOutputs: vfsCase.emittedOutputs,
        });
        for (const artifact of wholeFileSourceMaps) {
          if (assembled === undefined) {
            mismatches.push(`Source map baseline '${artifact.name}' exists but the compilation produces no source map baseline.`);
            continue;
          }
          const expected = normalizeEmittedOutputText(readFileSync(artifact.path, "utf8"));
          const actual = normalizeEmittedOutputText(assembled);
          if (actual !== expected) {
            mismatches.push(`Source map baseline '${artifact.name}' does not match the assembled baseline.`);
            await writeFile(join(materialized.caseDir, `${artifact.name}.actual`), actual);
          }
        }
      } catch (error) {
        mismatches.push(`Source map baseline generation failed: ${error?.message ?? error}.`);
      }
    }
  }


  if (!isCurrentCorpus) {
    const actualOutputsRaw = await emittedOutputsForCase(materialized);
    const actualOutputs = new Map();
    for (const [outputFile, content] of actualOutputsRaw) {
      actualOutputs.set(upstreamOutputName(materialized, outputFile), content);
    }
    for (const [outputFile, actualContent] of actualOutputs) {
      const expected = expectedOutputs.get(outputFile);
      if (expected === undefined) {
        mismatches.push(`Unexpected emitted output '${outputFile}'.`);
        continue;
      }
      if (normalizeEmittedOutputText(actualContent) !== normalizeEmittedOutputText(expected)) {
        mismatches.push(`Emitted output '${outputFile}' does not match its reference baseline section.`);
      }
    }
    for (const outputFile of expectedOutputs.keys()) {
      if (!actualOutputs.has(outputFile)) {
        mismatches.push(`Expected baseline output '${outputFile}' was not emitted.`);
      }
    }
  }
  if (unsupported.length !== 0) {
    mismatches.push(`Unsupported exact baseline artifact(s): ${unsupported.join(", ")}.`);
  }
  return {
    checked: artifacts.length,
    comparable: comparable.length + diagnostics.length + typeSymbol.length,
    unsupported,
    tsgoAccepted,
    mismatches,
    status: mismatches.length === 0 ? "pass" : "fail",
    // Whether the post-overlay reference baseline expects any diagnostics. In exact mode this is
    // the authoritative "expectedErrors" for transpile cases, whose diagnostics live in the
    // baseline's 'Diagnostics reported' section (with tsgo-accepted overlays applied), not a
    // separate .errors.txt.
    expectedDiagnosticsPresent: expectedDiagnosticHeadlines.some((headline) => headline.trim() !== ""),
    // For the harness-only fast path: actualErrors derived from the harness compile's all-stage
    // diagnostics (compiler_runner.go uses len(result.Diagnostics) > 0). usedHarness tells the
    // caller this case was fully evaluated in-process (no on-disk CLI compile needed for the
    // verdict). harnessEmitted is the in-memory emit, used by --verify-on-disk to prove the
    // on-disk CLI emit matches.
    actualErrors: usesVfsHarness ? hasDiagnostics : undefined,
    usedHarness: usesVfsHarness,
    harnessEmitted: sharedVfsCase?.emittedOutputs,
  };
}

export function diagnosticHeadlineText(text) {
  const lines = stripAnsiEscapes(normalizeComparableText(text)).split("\n");
  const headlines = [];
  for (const line of lines) {
    if (line.trim() === "") {
      if (headlines.length !== 0) {
        break;
      }
      continue;
    }
    if (diagnosticHeadlinePattern.test(line)) {
      headlines.push(line);
    }
  }
  return headlines.join("\n");
}

// Classifies a case-dir-relative path as a compiler-emitted output (vs a materialized
// input). Returns the normalized relative path, or undefined for inputs. Shared by the
// output collector and the in-process Program's FS filter so both agree exactly on what
// "emitted" means.
function emittedOutputRelativePath(materialized, relativeFile) {
  const normalized = normalizedBaselineSectionPath(relativeFile);
  if (!emittedOutputFilePattern.test(normalized)) {
    return undefined;
  }
  if (materialized.writtenFileSet.has(normalized)) {
    return undefined;
  }
  if (normalized.startsWith(".lib/") || normalized.startsWith(".ts/") || normalized.startsWith(".empty-types/")) {
    return undefined;
  }
  return normalized;
}

async function emittedOutputsForCase(materialized) {
  const outputs = new Map();
  for (const file of await walkFiles(materialized.caseDir)) {
    const relativeFile = relative(materialized.caseDir, file).split(sep).join("/");
    const normalized = emittedOutputRelativePath(materialized, relativeFile);
    if (normalized === undefined) {
      continue;
    }
    // Keep raw bytes: every textual comparison normalizes newlines itself, and the
    // source-map preview links base64 the EXACT emitted file contents (CRLF included).
    outputs.set(normalized, translateEmittedContentToUnitCoordinates(materialized, await readFile(file, "utf8")));
  }
  return outputs;
}

// Inverse of the materializer's source-content rewrites: the compiler copies rewritten
// fragments (triple-slash reference paths, module specifiers, /.lib/ references)
// verbatim into emitted outputs, while upstream compiles the unrewritten units in a vfs
// and emits the original fragments. Replay the recorded pairs in reverse so emitted
// outputs compare in upstream unit coordinates.
function translateEmittedContentToUnitCoordinates(materialized, content) {
  let translated = content;
  for (const [from, to] of materialized.contentRewrites ?? []) {
    translated = translated.replaceAll(from, to);
  }
  return translated;
}

function dedupedContentRewrites(contentRewrites) {
  const seen = new Set();
  const deduped = [];
  for (const pair of contentRewrites) {
    const key = JSON.stringify(pair);
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(pair);
    }
  }
  // Longest rewritten fragment first so a shorter pair can never clip a longer one.
  return deduped.sort(([left], [right]) => right.length - left.length);
}

function normalizedBaselineSectionPath(fileName) {
  return fileName.replaceAll("\\", "/").replace(/^\/+/, "");
}

function normalizeComparableText(text) {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function normalizeEmittedOutputText(text) {
  return normalizeComparableText(text).replace(/\n$/, "");
}

function configuredCaseName(testCase) {
  return testCase.configurationName === "" ? testCase.caseName : `${testCase.caseName}(${testCase.configurationName})`;
}

function configuredBaselineCaseNames(testCase) {
  if (testCase.configurationName === "") {
    return [testCase.caseName];
  }
  const names = [configuredCaseName(testCase)];
  const canonical = testCase.configurationName
    .split(",")
    .map((entry) => {
      const [option, ...valueParts] = entry.split("=");
      const value = valueParts.join("=");
      const displayName = compilerOptionDisplayName(option);
      return displayName === undefined ? entry : `${displayName}=${value}`;
    })
    .join(",");
  const canonicalName = `${testCase.caseName}(${canonical})`;
  if (!names.includes(canonicalName)) {
    names.push(canonicalName);
  }
  return names;
}

function compilerOptionDisplayName(option) {
  return booleanOptionNames.get(option) ?? stringOptions.get(option) ?? listOptions.get(option) ?? numberOptions.get(option);
}

async function materializeCase(testCase, runRoot) {
  if (testCase.kind === "project") {
    return materializeProjectCase(testCase, runRoot);
  }

  const sourceText = await readSourceText(testCase.sourcePath);
  const parsed = parseFileBasedTest(sourceText, testCase.relativePath.split("/").at(-1));
  const pathOptions = harnessPathOptionsFromSettings(testCase.configuration);
  const caseDir = join(runRoot, caseDirectoryFragment(testCase));
  await mkdir(caseDir, { recursive: true });
  const needsLibFolder = parsed.units.some((unit) => unit.content.includes("/.lib/")) || parsed.globalOptions.has("libfiles");
  if (needsLibFolder) {
    await cp(testLibRoot, join(caseDir, ".lib"), { recursive: true, force: true });
  }

  const writtenFiles = [];
  const contentRewrites = [];
  for (const unit of parsed.units) {
    const filePath = normalizeHarnessPath(unit.fileName, pathOptions);
    const fullPath = join(caseDir, filePath);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, rewriteHarnessFileContent(unit.content, filePath, pathOptions, contentRewrites));
    writtenFiles.push(filePath);
  }
  await materializeHarnessApiDeclarations(caseDir, parsed, pathOptions);
  if (!hasRootPackageJson(writtenFiles)) {
    await writeFile(join(caseDir, "package.json"), "{}\n");
    writtenFiles.push("package.json");
  }
  await materializeSymlinks(caseDir, parsed.symlinks, pathOptions);

  if (isTranspileCase(testCase)) {
    const compilerOptions = compilerOptionsForMaterializedCase(testCase.configuration, parsed, writtenFiles);
    return {
      caseDir,
      invocations: transpileInvocationsForMaterializedCase(compilerOptions, parsed, pathOptions, testCase.configuration),
      writtenFiles,
      writtenFileSet: normalizedWrittenFileSet(writtenFiles),
      expectedErrors: false,
      skipReason: "",
      transpile: true,
    };
  }

  const units = parsed.units.map((unit) => ({
    unitName: unit.fileName,
    filePath: normalizeHarnessPath(unit.fileName, pathOptions),
    // Upstream TestFile.Content is the unit text as authored; the baseline writers
    // interleave it verbatim. (The materialized on-disk copy may have rewritten
    // harness-virtual paths for the real filesystem.)
    content: unit.content,
  }));
  const fullEmitPaths = (parsed.globalOptions?.get("fullemitpaths") ?? testCase.configuration?.get?.("fullemitpaths")) === "true";
  // Harness-only option: compiler_runner.go verifyTypesAndSymbols returns early under
  // @noTypesAndSymbols, so upstream writes no type/symbol baselines for such cases.
  const noTypesAndSymbols = (parsed.globalOptions?.get("notypesandsymbols") ?? testCase.configuration?.get?.("notypesandsymbols")) === "true";
  // compiler_runner.go: `configuration["noimplicitreferences"] != ""` switches the
  // baseline partition to last-unit-only.
  const noImplicitReferencesValue = parsed.globalOptions?.get("noimplicitreferences") ?? testCase.configuration?.get?.("noimplicitreferences");
  const noImplicitReferences = noImplicitReferencesValue !== undefined && noImplicitReferencesValue !== "";
  const existingConfig = writtenFiles.find((file) => /(^|\/)tsconfig\.json$/i.test(file));
  if (existingConfig !== undefined) {
    const merged = await mergeFileBasedOptionsIntoProjectConfig(join(caseDir, existingConfig), testCase.configuration);
    const compilerOptions = merged.config?.compilerOptions ?? {};
    // SkipUnsupportedCompilerOptions runs on the EFFECTIVE options, so follow the
    // config's `extends` chain (parents merged under the child) for the skip decision.
    const inheritedOptions = merged.config === undefined ? {} : await inheritedConfigCompilerOptions(join(caseDir, existingConfig), merged.config);
    const skipReason = getSkipReasonFromCompilerOptions(testCase.sourceBaseName, { ...inheritedOptions, ...compilerOptions });
    return {
      caseDir,
      invocation: {
        cwd: caseDir,
        args: ["-p", join(caseDir, existingConfig), "--pretty", "false"],
      },
      units,
      symlinks: parsed.symlinks,
      fullEmitPaths,
      noTypesAndSymbols,
      noImplicitReferences,
      hasTsconfigUnit: true,
      contentRewrites: dedupedContentRewrites(contentRewrites),
      writtenFiles,
      writtenFileSet: normalizedWrittenFileSet(writtenFiles),
      expectedErrors: merged.parsedByTypescript ? caseExpectedErrors(testCase, compilerOptions) : false,
      skipReason,
    };
  }

  const inputFiles = selectInputFiles(parsed, writtenFiles, testCase.configuration);
  const compilerOptions = compilerOptionsForMaterializedCase(testCase.configuration, parsed, inputFiles);
  if (needsLibFolder) {
    compilerOptions.skipLibCheck = true;
  }
  await materializeSyntheticCompilerOptionRoots(caseDir, compilerOptions);
  const skipReason = getSkipReasonFromCompilerOptions(testCase.sourceBaseName, compilerOptions);
  return {
    caseDir,
    invocation: {
      cwd: caseDir,
      args: compilerCommandLineArgsForMaterializedCase(compilerOptions, inputFiles),
    },
    // Parsed unit order; the baseline writers partition into toBeCompiled/otherFiles
    // (membership in the parsed command line's root files, unit order preserved) the
    // same way compiler_runner.go does.
    units,
    symlinks: parsed.symlinks,
    fullEmitPaths,
    noTypesAndSymbols,
    noImplicitReferences,
    hasTsconfigUnit: false,
    contentRewrites: dedupedContentRewrites(contentRewrites),
    writtenFiles,
    writtenFileSet: normalizedWrittenFileSet(writtenFiles),
    expectedErrors: caseExpectedErrors(testCase, compilerOptions),
    skipReason,
  };
}

async function materializeProjectCase(testCase, runRoot) {
  const descriptor = testCase.descriptor ?? await readProjectTestDescriptor(testCase.sourcePath);
  const projectRoot = projectRootRelativeToCaseRoot(descriptor.projectRoot);
  const sourceProjectRoot = join(typeScriptSubmoduleCaseRoot, projectRoot);

  const caseDir = join(runRoot, caseDirectoryFragment(testCase));
  const materializedCaseRoot = join(caseDir, "tests/cases");
  const materializedProjectRoot = join(materializedCaseRoot, projectRoot);
  await mkdir(materializedProjectRoot, { recursive: true });
  if (existsSync(sourceProjectRoot)) {
    await cp(sourceProjectRoot, materializedProjectRoot, { recursive: true, force: true });
  }
  await writeFile(join(caseDir, "package.json"), "{}\n");

  const compilerOptions = compilerOptionsForProjectDescriptor(descriptor, testCase.moduleKind, caseDir);
  const invocation = projectInvocationForDescriptor(descriptor, compilerOptions, materializedProjectRoot);
  const writtenFiles = (await walkFiles(materializedProjectRoot)).map((file) => relative(materializedProjectRoot, file).split(sep).join("/"));
  return {
    caseDir,
    invocation,
    writtenFiles,
    writtenFileSet: normalizedWrittenFileSet(writtenFiles),
    expectedErrors: caseExpectedErrors(testCase, compilerOptions),
    skipReason: getSkipReasonFromCompilerOptions(testCase.sourceBaseName, compilerOptions),
  };
}

function normalizedWrittenFileSet(writtenFiles) {
  return new Set(writtenFiles.map((file) => normalizedBaselineSectionPath(file)));
}

function projectRootRelativeToCaseRoot(projectRoot) {
  return normalizeProjectDescriptorPath(projectRoot).replace(/^tests\/cases\//, "");
}

function normalizeProjectDescriptorPath(path) {
  return path.replaceAll("\\", "/").replace(/^\/+/, "").replace(/\/+$/, "");
}

export function compilerOptionsForProjectDescriptor(descriptor, moduleKind, caseDir = "") {
  const compilerOptions = {
    noErrorTruncation: false,
    skipDefaultLibCheck: false,
    moduleResolution: "classic",
    module: moduleKind,
    newLine: "crlf",
  };
  const projectMetaKeys = new Set([
    "scenario",
    "projectRoot",
    "inputFiles",
    "resolveMapRoot",
    "resolveSourceRoot",
    "baselineCheck",
    "runTest",
    "bug",
    "project",
    "emittedFiles",
  ]);
  for (const [rawName, rawValue] of Object.entries(descriptor)) {
    const name = rawName.toLowerCase();
    if (projectMetaKeys.has(rawName)) {
      continue;
    }
    if (rawName === "mapRoot") {
      compilerOptions.mapRoot = descriptor.resolveMapRoot === true && typeof rawValue === "string"
        ? join(caseDir, normalizeProjectDescriptorPath(rawValue))
        : rawValue;
      continue;
    }
    if (rawName === "sourceRoot") {
      compilerOptions.sourceRoot = descriptor.resolveSourceRoot === true && typeof rawValue === "string"
        ? join(caseDir, normalizeProjectDescriptorPath(rawValue))
        : rawValue;
      continue;
    }
    const optionName = compilerOptionNameFromJsonKey(name);
    if (optionName === undefined) {
      continue;
    }
    compilerOptions[optionName] = rawValue;
  }
  return compilerOptions;
}

function compilerOptionNameFromJsonKey(name) {
  if (booleanOptions.has(name)) {
    return booleanOptionNames.get(name);
  }
  return stringOptions.get(name) ?? numberOptions.get(name) ?? listOptions.get(name);
}

function projectInvocationForDescriptor(descriptor, compilerOptions, materializedProjectRoot) {
  if (typeof descriptor.project === "string" && descriptor.project !== "") {
    return {
      cwd: materializedProjectRoot,
      args: [
        "-p",
        join(materializedProjectRoot, descriptor.project, "tsconfig.json"),
        ...compilerCommandLineArgsForProjectOptions(compilerOptions),
        "--pretty",
        "false",
      ],
    };
  }

  if (Array.isArray(descriptor.inputFiles) && descriptor.inputFiles.length !== 0) {
    return {
      cwd: materializedProjectRoot,
      args: [
        "--ignoreConfig",
        ...compilerCommandLineArgsForProjectOptions(compilerOptions),
        "--pretty",
        "false",
        ...descriptor.inputFiles,
      ],
    };
  }

  return {
    cwd: materializedProjectRoot,
    args: [
      "-p",
      join(materializedProjectRoot, "tsconfig.json"),
      ...compilerCommandLineArgsForProjectOptions(compilerOptions),
      "--pretty",
      "false",
    ],
  };
}

function compilerCommandLineArgsForProjectOptions(compilerOptions) {
  const args = [];
  for (const key of Object.keys(compilerOptions).sort()) {
    const value = compilerOptions[key];
    if (value === undefined) {
      continue;
    }
    args.push(`--${key}`);
    if (value === true) {
      continue;
    }
    if (Array.isArray(value)) {
      args.push(value.join(","));
      continue;
    }
    args.push(String(value));
  }
  return args;
}

async function materializeSyntheticCompilerOptionRoots(caseDir, compilerOptions) {
  if (Array.isArray(compilerOptions.typeRoots) && compilerOptions.typeRoots.includes(".empty-types")) {
    await mkdir(join(caseDir, ".empty-types"), { recursive: true });
  }
}

function isTranspileCase(testCase) {
  return testCase.corpus === "typescript" && testCase.suite === "transpile";
}

export function transpileInvocationsForMaterializedCase(compilerOptions, parsed, pathOptions = defaultHarnessPathOptions(), settings = new Map()) {
  const sourceFiles = parsed.units
    .map((unit) => normalizeHarnessPath(unit.fileName, pathOptions))
    .filter((file) => harnessSourceFilePattern.test(file));
  const invocations = [];
  const reportDiagnostics = settings.get("reportdiagnostics")?.toLowerCase() === "true";
  if (compilerOptions.emitDeclarationOnly !== true) {
    for (const inputFile of sourceFiles) {
      invocations.push({
        label: `module:${inputFile}`,
        kind: "module",
        inputFile,
        reportDiagnostics,
        compilerOptions: compilerOptionsForTranspileInvocation(compilerOptions, "module"),
        args: compilerCommandLineArgsForTranspileInvocation(compilerOptions, inputFile, "module"),
        expectedOutputFiles: transpileExpectedOutputFiles(inputFile, compilerOptions, "module"),
      });
    }
  }
  if (compilerOptions.declaration === true) {
    for (const inputFile of sourceFiles) {
      invocations.push({
        label: `declaration:${inputFile}`,
        kind: "declaration",
        inputFile,
        reportDiagnostics,
        compilerOptions: compilerOptionsForTranspileInvocation(compilerOptions, "declaration"),
        args: compilerCommandLineArgsForTranspileInvocation(compilerOptions, inputFile, "declaration"),
        expectedOutputFiles: transpileExpectedOutputFiles(inputFile, compilerOptions, "declaration"),
      });
    }
  }
  return invocations;
}

export function transpileExpectedOutputFiles(inputFile, compilerOptions, kind) {
  if (kind === "module") {
    const jsFile = changeHarnessExtension(inputFile, getJsOutputExtension(inputFile, compilerOptions));
    const outputs = [jsFile];
    if (compilerOptions.sourceMap === true && compilerOptions.inlineSourceMap !== true) {
      outputs.push(`${jsFile}.map`);
    }
    return outputs;
  }
  if (kind === "declaration") {
    const declarationFile = changeHarnessExtension(inputFile, ts.getDeclarationEmitExtensionForPath(inputFile));
    const outputs = [declarationFile];
    if (compilerOptions.declarationMap === true) {
      outputs.push(`${declarationFile}.map`);
    }
    return outputs;
  }
  throw new Error(`Unsupported transpile output kind '${kind}'`);
}

function getJsOutputExtension(inputFile, compilerOptions) {
  return ts.getOutputExtension(inputFile, {
    jsx: compilerOptions.jsx === "preserve" ? ts.JsxEmit.Preserve : undefined,
  });
}

function changeHarnessExtension(inputFile, extension) {
  return inputFile.replace(/\.[cm]?[tj]sx?$/i, extension);
}

// Follows a tsconfig's `extends` chain (string or array, relative paths) and returns
// the union of ancestor compilerOptions, nearest ancestor winning. Only used to mirror
// SkipUnsupportedCompilerOptions on the effective options.
async function inheritedConfigCompilerOptions(configPath, rootConfig) {
  let options = {};
  const visit = async (path, config, depth) => {
    if (depth > 8 || config === undefined) {
      return;
    }
    const extendsList = config.extends === undefined ? [] : Array.isArray(config.extends) ? config.extends : [config.extends];
    for (const ext of extendsList) {
      if (typeof ext !== "string" || (!ext.startsWith(".") && !ext.startsWith("/"))) {
        continue;
      }
      let parentPath = join(dirname(path), ext);
      if (!existsSync(parentPath) && existsSync(`${parentPath}.json`)) {
        parentPath = `${parentPath}.json`;
      }
      let parentConfig;
      try {
        parentConfig = ts.parseConfigFileTextToJson(parentPath, await readSourceText(parentPath)).config;
      } catch {
        continue;
      }
      if (parentConfig !== undefined) {
        await visit(parentPath, parentConfig, depth + 1);
        options = { ...options, ...(parentConfig.compilerOptions ?? {}) };
      }
    }
  };
  await visit(configPath, rootConfig, 0);
  return options;
}

async function mergeFileBasedOptionsIntoProjectConfig(configPath, settings) {
  const configText = await readSourceText(configPath);
  const parsed = ts.parseConfigFileTextToJson(configPath, configText);
  if (parsed.error !== undefined) {
    return { config: undefined, parsedByTypescript: false };
  }
  const merged = compilerOptionsForExistingProjectConfig(parsed.config ?? {}, settings);
  await writeFile(configPath, `${JSON.stringify(merged, null, 2)}\n`);
  return { config: merged, parsedByTypescript: true };
}

export function hasRootPackageJson(writtenFiles) {
  return writtenFiles.some((file) => /^package\.json$/i.test(file));
}

export function selectInputFiles(parsed, writtenFiles, configuration) {
  const sourceFiles = writtenFiles.filter((file) => harnessSourceFilePattern.test(file));
  const explicitRootFiles = writtenFiles.filter((file) => isExplicitRootFile(file));
  const lastSourceFile = [...sourceFiles].at(-1);
  const lastUnit = parsed.units.filter((unit) => harnessSourceFilePattern.test(unit.fileName)).at(-1);
  const noImplicitReferences = configuration.get("noimplicitreferences") !== undefined;
  const hasRequireOrReference = lastUnit !== undefined && (hasCommonJsRequireCall(lastUnit.content) || /reference\spath/.test(lastUnit.content));
  if (lastSourceFile !== undefined && (noImplicitReferences || hasRequireOrReference)) {
    return [lastSourceFile];
  }
  return [...new Set([...sourceFiles, ...explicitRootFiles])];
}

function hasCommonJsRequireCall(sourceText) {
  return /(?:^|[^\w$])require\s*\(\s*["']/.test(sourceText);
}

function isExplicitRootFile(file) {
  if (harnessSourceFilePattern.test(file)) {
    return false;
  }
  if (/(^|\/)(?:package|tsconfig)\.json$/i.test(file)) {
    return false;
  }
  if (/(^|\/)\.lib\//i.test(file)) {
    return false;
  }
  if (/\.tsbuildinfo$/i.test(file)) {
    return false;
  }
  if (/\.json$/i.test(file)) {
    return false;
  }
  return true;
}

// `rewrites`, when provided, collects [rewrittenFragment, originalFragment] pairs for
// every source-content rule application. The compiler copies these fragments verbatim
// into emitted outputs (triple-slash reference paths, module specifiers, /.lib/
// references), while upstream compiles the unrewritten units in a vfs and emits the
// originals; the recorded pairs drive the inverse translation of emitted outputs back
// to upstream unit coordinates.
export function rewriteHarnessFileContent(content, filePath, pathOptions, rewrites) {
  let rewritten = content;
  if (rewritten.includes("/.lib/")) {
    let libPath = relative(dirname(filePath), ".lib").split(sep).join("/");
    if (libPath === "") {
      libPath = ".";
    }
    if (!libPath.startsWith(".")) {
      libPath = `./${libPath}`;
    }
    rewritten = rewritten.replaceAll("/.lib/", `${libPath}/`);
    rewrites?.push([`${libPath}/`, "/.lib/"]);
  }
  if (/\.json$/i.test(filePath)) {
    rewritten = rewriteHarnessJsonContent(rewritten, filePath, pathOptions);
  }
  if (harnessSourceFilePattern.test(filePath)) {
    rewritten = rewriteHarnessModuleSpecifiers(rewritten, filePath, pathOptions, rewrites);
  }
  return rewritten.replace(
    /(\/\/\/\s*<reference\s+path=["'])([^"']+)(["'])/gi,
    (match, prefix, referencePath, suffix) => {
      const next = `${prefix}${rewriteHarnessReferencePath(referencePath, filePath, pathOptions)}${suffix}`;
      if (next !== match) {
        rewrites?.push([next, match]);
      }
      return next;
    },
  );
}

function rewriteHarnessModuleSpecifiers(content, filePath, pathOptions, rewrites) {
  const rewriteSpecifier = (specifier) => isHarnessAbsolutePath(specifier) ? rewriteHarnessModuleSpecifier(specifier, filePath, pathOptions) : specifier;
  const rewriteMatch = (match, prefix, specifier, suffix) => {
    const next = `${prefix}${rewriteSpecifier(specifier)}${suffix}`;
    if (next !== match) {
      rewrites?.push([next, match]);
    }
    return next;
  };
  return content
    .replace(/(\b(?:import|export)\s+(?:(?!\bfrom\b)[^"'`])*?\bfrom\s*["'])(\/[^"']+)(["'])/g, rewriteMatch)
    .replace(/(\bimport\s*\(\s*["'])(\/[^"']+)(["']\s*\))/g, rewriteMatch)
    .replace(/(\brequire\s*\(\s*["'])(\/[^"']+)(["']\s*\))/g, rewriteMatch);
}

function rewriteHarnessModuleSpecifier(specifier, filePath, pathOptions) {
  const targetPath = normalizeHarnessPath(specifier, pathOptions);
  let rewritten = posixPath.relative(posixPath.dirname(filePath), targetPath);
  if (rewritten === "") {
    rewritten = posixPath.basename(targetPath);
  }
  if (!rewritten.startsWith(".")) {
    rewritten = `./${rewritten}`;
  }
  return rewritten;
}

function rewriteHarnessJsonContent(content, filePath, pathOptions) {
  try {
    return `${JSON.stringify(rewriteHarnessJsonValue(JSON.parse(content), filePath, pathOptions), null, 4)}\n`;
  } catch {
    return content;
  }
}

function rewriteHarnessJsonValue(value, filePath, pathOptions) {
  if (typeof value === "string") {
    return rewriteHarnessJsonString(value, filePath, pathOptions);
  }
  if (Array.isArray(value)) {
    return value.map((element) => rewriteHarnessJsonValue(element, filePath, pathOptions));
  }
  if (value !== null && typeof value === "object") {
    const rewritten = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      rewritten[key] = rewriteHarnessJsonValue(nestedValue, filePath, pathOptions);
    }
    return rewritten;
  }
  return value;
}

function rewriteHarnessJsonString(value, filePath, pathOptions) {
  if (!isHarnessAbsolutePath(value)) {
    return value;
  }
  const targetPath = normalizeHarnessPath(value, pathOptions);
  let rewritten = posixPath.relative(posixPath.dirname(filePath), targetPath);
  if (rewritten === "") {
    rewritten = posixPath.basename(targetPath);
  }
  if (!rewritten.startsWith(".")) {
    rewritten = `./${rewritten}`;
  }
  return rewritten;
}

function rewriteHarnessReferencePath(referencePath, containingFilePath, pathOptions) {
  if (!isHarnessAbsolutePath(referencePath)) {
    return referencePath;
  }
  const targetPath = normalizeHarnessPath(referencePath, pathOptions);
  let rewritten = posixPath.relative(posixPath.dirname(containingFilePath), targetPath);
  if (rewritten === "") {
    rewritten = posixPath.basename(targetPath);
  }
  return rewritten;
}

function isHarnessAbsolutePath(fileName) {
  const normalized = fileName.replaceAll("\\", "/").trim();
  return /^[a-zA-Z]:\//.test(normalized) || normalized.startsWith("/");
}

async function materializeSymlinks(caseDir, symlinks, pathOptions) {
  for (const [link, target] of symlinks) {
    const linkPath = join(caseDir, normalizeHarnessPath(link, pathOptions));
    const targetPath = join(caseDir, normalizeHarnessPath(target, pathOptions));
    await mkdir(dirname(linkPath), { recursive: true });
    try {
      await symlink(targetPath, linkPath, "dir");
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST") {
        throw error;
      }
    }
  }
}

async function materializeHarnessApiDeclarations(caseDir, parsed, pathOptions) {
  const declarationFileNames = harnessApiDeclarationFileNames(parsed, pathOptions);
  for (const fileName of declarationFileNames) {
    const text = harnessApiDeclarationText(fileName);
    if (text === undefined) {
      throw new Error(`No TypeScript API declaration source available for '${fileName}'`);
    }
    const fullPath = join(caseDir, ".ts", fileName);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, text);
  }
}

export function harnessApiDeclarationFileNames(parsed, pathOptions = defaultHarnessPathOptions()) {
  const names = new Set();
  const apiPathPattern = /["']\/\.ts\/([^"']+\.d\.ts)["']/g;
  for (const unit of parsed.units) {
    for (const match of unit.content.matchAll(apiPathPattern)) {
      const fileName = normalizeHarnessPath(`/.ts/${match[1]}`, pathOptions).replace(/^\.ts\//, "");
      if (!/^[a-zA-Z0-9._-]+\.d\.ts$/.test(fileName)) {
        throw new Error(`Unsupported TypeScript API declaration path '/.ts/${match[1]}'`);
      }
      names.add(fileName);
    }
  }
  return [...names].sort();
}

function harnessApiDeclarationText(fileName) {
  const directCandidates = [
    join(typeScriptApiDeclarationRoot, fileName),
    join(vendoredTypeScriptLibRoot, fileName),
  ];
  for (const candidate of directCandidates) {
    if (existsSync(candidate)) {
      return readFileSync(candidate, "utf8");
    }
  }
  const aliasTarget = harnessApiDeclarationAliasTarget(fileName);
  if (aliasTarget !== "") {
    const importTarget = `./${aliasTarget.replace(/\.d\.ts$/i, "")}`;
    return `import ts = require("${importTarget}");\nexport = ts;\n`;
  }
  return undefined;
}

function harnessApiDeclarationAliasTarget(fileName) {
  switch (fileName) {
    case "typescript.internal.d.ts":
      return "typescript.d.ts";
    case "tsserverlibrary.internal.d.ts":
      return "tsserverlibrary.d.ts";
    default:
      return "";
  }
}

export function getSkipReason(testCase) {
  return getSkipReasonFromConfiguration(testCase.sourceBaseName, testCase.configuration);
}

function getSkipReasonFromConfiguration(sourceBaseName, configuration) {
  return getSkipReasonFromCompilerOptions(sourceBaseName, compilerOptionsFromSettings(configuration ?? new Map()));
}

// compiler_runner.go skippedTests: test files the pinned TS-Go runner skips by name
// (typescript.d.ts dependents and tests whose options were removed from the option
// parser entirely, so the harness config fails to parse).
const tsgoRunnerSkippedTestNames = new Set([
  "APILibCheck.ts",
  "APISample_Watch.ts",
  "APISample_WatchWithDefaults.ts",
  "APISample_WatchWithOwnWatchHost.ts",
  "APISample_compile.ts",
  "APISample_jsdoc.ts",
  "APISample_linter.ts",
  "APISample_parseConfig.ts",
  "APISample_transform.ts",
  "APISample_watcher.ts",
  "preserveUnusedImports.ts",
  "noCrashWithVerbatimModuleSyntaxAndImportsNotUsedAsValues.ts",
  "verbatimModuleSyntaxCompat.ts",
  "verbatimModuleSyntaxCompat2.ts",
  "verbatimModuleSyntaxCompat3.ts",
  "verbatimModuleSyntaxCompat4.ts",
  "preserveValueImports.ts",
  "preserveValueImports_importsNotUsedAsValues.ts",
  "preserveValueImports_errors.ts",
  "preserveValueImports_mixedImports.ts",
  "preserveValueImports_module.ts",
  "importsNotUsedAsValues_error.ts",
  "alwaysStrictNoImplicitUseStrict.ts",
  "nonPrimitiveIndexingWithForInSupressError.ts",
  "parameterInitializerBeforeDestructuringEmit.ts",
  "mappedTypeUnionConstraintInferences.ts",
  "lateBoundConstraintTypeChecksCorrectly.ts",
  "keyofDoesntContainSymbols.ts",
  "isolatedModulesOut.ts",
  "noStrictGenericChecks.ts",
  "noImplicitUseStrict_umd.ts",
  "noImplicitUseStrict_system.ts",
  "noImplicitUseStrict_es6.ts",
  "noImplicitUseStrict_commonjs.ts",
  "noImplicitUseStrict_amd.ts",
  "noImplicitAnyIndexingSuppressed.ts",
  "excessPropertyErrorsSuppressed.ts",
  "moduleNoneDynamicImport.ts",
  "moduleNoneErrors.ts",
  "moduleNoneOutFile.ts",
  "noErrorUsingImportExportModuleAugmentationInDeclarationFile1.ts",
  "noErrorUsingImportExportModuleAugmentationInDeclarationFile2.ts",
  "noErrorUsingImportExportModuleAugmentationInDeclarationFile3.ts",
  "requireOfJsonFileWithModuleEmitNone.ts",
  "requireOfJsonFileWithModuleNodeResolutionEmitNone.ts",
]);

// Mirrors compiler_runner.go skippedTests plus harnessutil.go
// SkipUnsupportedCompilerOptions: the pinned TS-Go runner skips these tests and
// configurations outright, so no reference baselines exist for them. Skipping (counted
// and reasoned) is the faithful mirror; running them would gate against nothing.
// Condition order matches SkipUnsupportedCompilerOptions exactly.
function getSkipReasonFromCompilerOptions(sourceBaseName, compilerOptions) {
  if (tsgoRunnerSkippedTestNames.has(sourceBaseName)) {
    return `TS-Go runner skip list: ${sourceBaseName}`;
  }
  const moduleValue = stringCompilerOption(compilerOptions.module);
  if (moduleValue === "amd" || moduleValue === "umd" || moduleValue === "system") {
    return `TS-Go runner skips unsupported module kind ${moduleValue}`;
  }
  const moduleResolutionValue = stringCompilerOption(compilerOptions.moduleResolution);
  // "node" is the tsconfig alias for Node10 (core.ModuleResolutionKindNode10).
  if (moduleResolutionValue === "node10" || moduleResolutionValue === "node" || moduleResolutionValue === "classic") {
    return `TS-Go runner skips unsupported module resolution kind ${moduleResolutionValue}`;
  }
  if (compilerOptions.esModuleInterop === false) {
    return "TS-Go runner skips esModuleInterop=false";
  }
  if (compilerOptions.allowSyntheticDefaultImports === false) {
    return "TS-Go runner skips allowSyntheticDefaultImports=false";
  }
  if (optionIsPresent(compilerOptions.baseUrl)) {
    return `TS-Go runner skips unsupported baseUrl ${compilerOptions.baseUrl}`;
  }
  if (optionIsPresent(compilerOptions.outFile)) {
    return `TS-Go runner skips unsupported outFile ${compilerOptions.outFile}`;
  }
  if (stringCompilerOption(compilerOptions.target) === "es5") {
    return "TS-Go runner skips unsupported target es5";
  }
  if (compilerOptions.alwaysStrict === false) {
    return "TS-Go runner skips alwaysStrict=false";
  }
  return "";
}

export function caseExpectedErrors(testCase, compilerOptions) {
  return baselineHasErrors(testCase) || compilerOptionsRequireTsGoRemovedOptionDiagnostic(compilerOptions);
}

export function compilerOptionsRequireTsGoRemovedOptionDiagnostic(compilerOptions) {
  const moduleValue = stringCompilerOption(compilerOptions.module);
  const moduleResolutionValue = stringCompilerOption(compilerOptions.moduleResolution);
  return (
    optionIsPresent(compilerOptions.baseUrl) ||
    optionIsPresent(compilerOptions.outFile) ||
    optionIsPresent(compilerOptions.out) ||
    stringCompilerOption(compilerOptions.target) === "es5" ||
    moduleValue === "amd" ||
    moduleValue === "umd" ||
    moduleValue === "system" ||
    moduleResolutionValue === "classic" ||
    moduleResolutionValue === "node10" ||
    compilerOptions.alwaysStrict === false ||
    compilerOptions.esModuleInterop === false ||
    compilerOptions.allowSyntheticDefaultImports === false ||
    compilerOptions.keyofStringsOnly !== undefined ||
    compilerOptions.noImplicitUseStrict !== undefined ||
    compilerOptions.importsNotUsedAsValues !== undefined ||
    compilerOptions.downlevelIteration !== undefined
  );
}

function optionIsPresent(value) {
  return value !== undefined && value !== "";
}

function stringCompilerOption(value) {
  return typeof value === "string" ? value.toLowerCase() : "";
}

export function normalizeHarnessPath(fileName, options = defaultHarnessPathOptions()) {
  let normalized = fileName.replaceAll("\\", "/").trim();
  normalized = normalizeVirtualDrivePrefix(normalized, options);
  normalized = normalized.replace(/^\/+/, "");
  if (normalized === "") {
    normalized = "input.ts";
  }
  return normalized;
}

export function normalizeHarnessOptionPath(fileName, options = defaultHarnessPathOptions()) {
  let normalized = fileName.replaceAll("\\", "/").trim();
  normalized = normalizeVirtualDrivePrefix(normalized, options);
  normalized = normalized.replace(/^\/+/, "");
  return normalized === "" ? "." : normalized;
}

function normalizeHarnessModuleSpecifier(specifier, options = defaultHarnessPathOptions()) {
  if (!isHarnessAbsolutePath(specifier)) {
    return specifier;
  }
  const normalized = normalizeHarnessOptionPath(specifier, options);
  return normalized === "." ? "." : `./${normalized}`;
}

function applyVirtualRootCommonSourceDirectory(compilerOptions, settings, parsed, inputFiles) {
  if (compilerOptions.rootDir !== undefined) {
    return;
  }
  if (!hasSyntheticConfigEmitLayoutOption(compilerOptions)) {
    return;
  }
  const pathOptions = harnessPathOptionsFromSettings(settings);
  const inputFileSet = new Set(inputFiles);
  const sourceUnits = parsed.units.filter((unit) =>
    harnessSourceFilePattern.test(unit.fileName) &&
    !harnessDeclarationFilePattern.test(unit.fileName) &&
    inputFileSet.has(normalizeHarnessPath(unit.fileName, pathOptions))
  );
  if (sourceUnits.length < 1) {
    return;
  }
  const useCaseSensitiveFileNames = settings.get("usecasesensitivefilenames")?.toLowerCase() !== "false";
  const firstVolume = harnessVolumeKey(sourceUnits[0].fileName, useCaseSensitiveFileNames);
  if (!sourceUnits.every((unit) => harnessVolumeKey(unit.fileName, useCaseSensitiveFileNames) === firstVolume)) {
    return;
  }
  const emittedInputFiles = sourceUnits.map((unit) => normalizeHarnessPath(unit.fileName, pathOptions));
  const commonDirectory = commonDirectoryOfRelativeFiles(emittedInputFiles);
  if (commonDirectory !== ".") {
    compilerOptions.rootDir = commonDirectory;
  }
}

const harnessDeclarationFilePattern = /\.d\.[cm]?ts$/i;

function hasSyntheticConfigEmitLayoutOption(compilerOptions) {
  return compilerOptions.outDir !== undefined ||
    compilerOptions.declarationDir !== undefined ||
    compilerOptions.outFile !== undefined;
}

function harnessVolumeKey(fileName, useCaseSensitiveFileNames) {
  const normalized = fileName.replaceAll("\\", "/").trim();
  const drive = /^([a-zA-Z]):\//.exec(normalized);
  if (drive !== null) {
    return useCaseSensitiveFileNames ? `${drive[1]}:` : `${drive[1].toLowerCase()}:`;
  }
  return normalized.startsWith("/") ? "/" : "";
}

function defaultHarnessPathOptions() {
  return { useCaseSensitiveFileNames: true };
}

function harnessPathOptionsFromSettings(settings) {
  return {
    useCaseSensitiveFileNames: settings.get("usecasesensitivefilenames")?.toLowerCase() !== "false",
  };
}

function normalizeVirtualDrivePrefix(path, options) {
  const match = /^([a-zA-Z]):(?=\/|$)/.exec(path);
  if (match === null) {
    return path;
  }
  const drive = options.useCaseSensitiveFileNames ? match[1] : match[1].toLowerCase();
  return `${drive}:${path.slice(match[0].length)}`;
}

function commonDirectoryOfRelativeFiles(files) {
  if (files.length === 0) {
    return ".";
  }
  const directories = files.map((file) => file.split("/").slice(0, -1));
  const first = directories[0] ?? [];
  const common = [];
  for (let index = 0; index < first.length; index += 1) {
    const segment = first[index];
    if (directories.every((directory) => directory[index] === segment)) {
      common.push(segment);
    } else {
      break;
    }
  }
  return common.length === 0 ? "." : common.join("/");
}

function safePathFragment(path) {
  return path.replace(/[^a-zA-Z0-9._/-]/g, "_").replaceAll("/", "__");
}

export function caseDirectoryFragment(testCase) {
  return safePathFragment(`${testCase.corpus ?? "current"}/${testCase.suite}/${configuredCaseName(testCase)}`);
}

const CASE_TIMEOUT_MS = Number(process.env.TSGO_CASE_TIMEOUT_MS ?? "120000");

async function runTsts(invocation) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [
      "--max-old-space-size=8192",
      cliPath,
      ...invocation.args,
    ], {
      cwd: invocation.cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    // A single infinite loop in TSTS would otherwise wedge a worker forever and stall the whole
    // run. Kill a case that exceeds the (generous) budget and surface it as a visible failure.
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, CASE_TIMEOUT_MS);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (exitCode, signal) => {
      clearTimeout(timer);
      if (timedOut) {
        resolve({ exitCode: 1, signal: "SIGKILL", stdout, stderr: `${stderr}\nTSTS case timed out after ${CASE_TIMEOUT_MS}ms (likely an infinite loop).` });
        return;
      }
      resolve({ exitCode: exitCode ?? 1, signal, stdout, stderr });
    });
  });
}

async function runCase(testCase, runRoot, options) {
  const materialized = await materializeCase(testCase, runRoot);
  if (materialized.skipReason !== "") {
    return {
      ...testCase,
      caseDir: materialized.caseDir,
      expectedErrors: materialized.expectedErrors,
      actualErrors: false,
      exitCode: 0,
      signal: null,
      status: "skip",
      skipReason: materialized.skipReason,
      stdout: "",
      stderr: "",
    };
  }
  if (materialized.transpile === true) {
    const result = await runTranspileInvocations(materialized);
    const exactBaseline = await evaluateExactBaselines(testCase, materialized, `${result.stdout}${result.stderr}`);
    // In exact mode, transpile diagnostics live in the baseline's (post-overlay) 'Diagnostics
    // reported' section, not a .errors.txt; derive expectedErrors from there so the new pin's
    // --isolatedDeclarations diagnostics are accounted for rather than always failing on
    // actualErrors=true.
    const expectedErrors = exactBaseline !== undefined ? exactBaseline.expectedDiagnosticsPresent : materialized.expectedErrors;
    const statusMatches = result.actualErrors === expectedErrors && (exactBaseline === undefined || exactBaseline.status === "pass");
    return {
      ...testCase,
      caseDir: materialized.caseDir,
      expectedErrors,
      actualErrors: result.actualErrors,
      exitCode: result.exitCode,
      signal: result.signal,
      status: statusMatches ? "pass" : "fail",
      skipReason: "",
      stdout: result.stdout,
      stderr: result.stderr,
      exactBaseline,
    };
  }
  // For vfs-harness cases the in-memory harness compile (run inside evaluateExactBaselines)
  // is the authority and yields everything the verdict needs: all-stage diagnostics
  // (-> actualErrors), the emit, and the program/checker for .types/.symbols. So the
  // on-disk CLI compile is redundant for the verdict and is skipped on the fast path.
  // --verify-on-disk re-runs the on-disk CLI and proves it agrees with the harness
  // (error verdict AND emitted .js/.d.ts), keeping the on-disk path fully + provably covered.
  const isHarnessCase = usesTsgoAuthorityBaselines(testCase)
    && materialized.units !== undefined && materialized.invocation !== undefined;

  if (isHarnessCase && options.verifyOnDisk !== true) {
    const exactBaseline = await evaluateExactBaselines(testCase, materialized, "");
    const actualErrors = exactBaseline.actualErrors === true;
    const expectedErrors = exactBaseline.expectedDiagnosticsPresent;
    const statusMatches = actualErrors === expectedErrors && exactBaseline.status === "pass";
    return {
      ...testCase,
      caseDir: materialized.caseDir,
      expectedErrors,
      actualErrors,
      exitCode: actualErrors ? 1 : 0,
      signal: null,
      status: statusMatches ? "pass" : "fail",
      skipReason: "",
      stdout: "",
      stderr: "",
      exactBaseline,
    };
  }

  const result = await runTsts(materialized.invocation);
  const actualErrors = result.exitCode !== 0;
  const exactBaseline = await evaluateExactBaselines(testCase, materialized, `${result.stdout}${result.stderr}`);
  const expectedErrors = exactBaseline !== undefined ? exactBaseline.expectedDiagnosticsPresent : materialized.expectedErrors;
  const onDiskDivergences = isHarnessCase && options.verifyOnDisk === true
    ? await verifyOnDiskMatchesHarness(materialized, result, exactBaseline)
    : [];
  const statusMatches = actualErrors === expectedErrors
    && (exactBaseline === undefined || exactBaseline.status === "pass")
    && onDiskDivergences.length === 0;
  return {
    ...testCase,
    caseDir: materialized.caseDir,
    expectedErrors,
    actualErrors,
    exitCode: result.exitCode,
    signal: result.signal,
    status: statusMatches ? "pass" : "fail",
    skipReason: "",
    stdout: onDiskDivergences.length === 0 ? result.stdout : `${result.stdout}\nON-DISK/HARNESS DIVERGENCE:\n${onDiskDivergences.join("\n")}`,
    stderr: result.stderr,
    exactBaseline,
  };
}

// --verify-on-disk proof: confirm the real on-disk CLI compile agrees with the
// in-memory harness for a case — same error verdict AND same emitted .js/.d.ts.
// Returns human-readable divergences (empty = the on-disk path is equivalent here).
// Emit is compared by basename (the on-disk and harness maps key paths differently).
async function verifyOnDiskMatchesHarness(materialized, cliResult, exactBaseline) {
  const divergences = [];
  const cliActualErrors = cliResult.exitCode !== 0;
  if (exactBaseline.usedHarness === true && exactBaseline.actualErrors !== cliActualErrors) {
    divergences.push(`verdict: on-disk CLI actualErrors=${cliActualErrors} but harness actualErrors=${exactBaseline.actualErrors}`);
  }
  const harnessEmitted = exactBaseline.harnessEmitted;
  if (harnessEmitted !== undefined) {
    const baseMap = (map) => {
      const out = new Map();
      for (const [key, value] of map) out.set(String(key).split("/").pop(), value);
      return out;
    };
    const norm = (value) => normalizeEmittedOutputText(String(value ?? ""));
    const onDisk = baseMap(await emittedOutputsForCase(materialized));
    const harness = baseMap(harnessEmitted);
    for (const key of new Set([...onDisk.keys(), ...harness.keys()])) {
      const onDiskHas = onDisk.has(key);
      const harnessHas = harness.has(key);
      if (onDiskHas !== harnessHas) {
        divergences.push(`emit: '${key}' ${onDiskHas ? "emitted on disk but not by harness" : "emitted by harness but not on disk"}`);
      } else if (onDiskHas && norm(onDisk.get(key)) !== norm(harness.get(key))) {
        divergences.push(`emit: '${key}' content differs between on-disk and harness`);
      }
    }
  }
  return divergences;
}

async function runTranspileInvocations(materialized) {
  const outputs = [];
  const diagnostics = [];
  let actualErrors = false;
  let exitCode = 0;
  let signal = null;
  for (const invocation of materialized.invocations) {
    const result = await runTstsTranspileApi(materialized.caseDir, invocation);
    diagnostics.push(...result.diagnostics);
    // Diagnostics are the primary truth for actualErrors; missing output is an additional symptom
    // (e.g. --isolatedDeclarations blocks .d.ts emit). A case that reports diagnostics while still
    // emitting all expected outputs must still count as having errors.
    const missingOutputs = invocation.expectedOutputFiles.filter((file) => !existsSync(join(materialized.caseDir, file)));
    if (result.diagnostics.length !== 0 || missingOutputs.length !== 0) {
      actualErrors = true;
    }
    if (result.exitCode !== 0 && exitCode === 0) {
      exitCode = result.exitCode;
    }
    if (result.signal !== null && signal === null) {
      signal = result.signal;
    }
    outputs.push(renderTranspileInvocationOutput(invocation, result, missingOutputs));
  }
  const api = await loadTstsApi();
  const diagnosticText = api.formatDiagnostics(sortDiagnosticsForBaseline(diagnostics), "/");
  return {
    actualErrors,
    exitCode,
    signal,
    stdout: `${outputs.map((output) => output.stdout).join("")}${diagnosticText}`,
    stderr: outputs.map((output) => output.stderr).join(""),
  };
}

async function runTstsTranspileApi(caseDir, invocation) {
  const api = await loadTstsApi();
  const inputText = await readFile(join(caseDir, invocation.inputFile), "utf8");
  const transpileOptions = {
    compilerOptions: invocation.compilerOptions,
    fileName: invocation.inputFile,
    reportDiagnostics: invocation.reportDiagnostics,
  };
  const output = invocation.kind === "declaration"
    ? api.transpileDeclaration(inputText, transpileOptions)
    : api.transpileModule(inputText, transpileOptions);
  const primaryOutput = invocation.expectedOutputFiles.find((file) => !file.endsWith(".map"));
  // A declaration transpile that yields empty output emitted no file (e.g. blocked by
  // --isolatedDeclarations); the pinned binary writes nothing and the tsgo-accepted overlay marks
  // the section absent, so skip writing it to keep the absent-section comparison correct.
  const emittedNoOutputFile = invocation.kind === "declaration" && output.outputText === "";
  if (primaryOutput !== undefined && !emittedNoOutputFile) {
    await writeFile(join(caseDir, primaryOutput), output.outputText);
  }
  const sourceMapOutput = invocation.expectedOutputFiles.find((file) => file.endsWith(".map"));
  if (sourceMapOutput !== undefined && output.sourceMapText !== undefined) {
    await writeFile(join(caseDir, sourceMapOutput), output.sourceMapText);
  }
  return {
    exitCode: 0,
    signal: null,
    diagnostics: output.diagnostics,
    stdout: "",
    stderr: "",
  };
}

export function sortDiagnosticsForBaseline(diagnostics) {
  return [...diagnostics].sort(compareDiagnosticsForBaseline);
}

function compareDiagnosticsForBaseline(left, right) {
  return compareStrings(diagnosticFileName(left), diagnosticFileName(right)) ||
    diagnosticStart(left) - diagnosticStart(right) ||
    diagnosticEnd(left) - diagnosticEnd(right) ||
    diagnosticCode(left) - diagnosticCode(right);
}

function diagnosticFileName(diagnostic) {
  return diagnostic?.file?.fileName ?? diagnostic?.file?.FileName?.() ?? "";
}

function diagnosticStart(diagnostic) {
  return diagnostic?.loc?.pos ?? -1;
}

function diagnosticEnd(diagnostic) {
  return diagnostic?.loc?.end ?? diagnosticStart(diagnostic);
}

function diagnosticCode(diagnostic) {
  return diagnostic?.code ?? 0;
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

async function loadTstsApi() {
  tstsApi ??= import(apiPath);
  return tstsApi;
}

function renderTranspileInvocationOutput(invocation, result, missingOutputs) {
  const header = `## ${invocation.label}\n`;
  const missing = missingOutputs.length === 0 ? "" : `Missing outputs: ${missingOutputs.join(", ")}\n`;
  return {
    stdout: `${header}${missing}${result.stdout}`,
    stderr: result.stderr,
  };
}

// Run all cases, streaming each trimmed result record to results.ndjson in the
// report root as it completes. The runner holds NO per-case records in memory:
// memory stays O(in-flight cases) regardless of corpus size, and a killed run
// leaves a complete machine-readable record of everything it finished. Each
// NDJSON line is the results.json record plus a `caseIndex` field recording the
// case's position in discovery order (workers finish out of order).
// Stable identifier for a discovered case (independent of position in the list):
// used to verify a --resume target points at the SAME case set the suspended run
// was built from, so recorded caseIndex values still line up.
function caseIdentifier(testCase) {
  return `${testCase.corpus}/${testCase.suite}/${testCase.relativePath}#${testCase.configurationName ?? ""}`;
}

function hashCaseIds(testCases) {
  return createHash("sha256").update(testCases.map(caseIdentifier).join("\n")).digest("hex");
}

// Load the set of caseIndex values already durably recorded in a prior run's
// results.ndjson (each completed case appends exactly one line tagged with its index).
function loadCompletedCaseIndices(resultsPath) {
  const done = new Set();
  if (!existsSync(resultsPath)) {
    return done;
  }
  for (const line of readFileSync(resultsPath, "utf8").split("\n")) {
    if (line.trim() === "") {
      continue;
    }
    try {
      const record = JSON.parse(line);
      if (typeof record.caseIndex === "number") {
        done.add(record.caseIndex);
      }
    } catch {
      // Ignore a truncated trailing line (killed mid-append) — that case just re-runs.
    }
  }
  return done;
}

// Process-pool runner. Each "job" is a long-lived worker process (this same
// script re-forked with TSGO_SUITE_WORKER=1) that loads the compiler + harness
// once and then evaluates whole cases (emit + exact-baseline assembly +
// comparison) off a shared queue. The heavy per-case work (in-process compile +
// .types/.symbols walk) is CPU-bound and would otherwise serialize on one event
// loop; running it across N worker processes is what actually keeps all cores
// busy. --jobs sets the pool size (default = all cores; --jobs 1 = serial).
// Results stream to results.ndjson tagged with caseIndex, so discovery order is
// restored on read regardless of completion order.
async function runQueue(testCases, runRoot, reportRoot, jobs, failFast, options, doneIndices = new Set()) {
  const resultsPath = join(reportRoot, "results.ndjson");
  const resuming = doneIndices.size > 0;
  if (!resuming) {
    // Fresh run truncates; resume keeps the prior results and appends the remainder.
    await writeFile(resultsPath, "");
  }
  const total = testCases.length;
  // Backstop for an in-process hang inside a worker (e.g. an infinite loop in
  // the baseline assembly that the CLI's own timeout can't catch): kill+replace
  // the worker. Longer than the CLI's per-spawn timeout so real CLI timeouts
  // surface as themselves first.
  const POOL_CASE_TIMEOUT_MS = Number(process.env.TSGO_POOL_TIMEOUT_MS ?? "300000");
  let appendChain = Promise.resolve();
  let completed = doneIndices.size;
  let cursor = 0;
  let stopped = false;

  const persist = async (caseIndex, result) => {
    const record = { caseIndex, ...trimResult(result) };
    const append = appendChain.then(() => appendFile(resultsPath, `${JSON.stringify(record)}\n`));
    appendChain = append;
    await append;
    completed += 1;
    if (result.status === "fail" && failFast) {
      stopped = true;
    }
    printProgress(completed, total, result);
  };

  const failResult = (testCase, stderr, signal) => ({
    ...testCase,
    caseDir: "",
    expectedErrors: false,
    actualErrors: true,
    exitCode: 1,
    signal: signal ?? null,
    status: "fail",
    skipReason: "",
    stdout: "",
    stderr,
  });

  if (total === 0 || completed >= total) {
    return { resultsPath, completed };
  }

  await new Promise((resolve) => {
    const poolSize = Math.max(1, Math.min(jobs, total));
    let liveWorkers = 0;
    let spawnedTotal = 0;
    const maxSpawns = total + poolSize * 8; // respawn cap so a startup crash loop can't hang the run
    let done = false;

    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };

    const spawnWorker = () => {
      if (spawnedTotal >= maxSpawns) {
        if (liveWorkers === 0) finish();
        return;
      }
      spawnedTotal += 1;
      const child = fork(scriptPath, [], {
        env: { ...process.env, TSGO_SUITE_WORKER: "1" },
        stdio: ["ignore", "ignore", "inherit", "ipc"],
        // Advanced (V8 structured-clone) IPC preserves Map/Set/etc. in the case
        // descriptor (e.g. testCase.settings is a Map); the default JSON IPC
        // would silently flatten Maps to {} and break materializeCase.
        serialization: "advanced",
      });
      liveWorkers += 1;
      const state = { current: -1, settled: true, timer: null };

      const settle = async (result) => {
        if (state.settled) return; // exactly one resolution per assigned case
        state.settled = true;
        if (state.timer) { clearTimeout(state.timer); state.timer = null; }
        const idx = state.current;
        state.current = -1;
        await persist(idx, result);
        if (completed >= total) finish();
      };

      const assignNext = () => {
        // Skip cases already recorded by a suspended run (--resume).
        while (cursor < total && doneIndices.has(cursor)) {
          cursor += 1;
        }
        if (stopped || cursor >= total) {
          try { child.send({ type: "shutdown" }); } catch { try { child.kill(); } catch {} }
          return;
        }
        const idx = cursor++;
        state.current = idx;
        state.settled = false;
        state.timer = setTimeout(() => {
          // In-process hang: kill the worker; settle() records the timeout fail,
          // and the exit handler replaces the worker if work remains.
          try { child.kill("SIGKILL"); } catch {}
          settle(failResult(testCases[idx], `TSTS case exceeded ${POOL_CASE_TIMEOUT_MS}ms in worker (killed).`, "SIGKILL"));
        }, POOL_CASE_TIMEOUT_MS);
        try {
          child.send({ type: "case", caseIndex: idx, testCase: testCases[idx], runRoot, options });
        } catch {
          // Send failed (worker already dead); the exit handler settles + respawns.
        }
      };

      child.on("message", (msg) => {
        if (msg && msg.type === "ready") { assignNext(); return; }
        if (msg && msg.type === "result") {
          settle(msg.result).then(() => {
            if (!stopped && cursor < total) assignNext();
            else { try { child.send({ type: "shutdown" }); } catch { try { child.kill(); } catch {} } }
          });
        }
      });

      child.on("exit", () => {
        liveWorkers -= 1;
        // Crash with an unsettled in-flight case → record a fail for it.
        if (!state.settled && state.current >= 0) {
          settle(failResult(testCases[state.current], "TSTS worker crashed before returning a result.", null));
        }
        if (!stopped && cursor < total) {
          spawnWorker();
        } else if (liveWorkers === 0) {
          finish();
        }
      });
    };

    for (let i = 0; i < poolSize; i++) spawnWorker();
  });

  return { resultsPath, completed };
}

// Worker mode: this same script, re-forked with TSGO_SUITE_WORKER=1. It loads
// the compiler + harness lazily on its first case and then evaluates whole
// cases handed over IPC, returning the trimmed result. Staying warm means the
// ~12s bundled-lib load is paid once per worker, not once per case.
function runWorkerLoop() {
  process.on("message", async (msg) => {
    if (!msg) return;
    if (msg.type === "case") {
      let result;
      try {
        result = await runCase(msg.testCase, msg.runRoot, msg.options);
      } catch (error) {
        result = {
          ...msg.testCase,
          caseDir: "",
          expectedErrors: false,
          actualErrors: true,
          exitCode: 1,
          signal: null,
          status: "fail",
          skipReason: "",
          stdout: "",
          stderr: `TSTS worker error: ${error instanceof Error ? error.stack : String(error)}`,
        };
      }
      try { process.send({ type: "result", caseIndex: msg.caseIndex, result }); } catch {}
    } else if (msg.type === "shutdown") {
      process.exit(0);
    }
  });
  try { process.send({ type: "ready" }); } catch {}
}

// Read the streamed records back, restore discovery order, and strip the
// caseIndex envelope so the returned records match the results.json shape.
// Every record was trimmed (capped, flattened) at write time, so the
// materialized array is bounded regardless of per-case output sizes.
export async function readResults(resultsPath) {
  const text = await readFile(resultsPath, "utf8");
  const records = text
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line));
  records.sort((a, b) => a.caseIndex - b.caseIndex);
  return records.map(({ caseIndex: _caseIndex, ...record }) => record);
}

function printProgress(done, total, result) {
  const prefix = result.status === "pass" ? "PASS" : result.status === "skip" ? "SKIP" : "FAIL";
  const configuration = result.configurationName === "" ? "" : ` configuration=${result.configurationName}`;
  const skip = result.skipReason === "" ? "" : ` reason=${result.skipReason}`;
  const tsgoAccepted = (result.exactBaseline?.tsgoAccepted?.length ?? 0) === 0 ? "" : ` tsgoAccepted=${result.exactBaseline.tsgoAccepted.length}`;
  const baseline = result.exactBaseline === undefined ? "" : ` exactBaselines=${result.exactBaseline.status} mismatches=${result.exactBaseline.mismatches.length}${tsgoAccepted}`;
  console.log(`${prefix} ${done}/${total} ${result.relativePath}${configuration} expectedErrors=${result.expectedErrors} actualErrors=${result.actualErrors}${baseline}${skip}`);
  if (done % 100 === 0 || total <= 20 || process.env.TSGO_MEM_EVERY === "1") {
    const m = process.memoryUsage();
    const mb = (n) => Math.round(n / 1024 / 1024);
    console.log(`MEM ${done}/${total} rss=${mb(m.rss)}MB heapUsed=${mb(m.heapUsed)}MB heapTotal=${mb(m.heapTotal)}MB external=${mb(m.external)}MB arrayBuffers=${mb(m.arrayBuffers)}MB`);
  }
}

async function writeReports(reportRoot, resultsPath, inventory, caseRoot) {
  const results = await readResults(resultsPath);
  const summary = summarize(results);
  await writeFile(join(reportRoot, "results.json"), `${JSON.stringify({ summary, inventory, caseRoot, results }, null, 2)}\n`);
  await writeFile(join(reportRoot, "summary.md"), renderMarkdown(summary, results, inventory, caseRoot));
  return summary;
}

export function summarize(results) {
  const passed = results.filter((result) => result.status === "pass").length;
  const skipped = results.filter((result) => result.status === "skip").length;
  const failed = results.length - passed - skipped;
  const exactBaselineResults = results.map((result) => result.exactBaseline).filter((baseline) => baseline !== undefined);
  return {
    total: results.length,
    passed,
    failed,
    skipped,
    expectedErrorCases: results.filter((result) => result.expectedErrors).length,
    expectedCleanCases: results.filter((result) => !result.expectedErrors).length,
    exactBaselineCases: exactBaselineResults.length,
    exactBaselineFailedCases: exactBaselineResults.filter((baseline) => baseline.status === "fail").length,
    exactBaselineComparableArtifacts: exactBaselineResults.reduce((sum, baseline) => sum + baseline.comparable, 0),
    exactBaselineUnsupportedArtifacts: exactBaselineResults.reduce((sum, baseline) => sum + baseline.unsupported.length, 0),
    exactBaselineTsgoAcceptedSections: exactBaselineResults.reduce((sum, baseline) => sum + (baseline.tsgoAccepted?.length ?? 0), 0),
    exactBaselineMismatches: exactBaselineResults.reduce((sum, baseline) => sum + baseline.mismatches.length, 0),
  };
}

// V8 represents substrings from split()/slice() as SlicedStrings that retain
// the parent string. Without flattening, every trimmed record keeps its case's
// FULL stdout+stderr alive and a 7k-case sweep exhausts the default heap.
function flattenString(value) {
  return Buffer.from(value, "utf8").toString("utf8");
}

export function trimResult(result) {
  if (result.firstOutputLines !== undefined) {
    // Already trimmed at accumulation time.
    return result;
  }
  const output = `${result.stdout}${result.stderr}`;
  return {
    corpus: result.corpus,
    suite: result.suite,
    relativePath: result.relativePath,
    configurationName: result.configurationName,
    status: result.status,
    expectedErrors: result.expectedErrors,
    actualErrors: result.actualErrors,
    exitCode: result.exitCode,
    signal: result.signal,
    caseDir: result.caseDir,
    skipReason: result.skipReason,
    exactBaseline: result.exactBaseline === undefined ? undefined : JSON.parse(JSON.stringify(result.exactBaseline)),
    firstOutputLines: output.split(/\r?\n/).filter(Boolean).slice(0, 20).map((line) => flattenString(line.slice(0, 1000))),
  };
}

function renderMarkdown(summary, results, inventory, caseRoot) {
  const failed = results.filter((result) => result.status === "fail");
  const lines = [
    "# TSTS TS-Go Suite Run",
    "",
    `- Case root: ${caseRoot}`,
    `- Total: ${summary.total}`,
    `- Passed: ${summary.passed}`,
    `- Failed: ${summary.failed}`,
    `- Skipped: ${summary.skipped}`,
    `- Expected-error cases: ${summary.expectedErrorCases}`,
    `- Expected-clean cases: ${summary.expectedCleanCases}`,
    `- Exact-baseline cases: ${summary.exactBaselineCases}`,
    `- Exact-baseline failed cases: ${summary.exactBaselineFailedCases}`,
    `- Exact-baseline comparable artifacts: ${summary.exactBaselineComparableArtifacts}`,
    `- Exact-baseline unsupported artifacts: ${summary.exactBaselineUnsupportedArtifacts}`,
    `- Exact-baseline tsgo-accepted sections: ${summary.exactBaselineTsgoAcceptedSections}`,
    `- Exact-baseline mismatches: ${summary.exactBaselineMismatches}`,
    "",
    "## Upstream Test Universe",
    "",
    ...renderInventoryTable(inventory),
    "",
    "## Failures",
    "",
  ];
  if (failed.length === 0) {
    lines.push("None.");
  } else {
    lines.push("| Case | Expected Errors | Actual Errors | Exact Baselines | Exit | First Output |");
    lines.push("|---|---:|---:|---|---:|---|");
    for (const result of failed.slice(0, 200)) {
      const output = result.firstOutputLines?.[0] ?? "";
      const exact = result.exactBaseline === undefined
        ? ""
        : `${result.exactBaseline.status}: ${result.exactBaseline.mismatches.slice(0, 3).join("; ")}`;
      lines.push(`| ${result.relativePath} | ${result.expectedErrors} | ${result.actualErrors} | ${escapeTable(exact)} | ${result.exitCode} | ${escapeTable(output)} |`);
    }
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function renderInventoryTable(inventory) {
  return [
    "| Bucket | Total | In Scope | Excluded | Unclassified | Notes |",
    "|---|---:|---:|---:|---:|---|",
    `| Current TSTS harness | ${inventory.currentHarness.total} | ${inventory.currentHarness.inScope} | ${inventory.currentHarness.outOfScope} | ${inventory.currentHarness.unclassified} | Executed by this runner today |`,
    `| TypeScript submodule cases | ${inventory.typeScriptCases.total} | ${inventory.typeScriptCases.inScope} | ${inventory.typeScriptCases.outOfScope} | ${inventory.typeScriptCases.unclassified} | Compiler/conformance/project/transpile direct cases plus TS harness unit mirrors are in scope; language-service fourslash and LS harness cases excluded |`,
    `| TS-Go reference baselines | ${inventory.baselines.total} | ${inventory.baselines.inScope} | ${inventory.baselines.outOfScope} | ${inventory.baselines.unclassified} | Exact baseline comparison is the next acceptance-strength gate |`,
    `| TS-Go Go unit tests | ${inventory.goTests.total} | ${inventory.goTests.inScope} | ${inventory.goTests.outOfScope} | ${inventory.goTests.unclassified} | Go unit coverage to port or mirror, excluding LS packages |`,
  ];
}

function renderInventoryMarkdown(inventory) {
  const lines = [
    "# TSTS TS-Go Test Universe",
    "",
    ...renderInventoryTable(inventory),
    "",
    "## Current TSTS Harness",
    "",
    ...renderNamedCounts(inventory.currentHarness.entries),
    "",
    "## TypeScript Submodule Cases",
    "",
    ...renderNamedCounts(inventory.typeScriptCases.entries),
    "",
    "## TS-Go Reference Baselines",
    "",
    ...renderNamedCounts(inventory.baselines.entries),
    "",
    "## TS-Go Go Unit Tests",
    "",
    ...renderNamedCounts(inventory.goTests.entries),
    "",
  ];
  return `${lines.join("\n")}\n`;
}

function renderNamedCounts(entries) {
  const lines = [
    "| Name | Files |",
    "|---|---:|",
  ];
  for (const [name, count] of Object.entries(entries)) {
    lines.push(`| ${name} | ${count} |`);
  }
  return lines;
}

function escapeTable(text) {
  return text.replaceAll("|", "\\|").slice(0, 240);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const inventory = await buildTestUniverseInventory();
  if (options.inventory) {
    console.log(renderInventoryMarkdown(inventory));
    return;
  }
  const testCases = await discoverCases(options);
  let reportRoot;
  let doneIndices = new Set();
  if (options.resume !== "") {
    // Resume a suspended run: reuse its reportRoot, verify the case set is identical
    // (so recorded caseIndex values still line up), and skip the cases it recorded.
    reportRoot = isAbsolute(options.resume) ? options.resume : join(repoRoot, options.resume);
    const configPath = join(reportRoot, "run-config.json");
    if (!existsSync(configPath)) {
      throw new Error(`Cannot resume: no run-config.json in ${reportRoot}.`);
    }
    const config = JSON.parse(readFileSync(configPath, "utf8"));
    const mismatched = [];
    if (config.corpus !== options.corpus) mismatched.push(`corpus(${config.corpus} != ${options.corpus})`);
    if (config.suite !== options.suite) mismatched.push(`suite(${config.suite} != ${options.suite})`);
    if (config.filter !== options.filter) mismatched.push(`filter(${config.filter} != ${options.filter})`);
    if (config.limit !== options.limit) mismatched.push(`limit(${config.limit} != ${options.limit})`);
    if (mismatched.length !== 0) {
      throw new Error(`Cannot resume: run options differ from the suspended run [${mismatched.join(", ")}]. Re-run --resume with matching --corpus/--suite/--filter/--limit.`);
    }
    if (config.total !== testCases.length || config.caseIdsHash !== hashCaseIds(testCases)) {
      throw new Error(`Cannot resume: the discovered case set changed since suspend (corpus/testdata drift). Start a fresh run.`);
    }
    doneIndices = loadCompletedCaseIndices(join(reportRoot, "results.ndjson"));
  } else {
    const timestamp = new Date().toISOString().replaceAll(":", "").replace(".", "-").replace("Z", `-${process.pid}`);
    reportRoot = join(repoRoot, ".temp/tsgo-suite", timestamp);
  }
  const caseRootForRun = join(reportRoot, "cases");
  await mkdir(reportRoot, { recursive: true });
  await mkdir(caseRootForRun, { recursive: true });
  if (options.resume === "") {
    // Record this run's identity so it can be resumed later; resume refuses if the
    // case set differs.
    await writeFile(join(reportRoot, "run-config.json"), JSON.stringify({
      corpus: options.corpus,
      suite: options.suite,
      filter: options.filter,
      limit: options.limit,
      total: testCases.length,
      caseIdsHash: hashCaseIds(testCases),
    }));
  }

  if (!existsSync(cliPath)) {
    throw new Error(`TSTS CLI not found at ${cliPath}. Run TSTS emit first.`);
  }
  console.log(`TSTS TS-Go suite run${options.resume !== "" ? " (RESUME)" : ""}`);
  console.log(`cases=${testCases.length} corpus=${options.corpus} suite=${options.suite} jobs=${options.jobs}${doneIndices.size > 0 ? ` resumeSkip=${doneIndices.size}` : ""}`);
  console.log(`upstreamInScope=${inventory.typeScriptCases.inScope + inventory.baselines.inScope + inventory.goTests.inScope} upstreamExcluded=${inventory.typeScriptCases.outOfScope + inventory.baselines.outOfScope + inventory.goTests.outOfScope}`);
  console.log(`caseRoot=${caseRootForRun}`);
  console.log(`reportRoot=${reportRoot}`);

  const run = await runQueue(testCases, caseRootForRun, reportRoot, options.jobs, options.failFast, options, doneIndices);
  const summary = await writeReports(reportRoot, run.resultsPath, inventory, caseRootForRun);
  console.log(`SUMMARY total=${summary.total} passed=${summary.passed} failed=${summary.failed}`);
  if (process.env.TSGO_HOLD_SECONDS !== undefined) {
    // Diagnostics hook: keep the process alive (e.g. for --heapsnapshot-signal)
    // so retained memory can be inspected after the run completes.
    console.log(`HOLDING for ${process.env.TSGO_HOLD_SECONDS}s (TSGO_HOLD_SECONDS)`);
    await new Promise((resolve) => setTimeout(resolve, Number(process.env.TSGO_HOLD_SECONDS) * 1000));
  }
  console.log(`REPORT ${join(reportRoot, "summary.md")}`);
  if (summary.failed > 0) {
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.env.TSGO_SUITE_WORKER === "1") {
    runWorkerLoop();
  } else {
    main().catch((error) => {
      console.error(error instanceof Error ? error.stack : String(error));
      process.exitCode = 1;
    });
  }
}
