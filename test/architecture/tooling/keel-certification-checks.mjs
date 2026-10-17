import { keelCheckIds, keelFinding, keelTargetNames, keelWorkspaceRepositories, sortKeelFindings, validPath } from "./keel-contract.mjs";
import { keelDigest } from "./keel-source-analysis.mjs";
import { keelNativeTokens, keelNativeUnsafeSites } from "./keel-native-tokens.mjs";
import { isAbsolute, posix } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { keelSourceRejectionIdentity } from "./keel-source-rejection.mjs";
import { ParseSourceFile } from "../../../packages/tsts/dist/src/internal/parser/parser/statements-declarations.js";
import { createAstReader } from "../../../packages/tsts/dist/src/services/ast-reader.js";
import { ScriptKindJS, ScriptKindJSX, ScriptKindTS, ScriptKindTSX } from "../../../packages/tsts/dist/src/internal/core/scriptkind.js";
import { SourceFile_Diagnostics } from "../../../packages/tsts/dist/src/internal/ast/ast.js";
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
    staticEntryCut: "Tracked first-party source, package and Cargo entries; arbitrary external dynamic IO is not proven.",
    externalDynamicEntries: boundary.externalDynamicEntries,
  }) });
}

function validateCanonicalNativeAllocationBoundary(workspaceInputs) {
  const boundary = canonicalNativeAllocationBoundary;
  const findings = [];
  const fail = (repo, file, reason) => findings.push(keelFinding("AC12", repo, file,
    "canonical native allocation boundary", reason, { approvalId: boundary.approvalId }));
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
  const externalDynamicEntries = [];
  for (const [path, input] of files) {
    const separator = path.indexOf("/");
    const repo = path.slice(0, separator);
    const file = path.slice(separator + 1);
    if (input.kind === "symlink") {
      const destination = posix.normalize(posix.join(posix.dirname(path), input.target));
      if (destination === canonicalPath || isTestEnclave(destination) && !isTestEnclave(path)) {
        fail(repo, file, "A source symlink cannot alias the canonical allocator or introduce a product-to-test entry.");
      }
      continue;
    }
    if (input.kind !== "file") continue;
    if (path !== canonicalPath && input.tracked && input.sha256 === boundary.sourceSha256) {
      fail(repo, file, "A second tracked canonical allocator implementation is forbidden.");
    }
    if ((file === "package.json" || file.endsWith("/package.json")) && !isTestEnclave(path)) {
      const metadata = JSON.parse(input.text);
      packages.push({ root: posix.dirname(path), metadata });
      for (const entry of packageEntryStrings(metadata)) checkEntry(path, entry, false, "package entry");
    }
    if (posix.basename(file) === "Cargo.toml" && !isTestEnclave(path)) {
      let testTarget = false;
      for (const line of input.text.split(/\r?\n/u)) {
        const header = /^\s*(\[\[?[^\]]+\]\]?)/u.exec(line)?.[1];
        if (header !== undefined) testTarget = header === "[[test]]";
        for (const match of line.matchAll(/\b(path|build)\s*=\s*("(?:[^"\\]|\\.)*"|'[^']*')/gu)) {
          const entry = nativeLiteral(match[2]);
          if (testTarget && match[1] === "path") nativeTestRoots.add(posix.normalize(posix.join(posix.dirname(path), entry)));
          else checkEntry(path, entry, false, "Cargo product/build entry");
        }
      }
    }
  }
  for (const [path, input] of files) {
    if (input.kind !== "file" || input.text === undefined) continue;
    if (path.endsWith(".rs")) {
      const references = nativeSourceReferences(input.text, path);
      for (const reference of references) {
        if (reference.implicit && !files.has(posix.normalize(posix.join(posix.dirname(path), reference.specifier)))) continue;
        checkEntry(path, reference.specifier, reference.testOnly || isTestEnclave(path), "native source inclusion", false, reference.unresolved);
      }
      if (references.some(reference => !reference.testOnly && posix.normalize(posix.join(posix.dirname(path), reference.specifier)) === canonicalPath) &&
        !nativeTestRoots.has(path) && ![...nativeTestRoots].some(root => posix.dirname(root) === posix.dirname(path) ||
          files.get(root)?.text?.includes(`mod ${posix.basename(path, ".rs")};`))) {
        const incoming = [...files].some(([parent, candidate]) => candidate.kind === "file" && parent.endsWith(".rs") &&
          isTestEnclave(parent) && nativeSourceReferences(candidate.text, parent).some(reference =>
            posix.normalize(posix.join(posix.dirname(parent), reference.specifier)) === path));
        if (!incoming) fail(path.split("/")[0], path.slice(path.indexOf("/") + 1), "A native allocator consumer has no Cargo test entry or test-only module parent.");
      }
    } else if (path.endsWith(".cs") && !isTestEnclave(path)) {
      const tokens = keelNativeTokens(input.text).filter(token => token.kind !== "comment");
      for (let index = 0; index < tokens.length; index += 1) {
        if (["ReadAllText", "ReadAllBytes", "ReadAllLines"].includes(tokens[index].text) && tokens[index + 1]?.text === "(" &&
          tokens[index + 2]?.kind === "literal") checkEntry(path, nativeLiteral(tokens[index + 2].text), false, "native file-source inclusion");
      }
    } else if (/\.[cm]?[jt]sx?$/u.test(path) && !isTestEnclave(path)) {
      for (const reference of scriptSourceReferences(path, input.text, packages)) {
        if (reference.external) externalDynamicEntries.push(Object.freeze({ path, offset: reference.offset }));
        else checkEntry(path, reference.specifier, false, reference.module ? "module inclusion" : "file-source inclusion", reference.module, reference.unresolved);
      }
    }
  }
  return Object.freeze({ findings: sortKeelFindings(findings), externalDynamicEntries: Object.freeze(externalDynamicEntries), workspaceInputsSha256: keelDigest(JSON.stringify(
    [...files].map(([path, input]) => [path, input.kind === "file" ? { ...input, text: undefined } : input])
      .sort(([left], [right]) => left.localeCompare(right)))) });

  function checkEntry(sourcePath, specifier, testOnly, form, module = false, unresolved = false) {
    if (testOnly) return;
    let destinations = [];
    if (specifier.startsWith(".") || !module) {
      destinations.push(posix.normalize(posix.join(posix.dirname(sourcePath), specifier)));
    } else {
      for (const entry of packages) {
        const name = entry.metadata.name;
        if (typeof name !== "string" || specifier !== name && !specifier.startsWith(`${name}/`)) continue;
        const subpath = specifier === name ? "." : `.${specifier.slice(name.length)}`;
        const exports = entry.metadata.exports;
        const target = typeof exports === "object" && exports !== null && Object.keys(exports).some(key => key.startsWith("."))
          ? exports[subpath] : subpath === "." ? exports ?? entry.metadata.main : subpath;
        destinations.push(...stringLeaves(target).map(value => posix.normalize(posix.join(entry.root, value))));
      }
    }
    if (unresolved || isAbsolute(specifier) && [...files.keys()].some(path => isTestEnclave(path) && specifier.endsWith(`/${path}`)) ||
      destinations.some(destination => isTestEnclave(destination) || destination.includes("*") && [...files.keys()]
      .some(path => isTestEnclave(path) && new RegExp(`^${destination.split("*").map(part => part.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")).join(".*")}$`, "u").test(path))) ||
      destinations.length === 0 && /(?:^|\/)(?:test|tests)(?:\/|$)/u.test(specifier)) {
      const separator = sourcePath.indexOf("/");
      fail(sourcePath.slice(0, separator), sourcePath.slice(separator + 1), `The canonical test-only cut rejects ${form}: ${specifier}.`);
    }
  }
}

function isTestEnclave(path) {
  return /^[^/]+\/(?:packages\/[^/]+\/)?(?:tests?\/|nodejs\/test\/|rust\/tests\/)/u.test(path);
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
      } else if (tokens.slice(index + 2, index + 30).some(token => token.kind === "literal" && /(?:test|allocation_counts)/u.test(token.text))) {
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

function scriptSourceReferences(path, text, packages) {
  if (!/\b(?:import|export|require|URL|readFile|copyFile|resolve|join)\b/u.test(text)) return [];
  const ast = createAstReader();
  const kind = path.endsWith(".tsx") ? ScriptKindTSX : path.endsWith(".jsx") ? ScriptKindJSX
    : /\.[cm]?js$/u.test(path) ? ScriptKindJS : ScriptKindTS;
  const sourcePath = `/keel/${path}`;
  const source = ParseSourceFile({ FileName: sourcePath, Path: sourcePath }, text, kind);
  if (source === undefined) throw new Error(`Unresolved AC12 source syntax: ${path}.`);
  if (source.IsDeclarationFile) return [];
  if ((SourceFile_Diagnostics(source)?.length ?? 0) > 0) return [{ specifier: "unresolved executable source syntax", module: false, unresolved: true }];
  const references = [];
  const visit = node => {
    const kindName = ast.kindName(node);
    if (["KindImportDeclaration", "KindExportDeclaration"].includes(kindName)) {
      const literal = ast.children(node).find(child => ast.kindName(child) === "KindStringLiteral");
      if (literal !== undefined) references.push({ specifier: ast.text(literal), module: true });
    } else if (["KindCallExpression", "KindNewExpression"].includes(kindName)) {
      const callee = ast.children(node)[0];
      const name = ast.kindName(callee) === "KindIdentifier" ? ast.text(callee) : ast.text(ast.name(callee));
      const module = name === "require" || ast.kindName(callee) === "KindImportKeyword";
      if (module || /^(?:URL|readFile(?:Sync)?|copyFile(?:Sync)?|resolve|join)$/u.test(name)) {
        const arguments_ = ast.arguments(node);
        const literal = arguments_[0];
        if (["KindStringLiteral", "KindNoSubstitutionTemplateLiteral"].includes(ast.kindName(literal))) {
          references.push({ specifier: ast.text(literal), module });
        } else {
          const fragments = [];
          const collect = child => {
            if (["KindStringLiteral", "KindNoSubstitutionTemplateLiteral", "KindTemplateHead", "KindTemplateMiddle", "KindTemplateTail"].includes(ast.kindName(child))) fragments.push(ast.text(child));
            ast.forEachChild(child, collect);
          };
          for (const argument of arguments_) collect(argument);
          const base = arguments_[1];
          const rooted = name === "URL" && ast.kindName(base) === "KindPropertyAccessExpression" && ast.text(ast.name(base)) === "url" &&
            ast.kindName(ast.children(base)[0]) === "KindMetaProperty";
          const firstParty = rooted || fragments.some(fragment => /(?:^|\/)(?:test|tests)(?:\/|$)/u.test(fragment) || module &&
            (fragment.startsWith(".") || packages.some(entry => typeof entry.metadata.name === "string" && fragment.startsWith(entry.metadata.name))));
          if (firstParty) references.push({ specifier: "unresolved computed first-party source entry", module, unresolved: true });
          else if (module || name === "URL") references.push({ external: true, offset: ast.pos(node) });
        }
      }
    }
    ast.forEachChild(node, visit);
  };
  visit(NodeDefault_AsNode(source));
  return references;
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
