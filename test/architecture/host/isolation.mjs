import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { hostCatalogue, publicEntry, sourceOwner } from "./catalogue.mjs";
import { inspectHost, inspectionDeps } from "./inspect.mjs";

export function isolationDeps(toolingRoot) {
  const root = realpathSync(toolingRoot);
  const compiler = resolve(root, "node_modules/@typescript/native-preview/bin/tsgo.js");
  const version = JSON.parse(readFileSync(resolve(root, "node_modules/@typescript/native-preview/package.json"), "utf8")).version;
  const lock = JSON.parse(readFileSync(resolve(root, "package-lock.json"), "utf8"));
  if (!existsSync(compiler) || lock.packages["node_modules/@typescript/native-preview"].version !== version)
    throw new Error("Installed compiler must match the pinned lock.");
  const enumerate = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error("Explicit declaration inventories cannot contain symlinks.");
    return entry.isDirectory() ? enumerate(path) : [realpathSync(path)];
  });
  const declarations = directory => enumerate(directory).filter(path => /\.d\.(?:ts|mts|cts)$/u.test(path));
  const platform = Object.freeze({
    language: Object.freeze(declarations(resolve(root, `node_modules/@typescript/native-preview-${process.platform}-${process.arch}/lib`))),
    node: Object.freeze([...declarations(resolve(root, "node_modules/@types/node")), ...declarations(resolve(root, "node_modules/undici-types"))]),
    sdk: Object.freeze(declarations(resolve(root, "packages/tsts/dist"))),
  });
  return Object.freeze({
    compiler, platform, nodeTypes: resolve(root, "node_modules/@types"), sdkEntry: resolve(root, "packages/tsts/dist/src/index.d.ts"),
    admitted: () => process.env.TSONIC_TEST_ADMISSION !== undefined && process.env.TSONIC_TEST_ADMISSION_OWNER !== undefined,
    canonical: realpathSync, readText: path => readFileSync(path, "utf8"),
    writeText: (path, text) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, text, { flag: "wx" }); },
    fresh: directory => { mkdirSync(directory, { recursive: true }); return mkdtempSync(resolve(directory, "module-")); },
    discard: directory => rmSync(directory, { recursive: true }), enumerate,
    inspect: (root, files) => inspectHost(inspectionDeps, { root, files, catalogue: hostCatalogue, loadedFiles: [], configurations: [] }),
    run: (directory, config) => {
      const result = spawnSync(process.execPath, [compiler, "--project", config, "--listFiles", "--pretty", "false"], {
        cwd: directory, encoding: "utf8", maxBuffer: 4_194_304, timeout: 90_000,
      });
      if (result.error !== undefined) throw result.error;
      if (result.signal !== null) throw new Error(`Isolated compiler terminated with ${result.signal}.`);
      const output = `${result.stdout}${result.stderr}`;
      const loadedFiles = result.stdout.split(/\r?\n/u).filter(line => isAbsolute(line));
      return Object.freeze({ status: result.status, diagnostics: output, loadedFiles: Object.freeze(loadedFiles) });
    },
  });
}

/** @type {import("./contracts.d.mts").CompileIsolated} */
export async function compileIsolated(deps, module, inputs) {
  if (!deps.admitted()) throw new Error("Isolation requires the admitted aggregate process-group guard.");
  if (!hostCatalogue.includes(module)) throw new Error("Isolation requires an exact declared whole module.");
  const root = deps.canonical(inputs.root);
  const original = path => {
    if (typeof path !== "string" || path.length === 0 || isAbsolute(path) || path.includes("\\") || path.includes("\0") ||
      path.split("/").some(part => ["", ".", ".."].includes(part))) throw new Error("Canonical original source paths required.");
    const absolute = resolve(root, path);
    if (deps.canonical(absolute) !== absolute) throw new Error("Isolation forbids aliased original sources.");
    return absolute;
  };
  const complete = deps.enumerate(original(module.directory)).filter(path => /\.(?:[cm]?[jt]sx?)$/u.test(path))
    .map(path => relative(root, path).split(sep).join("/")).sort();
  const sources = [...inputs.sourceFiles].sort();
  if (new Set(sources).size !== sources.length || JSON.stringify(complete) !== JSON.stringify(sources) || !sources.includes(module.contract))
    throw new Error("Isolation requires the complete exact module source inventory including its actual contract.");
  if (new Set(inputs.interfaceSources).size !== inputs.interfaceSources.length) throw new Error("Distinct public interface sources required.");
  const permitted = new Set(module.imports);
  for (const name of permitted) {
    const dependency = hostCatalogue.find(candidate => candidate.name === name);
    for (const child of dependency.imports) permitted.add(child);
  }
  for (const path of inputs.interfaceSources) {
    const dependency = sourceOwner(hostCatalogue, path);
    if (dependency === undefined || dependency === module || !permitted.has(dependency.name) || !publicEntry(dependency, path) || path.endsWith(".d.ts") ||
      !inputs.interfaceSources.includes(dependency.contract)) throw new Error("Only original permitted public interface sources are admitted.");
    original(path);
  }
  if (!inputs.outputDirectory.startsWith(".temp/") || inputs.outputDirectory.split("/").some(part => ["", ".", ".."].includes(part)))
    throw new Error("Isolation stages belong in an owned .temp directory.");
  const output = resolve(root, inputs.outputDirectory);
  const stage = deps.fresh(output);
  if (!deps.canonical(stage).startsWith(`${root}${sep}`)) throw new Error("Isolation stage escaped its source root.");
  const diagnostics = [];
  const expectedInventory = new Set();
  const loadedInventory = new Set();
  const provenance = [];
  const findings = [];
  const platform = [...deps.platform.language,
    ...(["front", "driver", "orchestration", "cli"].includes(module.name) || ["driver", "orchestration", "cli"].includes(module.kind) ? deps.platform.node : []),
    ...(module.name === "front" ? deps.platform.sdk : [])];
  const report = status => Object.freeze({ status, diagnostics: Object.freeze(diagnostics), findings: Object.freeze(findings),
    expectedInventory: Object.freeze([...expectedInventory].sort()), loadedInventory: Object.freeze([...loadedInventory].sort()),
    provenance: Object.freeze(provenance) });
  const compile = (directory, files, outDir) => {
    const config = resolve(directory, "tsconfig.json");
    const node = module.name === "front" || ["driver", "orchestration", "cli"].includes(module.kind);
    deps.writeText(resolve(directory, "package.json"), JSON.stringify({ type: "module", private: true }));
    deps.writeText(config, JSON.stringify({ compilerOptions: {
      strict: true, noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true,
      noUnusedLocals: true, noUnusedParameters: true, noImplicitReturns: true, noFallthroughCasesInSwitch: true,
      forceConsistentCasingInFileNames: true, noEmitOnError: true, skipLibCheck: false,
      declaration: true, emitDeclarationOnly: true, target: "es2022", lib: ["es2022"], module: "nodenext", moduleResolution: "nodenext",
      types: node ? ["node"] : [], ...(node ? { typeRoots: [deps.nodeTypes] } : {}),
      paths: module.name === "front" ? { "@tsonic/tsts": [deps.sdkEntry] } : {}, rootDir: directory, outDir,
    }, files: files.map(path => resolve(directory, path)) }));
    const domain = new Set([...files.map(path => deps.canonical(resolve(directory, path))), ...platform.map(path => deps.canonical(path))]);
    for (const path of domain) expectedInventory.add(path);
    const result = deps.run(directory, config);
    diagnostics.push(result.diagnostics);
    for (const path of result.loadedFiles) {
      const canonical = deps.canonical(path);
      loadedInventory.add(canonical);
      if (!domain.has(canonical)) findings.push(Object.freeze({ code: "loaded-source-escape", path: canonical, line: 1, column: 1 }));
    }
    if (result.status === 0 && result.loadedFiles.length === 0)
      findings.push(Object.freeze({ code: "loaded-source-escape", path: config, line: 1, column: 1 }));
    return result.status === 0 && findings.length === 0;
  };
  try {
    const originalFindings = deps.inspect(root, [...sources, ...inputs.interfaceSources]);
    findings.push(...originalFindings);
    if (findings.length > 0) return report("failed");
    const interfaces = resolve(stage, "interface-source");
    const emitted = resolve(stage, "interface-declarations");
    const staged = resolve(stage, "isolated");
    for (const path of inputs.interfaceSources) deps.writeText(resolve(interfaces, path), deps.readText(original(path)));
    if (inputs.interfaceSources.length > 0) {
      if (!compile(interfaces, inputs.interfaceSources, emitted)) return report("failed");
      const actual = deps.enumerate(emitted).map(path => relative(emitted, path).split(sep).join("/")).sort();
      const expected = inputs.interfaceSources.map(path => path.replace(/\.ts$/u, ".d.ts")).sort();
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        findings.push(Object.freeze({ code: "loaded-source-escape", path: emitted, line: 1, column: 1 }));
        return report("failed");
      }
      const declarationFindings = deps.inspect(emitted, actual);
      findings.push(...declarationFindings);
      if (findings.length > 0) return report("failed");
    }
    const declarations = [];
    for (const path of inputs.interfaceSources) {
      const declaration = path.replace(/\.ts$/u, ".d.ts");
      const bytes = deps.readText(resolve(emitted, declaration));
      deps.writeText(resolve(staged, declaration), bytes);
      declarations.push(declaration);
      provenance.push(Object.freeze({ source: original(path), sourceHash: createHash("sha256").update(deps.readText(original(path))).digest("hex"),
        declaration: resolve(staged, declaration), declarationHash: createHash("sha256").update(bytes).digest("hex") }));
    }
    for (const path of sources) deps.writeText(resolve(staged, path), deps.readText(original(path)));
    if (!compile(staged, [...sources, ...declarations], resolve(stage, "owner-declarations"))) return report("failed");
    return report("passed");
  } finally {
    deps.discard(stage);
  }
}
