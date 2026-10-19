import {
  keelFinding, keelNativeContentDifferences, keelNativeDifferences, keelRemovedResponsibilities,
  keelRootFamilies, keelSkeletonFamilies,
  keelStorageStages, sortKeelFindings, validateKeelDifferences, validPath,
} from "./keel-contract.mjs";
import { keelNativeNodeDomains } from "./keel-native-tokens.mjs";
import { stronglyConnectedComponents } from "./strongly-connected-components.mjs";

export function evaluateKeelSkeleton(targetSources, differences = keelNativeDifferences) {
  validateKeelDifferences(differences);
  const sourceDifferences = differences.filter(entry => entry.tree !== "test");
  const findings = [];
  const responsibilities = new Map();
  for (const [repo, sources] of targetSources) {
    const tree = responsibilityTree(sources.keys(), "src/");
    for (const file of sources.keys()) {
      if (!file.startsWith("src/")) continue;
      const path = file.slice(4);
      if (!path.includes("/")) {
        if (path !== "index.ts") findings.push(keelFinding("AC7", repo, file, "src", "Only the public barrel occupies the source root."));
        continue;
      }
      const root = path.split("/")[0];
      if (!keelRootFamilies.includes(root)) {
        findings.push(keelFinding("AC7", repo, file, root, "Source responsibility is outside the prescribed skeleton."));
        continue;
      }
      const removed = keelRemovedResponsibilities.find(responsibility =>
        within(path.replace(/\.(?:tsx?|mts)$/u, ""), responsibility));
      if (removed !== undefined) {
        findings.push(keelFinding("AC7", repo, file, removed,
          "Removed source responsibility must be re-homed; mirroring it does not restore an approved owner."));
      }
      for (const [parent, children] of Object.entries(keelSkeletonFamilies)) {
        if (!path.startsWith(`${parent}/`)) continue;
        const suffix = path.slice(parent.length + 1);
        const child = suffix.split("/")[0].replace(/\.(?:ts|tsx)$/u, "");
        const responsibility = `${parent}/${child}`;
        if (!suffix.includes("/") && flatEntrypoint(parent, child)) continue;
        const native = sourceDifferences.find(entry => entry.target === repo && entry.path === responsibility);
        if (!children.includes(child) && native === undefined) {
          findings.push(keelFinding("AC7", repo, file, responsibility, "Responsibility needs its prescribed slot or an exact native-difference registration."));
        } else {
          tree.directories.add(responsibility);
        }
      }
    }
    responsibilities.set(repo, tree);
  }
  findings.push(...responsibilityParity(responsibilities, "src/", sourceDifferences));
  return sortKeelFindings(findings);
}

export function evaluateKeelTestSkeleton(targetTests, differences = keelNativeDifferences) {
  validateKeelDifferences(differences);
  const testDifferences = differences.filter(entry => entry.tree !== "src");
  const findings = [];
  const responsibilities = new Map();
  const domains = new Set(["analysis", "architecture", "backend", "fixtures", "helpers", "integration", "policy", "providers", "source", "target-model", "toolchain"]);
  for (const [repo, files] of targetTests) {
    const tree = responsibilityTree(files, "test/");
    responsibilities.set(repo, tree);
    for (const path of tree.directories) {
      const parent = path.slice(0, path.lastIndexOf("/"));
      const children = keelSkeletonFamilies[parent];
      if (children !== undefined && !children.includes(path.slice(parent.length + 1)) &&
        !testDifferences.some(entry => entry.target === repo && entry.path === path)) {
        findings.push(keelFinding("AC7", repo, `test/${path}`, path,
          "Test responsibility needs the same prescribed owner or exact target-native registration as its source."));
      }
    }
    for (const file of files) {
      if (!file.startsWith("test/") || !file.slice(5).includes("/")) continue;
      const domain = file.slice(5).split("/")[0];
      if (!domains.has(domain)) findings.push(keelFinding("AC7", repo, file, domain, "Target tests must use the shared responsibility domains."));
      if (/^test\/(?:source\/semantics|policy\/(?:evidence|safety|js-value-operations)|providers\/native\/(?:reflection|protocol|snapshot)|backend\/target-ast\/roslyn)\//u.test(file)) {
        findings.push(keelFinding("AC7", repo, file, domain, "Moved source responsibilities require matching test placement."));
      }
      const removed = keelRemovedResponsibilities.find(responsibility =>
        within(file.slice(5).replace(/\.(?:test\.)?(?:mjs|tsx?)$/u, ""), responsibility));
      if (removed !== undefined) findings.push(keelFinding("AC7", repo, file, removed,
        "Removed source responsibilities require matching test ownership, not a mirrored obsolete test tree."));
    }
  }
  findings.push(...responsibilityParity(responsibilities, "test/", testDifferences));
  return sortKeelFindings(findings);
}

function responsibilityTree(files, prefix) {
  const directories = new Set();
  const modules = new Set();
  for (const file of files) {
    if (!file.startsWith(prefix)) continue;
    const path = file.slice(prefix.length);
    const segments = path.split("/");
    for (let count = 1; count < segments.length; count += 1) directories.add(segments.slice(0, count).join("/"));
    modules.add(path.replace(/(?:\.(?:test|spec))?\.(?:mjs|cjs|mts|cts|tsx?)$/u, ""));
  }
  return { directories, modules };
}

function responsibilityParity(responsibilities, prefix, differences) {
  const findings = [];
  const empty = () => ({ directories: new Set(), modules: new Set() });
  const csharp = responsibilities.get("tsonic-csharp") ?? empty();
  const rust = responsibilities.get("tsonic-rust") ?? empty();
  for (const path of new Set([...csharp.directories, ...rust.directories])) {
    if (csharp.directories.has(path) === rust.directories.has(path)) continue;
    const present = csharp.directories.has(path) ? "tsonic-csharp" : "tsonic-rust";
    if (differences.some(entry => entry.target === present && within(path, entry.path)) ||
      keelNativeContentDifferences.some(entry => path.startsWith(`${entry.path}/`))) continue;
    const peer = present === "tsonic-csharp" ? rust : csharp;
    const segments = path.split("/");
    if (segments.some((_segment, index) => peer.modules.has(segments.slice(0, index + 1).join("/")))) continue;
    findings.push(keelFinding("AC7", present, `${prefix}${path}`, path,
      "A compiler responsibility is one-sided without a native constraint."));
  }
  return findings;
}

export function evaluateKeelStorageStages(sourceFiles, edges) {
  const prefix = "packages/target-api/src/target-analysis/source-storage/";
  const findings = [];
  const stageFor = file => {
    if (!file?.startsWith(prefix)) return undefined;
    const relative = file.slice(prefix.length);
    if (relative === "queries.ts") return keelStorageStages.length;
    const stage = keelStorageStages.indexOf(relative.split("/")[0]);
    return stage < 0 ? undefined : stage;
  };
  for (const file of sourceFiles.keys()) {
    if (file.startsWith(prefix) && stageFor(file) === undefined) {
      findings.push(keelFinding("AC8", "tsonic", file, "source-storage", "Shared storage source needs an exact staged owner."));
    }
  }
  for (const edge of edges) {
    const from = stageFor(edge.source);
    if (from === undefined || edge.kind !== "relative") continue;
    const to = stageFor(edge.target);
    if (edge.unresolved || to !== undefined && to > from) {
      findings.push(keelFinding("AC8", "tsonic", edge.source, edge.specifier,
        "Storage stage imports may only point to the same or an earlier stage.", { target: edge.target, from, to }));
    }
  }
  const vertices = [...sourceFiles.keys()].filter(file => file.startsWith(prefix));
  const dependencies = edges.filter(edge => edge.source.startsWith(prefix) && edge.target?.startsWith(prefix));
  for (const component of stronglyConnectedComponents(vertices, dependencies)) {
    if (component.length > 1 || dependencies.some(edge => edge.source === component[0] && edge.target === component[0])) {
      findings.push(keelFinding("AC8", "tsonic", component[0], "source-storage cycle",
        "The complete shared-storage module graph must be acyclic, including same-stage and self dependencies.", { component }));
    }
  }
  return sortKeelFindings(findings);
}

export function evaluateKeelCoreDomains(runtimeSources) {
  const findings = [];
  for (const [repo, sources] of runtimeSources) {
    if (repo !== "rust-runtime" && repo !== "csharp-runtime") throw new Error("AC9 accepts core runtime source only.");
    for (const [file, text] of sources) {
      for (const domain of keelNativeNodeDomains(text)) {
        findings.push(keelFinding("AC9", repo, file, domain.domain,
          "Core dispatch cannot know a JS/Node domain; domain packages register their own phases.", { offset: domain.offset }));
      }
    }
  }
  return sortKeelFindings(findings);
}

export function evaluateKeelRuntimeFamilies(runtimeSources, register = []) {
  const findings = [];
  const capabilityGaps = [];
  const used = new Set();
  for (const entry of register) {
    if (typeof entry.family !== "string" || entry.family.length === 0 ||
      typeof entry.evidence !== "string" || entry.evidence.length === 0 ||
      !Array.isArray(entry.owners) || entry.owners.length === 0) throw new Error("Invalid runtime family registration.");
    const targets = new Set();
    const tiers = new Set();
    for (const owner of entry.owners) {
      if (!runtimeSources.has(owner.repo) || !validPath(owner.path)) throw new Error("Runtime family needs exact source ownership.");
      const root = keelRuntimeRoots[owner.repo];
      if (root === undefined || !owner.path.startsWith(`${root}/`)) throw new Error("A runtime family cannot claim an entire package or an unrelated root.");
      const id = `${owner.repo}:${owner.path}`;
      if (used.has(id)) throw new Error(`Duplicate runtime responsibility '${id}'.`);
      used.add(id);
      targets.add(owner.repo.startsWith("csharp-") ? "csharp" : "rust");
      tiers.add(owner.repo.split("-").slice(1).join("-"));
      const files = runtimeSources.get(owner.repo);
      if (![...files.keys()].some(file => within(file, owner.path))) {
        findings.push(keelFinding("AC10", owner.repo, owner.path, entry.family, "Registered runtime responsibility has no implementation."));
      }
    }
    if (tiers.size !== 1) throw new Error("A runtime responsibility cannot be paired across core, JS and Node layers.");
    if (targets.size !== 2 && entry.api !== undefined && entry.required === false) {
      if (typeof entry.api !== "string" || entry.api.length === 0 || typeof entry.scopeEvidence !== "string" || entry.scopeEvidence.length === 0) {
        throw new Error("A native API outside the common contract needs its exact identity and signed scope evidence.");
      }
      capabilityGaps.push(Object.freeze({ family: entry.family, api: entry.api, owners: entry.owners,
        required: false, reason: "Native API counterpart is not part of the retained common contract; no API parity is certified.", scopeEvidence: entry.scopeEvidence }));
    } else if (targets.size !== 2 && (typeof entry.nativeReason !== "string" || entry.nativeReason.length === 0)) {
      const owner = entry.owners[0];
      findings.push(keelFinding("AC10", owner.repo, owner.path, entry.family, "One-sided runtime family requires its demonstrated native constraint."));
    }
  }
  for (const [repo, files] of runtimeSources) {
    for (const file of files.keys()) {
      const matches = register.flatMap(entry => entry.owners.filter(owner =>
        owner.repo === repo && within(file, owner.path)).map(() => entry.family));
      if (matches.length !== 1) findings.push(keelFinding("AC10", repo, file, "runtime ownership",
        "Every native implementation needs exactly one registered responsibility.", { families: matches }));
    }
  }
  return Object.freeze({ findings: sortKeelFindings(findings), capabilityGaps: Object.freeze(capabilityGaps) });
}

export function evaluateKeelNodeModules(moduleRows, nativeDifferences = [], moduleEvidence = new Map()) {
  const findings = [];
  const capabilityGaps = [];
  const moduleSet = repo => {
    const modules = moduleEvidence.get(repo)?.moduleRegistry?.modules;
    if (!Array.isArray(modules) || modules.some(module => typeof module !== "string" || !module.startsWith("node:")) ||
      new Set(modules).size !== modules.length) {
      findings.push(keelFinding("AC10", repo, "nodejs/src/provider/assembly/modules.ts", "public registry",
        "Public Node module-set verification requires the actual built registry, not identifier spelling."));
      return new Set();
    }
    return new Set(modules);
  };
  const csharp = moduleSet("csharp-nodejs");
  const rust = moduleSet("rust-nodejs");
  for (const module of new Set([...csharp, ...rust])) {
    if (csharp.has(module) === rust.has(module)) continue;
    const repo = csharp.has(module) ? "csharp-nodejs" : "rust-nodejs";
    const registration = nativeDifferences.find(entry => entry.repo === repo && entry.module === module);
    if (registration?.reason?.length > 0 && registration?.evidence?.length > 0) continue;
    const declarations = [...moduleRows.values()].flat().filter(row => row.module === module);
    if (declarations.length > 0 && declarations.every(row => row.required === false && row.scopeEvidence?.length > 0)) {
      capabilityGaps.push(Object.freeze({ module, repo, required: false,
        reason: "Current provider exposure is one-sided outside the retained contract; no API parity is certified.",
        scopeEvidence: declarations.map(row => row.scopeEvidence) }));
      continue;
    }
    findings.push(keelFinding("AC10", repo, "nodejs/src/provider/modules", module,
      "Exposed Node module sets differ without a demonstrated native constraint."));
  }
  for (const [repo, rows] of moduleRows) {
    const model = moduleEvidence.get(repo);
    const actualModules = repo === "csharp-nodejs" ? csharp : rust;
    const reachable = new Set(["nodejs/src/provider/package.ts"]);
    const pending = [...reachable];
    while (pending.length > 0) {
      const source = pending.pop();
      for (const edge of model?.edges ?? []) {
        if (edge.source !== source || edge.target === undefined || reachable.has(edge.target)) continue;
        reachable.add(edge.target);
        pending.push(edge.target);
      }
    }
    const seen = new Set();
    for (const row of rows) {
      if (!validPath(row.file) || typeof row.module !== "string" || !row.module.startsWith("node:") ||
        typeof row.exposed !== "boolean" || seen.has(row.module)) throw new Error("Invalid or duplicate Node module row.");
      seen.add(row.module);
      if (row.exposed && (model === undefined || !actualModules.has(row.module) || !reachable.has(row.file) ||
        !model.stringLiterals.some(literal => literal.file === row.file && literal.text === row.module))) {
        findings.push(keelFinding("AC10", repo, row.file, row.module,
          "Exposed module registration lacks exact literal and package-reachability evidence."));
      }
      if (!row.exposed && actualModules.has(row.module)) {
        findings.push(keelFinding("AC10", repo, row.file, row.module,
          "A reachable provider declaration cannot be relabeled native-only to hide a parity gap."));
      }
      if (!row.exposed && row.nativeReachable && !row.evidence?.length) {
        findings.push(keelFinding("AC10", repo, row.file, row.module,
          "Native-only implementation requires its checked reachability evidence, never automatic deletion."));
      }
    }
    for (const module of actualModules) {
      if (!seen.has(module)) {
        findings.push(keelFinding("AC10", repo, "nodejs/src/provider/assembly/modules.ts", module,
          "A public module registration is missing from the exact provider parity inventory."));
      }
    }
  }
  return Object.freeze({ findings: sortKeelFindings(findings), capabilityGaps: Object.freeze(capabilityGaps) });
}

export const keelRuntimeRoots = Object.freeze({
  "csharp-runtime": "src/Tsonic.CSharp.Runtime",
  "rust-runtime": "crates/tsonic_rust_runtime/src",
  "csharp-js": "src/Tsonic.CSharp.Js",
  "rust-js": "crates/tsonic_rust_js/src",
  "csharp-nodejs": "csharp/src/Tsonic.CSharp.Node",
  "rust-nodejs": "rust/crates/tsonic_rust_node/src",
});

function flatEntrypoint(parent, child) {
  if (child === "index") return true;
  return parent === "backend" && child === "compile" ||
    parent === "backend/planner" && ["context", "diagnostics"].includes(child) ||
    parent === "policy/types" && child === "conditional-numeric-carrier" ||
    parent === "providers" && ["catalog"].includes(child);
}

function within(file, path) {
  return file === path || file.startsWith(`${path}/`);
}
