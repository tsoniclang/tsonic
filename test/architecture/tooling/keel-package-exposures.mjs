import { isAbsolute, matchesGlob, posix, relative, resolve } from "node:path";
import { lstatSync, readFileSync, readlinkSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { collectCompilerSourceExports, findInstalledPackageRoot, isCompilerSourceFile, isDeclarationFile, readDependencyNames, readPackageJson } from "../../../packages/host/dist/package-contract.js";
import { collectTargetSourcePackageGraph } from "../../../packages/host/dist/source-package-inputs.js";
import { appendInstalledDeclarationPackageFiles } from "../../../packages/host/dist/declaration-package-inputs.js";
import { createCompilerSessionFromFiles } from "../../../packages/tsts/dist/src/index.js";
import { csharpCoreRuntimeSource, csharpJsRuntimeSource, csharpRuntimeSourceContributions } from "../../../../tsonic-csharp/dist/providers/runtime/source-projects.js";
import { nodejsRuntimeContributions } from "../../../../csharp-nodejs/dist/provider/runtime.js";
import { keelWorkspaceRepositories, validLiteralFilePath } from "./keel-contract.mjs";
import { keelDigest } from "./keel-source-analysis.mjs";
import { staticFileAddress } from "./keel-script-entries.mjs";
import { keelLiteralNodeCommand, keelLiteralNodeEntries } from "./keel-node-executions.mjs";

let buildResourceOwners;
let authoredPrograms = { owners: "", programs: new Map() };

export function keelPackageBuildResources() {
  if (buildResourceOwners !== undefined) return buildResourceOwners;
  const workspace = fileURLToPath(new URL("../../../../", import.meta.url));
  const owners = [
    ["tsonic-csharp/providers/runtime/source-projects", csharpRuntimeSourceContributions(csharpCoreRuntimeSource)],
    ["tsonic-csharp/providers/runtime/source-projects", csharpRuntimeSourceContributions(csharpJsRuntimeSource)],
    ["csharp-nodejs/provider/runtime", nodejsRuntimeContributions()],
  ];
  const artifacts = [
    "tsonic-csharp/src/providers/runtime/source-projects.ts", "tsonic-csharp/dist/providers/runtime/source-projects.js",
    "csharp-nodejs/nodejs/src/provider/runtime.ts", "csharp-nodejs/dist/provider/runtime.js",
  ].map(path => Object.freeze({ path, sha256: keelDigest(readFileSync(resolve(workspace, path))) }));
  const resources = new Map();
  for (const [producer, contributions] of owners) {
    for (const reference of contributions.references ?? []) {
      for (const absolute of [reference.include, reference.attributes?.DirectoryBuildPropsPath]) {
        if (typeof absolute !== "string" || !isAbsolute(absolute)) throw new Error("Unrooted native build-resource owner output.");
        const path = relative(workspace, absolute);
        if (!validLiteralFilePath(path) || !keelWorkspaceRepositories.includes(path.split("/")[0])) {
          throw new Error("Native build-resource owner output leaves the complete workspace.");
        }
        const evidence = Object.freeze({ producer, reference, artifacts: Object.freeze(artifacts) });
        if (!resources.has(path)) resources.set(path, evidence);
      }
    }
  }
  buildResourceOwners = Object.freeze([...resources].map(([path, evidence]) => Object.freeze({ path, evidence })));
  return buildResourceOwners;
}

export function captureKeelPackageOwners(workspace, inputs) {
  const resources = keelPackageBuildResources();
  const artifacts = new Map(resources.flatMap(({ evidence }) => evidence.artifacts.map(artifact => [artifact.path, artifact])));
  for (const artifact of artifacts.values()) {
    const separator = artifact.path.indexOf("/");
    const entries = inputs.get(artifact.path.slice(0, separator));
    const file = artifact.path.slice(separator + 1);
    const bytes = readFileSync(resolve(workspace, artifact.path));
    if (keelDigest(bytes) !== artifact.sha256) throw new Error(`Changed package-role owner artifact: ${artifact.path}.`);
    const existing = entries.get(file);
    if (existing !== undefined && existing.sha256 !== artifact.sha256) throw new Error(`Inconsistent package-role owner artifact: ${artifact.path}.`);
    entries.set(file, Object.freeze({ ...existing, kind: "file", tracked: existing?.tracked ?? false,
      mode: existing?.mode ?? "100644", sha256: artifact.sha256, text: bytes.toString("utf8") }));
  }
  for (const { path, evidence } of resources) {
    const separator = path.indexOf("/");
    const entries = inputs.get(path.slice(0, separator));
    const file = path.slice(separator + 1);
    const input = entries?.get(file);
    if (input?.kind !== "file") throw new Error(`Missing native build-resource owner input: ${path}.`);
    entries.set(file, Object.freeze({ ...input, packageResourceOwner: evidence }));
  }
  const packageInputs = [...inputs].flatMap(([repo, entries]) => [...entries].filter(([file, input]) =>
    input.kind === "file" && input.tracked && posix.basename(file) === "package.json")
    .map(([file, input]) => ({ path: `${repo}/${file}`, root: posix.dirname(`${repo}/${file}`), metadata: JSON.parse(input.text) })));
  for (const owner of packageInputs) {
    const root = resolve(workspace, owner.root);
    const programFiles = new Map([...inputs].flatMap(([repo, entries]) => [...entries].filter(([file, input]) =>
      input.kind === "file" && isCompilerSourceFile(file) && packageOwner(packageInputs, `${repo}/${file}`)?.root === owner.root)
      .map(([file, input]) => [resolve(workspace, repo, file), input.text])));
    if (collectCompilerSourceExports(root, owner.metadata, [...programFiles.keys()]).length === 0) continue;
    programFiles.set(resolve(root, "package.json"), filesText(owner.path));
    const sourcePackages = collectTargetSourcePackageGraph(root, root, programFiles);
    const installedDeclarations = appendInstalledDeclarationPackageFiles(root, programFiles);
    const compilerFiles = [...programFiles].map(([fileName, text]) => {
      const path = relative(workspace, fileName);
      const actual = realpathSync(fileName);
      const sourcePath = relative(workspace, actual);
      if (!validLiteralFilePath(path) || !keelWorkspaceRepositories.includes(path.split("/")[0])) {
        throw new Error(`Compiler package input leaves the complete workspace: ${fileName}.`);
      }
      const bytes = readFileSync(fileName);
      if (bytes.toString("utf8") !== text || !Buffer.from(text, "utf8").equals(bytes)) {
        throw new Error(`Changed compiler package input: ${fileName}.`);
      }
      const sha256 = keelDigest(bytes);
      if (!validLiteralFilePath(sourcePath) || !keelWorkspaceRepositories.includes(sourcePath.split("/")[0])) {
        if ((!isDeclarationFile(fileName) && posix.basename(fileName) !== "package.json") ||
          !installedDeclarations.packages.some(entry => fileName.startsWith(`${entry.root}/`))) {
          throw new Error(`Compiler source package input leaves the complete workspace: ${fileName}.`);
        }
        return Object.freeze({ fileName, path, sha256, text });
      }
      let prefix = workspace;
      for (const part of path.split("/").slice(0, -1)) {
        prefix = resolve(prefix, part);
        if (!lstatSync(prefix).isSymbolicLink()) continue;
        const alias = relative(workspace, prefix);
        const separator = alias.indexOf("/");
        const target = readlinkSync(prefix);
        if (isAbsolute(target)) throw new Error(`Unproved absolute compiler package alias: ${alias}.`);
        const entries = inputs.get(alias.slice(0, separator));
        const file = alias.slice(separator + 1);
        const previous = entries.get(file);
        if (previous !== undefined && (previous.kind !== "symlink" || previous.target !== target)) {
          throw new Error(`Inconsistent compiler package alias: ${alias}.`);
        }
        entries.set(file, Object.freeze({
          kind: "symlink", tracked: previous?.tracked ?? false, mode: "120000", target,
        }));
      }
      const separator = sourcePath.indexOf("/");
      const entries = inputs.get(sourcePath.slice(0, separator));
      const file = sourcePath.slice(separator + 1);
      const previous = entries.get(file);
      if (previous !== undefined && (previous.kind !== "file" || previous.sha256 !== sha256)) {
        throw new Error(`Inconsistent compiler package input: ${sourcePath}.`);
      }
      entries.set(file, Object.freeze({ ...previous, kind: "file", tracked: previous?.tracked ?? false,
        mode: lstatSync(actual).mode & 0o111 ? "100755" : "100644", sha256, text }));
      return Object.freeze({ fileName, path, sourcePath, sha256 });
    });
    const separator = owner.path.indexOf("/");
    const entries = inputs.get(owner.path.slice(0, separator));
    const file = owner.path.slice(separator + 1);
    entries.set(file, Object.freeze({ ...entries.get(file), compilerPackage: Object.freeze({
      sourcePackages, installedDeclarations, files: Object.freeze(compilerFiles),
    }) }));
  }
  for (const [repo, entries] of inputs) {
    for (const [file, input] of [...entries]) {
      if (input.kind !== "file" || posix.basename(file) !== "package.json" || !input.tracked) continue;
      const metadata = JSON.parse(input.text);
      const root = resolve(workspace, repo, posix.dirname(file));
      for (const name of readDependencyNames(metadata, true)) {
        const installed = findInstalledPackageRoot(root, name);
        if (installed === undefined) continue;
        const actual = realpathSync(installed);
        const path = relative(workspace, actual);
        const separator = path.indexOf("/");
        const installedEntries = inputs.get(path.slice(0, separator));
        const installedRoot = path.slice(separator + 1);
        if (!validLiteralFilePath(path) || installedEntries === undefined ||
          [...installedEntries].some(([candidate, entry]) => entry.tracked &&
            (candidate === `${installedRoot}/package.json` || candidate.startsWith(`${installedRoot}/`)))) continue;
        const packageJson = readPackageJson(resolve(actual, "package.json"));
        if (packageJson.name !== name || typeof packageJson.version !== "string") throw new Error(`Inconsistent installed package owner: ${name}.`);
        const lockInput = entries.get(posix.join(posix.dirname(file), "package-lock.json"));
        const lock = lockInput?.kind === "file" ? JSON.parse(lockInput.text) : undefined;
        const selected = lock?.packages?.[relative(root, actual)];
        if (selected?.version !== packageJson.version || typeof selected.integrity !== "string" || typeof selected.resolved !== "string") continue;
        const bytes = readFileSync(resolve(actual, "package.json"));
        const declaredBy = `${repo}/${file}`;
        const owner = Object.freeze({ declaredBy, name, version: packageJson.version, root: path });
        const packageFile = `${installedRoot}/package.json`;
        const previous = installedEntries.get(packageFile);
        if (previous !== undefined && previous.sha256 !== keelDigest(bytes)) throw new Error(`Changed installed package owner: ${path}.`);
        installedEntries.set(packageFile, Object.freeze({ kind: "file", tracked: false, mode: "100644", text: bytes.toString("utf8"),
          sha256: keelDigest(bytes), installedPackageOwners: Object.freeze([...(previous?.installedPackageOwners ?? []), owner]) }));
      }
    }
  }

  function filesText(path) {
    const separator = path.indexOf("/");
    return inputs.get(path.slice(0, separator)).get(path.slice(separator + 1)).text;
  }
}

export function createKeelPackageExposures(packages, files, resolveAlias) {
  const sources = [...files].filter(([path, input]) => input.kind === "file" && isCompilerSourceFile(path));
  const sourcePackages = new Map();
  const errors = [];
  for (const entry of packages) {
    const available = sources.filter(([path]) => packageOwner(packages, path)?.root === entry.root).map(([path]) => `/keel/${path}`);
    try {
      const exports = collectCompilerSourceExports(`/keel/${entry.root}`, entry.metadata, available);
      if (exports.length > 0) sourcePackages.set(entry.root, { ...entry, sourceFiles: available, exports });
    } catch (error) {
      errors.push({ path: `${entry.root}/package.json`, reason: `inconsistent compiler-source package owner: ${error.message}` });
    }
  }
  const compilerFiles = new Map([...files].filter(([path, input]) => input.kind === "file" &&
    (/\.[cm]?[jt]sx?$/u.test(path) || posix.basename(path) === "package.json")).map(([path, input]) => [`/keel/${path}`, input.text]));
  const owners = JSON.stringify([...sourcePackages.keys()]);
  if (authoredPrograms.owners !== owners) authoredPrograms = { owners, programs: new Map() };
  const compilerContexts = new Map();
  const authoredDeclarationInputs = new Map();
  for (const entry of sourcePackages.values()) {
    const program = { files: new Map(compilerFiles), roots: entry.sourceFiles,
      installedDeclarationNames: new Set(), originalDeclarationInputs: new Map() };
    compilerContexts.set(entry.root, program);
    const context = files.get(`${entry.root}/package.json`)?.compilerPackage;
    if (context === undefined) {
      if (readDependencyNames(entry.metadata, true).length > 0) errors.push({ path: `${entry.root}/package.json`, reason: "missing original compiler package input context" });
      continue;
    }
    const root = context.sourcePackages.packages.find(candidate => candidate.id === context.sourcePackages.rootPackageId);
    const metadataInput = context.files.find(file => file.path === `${entry.root}/package.json`);
    if (root === undefined || root.packageRoot !== posix.dirname(metadataInput?.fileName ?? "") ||
      !root.sourceFiles.every(fileName => context.files.some(file => file.fileName === fileName))) {
      errors.push({ path: `${entry.root}/package.json`, reason: "inconsistent original compiler package context" }); continue;
    }
    program.roots = root.sourceFiles.map(fileName => `/keel/${context.files.find(file => file.fileName === fileName).path}`);
    for (const owner of context.installedDeclarations.packages) program.installedDeclarationNames.add(owner.name);
    for (const file of context.files) {
      const input = file.sourcePath === undefined ? undefined : files.get(file.sourcePath);
      const originalDeclaration = file.sourcePath === undefined && typeof file.text === "string" &&
        (isDeclarationFile(file.fileName) || posix.basename(file.fileName) === "package.json") &&
        context.installedDeclarations.packages.some(owner => file.fileName.startsWith(`${owner.root}/`)) && keelDigest(file.text) === file.sha256;
      if ((!originalDeclaration && (resolveAlias(file.path) !== file.sourcePath || input?.kind !== "file" || input.sha256 !== file.sha256)) ||
        !validLiteralFilePath(file.path) || file.fileName !== `${metadataInput.fileName.slice(0, -metadataInput.path.length)}${file.path}`) {
        errors.push({ path: `${entry.root}/package.json`, reason: "inconsistent original compiler package input bytes" }); continue;
      }
      const name = `/keel/${file.path}`;
      const text = originalDeclaration ? file.text : input.text;
      if (program.files.has(name) && program.files.get(name) !== text) {
        errors.push({ path: `${entry.root}/package.json`, reason: "ambiguous original compiler package input identity" }); continue;
      }
      program.files.set(name, text);
      if (isDeclarationFile(file.fileName)) program.originalDeclarationInputs.set(name, Object.freeze({ fileName: file.fileName, sha256: file.sha256,
        installedDeclarationFingerprint: context.installedDeclarations.fingerprint }));
    }
  }
  const externalRoots = new Set();
  for (const { root, metadata } of packages) {
    const input = files.get(`${root}/package.json`);
    for (const owner of input?.installedPackageOwners ?? []) {
      const declaring = files.get(owner.declaredBy);
      const declaration = declaring?.kind === "file" ? JSON.parse(declaring.text) : undefined;
      const lockPath = `${posix.dirname(owner.declaredBy)}/package-lock.json`;
      const lockInput = files.get(lockPath);
      const lock = lockInput?.kind === "file" ? JSON.parse(lockInput.text) : undefined;
      const selected = lock?.packages?.[posix.relative(posix.dirname(owner.declaredBy), root)];
      if (declaring?.tracked === true && root === owner.root && metadata.name === owner.name && metadata.version === owner.version &&
        readDependencyNames(declaration, true).includes(owner.name) && selected?.version === owner.version &&
        typeof selected.integrity === "string" && typeof selected.resolved === "string" &&
        ![...files].some(([path, entry]) => entry.tracked && path.startsWith(`${root}/`))) externalRoots.add(root);
      else errors.push({ path: `${root}/package.json`, reason: "unproved installed dependency ownership" });
    }
  }
  const externalPackageRoot = root => externalRoots.has(root);
  const externalPath = path => typeof path === "string" && [...externalRoots].some(root => path.startsWith(`${root}/`));
  const resources = new Map(keelPackageBuildResources().map(({ path, evidence }) => [path, evidence]));
  for (const [path, input] of files) {
    if (input.packageResourceOwner !== undefined && (JSON.stringify(input.packageResourceOwner) !== JSON.stringify(resources.get(path)) ||
      !resources.get(path)?.artifacts.every(artifact => files.get(artifact.path)?.sha256 === artifact.sha256))) {
      errors.push({ path, reason: "inconsistent native build-resource owner evidence" });
    }
  }
  const select = (root, value, path, physical, conditions) => {
    if (physical) return { role: "native-execution" };
    const resource = resources.get(path);
    if (resource !== undefined && JSON.stringify(files.get(path)?.packageResourceOwner) === JSON.stringify(resource) &&
      resource.artifacts.every(artifact => files.get(artifact.path)?.sha256 === artifact.sha256)) {
      return { role: "build-resource", authority: resource };
    }
    if (conditions.includes("types") && isDeclarationFile(path)) return { role: "build-resource", authority: "declaration-condition" };
    const owner = sourcePackages.get(root);
    if (owner !== undefined) {
      const selected = collectCompilerSourceExports(`/keel/${root}`, { exports: value }, owner.sourceFiles);
      if (selected.length === 1) return { role: "compiler-source", sourceFile: selected[0].sourceFile.slice(6) };
    }
    return { role: "native-execution" };
  };
  const checkedSources = new Map();
  const resolutions = new Map();
  const knownPackage = (path, specifier) => {
    const owner = packageOwner(packages, path);
    const names = [...packages.flatMap(entry => typeof entry.metadata.name === "string" ? [entry.metadata.name] : []),
      ...(compilerContexts.get(owner?.root)?.installedDeclarationNames ?? [])];
    return names.some(name => specifier === name || specifier.startsWith(`${name}/`));
  };
  const authoredModule = (path, reference) => {
    const owner = packageOwner(packages, path);
    if (!sourcePackages.has(owner?.root) || !isCompilerSourceFile(path) || reference.specifier === undefined ||
      reference.nativeRequire || reference.executionEntry || reference.fileRead || reference.urlAddress) return undefined;
    const program = compilerContexts.get(owner.root);
    if (!reference.specifier.startsWith(".") && !reference.specifier.startsWith("#") && !knownPackage(path, reference.specifier)) return undefined;
    if (!checkedSources.has(owner.root)) {
      const digest = keelDigest(JSON.stringify([[...program.files], program.roots]));
      if (authoredPrograms.programs.get(owner.root)?.digest !== digest) {
        const session = createCompilerSessionFromFiles({ currentDirectory: `/keel/${owner.root}`, files: program.files, rootFiles: program.roots,
          compilerOptions: { module: "nodenext", moduleResolution: "nodenext", target: "es2024", noLib: true,
            allowJs: true, allowImportingTsExtensions: true, preserveSymlinks: true, allowArbitraryExtensions: true,
            strict: true, skipLibCheck: true } });
        authoredPrograms.programs.set(owner.root, { digest, source: session.checkSource() });
      }
      checkedSources.set(owner.root, authoredPrograms.programs.get(owner.root));
    }
    const key = `${path}\0${reference.specifier}`;
    if (resolutions.has(key)) return resolutions.get(key);
    const source = checkedSources.get(owner.root).source;
    const ast = source.ast;
    const sourceFile = source.getSourceFile(`/keel/${path}`);
    const targets = new Map();
    const visit = node => {
      if (["KindStringLiteral", "KindNoSubstitutionTemplateLiteral"].includes(ast.kindName(node)) && ast.text(node) === reference.specifier) {
        const resolved = source.resolveModuleSourceFile(node);
        if (resolved !== undefined) {
          const absolute = ast.getFileName(resolved);
          const originalDeclaration = program.originalDeclarationInputs.get(absolute);
          if (resolved.IsDeclarationFile === true && program.files.has(absolute)) {
            const input = Object.freeze({ fileName: originalDeclaration?.fileName ?? absolute,
              sha256: keelDigest(program.files.get(absolute)),
              ...(originalDeclaration === undefined ? {} : { installedDeclarationFingerprint: originalDeclaration.installedDeclarationFingerprint }) });
            targets.set(absolute, Object.freeze({ kind: "declaration", input }));
          } else {
            const path = absolute.startsWith("/keel/") ? resolveAlias(absolute.slice(6)) : undefined;
            if (path !== undefined && files.has(path)) targets.set(absolute, Object.freeze({ kind: "source", path }));
          }
        }
      }
      ast.forEachChild(node, visit);
    };
    if (sourceFile !== undefined) visit(sourceFile);
    const result = targets.size === 1 ? [...targets.values()][0] : Object.freeze({ kind: "unresolved" });
    if (result.kind === "declaration") authoredDeclarationInputs.set(result.input.fileName, result.input);
    resolutions.set(key, result);
    return result;
  };
  const compilerPattern = (root, key, value) => {
    const owner = sourcePackages.get(root);
    return owner === undefined ? [] : collectCompilerSourceExports(`/keel/${root}`, { exports: { [key]: value } }, owner.sourceFiles)
      .map(entry => Object.freeze({ path: entry.sourceFile.slice(6), sourceFile: entry.sourceFile.slice(6), role: "compiler-source" }));
  };
  return Object.freeze({ select, authoredModule, authoredDeclarationInputs, knownPackage, compilerPattern, externalPackageRoot, externalPath, errors: Object.freeze(errors) });
}

export function moduleReferencePaths(packages, files, sourcePath, reference) {
  if (reference.path !== undefined) {
    const path = reference.module && !reference.nativeRequire && !reference.urlAddress
      ? staticFileAddress("", `./${reference.path}`).path : reference.path;
    return path === undefined ? [] : [path];
  }
  let specifier = reference.specifier;
  if (specifier === undefined) return [];
  if (reference.module && !reference.nativeRequire && (specifier.startsWith("file:") || isAbsolute(specifier))) {
    const address = staticFileAddress(sourcePath, specifier);
    if (address.path !== undefined) return [address.path];
    specifier = address.specifier;
    if (specifier === undefined) return [];
  }
  if (isAbsolute(specifier)) return [...files.keys()].filter(path => specifier.endsWith(`/${path}`));
  if (reference.fileRead || reference.executionEntry) return [];
  return moduleEntryTargets(packages, reference.moduleOrigin ?? sourcePath, specifier, reference.nativeRequire);
}

function packageOwner(packages, sourcePath) {
  return packages.filter(entry => sourcePath.startsWith(`${entry.root}/`)).sort((left, right) => right.root.length - left.root.length)[0];
}

function packageMappingSelection(mapping, specifier) {
  if (mapping === null || typeof mapping !== "object") return undefined;
  const key = Object.hasOwn(mapping, specifier) ? specifier : Object.keys(mapping).filter(candidate => {
    const parts = candidate.split("*");
    return parts.length === 2 && specifier.length >= parts[0].length + parts[1].length &&
      specifier.startsWith(parts[0]) && specifier.endsWith(parts[1]);
  }).sort((left, right) => right.indexOf("*") - left.indexOf("*") || right.length - left.length)[0];
  if (key === undefined) return undefined;
  const parts = key.split("*");
  return { key, value: mapping[key], captured: parts.length === 2 ? specifier.slice(parts[0].length, specifier.length - parts[1].length) : undefined };
}

function selectedPackageTargets(selection) {
  return selection === undefined ? [] : stringLeaves(selection.value).map(target =>
    selection.captured === undefined ? target : target.replaceAll("*", selection.captured));
}

export function packageImportTargets(packages, sourcePath, specifier) {
  return selectedPackageTargets(packageMappingSelection(packageOwner(packages, sourcePath)?.metadata.imports, specifier));
}

function packageTargetPath(root, value, physical) {
  const address = physical ? { path: isAbsolute(value) ? undefined : posix.normalize(`${root}/${value}`) }
    : staticFileAddress(`${root}/package.json`, value);
  return address.path !== undefined && !address.directory && validLiteralFilePath(address.path) &&
    keelWorkspaceRepositories.includes(address.path.split("/")[0]) ? address.path : undefined;
}

function moduleEntryTargets(packages, sourcePath, specifier, nativeRequire = false) {
  if (specifier.startsWith(".")) {
    const path = nativeRequire ? posix.normalize(posix.join(posix.dirname(sourcePath), specifier)) : staticFileAddress(sourcePath, specifier).path;
    return path === undefined ? [] : [path];
  }
  if (specifier.startsWith("#")) {
    const owner = packageOwner(packages, sourcePath);
    return packageImportTargets(packages, sourcePath, specifier).flatMap(target => target.startsWith(".")
      ? [packageTargetPath(owner.root, target, false)].filter(path => path !== undefined)
      : target.startsWith("#") ? [] : moduleEntryTargets(packages, sourcePath, target, nativeRequire));
  }
  const result = [];
  for (const entry of packages) {
    const name = entry.metadata.name;
    if (typeof name !== "string" || specifier !== name && !specifier.startsWith(`${name}/`)) continue;
    const subpath = specifier === name ? "." : `.${specifier.slice(name.length)}`;
    const exports = entry.metadata.exports;
    const hasExports = exports !== undefined && exports !== null;
    const targets = typeof exports === "object" && exports !== null && Object.keys(exports).some(key => key.startsWith("."))
      ? selectedPackageTargets(packageMappingSelection(exports, subpath)) : subpath === "." ? stringLeaves(hasExports ? exports : entry.metadata.main)
        : !hasExports ? [subpath] : [];
    result.push(...targets.map(value => packageTargetPath(entry.root, value, !hasExports && (subpath === "." || nativeRequire)))
      .filter(path => path !== undefined));
  }
  return result;
}

export function nativeNodeModuleFormat(path) {
  return posix.extname(path) === ".json" ? "data" : posix.extname(path) === ".node" ? "binary" : "script";
}

function stringLeaves(value) {
  if (typeof value === "string") return [value];
  return value !== null && typeof value === "object" ? Object.values(value).flatMap(stringLeaves) : [];
}

export function nativeNodeEntries(packages, files) {
  const entries = [];
  const nodeLaunch = (source, command, program, packageName, scriptName) => {
    const details = { source, command, package: typeof packageName === "string" ? packageName : posix.dirname(source), scriptName };
    const launch = keelLiteralNodeCommand(command, program !== undefined);
    if (launch.unresolvedReason !== undefined) {
      entries.push({ ...details, value: command, unresolvedReason: launch.unresolvedReason }); return;
    }
    if (launch.external || launch.outsideProof) {
      entries.push({ ...details, openBoundary: true, executable: program }); return;
    }
    const arguments_ = program === undefined ? launch.arguments : [...launch.arguments, posix.basename(program)];
    for (const entry of keelLiteralNodeEntries(arguments_, (value, option, modes) => {
      if (option === undefined) {
        if (program !== undefined) return { path: program };
        if (modes.test && /[*?\[\]{}()]/u.test(value)) {
          const parts = value.split("/");
          const first = parts.findIndex(part => /[*?\[\]{}()]/u.test(part));
          if (isAbsolute(value) || parts.slice(first).includes("..") || value.includes("\0") || value.includes("\\") || modes.entryUrl) {
            return { unresolvedReason: "unrooted native Node test-entry pattern" };
          }
          const prefix = packageTargetPath(posix.dirname(source), parts.slice(0, first).join("/") || ".", true);
          const pattern = packageTargetPath(posix.dirname(source), value, true);
          return prefix === undefined || pattern === undefined ? { unresolvedReason: "unrooted native Node test-entry pattern" }
            : { testGlob: { prefix, pattern } };
        }
        const path = modes.entryUrl ? staticFileAddress(source, value).path : packageTargetPath(posix.dirname(source), value, true);
        return path === undefined ? { unresolvedReason: "unrooted physical native Node executable entry" } : { path };
      }
      if (program !== undefined && (value.startsWith(".") || value.startsWith("#") || !isAbsolute(value) && !value.startsWith("file:"))) {
        return { unresolvedReason: "unproved current directory for a native interpreter preload" };
      }
      const targets = moduleReferencePaths(packages, files, source, { module: true, specifier: value, nativeRequire: option === "--require" });
      if (targets.length > 0) return { paths: targets };
      return value.startsWith(".") || value.startsWith("#") || value.startsWith("file:") || isAbsolute(value)
        ? { unresolvedReason: "unresolved first-party native Node preload entry" } : { external: true };
    })) {
      if (entry.packageScript !== undefined) {
        const owner = program === undefined ? packageOwner(packages, source) : undefined;
        const dependencySource = owner === undefined ? undefined : `${owner.root}/package.json`;
        const command = owner?.metadata.scripts?.[entry.packageScript];
        entries.push({ ...entry, ...details, dependencySource,
          unresolvedReason: `${entry.unresolvedReason}: ${JSON.stringify(entry.packageScript)} requires ${JSON.stringify(command)}; no shell proof` });
      } else if (entry.paths !== undefined) {
        const { paths, ...selection } = entry;
        for (const path of paths) entries.push({ ...selection, path, ...details });
      } else entries.push({ ...entry, ...details, value: entry.value ?? command });
    }
  };
  for (const { root, metadata } of packages) {
    if (metadata.scripts === undefined) continue;
    const source = `${root}/package.json`;
    if (metadata.scripts === null || typeof metadata.scripts !== "object" || Array.isArray(metadata.scripts)) {
      entries.push({ source, value: "scripts", unresolvedReason: "unproved native package-script declarations" });
    } else for (const [name, command] of Object.entries(metadata.scripts)) nodeLaunch(source, command, undefined, metadata.name, name);
  }
  for (const [path, input] of files) {
    if (input.kind === "file" && input.mode === "100755" && input.text?.startsWith("#!")) {
      nodeLaunch(path, input.text.slice(2).split(/\r?\n/u)[0], path);
    }
  }
  return entries;
}
export function packageModuleEntries(packages, scripts, files, exposures) {
  const entries = nativeNodeEntries(packages, files).flatMap(entry => {
    if (entry.testGlob === undefined) return [entry];
    const { prefix, pattern } = entry.testGlob;
    const captures = files.get(entry.source)?.nodeTestGlobs;
    const matching = Array.isArray(captures) ? captures.filter(row => row !== null && typeof row === "object" && row.pattern === pattern) : [];
    const capture = matching.length === 1 ? matching[0] : undefined;
    const present = [...files].filter(([path, input]) => input.kind === "file" && path.startsWith(`${prefix}/`) &&
      !path.slice(posix.dirname(entry.source).length + 1).split("/").includes("node_modules") && matchesGlob(path, pattern))
      .map(([path]) => path).sort((left, right) => left.localeCompare(right));
    if (!capture || capture.prefix !== prefix || !Array.isArray(capture.matches) ||
      capture.sha256 !== keelDigest(JSON.stringify(capture.matches)) ||
      !capture.matches.every((row, index) => row !== null && typeof row === "object" && typeof row.path === "string" && row.path.startsWith(`${prefix}/`) &&
        matchesGlob(row.path, pattern) && files.get(row.path)?.kind === "file" &&
        files.get(row.path).sha256 === row.sha256 && (index === 0 || capture.matches[index - 1].path.localeCompare(row.path) < 0)) ||
      JSON.stringify(capture.matches.map(row => row.path)) !== JSON.stringify(present)) {
      return [{ ...entry, unresolvedReason: "unproved complete native Node test-glob snapshot" }];
    }
    return capture.matches.map(({ path }) => ({ ...entry, path }));
  });
  for (const entry of entries) if (exposures.externalPath(entry.path)) entry.external = true;
  const requests = [...scripts].flatMap(([sourcePath, script]) => script.references.filter(reference =>
    reference.module && !reference.external && !reference.unresolved && reference.specifier !== undefined)
    .map(reference => ({ sourcePath: reference.moduleOrigin ?? sourcePath, specifier: reference.specifier })));
  for (const { root, metadata } of packages) {
    if (exposures.externalPackageRoot(root)) continue;
    const source = `${root}/package.json`;
    const add = (value, physical, imports, conditions = []) => {
      if (!physical && !value.startsWith(".")) {
        if (!imports || value.startsWith("#")) {
          entries.push({ source, value, unresolvedReason: "unresolved first-party package module target" }); return;
        }
        const targets = moduleEntryTargets(packages, source, value);
        if (targets.length === 0 && !packages.some(entry => typeof entry.metadata.name === "string" &&
          (value === entry.metadata.name || value.startsWith(`${entry.metadata.name}/`)))) entries.push({ source, value, external: true });
        else if (targets.length === 0) entries.push({ source, value, unresolvedReason: "unresolved first-party package module target" });
        else for (const path of targets) entries.push({ source, value, path, role: "native-execution" });
        return;
      }
      const path = packageTargetPath(root, value, physical);
      if (path === undefined) {
        entries.push({ source, value, unresolvedReason: "unrooted first-party package module target" });
      } else entries.push({ source, value, path, ...exposures.select(root, value, path, physical, conditions) });
    };
    for (const value of [metadata.main, metadata.bin].flatMap(stringLeaves)) add(value, true, false);
    for (const value of stringLeaves(metadata.module)) {
      const path = packageTargetPath(root, value, true);
      if (path === undefined) entries.push({ source, value, unresolvedReason: "unrooted original compiler module target" });
      else entries.push({ source, value, path, ...exposures.select(root, value, path, false, []) });
    }
    const moduleTargets = (value, key, imports, conditions = []) => {
      if (typeof value === "string") {
        if (!key?.includes("*") || !value.includes("*")) { add(value, false, imports, conditions); return; }
        let marker = "__keel_package_capture__";
        while (`${root}/${value}`.includes(marker) || staticFileAddress(source, value).path?.includes(marker)) marker += "_";
        const markedPath = value.startsWith(".") ? packageTargetPath(root, value.replaceAll("*", marker), false) : undefined;
        if (markedPath !== undefined && !markedPath.includes(marker)) { add(value, false, imports); return; }
        const captures = requests.flatMap(request => {
          const specifier = packageOwner(packages, request.sourcePath)?.root === root ? request.specifier : undefined;
          const selection = specifier === undefined ? undefined : packageMappingSelection(metadata.imports, specifier);
          return selection?.key === key && selection.captured !== undefined ? [selection.captured] : [];
        });
        if (!imports || markedPath === undefined || captures.length === 0) {
          const authored = !imports ? exposures.compilerPattern(root, key, value) : [];
          if (authored.length > 0) { entries.push(...authored.map(entry => ({ source, value, ...entry }))); return; }
          entries.push({ source, value, unresolvedReason: "unproved finite package module pattern" }); return;
        }
        const parts = markedPath.split(marker);
        const matcher = new RegExp(`^${parts.map((part, index) => part.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&") +
          (index === parts.length - 1 ? "" : index === 0 ? "(.*)" : "\\1")).join("")}$`, "u");
        for (const captured of new Set(captures)) add(value.replaceAll("*", captured), false, imports, conditions);
        for (const path of files.keys()) {
          const capture = matcher.exec(path)?.[1];
          if (capture === undefined) continue;
          const specifier = key.replaceAll("*", capture.split("/").map(encodeURIComponent).join("/"));
          const selection = packageMappingSelection(metadata.imports, specifier);
          if (selection?.key === key && selectedPackageTargets(selection).some(target => packageTargetPath(root, target, false) === path)) {
            entries.push({ source, value, path, ...exposures.select(root, value, path, false, conditions) });
          }
        }
      }
      else if (value !== null && typeof value === "object") {
        for (const [name, target] of Object.entries(value)) moduleTargets(target, name.startsWith(".") || name.startsWith("#") ? name : key, imports,
          name.startsWith(".") || name.startsWith("#") || Array.isArray(value) ? conditions : [...conditions, name]);
      }
    };
    moduleTargets(metadata.exports, ".", false);
    moduleTargets(metadata.imports, undefined, true);
  }
  return entries;
}

