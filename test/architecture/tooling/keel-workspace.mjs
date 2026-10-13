import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { collectFiles, readSourceInventory } from "./file-inventory.mjs";
import { evaluateNodeProviderContract } from "./node-provider-contract.mjs";
import { analyzeKeelTypeScript, keelDigest } from "./keel-source-analysis.mjs";
import { keelFinding, keelTargetNames, sortKeelFindings, validPath } from "./keel-contract.mjs";
import { evaluateKeelLayers } from "./keel-layer-checks.mjs";
import {
  evaluateKeelCoreDomains, evaluateKeelNodeModules, evaluateKeelRuntimeFamilies,
  evaluateKeelSkeleton, evaluateKeelStorageStages, evaluateKeelTestSkeleton, keelRuntimeRoots,
} from "./keel-structure-checks.mjs";
import { evaluateKeelDeterminism, evaluateKeelSafety } from "./keel-certification-checks.mjs";
import { readKeelDeclarations } from "./keel-declarations.mjs";
import { keelOwnedDeterminismPrograms, readKeelProgramInputs } from "./keel-determinism-contracts.mjs";

export const keelWorkspaceRepositories = Object.freeze([
  "tsonic", "tsonic-csharp", "tsonic-rust", "tsts-legacy",
  "csharp-runtime", "csharp-js", "csharp-nodejs", "rust-runtime", "rust-js", "rust-nodejs",
  "express", "tsumo-rust", "csharp-pudding", "rust-pudding", "tsumo-csharp",
]);
const sourceExtensions = Object.freeze([".ts", ".tsx", ".mts", ".mjs"]);
const excluded = Object.freeze([
  ".analysis", ".temp", ".test", ".tests", ".git", "bin", "dist", "node_modules", "obj", "target",
]);

export function validateKeelManifest(manifest) {
  if (manifest?.schemaVersion !== 1 || JSON.stringify(Object.keys(manifest.basePins ?? {}).sort()) !==
    JSON.stringify([...keelWorkspaceRepositories].sort()) || Object.values(manifest.basePins).some(pin =>
      typeof pin !== "string" || !/^[a-f0-9]{40}$/u.test(pin)) ||
    manifest.targets === null || typeof manifest.targets !== "object" ||
    keelTargetNames.some(target => manifest.targets[target] === undefined) ||
    !Array.isArray(manifest.runtimeFamilies) || !Array.isArray(manifest.determinismPrograms)) {
    throw new Error("Keel manifest must pin all 15 repositories and declare both target censuses and certification scopes.");
  }
  const required = new Set(keelOwnedDeterminismPrograms.map(program => `${program.target}:${program.id}`));
  const actual = new Set();
  for (const program of manifest.determinismPrograms) {
    const id = `${program.target}:${program.id}`;
    if (actual.has(id) || !Array.isArray(program.inputs) || program.inputs.length === 0 || program.inputs.some(input =>
      !keelWorkspaceRepositories.includes(input.repo) || !validPath(input.path))) throw new Error("Invalid generation input scope.");
    actual.add(id);
  }
  if ([...required].some(id => !actual.has(id))) throw new Error("Keel certification cannot omit a prescribed acceptance/catalogue scope.");
}

export function evaluateKeelWorkspace(workspace, manifest, { final = false, determinism = [] } = {}) {
  if (!isAbsolute(workspace)) throw new Error("Keel workspace root must be absolute.");
  validateKeelManifest(manifest);
  const findings = [];
  const capabilityGaps = [];
  const targetSources = new Map();
  const targetTests = new Map();
  const runtimes = new Map();
  const nodeModels = new Map();
  const pins = {};
  const sourceDigests = {};
  let totalFunctions = 0;
  for (const repo of keelWorkspaceRepositories) {
    const root = resolve(workspace, repo);
    pins[repo] = git(root, ["rev-parse", "HEAD"]).trim();
    git(root, ["cat-file", "-e", `${manifest.basePins[repo]}^{commit}`]);
  }
  const declarations = readKeelDeclarations(workspace);
  for (const repo of keelWorkspaceRepositories) {
    const root = resolve(workspace, repo);
    const tracked = git(root, ["ls-files", "-z"]).split("\0").filter(Boolean);
    const sources = productSources(root, repo);
    sourceDigests[repo] = digestInventory(sources);
    const typed = new Map([...sources].filter(([file]) => sourceExtensions.some(extension => file.endsWith(extension))));
    let model;
    if (typed.size > 0) {
      model = analyzeKeelTypeScript(typed, declarations);
      totalFunctions += model.functions.length;
    }
    if (keelTargetNames.includes(repo)) {
      targetSources.set(repo, typed);
      targetTests.set(repo, collectFiles(resolve(root, "test"), {
        extensions: [".mjs", ".ts"], exclude: excluded,
      }).map(file => `test/${file}`));
      findings.push(...evaluateKeelLayers(repo, model, manifest.targets[repo]));
    }
    if (repo === "tsonic") findings.push(...evaluateKeelStorageStages(typed, model.edges));
    if (Object.hasOwn(keelRuntimeRoots, repo)) {
      runtimes.set(repo, new Map([...sources].filter(([file]) => file.endsWith(".rs") || file.endsWith(".cs"))));
    }
    if (repo === "csharp-nodejs" || repo === "rust-nodejs") {
      nodeModels.set(repo, model);
      const nodeSources = new Map([...typed].filter(([file]) => file.startsWith("nodejs/src/")));
      const target = repo === "csharp-nodejs" ? "Csharp" : "Rust";
      findings.push(...evaluateNodeProviderContract(nodeSources, {
        targetPackage: `@tsonic/target-${target.toLowerCase()}`,
        factoryName: `create${target}ProviderPackage`,
      }).map(reason => keelFinding("AC10", repo, "nodejs/src/provider", "provider ownership", reason)));
    }
    findings.push(...safety(root, repo, tracked, manifest.basePins[repo]));
  }
  findings.push(...evaluateKeelSkeleton(targetSources, manifest.nativeDifferences));
  findings.push(...evaluateKeelTestSkeleton(targetTests));
  findings.push(...evaluateKeelCoreDomains(new Map([...runtimes].filter(([repo]) =>
    repo === "rust-runtime" || repo === "csharp-runtime"))));
  const runtimeRegistry = evaluateKeelRuntimeFamilies(runtimes, manifest.runtimeFamilies);
  const nodeRegistry = evaluateKeelNodeModules(new Map(Object.entries(manifest.nodeModules ?? {})), manifest.nodeDifferences ?? [], nodeModels);
  findings.push(...runtimeRegistry.findings, ...nodeRegistry.findings);
  capabilityGaps.push(...runtimeRegistry.capabilityGaps, ...nodeRegistry.capabilityGaps);
  if (final || determinism.length > 0) {
    const programs = manifest.determinismPrograms.map(program => {
      try { return { ...program, pins, sourceDigest: readKeelProgramInputs(workspace, program) }; }
      catch (error) {
        findings.push(keelFinding("AC11", program.target, program.id, "required generation inputs",
          error instanceof Error ? error.message : String(error)));
        return { ...program, pins, sourceDigest: "missing" };
      }
    });
    findings.push(...evaluateKeelDeterminism(determinism, programs));
  }
  if (readKeelDeclarations(workspace).inputDigest !== declarations.inputDigest) {
    throw new Error("Public declaration inputs changed during Keel checks; no result is certified.");
  }
  for (const repo of keelWorkspaceRepositories) {
    const root = resolve(workspace, repo);
    if (git(root, ["rev-parse", "HEAD"]).trim() !== pins[repo] ||
      digestInventory(productSources(root, repo)) !== sourceDigests[repo]) {
      throw new Error(`Keel inputs changed during the census in '${repo}'; no result is certified.`);
    }
  }
  return Object.freeze({ findings: sortKeelFindings(findings), capabilityGaps: Object.freeze(capabilityGaps), pins, sourceDigests, totalFunctions,
    determinismExecuted: final || determinism.length > 0 });
}

export function readKeelDeterminism(packetPath) {
  const packet = JSON.parse(readFileSync(packetPath, "utf8"));
  if (!Array.isArray(packet.samples) || typeof packet.artifactRoot !== "string" || !isAbsolute(packet.artifactRoot)) {
    throw new Error("Determinism evidence requires an absolute artifact root and sample list.");
  }
  const root = realpathSync(packet.artifactRoot);
  return packet.samples.map(sample => {
    if (ownedPath(sample.firstDirectory) === ownedPath(sample.secondDirectory) ||
      ownedPath(sample.firstGuardFile) === ownedPath(sample.secondGuardFile) ||
      ownedPath(sample.firstGuardSummary) === ownedPath(sample.secondGuardSummary)) {
      throw new Error("Independent generations cannot reuse an output directory or guard evidence.");
    }
    return {
      ...sample,
      first: artifactSet(sample.firstDirectory, sample.files),
      second: artifactSet(sample.secondDirectory, sample.files),
      firstRejection: sample.firstRejectionFile === undefined ? undefined
        : JSON.parse(readFileSync(ownedPath(sample.firstRejectionFile), "utf8")),
      secondRejection: sample.secondRejectionFile === undefined ? undefined
        : JSON.parse(readFileSync(ownedPath(sample.secondRejectionFile), "utf8")),
      firstGuard: guardReceipt(sample.firstGuardFile, sample.firstGuardSummary),
      secondGuard: guardReceipt(sample.secondGuardFile, sample.secondGuardSummary),
    };
  });

  function ownedPath(path) {
    if (!validPath(path)) throw new Error("Determinism evidence paths must be artifact-root-relative.");
    const absolute = realpathSync(resolve(root, path));
    const inside = relative(root, absolute);
    if (inside === ".." || inside.startsWith("../") || isAbsolute(inside)) throw new Error("Determinism evidence escapes its owned artifact root.");
    return absolute;
  }

  function artifactSet(directory, files) {
    const absolute = ownedPath(directory);
    if (!Array.isArray(files) || files.some(file => !validPath(file))) throw new Error("Invalid deterministic artifact scope.");
    const actual = collectFiles(absolute);
    if (JSON.stringify([...new Set(files)].sort()) !== JSON.stringify(actual)) {
      throw new Error("Declared determinism artifacts must exactly cover each complete output tree.");
    }
    return new Map(actual.map(file => [file, readFileSync(ownedPath(`${directory}/${file}`))]));
  }

  function guardReceipt(file, summary) {
    const receipt = JSON.parse(readFileSync(ownedPath(file), "utf8"));
    const output = readFileSync(ownedPath(summary), "utf8");
    return { ...receipt, scopeDrained: /^\s*scope drained: true\s*$/mu.test(output) };
  }
}

export function defaultKeelWorkspace() {
  return resolve(fileURLToPath(new URL("../../../..", import.meta.url)));
}

function productSources(root, repo) {
  const roots = repo === "tsonic" ? [
    "packages/target-api/src", "packages/source-core/src", "packages/js-source-profile/src",
    "packages/host/src", "packages/cli/src", "packages/create-tsonic/src",
  ] : keelTargetNames.includes(repo) ? ["src"] : Object.hasOwn(keelRuntimeRoots, repo)
    ? [keelRuntimeRoots[repo], ...(repo.endsWith("nodejs") ? ["nodejs/src"] : [])] : [];
  const result = new Map();
  for (const prefix of roots) {
    const directory = resolve(root, prefix);
    if (!existsSync(directory)) throw new Error(`Keel source root is missing: ${repo}/${prefix}.`);
    for (const [file, text] of readSourceInventory(directory, { extensions: [...sourceExtensions, ".rs", ".cs"], exclude: excluded })) {
      result.set(`${prefix}/${file}`, text);
    }
  }
  return result;
}

function safety(root, repo, tracked, base) {
  const changed = new Set(git(root, ["diff", "--name-only", "-z", base, "--"]).split("\0").filter(Boolean));
  for (const file of git(root, ["ls-files", "--others", "--exclude-standard", "-z"]).split("\0").filter(Boolean)) changed.add(file);
  const currentSources = new Map();
  const baseSources = new Map();
  for (const file of changed) {
    if (!validPath(file) || ![...sourceExtensions, ".rs", ".cs"].some(extension => file.endsWith(extension))) continue;
    if (existsSync(resolve(root, file))) currentSources.set(file, readFileSync(resolve(root, file), "utf8"));
    const present = git(root, ["ls-tree", "--name-only", base, "--", file]).trim();
    if (present !== "") baseSources.set(file, git(root, ["show", `${base}:${file}`]));
  }
  const typed = entries => new Map([...entries].filter(([file]) => sourceExtensions.some(extension => file.endsWith(extension))));
  return evaluateKeelSafety({
    repo, trackedFiles: tracked, currentSources, baseSources,
    currentModel: analyzeKeelTypeScript(typed(currentSources), { resolveReferences: false }),
    baseModel: analyzeKeelTypeScript(typed(baseSources), { resolveReferences: false }),
  });
}

function digestInventory(sources) {
  return keelDigest(JSON.stringify([...sources].sort(([left], [right]) => left.localeCompare(right))));
}

function git(root, arguments_) {
  return execFileSync("git", arguments_, {
    cwd: root, encoding: "utf8", timeout: 30_000, maxBuffer: 64 * 1024 * 1024,
  });
}
