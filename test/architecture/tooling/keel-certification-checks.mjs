import { keelCheckIds, keelFinding, keelTargetNames, keelWorkspaceRepositories, sortKeelFindings, validPath } from "./keel-contract.mjs";
import { keelDigest } from "./keel-source-analysis.mjs";
import { keelNativeTokens, keelNativeUnsafeSites } from "./keel-native-tokens.mjs";
import { isAbsolute, posix } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { keelSourceRejectionIdentity } from "./keel-source-rejection.mjs";
import { ParseSourceFile } from "../../../packages/tsts/dist/src/internal/parser/parser/statements-declarations.js";
import { createAstReader } from "../../../packages/tsts/dist/src/services/ast-reader.js";
import { ScriptKindJS, ScriptKindJSX, ScriptKindTS, ScriptKindTSX } from "../../../packages/tsts/dist/src/internal/core/scriptkind.js";
import { Node_QuestionDotToken, SourceFile_Diagnostics } from "../../../packages/tsts/dist/src/internal/ast/ast.js";
import { NodeDefault_AsNode } from "../../../packages/tsts/dist/src/internal/ast/spine.js";

const canonicalNativeAllocationBoundary = Object.freeze({
  approvalId: "C-0067/Q-109", boundaryId: "TEST-ALLOCATOR", repo: "rust-runtime",
  path: "tests/helpers/allocation_counts.rs", owner: "CountingAllocator",
  sourceSha256: "51b161241b9b6d49690154c9ab0506b671d1546075a7a81c5ee45335f9b48dc5",
  writerRepo: "tsonic-rust", writerPath: "test/helpers/native-ownership-cost.mjs",
  writerSha256: "b056c542d5e791f1a86d9a9b166a9769ea5001c2abf8dcd7544dafcd4e377cf9",
  windows: Object.freeze([
    "Ordering :: SeqCst ) } struct CountingAllocator ; unsafe impl GlobalAlloc for CountingAllocator { unsafe fn alloc",
    "CountingAllocator ; unsafe impl GlobalAlloc for CountingAllocator { unsafe fn alloc ( & self , layout :",
    ". align ( ) , } ) ; unsafe { System . alloc ( layout ) }",
    "System . alloc ( layout ) } } unsafe fn alloc_zeroed ( & self , layout :",
    ". align ( ) , } ) ; unsafe { System . alloc_zeroed ( layout ) }",
    "System . alloc_zeroed ( layout ) } } unsafe fn dealloc ( & self , pointer :",
    ". size ( ) , } ) ; unsafe { System . dealloc ( pointer , layout",
    "dealloc ( pointer , layout ) } } unsafe fn realloc ( & self , pointer :",
    ". align ( ) , } ) ; unsafe { System . realloc ( pointer , layout",
  ]),
  additionalWindows: Object.freeze([0, 1, 2, 3, 4, 5, 6, 8]),
});

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
    staticEntryCut: "Current canonical consumers and their incoming static source, package and Cargo entries; arbitrary external dynamic IO is not proven. This is not arbitrary dynamic IO soundness.",
    consumers: boundary.consumers,
    transcriptData: boundary.transcriptData,
    literalUrlLoaders: boundary.literalUrlLoaders,
    externalDynamicEntries: boundary.externalDynamicEntries,
  }) });
}

function validateCanonicalNativeAllocationBoundary(workspaceInputs) {
  const boundary = canonicalNativeAllocationBoundary;
  const findings = [];
  const failureIds = new Set();
  const fail = (repo, file, reason) => {
    const finding = keelFinding("AC12", repo, file, "canonical native allocation boundary", reason, { approvalId: boundary.approvalId });
    if (!failureIds.has(finding.id)) findings.push(finding);
    failureIds.add(finding.id);
  };
  const files = new Map();
  for (const [repo, entries] of workspaceInputs) {
    for (const [file, input] of entries) {
      if (!validPath(file) || input === null || typeof input !== "object" || typeof input.tracked !== "boolean" ||
        !["file", "symlink", "gitlink"].includes(input.kind)) throw new Error("Invalid complete AC12 file input.");
      if (input.kind === "file" && (!/^[a-f0-9]{64}$/u.test(input.sha256) || !["100644", "100755"].includes(input.mode) ||
        input.text !== undefined && (typeof input.text !== "string" || keelDigest(input.text) !== input.sha256) ||
        /\.(?:[cm]?[jt]sx?|rs|cs|json|toml|csproj|props|targets)$/u.test(file) && typeof input.text !== "string")) {
        throw new Error(`Incomplete or inconsistent AC12 bytes: ${repo}/${file}.`);
      }
      if (input.kind === "symlink" && (input.mode !== "120000" || typeof input.target !== "string") ||
        input.kind === "gitlink" && (input.mode !== "160000" || !/^[a-f0-9]{40}$/u.test(input.object))) {
        throw new Error(`Invalid complete AC12 file mode: ${repo}/${file}.`);
      }
      files.set(`${repo}/${file}`, input);
    }
  }
  const canonicalPath = `${boundary.repo}/${boundary.path}`;
  const source = files.get(canonicalPath);
  const writer = files.get(`${boundary.writerRepo}/${boundary.writerPath}`);
  if (source?.kind !== "file" || source.tracked !== true || source.sha256 !== boundary.sourceSha256 ||
    JSON.stringify(keelNativeUnsafeSites(source.text)) !== JSON.stringify(boundary.windows)) {
    fail(boundary.repo, boundary.path, "The canonical allocator requires its exact tracked source and all nine reviewed unsafe windows.");
  }
  if (writer?.kind !== "file" || writer.tracked !== true || writer.sha256 !== boundary.writerSha256) {
    fail(boundary.writerRepo, boundary.writerPath, "The canonical test-copy writer requires its exact tracked source.");
  }
  const packages = [];
  const nativeTestRoots = new Set();
  const metadataEntries = [];
  const externalDynamicEntries = [];
  const writerPath = `${boundary.writerRepo}/${boundary.writerPath}`;
  const aliases = new Map();
  const transcriptData = declaredTranscriptData(files);
  const nativeReferences = new Map();
  const scripts = new Map();
  for (const [path, input] of files) {
    const separator = path.indexOf("/");
    const repo = path.slice(0, separator);
    const file = path.slice(separator + 1);
    if (input.kind === "symlink") {
      const destination = resolveAlias(path);
      if (destination !== undefined) aliases.set(path, destination);
      continue;
    }
    if (input.kind !== "file") continue;
    if (path !== canonicalPath && input.tracked && input.sha256 === boundary.sourceSha256) {
      fail(repo, file, "A second tracked canonical allocator implementation is forbidden.");
    }
    if (file === "package.json" || file.endsWith("/package.json")) {
      const metadata = JSON.parse(input.text);
      packages.push({ root: posix.dirname(path), metadata });
      for (const entry of packageEntryStrings(metadata)) metadataEntries.push({ path, entry, form: "package entry" });
    }
    if (posix.basename(file) === "Cargo.toml") {
      let testTarget = false;
      for (const line of input.text.split(/\r?\n/u)) {
        const header = /^\s*(\[\[?[^\]]+\]\]?)/u.exec(line)?.[1];
        if (header !== undefined) testTarget = header === "[[test]]";
        for (const match of line.matchAll(/\b(path|build)\s*=\s*("(?:[^"\\]|\\.)*"|'[^']*')/gu)) {
          const entry = nativeLiteral(match[2]);
          if (testTarget && match[1] === "path") nativeTestRoots.add(resolveAlias(posix.normalize(posix.join(posix.dirname(path), entry))));
          else metadataEntries.push({ path, entry, form: "Cargo product/build entry" });
        }
      }
    }
    if (path.endsWith(".rs")) {
      nativeReferences.set(path, nativeSourceReferences(input.text, path).map(reference => ({ ...reference,
        destination: reference.unresolved ? undefined : resolveAlias(posix.normalize(posix.join(posix.dirname(path), reference.specifier))),
      })).filter(reference => !reference.implicit || files.has(reference.destination)));
    } else if (/\.[cm]?[jt]sx?$/u.test(path) && !transcriptData.has(path)) {
      scripts.set(path, scriptSourceReferences(path, input.text));
    }
  }
  const restricted = new Set([canonicalPath, writerPath, ...transcriptData]);
  const consumers = [];
  const nativeParents = new Map();
  for (const [path, references] of nativeReferences) {
    for (const reference of references.filter(candidate => candidate.destination === canonicalPath)) {
      if (reference.testOnly) { consumers.push(Object.freeze({ path, kind: "cfg(test)" })); continue; }
      const parent = nativeTestRoots.has(path) ? path : [...nativeTestRoots].find(root =>
        nativeReferences.get(root)?.some(candidate => candidate.destination === path));
      const guardedParent = [...nativeReferences].find(([_parent, entries]) =>
        entries.some(candidate => candidate.destination === path && candidate.testOnly))?.[0];
      if (parent === undefined && guardedParent === undefined) reject(path, "native observer consumer without a Cargo test entry or directly attached test parent");
      else {
        if (parent !== undefined) restricted.add(parent);
        nativeParents.set(path, parent);
      }
      restricted.add(path);
      consumers.push(Object.freeze({ path, kind: parent === undefined ? "cfg(test) module" : "Cargo test", parent: parent ?? guardedParent }));
    }
  }
  for (const [path, script] of scripts) {
    const usesWriter = script.references.some(reference => reference.module && destinations(path, reference).includes(writerPath));
    const readsObserver = script.references.some(reference => reference.fileRead && destinations(path, reference).includes(canonicalPath));
    const computedEntry = script.references.some(reference => reference.module && ambiguousEntry(path, reference));
    if (path === writerPath || !usesWriter && !readsObserver && !computedEntry) continue;
    restricted.add(path);
    if (!script.testEntry) reject(path, "observer reader is not a direct Node test entry");
    consumers.push(Object.freeze({ path, kind: usesWriter ? "Node test writer consumer" : readsObserver ? "Node test source witness" : "Node test computed source entry" }));
  }
  for (const [path, destination] of aliases) {
    if ([...restricted].some(entry => entry === destination || entry.startsWith(`${destination}/`))) {
      reject(path, "source symlink aliases the observer, writer or one of their test entries");
    }
  }
  for (const { path, entry, form } of metadataEntries) {
    if (touchesRestricted(posix.normalize(posix.join(posix.dirname(path), entry)))) reject(path, `${form}: ${entry}`);
  }
  for (const [path, references] of nativeReferences) {
    for (const reference of references) {
      if (reference.testOnly) continue;
      if (reference.unresolved || isAbsolute(reference.specifier) && [...restricted].some(entry => reference.specifier.endsWith(`/${entry}`))) {
        reject(path, `unresolved first-party native source inclusion: ${reference.specifier}`);
      } else if (restricted.has(reference.destination) && !(reference.destination === canonicalPath && nativeParents.has(path)) &&
        nativeParents.get(reference.destination) !== path) reject(path, `native source inclusion: ${reference.specifier}`);
    }
  }
  for (const [path, script] of scripts) {
    for (const reference of script.references) {
      if (reference.external) { externalDynamicEntries.push(Object.freeze({ path, offset: reference.offset })); continue; }
      if (reference.unresolved) { reject(path, reference.unresolvedReason ?? "unresolved executable source syntax"); continue; }
      const targets = destinations(path, reference);
      const hits = targets.some(touchesRestricted);
      const ambiguous = ambiguousEntry(path, reference);
      if (!hits && !ambiguous) continue;
      const allowed = !transcriptData.has(targets[0]) && (script.testEntry || path === writerPath &&
        reference.fileRead && targets.length === 1 && targets[0] === canonicalPath);
      if (!allowed) reject(path, `${reference.module ? "module" : "observer file"} inclusion: ${reference.specifier ?? "unresolved first-party root"}`);
    }
  }
  return Object.freeze({ findings: sortKeelFindings(findings), consumers: Object.freeze(consumers),
    literalUrlLoaders: Object.freeze([...scripts].flatMap(([path, script]) => script.literalUrlLoaders
      .map(loader => Object.freeze({ path, ...loader })))),
    transcriptData: Object.freeze([...transcriptData].sort()), externalDynamicEntries: Object.freeze(externalDynamicEntries), workspaceInputsSha256: keelDigest(JSON.stringify(
    [...files].map(([path, input]) => [path, input.kind === "file" ? { ...input, text: undefined } : input])
      .sort(([left], [right]) => left.localeCompare(right)))) });

  function reject(path, reason) {
    const separator = path.indexOf("/");
    fail(path.slice(0, separator), path.slice(separator + 1), `The canonical test-only cut rejects ${reason}.`);
  }

  function resolveAlias(path) {
    const seen = new Set();
    const links = new Set();
    for (;;) {
      if (!validPath(path) || !keelWorkspaceRepositories.includes(path.split("/")[0]) || seen.has(path)) {
        if (seen.size > 0) reject([...seen][0], "unresolved or cyclic source symlink outside the snapshot");
        return undefined;
      }
      seen.add(path);
      const segments = path.split("/");
      const prefix = segments.map((_segment, index) => segments.slice(0, index + 1).join("/"))
        .find(candidate => files.get(candidate)?.kind === "symlink");
      if (prefix === undefined) {
        if (seen.size > 1 && !files.has(path) && ![...files.keys()].some(file => file.startsWith(`${path}/`))) {
          reject([...seen][0], "unresolved source symlink target in the snapshot");
          return undefined;
        }
        return path;
      }
      const target = files.get(prefix).target;
      if (links.has(prefix)) { reject([...seen][0], "cyclic source symlink in the snapshot"); return undefined; }
      links.add(prefix);
      if (isAbsolute(target)) { reject([...seen][0], "absolute source symlink outside the snapshot"); return undefined; }
      path = posix.normalize(posix.join(posix.dirname(prefix), target, path.slice(prefix.length)));
    }
  }

  function touchesRestricted(path) {
    if (path === undefined) return false;
    if (path.includes("*")) return [...restricted, ...aliases.keys()].some(entry => new RegExp(
      `^${path.split("*").map(part => part.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")).join(".*")}$`, "u").test(entry));
    return restricted.has(resolveAlias(path));
  }

  function ambiguousEntry(path, reference) {
    return reference.firstParty && (!reference.fileRead || reference.observerEvidence) && destinations(path, reference).length === 0 &&
      (reference.suffix === undefined || [...restricted, ...aliases.keys()].some(entry => entry.endsWith(reference.suffix)));
  }

  function destinations(sourcePath, reference) {
    if (reference.path !== undefined) return [resolveAlias(reference.path)];
    const specifier = reference.specifier;
    if (specifier === undefined) return [];
    if (isAbsolute(specifier)) return [...files.keys()].filter(path => specifier.endsWith(`/${path}`)).map(resolveAlias);
    if (reference.fileRead) return [];
    if (specifier.startsWith(".")) return [resolveAlias(posix.normalize(posix.join(posix.dirname(sourcePath), specifier)))];
    const result = [];
    for (const entry of packages) {
      const name = entry.metadata.name;
      if (typeof name !== "string" || specifier !== name && !specifier.startsWith(`${name}/`)) continue;
      const subpath = specifier === name ? "." : `.${specifier.slice(name.length)}`;
      const exports = entry.metadata.exports;
      const target = typeof exports === "object" && exports !== null && Object.keys(exports).some(key => key.startsWith("."))
        ? exports[subpath] : subpath === "." ? exports ?? entry.metadata.main : subpath;
      result.push(...stringLeaves(target).map(value => resolveAlias(posix.normalize(posix.join(entry.root, value)))));
    }
    return result;
  }
}

function declaredTranscriptData(files) {
  const root = "tsts-legacy/packages/tsts/tools/tsgo-suite";
  const manifest = files.get(`${root}/tsgo-accepted/manifest.json`);
  const reader = files.get(`${root}/run.mjs`)?.text;
  const writer = files.get(`${root}/capture-tsgo-accepted.mjs`)?.text;
  if (manifest?.kind !== "file" || !reader?.includes('parseBaselineSections(readFileSync(overlayPath, "utf8"))') ||
    !writer?.includes('join(overlayRoot, "manifest.json")')) return new Set();
  const entries = JSON.parse(manifest.text);
  if (!Array.isArray(entries)) throw new Error("Invalid declared TS-Go transcript data.");
  return new Set(entries.map(entry => {
    if (![entry.corpus, entry.suite, entry.artifact].every(validPath) || !Array.isArray(entry.sections)) {
      throw new Error("Invalid declared TS-Go transcript data entry.");
    }
    const path = `${root}/tsgo-accepted/${entry.corpus}/${entry.suite}/${entry.artifact}`;
    if (files.get(path)?.tracked !== true || !files.get(path)?.text?.startsWith("Generated by tools/tsgo-suite/capture-tsgo-accepted.mjs from pinned TS-Go ")) {
      throw new Error(`Missing declared TS-Go transcript bytes: ${path}.`);
    }
    return path;
  }));
}

function stringLeaves(value) {
  if (typeof value === "string") return [value];
  return value !== null && typeof value === "object" ? Object.values(value).flatMap(stringLeaves) : [];
}

function packageEntryStrings(metadata) {
  return [metadata.main, metadata.bin, metadata.exports].flatMap(stringLeaves);
}

function nativeLiteral(text) {
  if (text.startsWith('"')) return JSON.parse(text);
  if (text.startsWith("'")) return text.slice(1, -1);
  const raw = /^(?:br|r)(#+)?"([\s\S]*)"\1$/u.exec(text);
  if (raw !== null) return raw[2];
  throw new Error("Unresolved native source-inclusion literal.");
}

function nativeSourceReferences(text, path) {
  const tokens = keelNativeTokens(text).filter(token => token.kind !== "comment");
  const references = [];
  let depth = 0;
  let pendingTest = false;
  let pendingPaths = [];
  const testScopes = new Set();
  const publish = () => {
    references.push(...pendingPaths.map(specifier => ({ specifier, testOnly: pendingTest || testScopes.size > 0 })));
    pendingPaths = [];
  };
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index].text === "#" && tokens[index + 1]?.text === "[") {
      let end = index + 2;
      let brackets = 1;
      while (end < tokens.length && brackets > 0) {
        if (tokens[end].text === "[") brackets += 1;
        if (tokens[end].text === "]") brackets -= 1;
        end += 1;
      }
      const attribute = tokens.slice(index + 2, end - 1);
      if (attribute.map(token => token.text).join(" ") === "cfg ( test )") pendingTest = true;
      if (attribute[0]?.text === "path" && attribute[1]?.text === "=" && attribute[2]?.kind === "literal") {
        pendingPaths.push(nativeLiteral(attribute[2].text));
      }
      index = end - 1;
      continue;
    }
    if (tokens[index].text === "mod" && tokens[index + 1]?.kind === "identifier" && tokens[index + 2]?.text === ";" && pendingPaths.length === 0) {
      const name = tokens[index + 1].text;
      const stem = posix.basename(path, ".rs");
      const prefixes = ["lib", "main", "mod"].includes(stem) ? [""] : ["", `${stem}/`];
      for (const prefix of prefixes) {
        references.push(...[`${prefix}${name}.rs`, `${prefix}${name}/mod.rs`].map(specifier => ({
          specifier, testOnly: pendingTest || testScopes.size > 0, implicit: true,
        })));
      }
    }
    if (["include", "include_str", "include_bytes"].includes(tokens[index].text) && tokens[index + 1]?.text === "!") {
      if (tokens[index + 3]?.kind === "literal" && tokens[index + 4]?.text === ")") {
        references.push({ specifier: nativeLiteral(tokens[index + 3].text), testOnly: pendingTest || testScopes.size > 0 });
      } else if (tokens.slice(index + 2, index + 30).some(token => token.kind === "literal" && /(?:test|allocation_counts|CARGO_MANIFEST_DIR)/u.test(token.text))) {
        references.push({ specifier: "computed native test inclusion", testOnly: pendingTest || testScopes.size > 0, unresolved: true });
      }
    }
    if (tokens[index].text === "{") {
      publish();
      depth += 1;
      if (pendingTest) testScopes.add(depth);
      pendingTest = false;
    } else if (tokens[index].text === ";" || tokens[index].text === "}") {
      publish();
      pendingTest = false;
      if (tokens[index].text === "}") { testScopes.delete(depth); depth -= 1; }
    }
  }
  return references;
}

function scriptSourceReferences(path, text) {
  if (!/\b(?:import|export|require|URL|readFile|copyFile)\b/u.test(text)) return { references: [], testEntry: false, literalUrlLoaders: Object.freeze([]) };
  const ast = createAstReader();
  const kind = path.endsWith(".tsx") ? ScriptKindTSX : path.endsWith(".jsx") ? ScriptKindJSX
    : /\.[cm]?js$/u.test(path) ? ScriptKindJS : ScriptKindTS;
  const sourcePath = `/keel/${path}`;
  const source = ParseSourceFile({ FileName: sourcePath, Path: sourcePath }, text, kind);
  if (source === undefined) throw new Error(`Unresolved AC12 source syntax: ${path}.`);
  if (source.IsDeclarationFile) return { references: [], testEntry: false, literalUrlLoaders: Object.freeze([]) };
  if ((SourceFile_Diagnostics(source)?.length ?? 0) > 0) return { references: [{ unresolved: true }], testEntry: false, literalUrlLoaders: Object.freeze([]) };
  const references = [];
  const nodes = [];
  const imports = new Map();
  const variables = new Map();
  const identifiers = new Map();
  const visit = node => {
    nodes.push(node);
    if (ast.kindName(node) === "KindIdentifier") {
      const name = ast.text(node);
      identifiers.set(name, [...identifiers.get(name) ?? [], node]);
    }
    ast.forEachChild(node, visit);
  };
  visit(NodeDefault_AsNode(source));
  for (const node of nodes) {
    const kindName = ast.kindName(node);
    if (["KindImportDeclaration", "KindExportDeclaration"].includes(kindName)) {
      const literal = ast.children(node).find(child => ast.kindName(child) === "KindStringLiteral");
      if (literal === undefined) continue;
      const specifier = ast.text(literal);
      references.push({ specifier, module: true });
      if (kindName !== "KindImportDeclaration") continue;
      const collect = child => {
        if (ast.kindName(child) === "KindImportSpecifier") {
          const names = ast.children(child);
          imports.set(ast.text(names.at(-1)), `${specifier}#${ast.text(names[0])}`);
        } else if (["KindImportClause", "KindNamespaceImport"].includes(ast.kindName(child)) && ast.name(child) !== undefined) {
          imports.set(ast.text(ast.name(child)), `${specifier}#*`);
        }
        ast.forEachChild(child, collect);
      };
      collect(node);
    } else if (kindName === "KindVariableDeclaration" && ast.kindName(ast.name(node)) === "KindIdentifier") {
      const name = ast.text(ast.name(node));
      variables.set(name, [...variables.get(name) ?? [], node]);
    }
  }
  const literalUrlLoaders = [];
  const loaderImports = new Map();
  for (const declarations of variables.values()) {
    for (const declaration of declarations) {
      const arrow = initializer(declaration);
      if (ast.kindName(arrow) !== "KindArrowFunction") continue;
      const body = ast.body(arrow);
      if (ast.kindName(body) !== "KindCallExpression" || ast.kindName(ast.children(body)[0]) !== "KindImportKeyword") continue;
      const address = ast.arguments(body)[0];
      if (ast.kindName(address) !== "KindPropertyAccessExpression" || ast.text(ast.name(address)) !== "href") continue;
      const construction = ast.children(address)[0];
      if (ast.kindName(construction) !== "KindNewExpression") continue;
      const base = ast.arguments(construction)[1];
      if (ast.kindName(base) !== "KindIdentifier" || !urlBaseDeclaration(base)) continue;
      const rejectLoader = reason => loaderImports.set(body, [{ unresolved: true,
        unresolvedReason: `unresolved first-party literal URL loader: ${reason}` }]);
      const baseDeclaration = urlBaseDeclaration(base);
      const baseConstruction = initializer(baseDeclaration);
      const baseArguments = ast.arguments(baseConstruction);
      const parameters = ast.parameters(arrow);
      const loaderName = ast.text(ast.name(declaration));
      const uses = identifiers.get(loaderName);
      const baseUses = identifiers.get(ast.text(base));
      const referencesToLoader = uses.filter(use => use !== ast.name(declaration));
      const calls = referencesToLoader.map(use => ast.parent(use));
      if (!privateConstant(declaration) || declarations.length !== 1 || ast.hasModifierKind(arrow, "async") ||
        parameters.length !== 1 || ast.kindName(ast.name(parameters[0])) !== "KindIdentifier" ||
        ast.children(parameters[0]).length !== 1 || ast.typeParameters(arrow).length !== 0 ||
        ast.arguments(body).length !== 1 || ast.arguments(construction).length !== 2 ||
        ast.kindName(ast.arguments(construction)[0]) !== "KindIdentifier" ||
        ast.text(ast.arguments(construction)[0]) !== ast.text(ast.name(parameters[0])) ||
        !nativeUrlConstructor(ast.children(construction)[0])) {
        rejectLoader("the private immutable binding and exact whole loader body are not proven"); continue;
      }
      if (!privateConstant(baseDeclaration) || variables.get(ast.text(base)).length !== 1 ||
        baseUses.length !== 2 || !baseUses.includes(ast.name(baseDeclaration)) || !baseUses.includes(base) ||
        baseArguments.length !== 2 || !literal(baseArguments[0]) || !importMetaUrl(baseArguments[1]) ||
        !nativeUrlConstructor(ast.children(baseConstruction)[0])) {
        rejectLoader("the literal URL base is ambiguous, escaping, mutable, shadowed or unrooted"); continue;
      }
      if (calls.length === 0 || calls.some((call, index) => ast.kindName(call) !== "KindCallExpression" ||
        ast.children(call)[0] !== referencesToLoader[index] || Node_QuestionDotToken(call) !== undefined ||
        ast.arguments(call).length !== 1 || !literal(ast.arguments(call)[0]) || ast.typeArguments(call).length !== 0)) {
        rejectLoader("every reference must be its declaration or a direct one-literal-argument call"); continue;
      }
      let baseUrl;
      let targets;
      try {
        baseUrl = new URL(ast.text(baseArguments[0]), new URL(path.split("/").map(encodeURIComponent).join("/"), "file:///keel/"));
        targets = calls.map(call => new URL(ast.text(ast.arguments(call)[0]), baseUrl));
        if ([baseUrl, ...targets].some(url => url.protocol !== "file:" || url.hostname !== "" ||
          !url.pathname.startsWith("/keel/") || /%2f|%5c/iu.test(url.pathname) || !validPath(decodeURIComponent(url.pathname.slice(6))))) throw new Error("Unrooted URL");
      } catch {
        rejectLoader("the actual URL base or a literal target leaves the tracked first-party root"); continue;
      }
      const resolved = targets.map(url => decodeURIComponent(url.pathname.slice(6)));
      loaderImports.set(body, resolved.map(target => ({ module: true, path: target, firstParty: true })));
      literalUrlLoaders.push(Object.freeze({ name: loaderName, base: baseUrl.href, targets: Object.freeze(resolved) }));
    }
  }
  const testEntry = ["tsonic/test/", "tsonic-csharp/test/", "tsonic-rust/test/", "csharp-nodejs/nodejs/test/", "rust-nodejs/nodejs/test/"].some(root => path.startsWith(root)) &&
    path.endsWith(".test.mjs") && references.some(reference => reference.specifier === "node:test");
  for (const node of nodes) {
    if (["KindCallExpression", "KindNewExpression"].includes(ast.kindName(node))) {
      const callee = ast.children(node)[0];
      const module = api(callee) === "require" || ast.kindName(callee) === "KindImportKeyword";
      const fileRead = /^node:fs(?:\/promises)?#(?:readFile(?:Sync)?|copyFile(?:Sync)?)$/u.test(api(callee));
      if (!module && !fileRead) continue;
      if (loaderImports.has(node)) { references.push(...loaderImports.get(node)); continue; }
      const address = sourceAddress(ast.arguments(node)[0]);
      if (module && address.literalBaseLoader) {
        references.push({ unresolved: true, unresolvedReason: "unresolved first-party literal URL loader: unsupported whole body or binding" });
      } else if (address.path !== undefined || address.specifier !== undefined || address.firstParty) {
        references.push({ ...address, module, fileRead });
      } else if (module) references.push({ external: true, offset: ast.pos(node) });
    }
  }
  return { references, testEntry, literalUrlLoaders: Object.freeze(literalUrlLoaders) };

  function literal(node) {
    return ["KindStringLiteral", "KindNoSubstitutionTemplateLiteral"].includes(ast.kindName(node));
  }

  function initializer(declaration) {
    const children = ast.children(declaration);
    return children.at(-1) === ast.name(declaration) ? undefined : children.at(-1);
  }

  function privateConstant(declaration) {
    const statement = ast.parent(ast.parent(declaration));
    return ast.variableDeclarationKind(declaration) === "const" && ast.kindName(statement) === "KindVariableStatement" &&
      ast.kindName(ast.parent(statement)) === "KindSourceFile" && !ast.hasModifierKind(statement, "export");
  }

  function importMetaUrl(node) {
    return ast.kindName(node) === "KindPropertyAccessExpression" && ast.text(ast.name(node)) === "url" &&
      ast.kindName(ast.children(node)[0]) === "KindMetaProperty";
  }

  function urlBaseDeclaration(node) {
    return variables.get(ast.text(node))?.find(declaration => {
      const construction = initializer(declaration);
      const constructor = ast.children(construction)[0];
      return ast.kindName(construction) === "KindNewExpression" &&
        (ast.kindName(constructor) === "KindIdentifier" && ast.text(constructor) === "URL" || api(constructor) === "node:url#URL");
    });
  }

  function nativeUrlConstructor(node) {
    if (ast.kindName(node) !== "KindIdentifier") return false;
    if (!["URL", "node:url#URL"].includes(api(node))) return false;
    const name = ast.text(node);
    return !(identifiers.get(name) ?? []).some(use => {
      const parent = ast.parent(use);
      return ast.name(parent) === use && !["KindImportSpecifier", "KindImportClause", "KindNamespaceImport"].includes(ast.kindName(parent));
    });
  }

  function api(node) {
    if (ast.kindName(node) === "KindIdentifier") {
      const name = ast.text(node);
      return imports.get(name) ?? (!variables.has(name) && ["URL", "require"].includes(name) ? name : "");
    }
    if (ast.kindName(node) === "KindPropertyAccessExpression") {
      const receiver = ast.children(node)[0];
      const imported = ast.kindName(receiver) === "KindIdentifier" ? imports.get(ast.text(receiver)) : undefined;
      if (imported?.endsWith("#*")) return `${imported.slice(0, -1)}${ast.text(ast.name(node))}`;
    }
    return "";
  }

  function sourceAddress(node, seen = new Set()) {
    const kindName = ast.kindName(node);
    if (["KindStringLiteral", "KindNoSubstitutionTemplateLiteral"].includes(kindName)) {
      const specifier = ast.text(node);
      return { specifier, suffix: specifier.replace(/^(?:\.\.?\/)+/u, ""),
        firstParty: specifier.startsWith(".") || referencesCanonicalSource(specifier), observerEvidence: referencesCanonicalSource(specifier) };
    }
    if (kindName === "KindIdentifier") {
      const name = ast.text(node);
      if (seen.has(name)) return { firstParty: true };
      const declarations = variables.get(name);
      return declarations?.length === 1 && ast.variableDeclarationKind(declarations[0]) === "const"
        ? sourceAddress(initializer(declarations[0]), new Set([...seen, name])) : {};
    }
    if (kindName === "KindParenthesizedExpression" || kindName === "KindPropertyAccessExpression" && ast.text(ast.name(node)) === "href") {
      return sourceAddress(ast.children(node)[0], seen);
    }
    if (kindName === "KindPropertyAccessExpression" && ast.text(ast.name(node)) === "url" &&
      ast.kindName(ast.children(node)[0]) === "KindMetaProperty") return { path, firstParty: true };
    if (["KindCallExpression", "KindNewExpression"].includes(kindName)) {
      const name = api(ast.children(node)[0]);
      const arguments_ = ast.arguments(node);
      if (["node:url#pathToFileURL", "node:url#fileURLToPath"].includes(name)) return sourceAddress(arguments_[0], seen);
      if (["URL", "node:url#URL"].includes(name)) {
        const base = arguments_[1];
        if (ast.kindName(base) === "KindIdentifier" && urlBaseDeclaration(base)) return { firstParty: true, literalBaseLoader: true };
        const rooted = importMetaUrl(base);
        if (!rooted) return {};
        const value = sourceAddress(arguments_[0], seen);
        if (value.specifier !== undefined) {
          if (value.specifier.startsWith("file:")) return { specifier: decodeURIComponent(new URL(value.specifier).pathname), firstParty: true };
          if (/^[a-z][a-z0-9+.-]*:/iu.test(value.specifier)) return {};
          if (isAbsolute(value.specifier)) return { specifier: value.specifier, firstParty: true };
          return { path: posix.normalize(posix.join(posix.dirname(path), value.specifier)), firstParty: true };
        }
        return { firstParty: true, suffix: value.suffix, observerEvidence: value.observerEvidence };
      }
      if (["node:path#join", "node:path#resolve"].includes(name)) {
        const values = arguments_.map(argument => sourceAddress(argument, seen));
        if (values[0]?.path !== undefined && values.slice(1).every(value => value.specifier !== undefined && !isAbsolute(value.specifier))) {
          return { path: posix.normalize(posix.join(values[0].path, ...values.slice(1).map(value => value.specifier))), firstParty: true };
        }
        const suffix = [];
        for (const value of [...values].reverse()) {
          if (value.specifier === undefined) break;
          suffix.unshift(value.specifier);
        }
        return { firstParty: true, suffix: suffix.length > 0 ? posix.join(...suffix) : undefined,
          observerEvidence: values.some(value => value.observerEvidence) };
      }
      if (name === "node:path#dirname") {
        const value = sourceAddress(arguments_[0], seen);
        return value.path === undefined ? {} : { path: posix.dirname(value.path), firstParty: true };
      }
    }
    const fragments = [];
    const collect = child => {
      if (["KindStringLiteral", "KindNoSubstitutionTemplateLiteral", "KindTemplateHead", "KindTemplateMiddle", "KindTemplateTail"].includes(ast.kindName(child))) fragments.push(ast.text(child));
      ast.forEachChild(child, collect);
    };
    collect(node);
    const tail = kindName === "KindTemplateExpression" ? ast.children(ast.children(node).at(-1)).at(-1)
      : kindName === "KindBinaryExpression" && ast.operatorKindName(node) === "KindPlusToken" ? ast.children(node).at(-1) : undefined;
    const suffix = ["KindStringLiteral", "KindNoSubstitutionTemplateLiteral", "KindTemplateTail"].includes(ast.kindName(tail)) ? ast.text(tail) : undefined;
    return { firstParty: fragments.some(fragment => fragment.startsWith(".") || /(?:test|allocation_counts|native-ownership-cost)/u.test(fragment)),
      suffix, observerEvidence: fragments.some(referencesCanonicalSource) };
  }
}

function referencesCanonicalSource(text) {
  const boundary = canonicalNativeAllocationBoundary;
  return [posix.basename(boundary.path), posix.basename(boundary.writerPath),
    `${boundary.repo}/${posix.dirname(boundary.path)}`, `${boundary.writerRepo}/${posix.dirname(boundary.writerPath)}`]
    .some(fragment => text.includes(fragment));
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
