// @ts-check
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { hostModules } from "../architecture/tooling/host-modules.mjs";
import { inspectHostStructure } from "../architecture/tooling/host-gates.mjs";

const toolingRoot = fileURLToPath(new URL("../../", import.meta.url));

/** @type {(input: import("./host-isolated.mjs").HostIsolationInput) => Promise<import("./host-isolated.mjs").HostIsolationResult>} */
export const compileHostModuleInIsolation = async input => {
  if (process.env.TSONIC_TEST_ADMISSION === undefined || process.env.TSONIC_TEST_ADMISSION_OWNER === undefined)
    throw new Error("Isolated compilation must run inside the existing admitted process-group guard.");
  const root = realpathSync(input.root);
  const module = hostModules.find(module => module.name === input.module);
  if (module === undefined) throw new Error("Isolated compilation requires a declared whole Host module.");
  const compiler = resolve(toolingRoot, "node_modules/@typescript/native-preview/bin/tsgo.js");
  if (!existsSync(compiler)) throw new Error("The installed pinned project compiler is required for isolation.");
  const compilerPackage = createRequire(compiler).resolve(`@typescript/native-preview-${process.platform}-${process.arch}/package.json`);
  const platformRoots = [realpathSync(resolve(dirname(compilerPackage), "lib")),
    ...(module.layer >= 5 || module.name === "ingress" ? [realpathSync(resolve(toolingRoot, "node_modules/@types/node")),
      realpathSync(resolve(toolingRoot, "node_modules/undici-types"))] : []),
    ...(module.name === "ingress" ? [realpathSync(resolve(toolingRoot, "packages/tsts/dist"))] : [])];
  /** @param {string} file */
  const path = file => {
    if (typeof file !== "string" || file.length === 0 || isAbsolute(file) || file.includes("\\") ||
      file.split("/").some(part => part === ".." || part === "." || part.length === 0))
      throw new Error("Isolation requires canonical root-relative file paths.");
    const absolute = realpathSync(resolve(root, file));
    const child = relative(root, absolute);
    if (child === ".." || child.startsWith(`..${sep}`) || isAbsolute(child)) throw new Error("Isolation input escapes its declared root.");
    if (absolute !== resolve(root, file)) throw new Error("Isolation requires original owned files, not aliased source paths.");
    return absolute;
  };
  /** @param {string} directory @param {string} [prefix] @returns {string[]} */
  const enumerate = (directory, prefix = "") => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const name = prefix + entry.name;
    if (entry.isSymbolicLink()) throw new Error("Whole module source inventory may not hide files behind a symlink.");
    if (entry.isDirectory()) return enumerate(resolve(directory, entry.name), `${name}/`);
    return /\.(?:ts|mts|cts|tsx|js|mjs|cjs)$/u.test(name) ? [name] : [];
  });
  const sources = [...input.sourceFiles].sort();
  const complete = enumerate(path(module.directory)).map(file => `${module.directory}/${file}`).sort();
  if (sources.length !== complete.length || sources.some((file, index) => file !== complete[index]) ||
    new Set(input.dependencyContracts).size !== input.dependencyContracts.length)
    throw new Error("Isolation requires the complete exact module source inventory and distinct dependency contracts.");
  if (!sources.includes(module.contract)) throw new Error("A whole module must include its actual contract source.");
  const permitted = new Set(module.dependencies);
  for (const name of permitted) {
    const dependency = hostModules.find(dependency => dependency.name === name);
    if (dependency === undefined) throw new Error("The Host catalogue contains an undeclared dependency owner.");
    for (const child of dependency.dependencies) permitted.add(child);
  }
  for (const file of [...sources, ...input.dependencyContracts]) path(file);
  for (const file of input.dependencyContracts) {
    const dependency = hostModules.find(dependency => file.startsWith(`${dependency.directory}/`) &&
      !file.slice(dependency.directory.length + 1).includes("/"));
    if (dependency === undefined || dependency === module || !file.endsWith(".ts") || file.endsWith(".d.ts") ||
      !input.dependencyContracts.includes(dependency.contract))
      throw new Error("Isolation dependencies must be original declared contract sources and their explicit same-owner data closure.");
    if (!permitted.has(dependency.name)) throw new Error("Isolation dependencies must belong to the module's declared dependency closure.");
  }
  const output = resolve(root, input.outputDirectory);
  if (typeof input.outputDirectory !== "string" || !input.outputDirectory.startsWith(".temp/") ||
    input.outputDirectory.split("/").some(part => part === ".." || part === "." || part.length === 0) ||
    !output.startsWith(`${root}${sep}`)) throw new Error("Isolation output must be a disposable directory beneath this root's .temp.");
  mkdirSync(output, { recursive: true });
  const realOutput = realpathSync(output);
  if (!realOutput.startsWith(`${root}${sep}`)) throw new Error("Isolation output escapes its declared root.");
  const stage = mkdtempSync(resolve(realOutput, "module-"));
  /** @type {string[]} */
  const logs = [];
  /** @param {string} log */
  const failed = log => Object.freeze({ kind: "failed", log });
  /** @param {readonly import("../architecture/tooling/host-gates.mjs").HostGateFinding[]} findings */
  const format = findings => findings.map(finding => `${finding.gate}:${finding.file}:${finding.start}: ${finding.message}`).join("\n");
  /** @param {string} source @param {string} destination */
  const copy = (source, destination) => {
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(source, destination);
  };
  /** @param {string} directory @param {readonly string[]} files @param {string} outDir */
  const compile = (directory, files, outDir) => {
    mkdirSync(directory, { recursive: true });
    const config = resolve(directory, "tsconfig.json");
    writeFileSync(config, JSON.stringify({ compilerOptions: {
      strict: true, noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true,
      noUnusedLocals: true, noUnusedParameters: true, noImplicitReturns: true, noFallthroughCasesInSwitch: true,
      forceConsistentCasingInFileNames: true, esModuleInterop: true,
      noEmitOnError: true, skipLibCheck: false, declaration: true, emitDeclarationOnly: true,
      target: "es2020", module: "nodenext", moduleResolution: "nodenext",
      types: module.layer >= 5 || module.name === "ingress" ? ["node"] : [], rootDir: directory, outDir,
    }, files: files.map(file => resolve(directory, file)) }));
    writeFileSync(resolve(directory, "package.json"), JSON.stringify({ type: "module", private: true }));
    const result = spawnSync(process.execPath, [compiler, "--project", config, "--listFiles"], {
      cwd: directory, encoding: "utf8", maxBuffer: 1_048_576, timeout: 60_000,
    });
    if (result.error !== undefined) throw result.error;
    if (result.signal !== null) throw new Error(`The isolated compiler terminated with ${result.signal}.`);
    logs.push(`strict compiler exit=${result.status}\n${result.stdout}${result.stderr}`);
    if (result.status !== 0) return false;
    const checked = result.stdout.trim().split(/\r?\n/u).filter(Boolean).map(file => realpathSync(file));
    if (checked.length === 0) throw new Error("The successful compiler did not report its actual checked source closure.");
    const foreign = checked.find(file => !file.startsWith(`${directory}${sep}`) &&
      (!/\.d\.(?:ts|mts|cts)$/u.test(file) || !platformRoots.some(root => file.startsWith(`${root}${sep}`))));
    if (foreign !== undefined) {
      logs.push(`isolated-compile: Compiler resolved an undeclared source or peer declaration: ${foreign}`);
      return false;
    }
    return true;
  };
  try {
    const initial = inspectHostStructure({ root, files: [...sources, ...input.dependencyContracts], declarationFiles: input.dependencyContracts });
    if (initial.length !== 0) return failed(format(initial));
    const contracts = resolve(stage, "contracts"), emitted = resolve(stage, "checked-contracts");
    for (const file of input.dependencyContracts) copy(path(file), resolve(contracts, file));
    if (input.dependencyContracts.length > 0 && !compile(contracts, input.dependencyContracts, emitted)) return failed(logs.join("\n"));
    if (input.dependencyContracts.length > 0) {
      const declarations = enumerate(emitted);
      const expected = input.dependencyContracts.map(file => file.replace(/\.ts$/u, ".d.ts")).sort();
      if (declarations.length !== expected.length || declarations.sort().some((file, index) => file !== expected[index]))
        return failed("Fresh dependency declaration emission escaped its declared contract closure.");
      const closure = inspectHostStructure({ root: emitted, files: declarations, declarationFiles: declarations });
      if (closure.length !== 0) return failed(format(closure));
    }
    const isolated = resolve(stage, "isolated"), declarations = resolve(stage, "declarations");
    for (const file of sources) copy(path(file), resolve(isolated, file));
    for (const file of input.dependencyContracts) {
      const declaration = file.replace(/\.ts$/u, ".d.ts");
      copy(resolve(emitted, declaration), resolve(isolated, declaration));
    }
    if (!compile(isolated, sources, declarations)) return failed(logs.join("\n"));
    for (const file of input.dependencyContracts) {
      const declaration = file.replace(/\.ts$/u, ".d.ts");
      copy(resolve(emitted, declaration), resolve(declarations, declaration));
    }
    const generated = enumerate(declarations);
    const selected = inspectHostStructure({ root: declarations, files: generated,
      declarationFiles: [module.contract.replace(/\.ts$/u, ".d.ts")] });
    if (selected.length !== 0) return failed(format(selected));
    return Object.freeze({ kind: "passed", log: logs.join("\n") });
  } finally {
    rmSync(stage, { recursive: true });
  }
};
