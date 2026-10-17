import { isAbsolute, posix } from "node:path";
import { keelFinding, keelWorkspaceRepositories, sortKeelFindings, validLiteralFilePath, validPath } from "./keel-contract.mjs";
import { keelDigest } from "./keel-source-analysis.mjs";
import { keelNativeTokens, keelNativeUnsafeSites } from "./keel-native-tokens.mjs";
import { scriptSourceReferences, staticFileAddress } from "./keel-script-entries.mjs";

export const canonicalNativeAllocationBoundary = Object.freeze({
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

export function validateCanonicalNativeAllocationBoundary(workspaceInputs) {
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
      if (!validLiteralFilePath(file) || input === null || typeof input !== "object" || typeof input.tracked !== "boolean" ||
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
      const root = posix.dirname(path);
      let table = "";
      const disabled = new Set();
      let explicitLibrary = false;
      let explicitBuild = false;
      const declaredTargets = [];
      let declaredTarget;
      for (const line of input.text.split(/\r?\n/u)) {
        const header = /^\s*(\[\[?[^\]]+\]\]?)/u.exec(line)?.[1];
        if (header !== undefined) {
          table = header;
          declaredTarget = ["[lib]", "[[bin]]", "[[example]]", "[[bench]]"].includes(header) ? { kind: header, path: false } : undefined;
          if (declaredTarget !== undefined) declaredTargets.push(declaredTarget);
        }
        if (table === "[package]") {
          const flag = /^\s*(autolib|autobins|autoexamples|autobenches|build)\s*=\s*false\b/u.exec(line)?.[1];
          if (flag !== undefined) disabled.add(flag);
          if (/^\s*build\s*=\s*["']/u.test(line)) explicitBuild = true;
        }
        if (table === "[lib]" && /^\s*path\s*=/u.test(line)) explicitLibrary = true;
        if (declaredTarget !== undefined) {
          const field = /^\s*(name|path)\s*=\s*("(?:[^"\\]|\\.)*"|'[^']*')/u.exec(line);
          if (field?.[1] === "name") declaredTarget.name = nativeLiteral(field[2]);
          if (field?.[1] === "path") declaredTarget.path = true;
        }
      }
      for (const target of declaredTargets.filter(target => !target.path)) {
        const directory = target.kind === "[[bin]]" ? "src/bin" : target.kind === "[[example]]" ? "examples" : "benches";
        const candidates = target.kind === "[lib]" ? ["src/lib.rs"] : typeof target.name === "string" && validPath(target.name)
          ? [`${directory}/${target.name}.rs`, `${directory}/${target.name}/main.rs`, ...(target.kind === "[[bin]]" ? ["src/main.rs"] : [])] : [];
        const present = candidates.filter(candidate => files.has(`${root}/${candidate}`));
        if (present.length === 0) reject(path, "unresolved explicit Cargo product target without a path");
        for (const entry of present) metadataEntries.push({ path, entry, form: "explicit Cargo product target with a default path" });
      }
      for (const candidate of files.keys()) {
        if (!candidate.startsWith(`${root}/`)) continue;
        const relative = candidate.slice(root.length + 1);
        const family = relative === "src/lib.rs" && !explicitLibrary ? "autolib"
          : relative === "build.rs" && !explicitBuild ? "build"
          : relative === "src/main.rs" || /^src\/bin\/(?:[^/]+\.rs|[^/]+\/main\.rs)$/u.test(relative) ? "autobins"
          : /^examples\/(?:[^/]+\.rs|[^/]+\/main\.rs)$/u.test(relative) ? "autoexamples"
          : /^benches\/(?:[^/]+\.rs|[^/]+\/main\.rs)$/u.test(relative) ? "autobenches" : undefined;
        if (family !== undefined && !disabled.has(family)) {
          metadataEntries.push({ path, entry: relative, form: "implicit Cargo product/build target" });
        }
      }
      let testTarget = false;
      for (const line of input.text.split(/\r?\n/u)) {
        const header = /^\s*(\[\[?[^\]]+\]\]?)/u.exec(line)?.[1];
        if (header !== undefined) testTarget = header === "[[test]]";
        for (const match of line.matchAll(/\b(path|build)\s*=\s*("(?:[^"\\]|\\.)*"|'[^']*')/gu)) {
          const entry = nativeLiteral(match[2]);
          if (testTarget && match[1] === "path") {
            const target = resolveAlias(`${posix.dirname(path)}/${entry}`, path);
            if (target !== undefined) nativeTestRoots.add(target);
          } else metadataEntries.push({ path, entry, form: "Cargo product/build entry" });
        }
      }
    }
    if (path.endsWith(".rs")) {
      nativeReferences.set(path, nativeSourceReferences(input.text, path).map(reference => ({ ...reference,
        destination: reference.unresolved ? undefined : resolveAlias(`${posix.dirname(path)}/${reference.specifier}`, path),
      })).filter(reference => !reference.implicit || files.has(reference.destination)));
    } else if (/\.[cm]?[jt]sx?$/u.test(path) && !transcriptData.has(path)) {
      scripts.set(path, scriptSourceReferences(path, input.text, canonicalNativeAllocationBoundary));
    }
  }
  const incomingEntries = new Map();
  const recordIncoming = (sourcePath, target) => {
    if (target === undefined) return;
    if (!incomingEntries.has(target)) incomingEntries.set(target, new Set());
    incomingEntries.get(target).add(sourcePath);
  };
  for (const [path, references] of nativeReferences) {
    for (const reference of references) {
      if (!reference.testOnly && !reference.unresolved) recordIncoming(path, reference.destination);
    }
  }
  const nativeScripts = new Set([...scripts].filter(([path, script]) => script.nativeJavaScript || files.get(path)?.builtModule).map(([path]) => path));
  const pendingScripts = [...scripts.keys()];
  const processedScripts = new Map();
  for (let index = 0; index < pendingScripts.length; index += 1) {
    const path = pendingScripts[index];
    const nativeScript = nativeScripts.has(path);
    if (processedScripts.has(path) && (processedScripts.get(path) || !nativeScript)) continue;
    processedScripts.set(path, nativeScript);
    const script = scripts.get(path);
    for (const reference of script.references) {
      if (!reference.module || reference.external || reference.unresolved) continue;
      for (const target of destinations(path, reference)) {
        recordIncoming(path, target);
        if (transcriptData.has(target)) continue;
        const input = files.get(target);
        if (input?.kind !== "file") {
          if (reference.nativeRequire || nativeScript) reject(path, "uncaptured first-party native module entry");
          continue;
        }
        const format = nativeNodeModuleFormat(target);
        if (format === "data") continue;
        if (format === "binary") { reject(path, "unproved first-party native binary module entry"); continue; }
        if (typeof input.text !== "string") { reject(path, "uncaptured first-party executable module bytes"); continue; }
        if (reference.nativeRequire || nativeScript) nativeScripts.add(target);
        if (!scripts.has(target)) {
          scripts.set(target, scriptSourceReferences(target, input.text, boundary));
          pendingScripts.push(target);
        } else if (nativeScripts.has(target) && processedScripts.get(target) === false) pendingScripts.push(target);
      }
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
    const readsObserver = script.references.some(reference => reference.fileRead && destinations(path, reference).some(target =>
      target === canonicalPath || (reference.directory || reference.treeRead) && canonicalPath.startsWith(`${target}/`)));
    const computedEntry = script.references.some(reference => reference.module && ambiguousEntry(path, reference));
    if (path === writerPath || !usesWriter && !readsObserver && !computedEntry) continue;
    restricted.add(path);
    if (!script.testEntry) reject(path, "observer reader is not a direct Node test entry");
    consumers.push(Object.freeze({ path, kind: usesWriter ? "Node test writer consumer" : readsObserver ? "Node test source witness" : "Node test computed source entry" }));
  }
  const pendingRestricted = [...restricted];
  for (let index = 0; index < pendingRestricted.length; index += 1) {
    for (const sourcePath of incomingEntries.get(pendingRestricted[index]) ?? []) {
      if (restricted.has(sourcePath)) continue;
      restricted.add(sourcePath);
      pendingRestricted.push(sourcePath);
    }
  }
  for (const [path, destination] of aliases) {
    if ([...restricted].some(entry => entry === destination || entry.startsWith(`${destination}/`))) {
      reject(path, "source symlink aliases the observer, writer or one of their test entries");
    }
  }
  for (const { path, entry, form } of metadataEntries) {
    const raw = `${posix.dirname(path)}/${entry}`;
    if (touchesRestricted(raw, path, false, true) || form === "package entry" && touchesRestricted(staticFileAddress(path, entry).path, path, false, true)) reject(path, `${form}: ${entry}`);
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
      if (reference.external) {
        externalDynamicEntries.push(Object.freeze({ path, offset: reference.offset,
          ...(reference.environment === undefined ? {} : { environment: reference.environment }) })); continue;
      }
      if (reference.unresolved) { reject(path, reference.unresolvedReason ?? "unresolved executable source syntax"); continue; }
      const externalTargets = externalPackageImportTargets(path, reference);
      if (externalTargets !== undefined) {
        externalDynamicEntries.push(Object.freeze({ path, packageImport: reference.specifier, externalTargets })); continue;
      }
      const targets = destinations(path, reference);
      const hits = targets.some(target => touchesRestricted(target, path, reference.fileRead && (reference.directory || reference.treeRead)));
      const ambiguous = ambiguousEntry(path, reference);
      if (!hits && !ambiguous) {
        if (reference.module && targets.length === 0 && reference.specifier === undefined && !reference.firstParty) {
          externalDynamicEntries.push(Object.freeze({ path, offset: reference.offset }));
        }
        continue;
      }
      const allowed = !transcriptData.has(targets[0]) && (script.testEntry || path === writerPath &&
        reference.fileRead && targets.length === 1 && targets[0] === canonicalPath);
      if (!allowed) reject(path, `${reference.module ? "module" : "observer file"} inclusion: ${reference.specifier ?? "unresolved first-party root"}`);
    }
  }
  const builtModuleInputs = new Map();
  const pendingModules = [...scripts.values()].flatMap(script => script.finiteModuleTargets);
  while (pendingModules.length > 0) {
    const target = resolveAlias(pendingModules.pop());
    if (target === undefined || builtModuleInputs.has(target)) continue;
    const input = files.get(target);
    if (input?.kind !== "file" || typeof input.text !== "string") {
      reject(target, "missing bytes for a finite module entry or its static imports"); continue;
    }
    builtModuleInputs.set(target, Object.freeze({ path: target, sha256: input.sha256 }));
    for (const reference of scripts.get(target)?.references ?? []) {
      if (reference.module && !reference.unresolved && !reference.external) pendingModules.push(...destinations(target, reference).filter(value => value !== undefined));
    }
  }
  return Object.freeze({ findings: sortKeelFindings(findings), consumers: Object.freeze(consumers),
    literalUrlLoaders: Object.freeze([...scripts].flatMap(([path, script]) => script.literalUrlLoaders
      .map(loader => Object.freeze({ path, ...loader })))),
    builtModuleInputs: Object.freeze([...builtModuleInputs.values()].sort((left, right) => left.path.localeCompare(right.path))),
    transcriptData: Object.freeze([...transcriptData].sort()), externalDynamicEntries: Object.freeze(externalDynamicEntries), workspaceInputsSha256: keelDigest(JSON.stringify(
    [...files].map(([path, input]) => [path, input.kind === "file" ? { ...input, text: undefined } : input])
      .sort(([left], [right]) => left.localeCompare(right)))) });

  function reject(path, reason) {
    const separator = path.indexOf("/");
    fail(path.slice(0, separator), path.slice(separator + 1), `The canonical test-only cut rejects ${reason}.`);
  }

  function resolveAlias(path, ownerPath = path, pattern = false) {
    if (typeof path !== "string" || isAbsolute(path)) return undefined;
    const pending = path.split("/");
    const segments = [];
    const links = new Set();
    while (pending.length > 0) {
      const segment = pending.shift();
      if (segment === "" || segment === ".") continue;
      if (segment === "..") {
        if (pattern && segments.some(part => part.includes("*"))) { reject(ownerPath, "unresolved source pattern parent traversal"); return undefined; }
        if (segments.length === 0) { reject(ownerPath, `${links.size > 0 ? "source symlink" : "source path"} leaves the snapshot`); return undefined; }
        segments.pop(); continue;
      }
      segments.push(segment);
      const prefix = segments.join("/");
      if (files.get(prefix)?.kind !== "symlink") continue;
      const target = files.get(prefix).target;
      if (links.has(prefix)) { reject(ownerPath, "cyclic source symlink in the snapshot"); return undefined; }
      links.add(prefix);
      if (isAbsolute(target)) { reject(ownerPath, "absolute source symlink outside the snapshot"); return undefined; }
      segments.pop();
      pending.unshift(...target.split("/"));
    }
    const resolved = segments.join("/");
    if (!(pattern ? validPath(resolved.replaceAll("*", "entry")) : validLiteralFilePath(resolved)) || !keelWorkspaceRepositories.includes(segments[0])) {
      reject(ownerPath, `${links.size > 0 ? "source symlink" : "source path"} leaves the snapshot`); return undefined;
    }
    if (links.size > 0 && !files.has(resolved) && ![...files.keys()].some(file => file.startsWith(`${resolved}/`))) {
      reject(ownerPath, "unresolved source symlink target in the snapshot"); return undefined;
    }
    return resolved;
  }

  function touchesRestricted(path, ownerPath = path, directory = false, pattern = false) {
    if (path === undefined) return false;
    if (pattern && path.includes("*")) {
      const resolved = resolveAlias(path, ownerPath, true);
      return resolved === undefined || [...restricted, ...aliases.keys()].some(entry => new RegExp(
        `^${resolved.split("*").map(part => part.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")).join(".*")}$`, "u").test(entry));
    }
    const resolved = resolveAlias(path, ownerPath);
    return restricted.has(resolved) || directory && resolved !== undefined && [...restricted].some(entry => entry.startsWith(`${resolved}/`));
  }

  function externalPackageImportTargets(path, reference) {
    if (!reference.module || !reference.specifier?.startsWith("#")) return undefined;
    const targets = packageImportTargets(packages, path, reference.specifier);
    return targets.length > 0 && targets.every(target => !target.startsWith(".") && !target.startsWith("#") &&
      !packages.some(entry => typeof entry.metadata.name === "string" && (target === entry.metadata.name || target.startsWith(`${entry.metadata.name}/`))))
      ? Object.freeze(targets) : undefined;
  }

  function ambiguousEntry(path, reference) {
    if (reference.computedEntry) return true;
    if (externalPackageImportTargets(path, reference) !== undefined) return false;
    if (reference.fileRead && reference.observerEvidence && destinations(path, reference).filter(value => value !== undefined).length === 0) return true;
    if (reference.module && reference.specifier?.startsWith("file:") && destinations(path, reference).length === 0) return true;
    if (reference.module && reference.specifier?.startsWith("#") && destinations(path, reference).length === 0) return true;
    if (reference.executionEntry && reference.firstParty && destinations(path, reference).length === 0) return true;
    if (reference.module && reference.suffix !== undefined && destinations(path, reference).length === 0 &&
      [...restricted].some(entry => entry.endsWith(reference.suffix))) return true;
    return reference.firstParty && (!reference.fileRead || reference.observerEvidence) && destinations(path, reference).length === 0;
  }

  function destinations(sourcePath, reference) {
    if (reference.path !== undefined) {
      const path = reference.module && !reference.nativeRequire && !reference.urlAddress
        ? staticFileAddress("", `./${reference.path}`).path : reference.path;
      return path === undefined ? [] : [resolveAlias(path)].filter(value => value !== undefined);
    }
    let specifier = reference.specifier;
    if (specifier === undefined) return [];
    if (reference.module && !reference.nativeRequire && (specifier.startsWith("file:") || isAbsolute(specifier))) {
      const address = staticFileAddress(sourcePath, specifier);
      if (address.path !== undefined) return [resolveAlias(address.path)].filter(value => value !== undefined);
      specifier = address.specifier;
      if (specifier === undefined) return [];
    }
    if (isAbsolute(specifier)) return [...files.keys()].filter(path => specifier.endsWith(`/${path}`))
      .map(path => resolveAlias(path, sourcePath)).filter(value => value !== undefined);
    if (reference.fileRead) return [];
    if (reference.executionEntry) return [];
    return moduleEntryTargets(packages, sourcePath, specifier, reference.nativeRequire)
      .map(path => resolveAlias(path, sourcePath)).filter(value => value !== undefined);
  }
}

function packageImportTargets(packages, sourcePath, specifier) {
  const owner = packages.filter(entry => sourcePath.startsWith(`${entry.root}/`)).sort((left, right) => right.root.length - left.root.length)[0];
  const imports = owner?.metadata.imports;
  if (imports === null || typeof imports !== "object") return [];
  const key = Object.keys(imports).find(candidate => candidate === specifier) ?? Object.keys(imports).find(candidate => {
    const parts = candidate.split("*");
    return parts.length === 2 && specifier.startsWith(parts[0]) && specifier.endsWith(parts[1]);
  });
  if (key === undefined) return [];
  const parts = key.split("*");
  const captured = parts.length === 2 ? specifier.slice(parts[0].length, specifier.length - parts[1].length) : undefined;
  return stringLeaves(imports[key]).map(target => captured === undefined ? target : target.replaceAll("*", captured));
}

function moduleEntryTargets(packages, sourcePath, specifier, nativeRequire = false) {
  if (specifier.startsWith(".")) {
    const path = nativeRequire ? posix.normalize(posix.join(posix.dirname(sourcePath), specifier)) : staticFileAddress(sourcePath, specifier).path;
    return path === undefined ? [] : [path];
  }
  if (specifier.startsWith("#")) {
    const owner = packages.filter(entry => sourcePath.startsWith(`${entry.root}/`)).sort((left, right) => right.root.length - left.root.length)[0];
    return packageImportTargets(packages, sourcePath, specifier).flatMap(target => target.startsWith(".")
      ? [staticFileAddress(`${owner.root}/package.json`, target).path].filter(path => path !== undefined)
      : target.startsWith("#") ? [] : moduleEntryTargets(packages, sourcePath, target, nativeRequire));
  }
  const result = [];
  for (const entry of packages) {
    const name = entry.metadata.name;
    if (typeof name !== "string" || specifier !== name && !specifier.startsWith(`${name}/`)) continue;
    const subpath = specifier === name ? "." : `.${specifier.slice(name.length)}`;
    const exports = entry.metadata.exports;
    const target = typeof exports === "object" && exports !== null && Object.keys(exports).some(key => key.startsWith("."))
      ? exports[subpath] : subpath === "." ? exports ?? entry.metadata.main : subpath;
    result.push(...stringLeaves(target).map(value => staticFileAddress(`${entry.root}/package.json`, value).path).filter(path => path !== undefined));
  }
  return result;
}

export function keelSafetyBuiltModuleEntries(workspaceInputs) {
  const packages = [...workspaceInputs].flatMap(([repo, files]) => [...files].filter(([file, input]) =>
    input.kind === "file" && posix.basename(file) === "package.json").map(([file, input]) =>
    ({ root: posix.dirname(`${repo}/${file}`), metadata: JSON.parse(input.text) })));
  const transcriptData = declaredTranscriptData(new Map([...workspaceInputs].flatMap(([repo, entries]) =>
    [...entries].map(([file, input]) => [`${repo}/${file}`, input]))));
  const targets = new Set();
  for (const [repo, files] of workspaceInputs) {
    for (const [file, input] of files) {
      const path = `${repo}/${file}`;
      if (input.kind !== "file" || !/\.[cm]?[jt]sx?$/u.test(file) && !input.builtModule || transcriptData.has(path)) continue;
      const script = scriptSourceReferences(path, input.text, canonicalNativeAllocationBoundary);
      for (const target of script.finiteModuleTargets) targets.add(target);
      for (const reference of script.references.filter(reference => reference.module && !reference.external && !reference.unresolved)) {
        const address = reference.path !== undefined && !reference.nativeRequire && !reference.urlAddress
          ? staticFileAddress("", `./${reference.path}`) : reference;
        for (const target of address.path !== undefined ? [address.path]
          : reference.specifier !== undefined ? moduleEntryTargets(packages, path, reference.specifier, reference.nativeRequire) : []) {
          if (nativeNodeModuleFormat(target) !== "script") continue;
          if (input.builtModule || script.nativeJavaScript || reference.nativeRequire) targets.add(target);
        }
      }
    }
  }
  return Object.freeze([...targets].sort());
}

function nativeNodeModuleFormat(path) {
  return posix.extname(path) === ".json" ? "data" : posix.extname(path) === ".node" ? "binary" : "script";
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
    if (!validPath(entry.corpus) || !validPath(entry.suite) || !validLiteralFilePath(entry.artifact) || !Array.isArray(entry.sections)) {
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
  return [metadata.main, metadata.bin, metadata.exports, metadata.imports].flatMap(stringLeaves);
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
  let conditionalPath = false;
  const testScopes = new Set();
  const inlineModules = new Map();
  const publish = () => {
    if (conditionalPath) references.push({ specifier: "conditional native source selection", unresolved: true, testOnly: pendingTest || testScopes.size > 0 });
    references.push(...pendingPaths.map(specifier => ({ specifier: inlineModules.size > 0 && !isAbsolute(specifier)
      ? `${[...(!["lib", "main", "mod"].includes(posix.basename(path, ".rs")) ? [posix.basename(path, ".rs")] : []), ...inlineModules.values()].join("/")}/${specifier}`
      : specifier, testOnly: pendingTest || testScopes.size > 0,
      unresolved: inlineModules.size > 0 && !pendingTest && testScopes.size === 0 })));
    pendingPaths = [];
    conditionalPath = false;
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
      if (attribute[0]?.text === "cfg_attr" && attribute.some((token, offset) => token.text === "path" && attribute[offset + 1]?.text === "=")) conditionalPath = true;
      index = end - 1;
      continue;
    }
    if (tokens[index].text === "mod" && tokens[index + 1]?.kind === "identifier" && tokens[index + 2]?.text === ";" && pendingPaths.length === 0) {
      const name = tokens[index + 1].text;
      const stem = posix.basename(path, ".rs");
      const prefixes = ["lib", "main", "mod"].includes(stem) ? [""] : ["", `${stem}/`];
      for (const prefix of prefixes) {
        const nested = posix.join(prefix, ...inlineModules.values(), name);
        references.push(...[`${nested}.rs`, `${nested}/mod.rs`].map(specifier => ({
          specifier, testOnly: pendingTest || testScopes.size > 0, implicit: true,
        })));
      }
    }
    if (["include", "include_str", "include_bytes"].includes(tokens[index].text) && tokens[index + 1]?.text === "!") {
      const closing = { "(": ")", "[": "]", "{": "}" }[tokens[index + 2]?.text];
      const end = tokens[index + 4]?.text === "," ? index + 5 : index + 4;
      if (closing !== undefined && tokens[index + 3]?.kind === "literal" && tokens[end]?.text === closing) {
        references.push({ specifier: nativeLiteral(tokens[index + 3].text), testOnly: pendingTest || testScopes.size > 0 });
      } else {
        references.push({ specifier: "computed native source inclusion", testOnly: pendingTest || testScopes.size > 0, unresolved: true });
      }
    }
    if (tokens[index].text === "{") {
      publish();
      depth += 1;
      if (tokens[index - 2]?.text === "mod" && tokens[index - 1]?.kind === "identifier") inlineModules.set(depth, tokens[index - 1].text);
      if (pendingTest) testScopes.add(depth);
      pendingTest = false;
    } else if (tokens[index].text === ";" || tokens[index].text === "}") {
      publish();
      pendingTest = false;
      if (tokens[index].text === "}") { testScopes.delete(depth); inlineModules.delete(depth); depth -= 1; }
    }
  }
  return references;
}

