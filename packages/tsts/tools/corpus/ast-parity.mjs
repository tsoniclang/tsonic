#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { cp, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = resolve(dirname(scriptPath), "../../../..");
const packageRoot = join(repoRoot, "packages/tsts");
const defaultManifestPath = join(packageRoot, "corpus/realworld.json");
const vendorRoot = join(packageRoot, "_vendor/typescript-go");
const tempRoot = join(repoRoot, ".temp/corpus");
const repoCacheRoot = join(tempRoot, "repos");
const helperSourcePath = join(packageRoot, "tools/corpus/tsgo-ast-dump/main.go");
const helperToolRoot = join(tempRoot, "tools/tsgo-ast-dump");
const helperBuildRoot = join(tempRoot, "build/tsgo-ast-dump");
const resultRoot = join(tempRoot, "ast");
const tscPath = join(repoRoot, "node_modules/typescript/bin/tsc");

const sourceFileExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs"]);
const defaultExcludedDirectories = new Set([".git", ".next", ".temp", ".turbo", "bower_components", "coverage", "dist", "node_modules", "tmp"]);

const args = parseArgs(process.argv.slice(2));
const command = args._[0] ?? "help";

if (command === "help" || args.help) {
  printHelp();
  process.exit(command === "help" ? 0 : 1);
}

try {
  if (command === "setup") {
    const manifest = readManifest(args.manifest ?? defaultManifestPath);
    await setupCorpus(manifest, args);
  } else if (command === "ast") {
    const manifest = readManifest(args.manifest ?? defaultManifestPath);
    await runAstParity(manifest, args);
  } else if (command === "list") {
    const manifest = readManifest(args.manifest ?? defaultManifestPath);
    await listCorpusFiles(manifest, args);
  } else {
    throw new Error(`unknown command: ${command}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

function printHelp() {
  console.log(`Usage:
  node packages/tsts/tools/corpus/ast-parity.mjs setup [--project name]
  node packages/tsts/tools/corpus/ast-parity.mjs ast [--project name] [--file relative/path.ts] [--limit n]
  node packages/tsts/tools/corpus/ast-parity.mjs list [--project name]

Options:
  --manifest path   Corpus manifest path. Default: packages/tsts/corpus/realworld.json
  --project name    Restrict to one corpus project.
  --file path       Restrict to one project-relative source file.
  --limit n         Restrict to the first n selected files.
  --no-setup        Do not fetch/check out corpus repos before running ast.
  --no-build        Do not build packages/tsts/dist before running ast.
  --pretty          Write pretty JSON mismatch dumps.
`);
}

function parseArgs(argv) {
  const result = { _: [] };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      result._.push(arg);
      continue;
    }
    const eq = arg.indexOf("=");
    const key = arg.slice(2, eq === -1 ? undefined : eq);
    if (eq !== -1) {
      result[key] = arg.slice(eq + 1);
      continue;
    }
    const next = argv[index + 1];
    if (next !== undefined && !next.startsWith("--")) {
      result[key] = next;
      index++;
    } else {
      result[key] = true;
    }
  }
  return result;
}

function readManifest(path) {
  const manifestPath = resolve(repoRoot, path);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (manifest.schemaVersion !== 1) {
    throw new Error(`unsupported corpus manifest schemaVersion in ${relative(repoRoot, manifestPath)}`);
  }
  if (!Array.isArray(manifest.projects)) {
    throw new Error(`corpus manifest ${relative(repoRoot, manifestPath)} is missing projects[]`);
  }
  return { ...manifest, manifestPath };
}

async function setupCorpus(manifest, options) {
  await mkdir(repoCacheRoot, { recursive: true });
  const projects = selectProjects(manifest, options.project);
  for (const project of projects) {
    await ensureProjectCheckout(project);
  }
}

async function listCorpusFiles(manifest, options) {
  const projects = selectProjects(manifest, options.project);
  const files = await collectCorpusFiles(manifest, projects, options);
  for (const file of files) {
    console.log(`${file.project.name}\t${file.relativePath}`);
  }
  console.log(`files=${files.length}`);
}

async function runAstParity(manifest, options) {
  const projects = selectProjects(manifest, options.project);
  if (!options["no-setup"]) {
    await setupCorpus(manifest, options);
  }
  if (!options["no-build"]) {
    buildTstsDist();
  }

  const helperBinary = await ensureTsgoDumpBinary();
  const tstsDumper = await createTstsDumper();
  const files = await collectCorpusFiles(manifest, projects, options);
  if (files.length === 0) {
    throw new Error("no corpus source files selected");
  }

  const runId = new Date().toISOString().replaceAll(":", "").replace(/\..+$/, "").replace("T", "-");
  const runDir = join(resultRoot, runId);
  await mkdir(runDir, { recursive: true });

  const failures = [];
  const startedAt = Date.now();
  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    const tsgoDump = runTsgoDump(helperBinary, file);
    const tstsDump = await tstsDumper.dump(file);
    const mismatch = firstMismatch(toComparableDump(tsgoDump), toComparableDump(tstsDump));
    if (mismatch !== undefined) {
      const mismatchBase = join(runDir, file.project.name, safeOutputName(file.relativePath));
      await mkdir(dirname(mismatchBase), { recursive: true });
      const spacing = options.pretty ? 2 : 0;
      await writeFile(`${mismatchBase}.tsgo.json`, JSON.stringify(tsgoDump, undefined, spacing) + "\n");
      await writeFile(`${mismatchBase}.tsts.json`, JSON.stringify(tstsDump, undefined, spacing) + "\n");
      failures.push({
        project: file.project.name,
        file: file.relativePath,
        path: mismatch.path,
        expected: mismatch.expected,
        actual: mismatch.actual,
      });
      console.error(`FAIL ${failures.length}: ${file.project.name}/${file.relativePath} ${mismatch.path}`);
      console.error(`  tsgo=${formatValue(mismatch.expected)}`);
      console.error(`  tsts=${formatValue(mismatch.actual)}`);
    }

    const done = index + 1;
    if (done === 1 || done === files.length || done % 50 === 0) {
      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
      console.log(`AST parity ${done}/${files.length} failures=${failures.length} elapsed=${elapsed}s`);
    }
  }

  const summary = {
    schemaVersion: 1,
    manifest: relative(repoRoot, manifest.manifestPath),
    totalFiles: files.length,
    passedFiles: files.length - failures.length,
    failedFiles: failures.length,
    failures,
    runDirectory: relative(repoRoot, runDir),
  };
  await mkdir(resultRoot, { recursive: true });
  await writeFile(join(resultRoot, "latest-summary.json"), JSON.stringify(summary, undefined, 2) + "\n");
  await writeFile(join(resultRoot, "latest-summary.md"), renderSummary(summary));
  console.log(renderSummary(summary));

  if (failures.length > 0) {
    process.exit(1);
  }
}

function selectProjects(manifest, selectedName) {
  const projects = selectedName === undefined
    ? manifest.projects
    : manifest.projects.filter((project) => project.name === selectedName);
  if (projects.length === 0) {
    throw new Error(`no corpus project matched ${selectedName}`);
  }
  for (const project of projects) {
    if (!project.name || !project.repository || !project.commit) {
      throw new Error(`invalid corpus project entry: ${JSON.stringify(project)}`);
    }
  }
  return projects;
}

async function ensureProjectCheckout(project) {
  const checkout = projectCheckoutPath(project);
  await mkdir(dirname(checkout), { recursive: true });
  if (!existsSync(join(checkout, ".git"))) {
    console.log(`Cloning ${project.name} ${project.repository}`);
    run("git", ["clone", "--no-checkout", "--filter=blob:none", project.repository, checkout], repoRoot);
  }

  const currentRemote = runCapture("git", ["-C", checkout, "remote", "get-url", "origin"], repoRoot).trim();
  if (currentRemote !== project.repository) {
    throw new Error(`${relative(repoRoot, checkout)} origin is ${currentRemote}, expected ${project.repository}`);
  }

  const hasCommit = spawnSync("git", ["-C", checkout, "cat-file", "-e", `${project.commit}^{commit}`], { cwd: repoRoot, stdio: "ignore" });
  if (hasCommit.status !== 0) {
    console.log(`Fetching ${project.name}@${project.commit}`);
    run("git", ["-C", checkout, "fetch", "--depth=1", "origin", project.commit], repoRoot);
  }

  const current = runCapture("git", ["-C", checkout, "rev-parse", "HEAD"], repoRoot).trim();
  const hasWorkingTreeFiles = existsSync(join(checkout, "package.json")) || existsSync(join(checkout, "src")) || existsSync(join(checkout, "packages"));
  if (current !== project.commit || !hasWorkingTreeFiles) {
    console.log(`Checking out ${project.name}@${project.commit}`);
    run("git", ["-C", checkout, "checkout", "--detach", "--force", project.commit], repoRoot);
  }
}

function projectCheckoutPath(project) {
  return join(repoCacheRoot, project.name, project.commit);
}

async function collectCorpusFiles(manifest, projects, options) {
  const fileSelection = manifest.fileSelection ?? {};
  const extensions = new Set(fileSelection.extensions ?? [...sourceFileExtensions]);
  const excludedDirectories = new Set(fileSelection.excludedDirectories ?? [...defaultExcludedDirectories]);
  const excludedFileSuffixes = fileSelection.excludedFileSuffixes ?? [];
  const selected = [];

  for (const project of projects) {
    const checkout = projectCheckoutPath(project);
    if (!existsSync(checkout)) {
      throw new Error(`${project.name} has not been set up; run corpus:setup first`);
    }
    const root = join(checkout, project.sourceRoot ?? ".");
    const files = [];
    await collectSourceFiles(root, root, files, { extensions, excludedDirectories, excludedFileSuffixes });
    files.sort((left, right) => left.localeCompare(right));
    for (const relativePath of files) {
      if (options.file !== undefined && normalizePath(options.file) !== relativePath) {
        continue;
      }
      selected.push({
        project,
        root,
        absolutePath: join(root, relativePath),
        relativePath,
        logicalPath: `/${project.name}/${relativePath}`,
      });
    }
  }

  if (options.limit !== undefined) {
    const limit = Number(options.limit);
    if (!Number.isInteger(limit) || limit < 0) {
      throw new Error(`invalid --limit value: ${options.limit}`);
    }
    return selected.slice(0, limit);
  }
  return selected;
}

async function collectSourceFiles(root, directory, result, policy) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (policy.excludedDirectories.has(entry.name)) {
        continue;
      }
      await collectSourceFiles(root, absolute, result, policy);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    const relativePath = normalizePath(relative(root, absolute));
    if (!policy.extensions.has(extname(entry.name))) {
      continue;
    }
    if (policy.excludedFileSuffixes.some((suffix) => relativePath.endsWith(suffix))) {
      continue;
    }
    result.push(relativePath);
  }
}

async function ensureTsgoDumpBinary() {
  const revision = runCapture("git", ["-C", vendorRoot, "rev-parse", "HEAD"], repoRoot).trim();
  const helperHash = sha256File(helperSourcePath).slice(0, 16);
  const key = `${revision.slice(0, 12)}-${helperHash}`;
  const binary = join(helperToolRoot, key, "tsgo-ast-dump");
  if (existsSync(binary)) {
    return binary;
  }

  const moduleRoot = join(helperBuildRoot, key, "module");
  await mkdir(moduleRoot, { recursive: true });
  await copyTrackedTsgoSource(moduleRoot);
  await cp(helperSourcePath, join(moduleRoot, "cmd/tsts-ast-dump/main.go"), { force: true });
  await mkdir(dirname(binary), { recursive: true });
  console.log(`Building TS-Go AST dump helper ${key}`);
  run("go", ["build", "-o", binary, "./cmd/tsts-ast-dump"], moduleRoot);
  return binary;
}

async function copyTrackedTsgoSource(destinationRoot) {
  const marker = join(destinationRoot, ".tsts-copied");
  if (existsSync(marker)) {
    return;
  }
  const files = runCapture("git", ["-C", vendorRoot, "ls-files", "-z"], repoRoot).split("\0").filter(Boolean);
  for (const file of files) {
    const source = join(vendorRoot, file);
    const sourceStat = await stat(source);
    if (!sourceStat.isFile()) {
      continue;
    }
    const destination = join(destinationRoot, file);
    await mkdir(dirname(destination), { recursive: true });
    await cp(source, destination, { force: true });
  }
  await writeFile(marker, new Date().toISOString() + "\n");
}

function buildTstsDist() {
  if (!existsSync(tscPath)) {
    throw new Error(`TypeScript compiler not found at ${relative(repoRoot, tscPath)}; run npm install first`);
  }
  console.log("Building TSTS dist for AST parity");
  run(process.execPath, [tscPath, "-p", "packages/tsts/tsconfig.json", "--pretty", "false"], repoRoot);
}

async function createTstsDumper() {
  const distRoot = join(packageRoot, "dist/src");
  const parserPath = join(distRoot, "internal/parser/parser/statements-declarations.js");
  if (!existsSync(parserPath)) {
    throw new Error(`TSTS dist parser not found at ${relative(repoRoot, parserPath)}; run npx tsc -p packages/tsts/tsconfig.json`);
  }
  const jsdocModule = await import(pathToFileURL(join(distRoot, "internal/parser/jsdoc.js")).href);
  jsdocModule.init();
  const parserModule = await import(pathToFileURL(parserPath).href);
  const coreModule = await import(pathToFileURL(join(distRoot, "internal/core/core.js")).href);
  const scriptKindModule = await import(pathToFileURL(join(distRoot, "internal/core/scriptkind_stringer_generated.js")).href);
  const astModule = await import(pathToFileURL(join(distRoot, "internal/ast/ast.js")).href);
  const diagnosticModule = await import(pathToFileURL(join(distRoot, "internal/ast/diagnostic.js")).href);
  const kindModule = await import(pathToFileURL(join(distRoot, "internal/ast/generated/kinds.js")).href);

  return {
    async dump(file) {
      const sourceText = await readFile(file.absolutePath, "utf8");
      const scriptKind = coreModule.GetScriptKindFromFileName(file.logicalPath);
      const sourceFile = parserModule.ParseSourceFile({
        FileName: file.logicalPath,
        Path: file.logicalPath,
      }, sourceText, scriptKind);
      return {
        schemaVersion: 1,
        compiler: "tsts",
        fileName: file.logicalPath,
        scriptKind: scriptKindModule.ScriptKind_String(scriptKind),
        scriptKindId: scriptKind,
        sourceFile: {
          isDeclarationFile: sourceFile.IsDeclarationFile,
          containsNonAscii: sourceFile.ContainsNonASCII,
          nodeCount: sourceFile.NodeCount,
          textCount: sourceFile.TextCount,
          identifierCount: sourceFile.IdentifierCount,
          path: astModule.SourceFile_Path(sourceFile),
        },
        diagnostics: {
          parse: dumpTstsDiagnosticList(astModule.SourceFile_Diagnostics(sourceFile), diagnosticModule),
          js: dumpTstsDiagnosticList(astModule.SourceFile_JSDiagnostics(sourceFile), diagnosticModule),
          jsdoc: dumpTstsDiagnosticList(astModule.SourceFile_JSDocDiagnostics(sourceFile), diagnosticModule),
        },
        root: dumpTstsNode(sourceFile, sourceFile, astModule, kindModule),
      };
    },
  };
}

function dumpTstsNode(node, sourceFile, astModule, kindModule) {
  if (node === undefined) {
    return undefined;
  }
  const result = {
    kind: kindModule.KindString(node.Kind),
    kindId: node.Kind,
    pos: node.Loc.pos,
    end: node.Loc.end,
    flags: node.Flags,
    children: [],
    childCount: 0,
  };

  const text = safeTstsText(() => astModule.Node_Text(node));
  if (text !== undefined) {
    result.text = text;
  }
  const rawText = safeTstsText(() => astModule.Node_RawText(node));
  if (rawText !== undefined) {
    result.rawText = rawText;
  }

  node.data.ForEachChild((child) => {
    result.children.push(dumpTstsNode(child, sourceFile, astModule, kindModule));
    return false;
  });
  result.childCount = result.children.length;

  const jsdoc = astModule.Node_JSDoc(node, sourceFile).map((child) => dumpTstsNode(child, sourceFile, astModule, kindModule));
  if (jsdoc.length > 0) {
    result.jsdoc = jsdoc;
    result.jsdocCount = jsdoc.length;
  }
  return result;
}

function safeTstsText(callback) {
  try {
    return callback();
  } catch {
    return undefined;
  }
}

function dumpTstsDiagnosticList(diags, diagnosticModule) {
  if (diags === undefined || diags.length === 0) {
    return null;
  }
  return diags.map((diag) => ({
    code: diagnosticModule.Diagnostic_Code(diag),
    pos: diagnosticModule.Diagnostic_Pos(diag),
    end: diagnosticModule.Diagnostic_End(diag),
  }));
}

function runTsgoDump(binary, file) {
  const result = spawnSync(binary, ["--file", file.absolutePath, "--logical", file.logicalPath], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error !== undefined) {
    throw result.error;
  }
  if (result.status !== 0 || result.signal !== null) {
    throw new Error(`TS-Go AST dump failed for ${file.project.name}/${file.relativePath}\n${result.stderr}`);
  }
  return JSON.parse(result.stdout);
}

function toComparableDump(dump) {
  return {
    schemaVersion: dump.schemaVersion,
    fileName: dump.fileName,
    scriptKind: dump.scriptKind,
    scriptKindId: dump.scriptKindId,
    sourceFile: dump.sourceFile,
    diagnostics: normalizeNullArrays(dump.diagnostics),
    root: normalizeNullArrays(dump.root),
  };
}

function normalizeNullArrays(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeNullArrays);
  }
  if (value === null || value === undefined) {
    return [];
  }
  if (typeof value !== "object") {
    return value;
  }
  const result = {};
  for (const key of Object.keys(value).sort()) {
    const child = value[key];
    if ((key === "jsdoc" || key === "children" || key === "parse" || key === "js") && child === undefined) {
      result[key] = [];
    } else {
      result[key] = normalizeNullArrays(child);
    }
  }
  return result;
}

function firstMismatch(expected, actual, path = "$") {
  if (Object.is(expected, actual)) {
    return undefined;
  }
  if (typeof expected !== typeof actual) {
    return { path, expected, actual };
  }
  if (expected === null || actual === null || typeof expected !== "object") {
    return { path, expected, actual };
  }
  if (Array.isArray(expected) || Array.isArray(actual)) {
    if (!Array.isArray(expected) || !Array.isArray(actual)) {
      return { path, expected, actual };
    }
    if (expected.length !== actual.length) {
      return { path: `${path}.length`, expected: expected.length, actual: actual.length };
    }
    for (let index = 0; index < expected.length; index++) {
      const mismatch = firstMismatch(expected[index], actual[index], `${path}[${index}]`);
      if (mismatch !== undefined) {
        return mismatch;
      }
    }
    return undefined;
  }

  const expectedKeys = Object.keys(expected).sort();
  const actualKeys = Object.keys(actual).sort();
  const keyMismatch = firstMismatch(expectedKeys, actualKeys, `${path}.keys`);
  if (keyMismatch !== undefined) {
    return keyMismatch;
  }
  for (const key of expectedKeys) {
    const mismatch = firstMismatch(expected[key], actual[key], `${path}.${key}`);
    if (mismatch !== undefined) {
      return mismatch;
    }
  }
  return undefined;
}

function renderSummary(summary) {
  const lines = [
    "# Corpus AST Parity Summary",
    "",
    `- Manifest: ${summary.manifest}`,
    `- Total files: ${summary.totalFiles}`,
    `- Passed files: ${summary.passedFiles}`,
    `- Failed files: ${summary.failedFiles}`,
    `- Run directory: ${summary.runDirectory}`,
    "",
  ];
  if (summary.failures.length > 0) {
    lines.push("## Failures", "");
    for (const failure of summary.failures.slice(0, 50)) {
      lines.push(`- ${failure.project}/${failure.file}: ${failure.path}`);
      lines.push(`  - TS-Go: ${formatValue(failure.expected)}`);
      lines.push(`  - TSTS: ${formatValue(failure.actual)}`);
    }
    if (summary.failures.length > 50) {
      lines.push(`- ... ${summary.failures.length - 50} more failures`);
    }
  }
  return lines.join("\n") + "\n";
}

function safeOutputName(path) {
  return normalizePath(path).replaceAll("/", "__").replace(/[^a-zA-Z0-9_.-]/g, "_");
}

function formatValue(value) {
  const text = JSON.stringify(value);
  if (text === undefined) {
    return "undefined";
  }
  return text.length > 300 ? `${text.slice(0, 300)}...` : text;
}

function normalizePath(path) {
  return path.split(sep).join("/");
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.error !== undefined) {
    throw result.error;
  }
  if (result.status !== 0 || result.signal !== null) {
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
}

function runCapture(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.error !== undefined) {
    throw result.error;
  }
  if (result.status !== 0 || result.signal !== null) {
    throw new Error(`${command} ${args.join(" ")} failed\n${result.stderr}`);
  }
  return result.stdout;
}
