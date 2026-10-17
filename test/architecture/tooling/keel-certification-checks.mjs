import { keelCheckIds, keelFinding, keelTargetNames, keelWorkspaceRepositories, sortKeelFindings, validPath } from "./keel-contract.mjs";
import { keelDigest } from "./keel-source-analysis.mjs";
import { keelNativeTokens, keelNativeUnsafeSites } from "./keel-native-tokens.mjs";
import { isAbsolute } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { keelSourceRejectionIdentity } from "./keel-source-rejection.mjs";
import { canonicalNativeAllocationBoundary, validateCanonicalNativeAllocationBoundary } from "./keel-native-allocation-boundary.mjs";

export function evaluateKeelDeterminism(samples, requiredPrograms) {
  const findings = [];
  const seen = new Set();
  const requirements = new Set();
  for (const program of requiredPrograms) {
    const id = `${program.target}:${program.id}`;
    if (!keelTargetNames.includes(program.target) || !validPath(program.id) || requirements.has(id)) {
      throw new Error(`Invalid or duplicate determinism requirement '${id}'.`);
    }
    requirements.add(id);
  }
  for (const sample of samples) {
    const id = `${sample.target}:${sample.id}`;
    const expected = requiredPrograms.find(program => program.target === sample.target && program.id === sample.id);
    if (seen.has(id) || expected === undefined) throw new Error(`Unexpected or duplicate determinism sample '${id}'.`);
    seen.add(id);
    const fail = (reason, evidence = {}) => findings.push(keelFinding("AC11", sample.target,
      sample.id, "double generation", reason, evidence));
    if (!/^[a-f0-9]{64}$/u.test(expected.sourceDigest) || sample.sourceDigest !== expected.sourceDigest ||
      pinIdentity(sample.pins) !== pinIdentity(expected.pins) || !["acceptance", "catalogue"].includes(expected.family)) {
      fail("Generation evidence does not match the prescribed source inputs and repository pins.");
    }
    const sourceRejected = expected.expectation?.kind === "source-rejected";
    if (sourceRejected) {
      if (!(sample.first instanceof Map) || !(sample.second instanceof Map) || sample.first.size !== 0 || sample.second.size !== 0) {
        fail("A source-rejection control cannot publish target artifacts.");
      }
      try {
        const first = keelSourceRejectionIdentity(sample.firstRejection, expected.expectation.diagnosticCodes);
        const second = keelSourceRejectionIdentity(sample.secondRejection, expected.expectation.diagnosticCodes);
        if (first !== second) fail("The independent source-rejection diagnostics differ.");
      } catch (error) {
        fail(error instanceof Error ? error.message : String(error));
      }
    } else if (!(sample.first instanceof Map) || !(sample.second instanceof Map) ||
      sample.first.size === 0 || sample.second.size === 0) {
      fail("Both independent generations must publish a nonempty artifact set.");
      continue;
    }
    if (!(sample.first instanceof Map) || !(sample.second instanceof Map)) continue;
    if (sample.first === sample.second || sample.firstGuard?.log === sample.secondGuard?.log) {
      fail("Double generation requires independent outputs and distinct guarded runs, not one receipt reused twice.");
    }
    for (const [file, bytes] of sample.first) {
      if (!validPath(file) || !Buffer.isBuffer(bytes) && !(bytes instanceof Uint8Array)) throw new Error("Invalid generated artifact bytes or path.");
      const second = sample.second.get(file);
      if (second === undefined || !Buffer.from(bytes).equals(Buffer.from(second))) {
        fail("The two generated artifact sets differ.", { file });
      }
    }
    for (const file of sample.second.keys()) {
      if (!sample.first.has(file)) fail("The second generation publishes an extra artifact.", { file });
    }
    if (!guardSucceeded(sample.firstGuard, sourceRejected ? 1 : 0) || !guardSucceeded(sample.secondGuard, sourceRejected ? 1 : 0)) {
      fail("Each generation needs its own complete successful process-group guard receipt.");
    }
  }
  for (const program of requiredPrograms) {
    if (!seen.has(`${program.target}:${program.id}`)) findings.push(keelFinding("AC11", program.target,
      program.id, "double generation", "Required acceptance/catalogue determinism evidence is missing."));
  }
  if (keelTargetNames.some(target => ["acceptance", "catalogue"].some(family =>
    !requiredPrograms.some(program => program.target === target && program.family === family)))) {
    findings.push(keelFinding("AC11", "tsonic", "test/architecture", "determinism scope",
      "Determinism must cover the prescribed acceptance and catalogue scopes; empty coverage is not certification."));
  }
  return sortKeelFindings(findings);
}

export function guardSucceeded(receipt, expectedExitCode = 0) {
  if (![0, 1].includes(expectedExitCode) || receipt === undefined || receipt === null || receipt.exitCode !== expectedExitCode ||
    receipt.swapMax !== 0 || receipt.calibration !== false || receipt.scopeDrained !== true ||
    !(expectedExitCode === 1 ? [null, "success", "exit-code"] : [null, "success"]).includes(receipt.scopeResult) ||
    !Number.isSafeInteger(receipt.oomBefore) || receipt.oomBefore < 0 || receipt.oomBefore !== receipt.oomAfter) return false;
  return ["memoryMiB", "tasksMax", "timeoutSeconds", "logMaxBytes"].every(key =>
    Number.isSafeInteger(receipt[key]) && receipt[key] > 0) &&
    typeof receipt.log === "string" && (validPath(receipt.log) || isAbsolute(receipt.log) && validPath(receipt.log.slice(1))) &&
    receipt.budget !== undefined && Number.isSafeInteger(receipt.budget.workers) && receipt.budget.workers > 0 &&
    Number.isSafeInteger(receipt.budget.childJobs) && receipt.budget.childJobs > 0 &&
    Number.isSafeInteger(receipt.budget.cpuBudget) && receipt.budget.cpuBudget > 0 &&
    receipt.budget.memoryMiB === receipt.memoryMiB;
}

export function evaluateKeelSafety({ repo, trackedFiles, currentSources, baseSources, currentModel, baseModel, workspaceInputs }) {
  if (!(workspaceInputs instanceof Map) || JSON.stringify([...workspaceInputs.keys()].sort()) !==
    JSON.stringify([...keelWorkspaceRepositories].sort()) || [...workspaceInputs.values()].some(files => !(files instanceof Map))) {
    throw new Error("AC12 requires complete current inputs for all 15 repositories.");
  }
  const findings = [];
  for (const file of trackedFiles) {
    if (file.split("/").includes(".analysis")) findings.push(keelFinding("AC12", repo, file,
      "tracked analysis", "Analysis records must be ignored and untracked."));
  }
  const beforeAssertions = countBy(assertionRows(baseModel).map(row => row.bodySha256));
  for (const row of assertionRows(currentModel)) {
    const id = row.bodySha256;
    if (take(beforeAssertions, id)) continue;
    findings.push(keelFinding("AC12", repo, row.file, row.owner, "A new unchecked any assertion is forbidden.", {
      bodySha256: row.bodySha256,
    }));
  }
  const beforeSuppressions = countBy((baseModel?.suppressions ?? []).map(row => row.bodySha256));
  for (const row of currentModel?.suppressions ?? []) {
    if (take(beforeSuppressions, row.bodySha256)) continue;
    findings.push(keelFinding("AC12", repo, row.file, "type-check suppression",
      "A new type-check suppression is forbidden.", { bodySha256: row.bodySha256 }));
  }
  const nativeBase = [...baseSources].filter(([file]) => file.endsWith(".rs") || file.endsWith(".cs"));
  const beforeIgnores = countBy(nativeBase.flatMap(([_file, text]) => keelNativeTokens(text)
    .filter(token => token.kind === "comment" && /@ts-ignore\b/u.test(token.text)).map(token => token.text)));
  const beforeUnsafe = countBy(nativeBase.flatMap(([_file, text]) => keelNativeUnsafeSites(text)));
  for (const [file, text] of currentSources) {
    if (!file.endsWith(".rs") && !file.endsWith(".cs")) continue;
    for (const token of keelNativeTokens(text)) {
      if (token.kind !== "comment" || !/@ts-ignore\b/u.test(token.text) || take(beforeIgnores, token.text)) continue;
      findings.push(keelFinding("AC12", repo, file, "type-check suppression", "A new type-check suppression is forbidden.", {
        bodySha256: keelDigest(token.text),
      }));
    }
    for (const site of keelNativeUnsafeSites(text)) {
      if (take(beforeUnsafe, site)) continue;
      findings.push(keelFinding("AC12", repo, file, "native safety", "A new native unsafe site is forbidden.", {
        bodySha256: keelDigest(site),
      }));
    }
  }
  if (repo !== canonicalNativeAllocationBoundary.repo) {
    return Object.freeze({ findings: sortKeelFindings(findings), nativeAllocationBoundary: undefined });
  }
  const boundary = validateCanonicalNativeAllocationBoundary(workspaceInputs);
  const changedCanonical = currentSources.get(canonicalNativeAllocationBoundary.path);
  const mismatch = changedCanonical !== undefined && keelDigest(changedCanonical) !==
    workspaceInputs.get(repo).get(canonicalNativeAllocationBoundary.path)?.sha256
    ? [keelFinding("AC12", repo, canonicalNativeAllocationBoundary.path, "canonical native allocation boundary",
      "Changed-source evidence differs from the complete canonical source snapshot.")] : [];
  if (boundary.findings.length > 0 || mismatch.length > 0) {
    return Object.freeze({ findings: sortKeelFindings([...findings, ...boundary.findings, ...mismatch]), nativeAllocationBoundary: undefined });
  }
  const permitted = countBy(canonicalNativeAllocationBoundary.additionalWindows.map(index =>
    keelDigest(canonicalNativeAllocationBoundary.windows[index])));
  const accountedAdditions = [];
  const remaining = findings.filter(finding => {
    if (finding.file !== canonicalNativeAllocationBoundary.path || finding.subject !== "native safety" ||
      !take(permitted, finding.evidence.bodySha256)) return true;
    accountedAdditions.push(finding);
    return false;
  });
  return Object.freeze({ findings: sortKeelFindings(remaining), nativeAllocationBoundary: Object.freeze({
    approvalId: canonicalNativeAllocationBoundary.approvalId, boundaryId: canonicalNativeAllocationBoundary.boundaryId,
    repo, path: canonicalNativeAllocationBoundary.path, sourceSha256: canonicalNativeAllocationBoundary.sourceSha256,
    reviewedUnsafeCount: canonicalNativeAllocationBoundary.windows.length,
    accountedAdditions: sortKeelFindings(accountedAdditions), workspaceInputsSha256: boundary.workspaceInputsSha256,
    staticEntryCut: "Current canonical consumers and incoming static source, package and Cargo entries, including implicit Cargo targets, package imports, executable import-equals, createRequire, module registration, Worker/fork and native Node executions. Script admission and finite built-input discovery use the canonical parser, not raw builtin-word or spelling filters; escaped identifiers retain semantic binding identity and malformed executable bodies deny. Restriction propagates through the existing physical module references before incoming source, alias or metadata validation; a genuine test bridge cannot promote its restricted dependency into product. Lexically attached native cfg(test) edges remain test-only. Erased type-only syntax has no executable edge; its bytes remain captured. Native require names retain raw filesystem identity rather than module-URL decoding. Known native Node option arity separates operands, module/code inputs, the entry script and program arguments; unknown arity and opaque execution/environment configuration fail closed. Explicit execArgv, shell execution, in-file NODE_OPTIONS and synchronous stdin in an executing native mode use the same source-entry owner. Every Function parameter/body field, eval, VM and inline-code input uses nonliteral evidence, never a guessed module filename. Unknown code, arguments and bounded environment remain explicitly unproved. Native URL proofs require scoped closed in-file constructor and address uses. Native builtin getters, source loaders and observer byte roots require direct positive-use evidence; aliases, opaque namespace acquisition, mutation and escape are not evaluated. Finite literal members and const destructuring bind native members exactly like imports; ordinary non-acquiring members do not acquire those roots. Detached native resolve values do not load modules. Installed package contents, including runtime Cargo path dependencies, and runtime-selected plugin packages are not certified. Environment assumption: foreign-module, preload or loader-hook intrinsic mutation and computed-value prototype mutation are excluded, not proven harmless. Within those limits, arbitrary external dynamic IO is not proven, including non-Node child processes. This is not a sandbox or arbitrary dynamic IO soundness.",
    consumers: boundary.consumers,
    transcriptData: boundary.transcriptData,
    literalUrlLoaders: boundary.literalUrlLoaders,
    builtModuleInputs: boundary.builtModuleInputs,
    externalDynamicEntries: boundary.externalDynamicEntries,
  }) });
}

export function createKeelViolationInventory(findings, origin) {
  const inventory = Object.freeze({
    schemaVersion: 1, rules: keelCheckIds, origin,
    violations: sortKeelFindings(findings),
  });
  validateKeelViolationInventory(inventory);
  return inventory;
}

export function evaluateKeelViolationInventory(findings, inventory, manifestSha256) {
  validateKeelViolationInventory(inventory);
  validateKeelViolationInventory({ ...inventory, violations: findings });
  if (manifestSha256 !== undefined && inventory.origin.manifestSha256 !== manifestSha256) {
    throw new Error("Keel contracts changed; the exact inventory requires a fresh reviewed origin, not an unchecked rebaseline.");
  }
  const available = new Map(inventory.violations.map(finding => [finding.id, finding]));
  const unmatched = [];
  for (const finding of sortKeelFindings(findings)) {
    if (!available.delete(finding.id)) unmatched.push(finding);
  }
  const sites = new Map();
  for (const finding of available.values()) {
    const site = relocationSite(finding);
    if (site === undefined) continue;
    const group = sites.get(site.key) ?? [];
    group.push({ finding, identity: site.identity });
    sites.set(site.key, group);
  }
  const newViolations = [];
  const relocatedViolations = [];
  for (const finding of unmatched) {
    const site = relocationSite(finding);
    const group = site === undefined ? [] : sites.get(site.key) ?? [];
    const index = group.findIndex(candidate => isDeepStrictEqual(candidate.identity, site.identity));
    if (index === -1) {
      newViolations.push(finding);
      continue;
    }
    const [{ finding: original }] = group.splice(index, 1);
    available.delete(original.id);
    relocatedViolations.push(Object.freeze({ originalId: original.id, currentId: finding.id }));
  }
  return Object.freeze({
    newViolations: sortKeelFindings(newViolations),
    removedViolations: sortKeelFindings([...available.values()]),
    relocatedViolations: Object.freeze(relocatedViolations),
    inventory: createKeelViolationInventory(inventory.violations.filter(finding => !available.has(finding.id)), inventory.origin),
  });
}

function relocationSite(finding) {
  const { id, evidence, ...identity } = finding;
  if (typeof evidence.bodySha256 !== "string" || !/^[a-f0-9]{64}$/u.test(evidence.bodySha256) ||
    !Number.isSafeInteger(evidence.offset) || evidence.offset < 0) return undefined;
  const { offset, ...proof } = evidence;
  const subject = finding.subject.replace(/<(ArrowFunction|FunctionExpression|FunctionDeclaration)@[0-9]+>/gu, "<$1>");
  return {
    key: JSON.stringify([finding.check, finding.repo, finding.file, subject, finding.reason, evidence.bodySha256]),
    identity: { ...identity, subject, evidence: proof },
  };
}

export function validateKeelViolationInventory(inventory) {
  if (inventory?.schemaVersion !== 1 || JSON.stringify(inventory.rules) !== JSON.stringify(keelCheckIds) ||
    !Array.isArray(inventory.violations) || !/^[a-f0-9]{64}$/u.test(inventory.origin?.manifestSha256) ||
    typeof inventory.origin?.pins !== "object" || inventory.origin.pins === null ||
    Object.keys(inventory.origin.pins).length === 0 || Object.entries(inventory.origin.pins).some(([repo, sha]) =>
      !validPath(repo) || repo.includes("/") || !/^[a-f0-9]{40}$/u.test(sha))) {
    throw new Error("Invalid Keel violation inventory origin or schema.");
  }
  const seen = new Set();
  for (const entry of inventory.violations) {
    if (!keelCheckIds.includes(entry.check) || !validPath(entry.repo) || !validPath(entry.file) ||
      typeof entry.subject !== "string" || entry.subject.length === 0 ||
      typeof entry.reason !== "string" || entry.reason.length === 0 || entry.evidence === null || Array.isArray(entry.evidence) ||
      typeof entry.evidence !== "object" || seen.has(entry.id)) throw new Error("Invalid or duplicate Keel baseline violation.");
    const { id, ...identity } = entry;
    if (id !== keelDigest(JSON.stringify(identity))) throw new Error("A Keel violation fingerprint does not match its exact evidence.");
    seen.add(id);
  }
}

function assertionRows(model) {
  return model?.assertions ?? [];
}

function pinIdentity(pins) {
  if (pins === null || typeof pins !== "object" || Object.keys(pins).length === 0 ||
    Object.entries(pins).some(([repo, sha]) => !validPath(repo) || !/^[a-f0-9]{40}$/u.test(sha))) {
    throw new Error("Invalid generation repository pins.");
  }
  return JSON.stringify(Object.entries(pins).sort(([left], [right]) => left.localeCompare(right)));
}

function countBy(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

function take(counts, key) {
  const count = counts.get(key) ?? 0;
  if (count === 0) return false;
  counts.set(key, count - 1);
  return true;
}
