import { lstatSync, readFileSync, readdirSync, readlinkSync } from "node:fs";
import { isAbsolute, posix, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createCompilerHost, createInMemoryFileSystem } from "../../packages/tsts/dist/src/index.js";
import { GetParsedCommandLineOfConfigFile } from "../../packages/tsts/dist/src/internal/tsoptions/tsconfigparsing.js";

const dataPath = "test/architecture/quarantine/areas.json";
const within = (path, directory) => path === directory || path.startsWith(`${directory}/`);
const canonical = path => typeof path === "string" && path.length > 0 && !isAbsolute(path)
  && !path.includes("\\") && !path.includes("\0") && posix.normalize(path) === path
  && path !== ".." && !path.startsWith("../") && !path.endsWith("/");
const tsconfig = path => /(?:^|\/)tsconfig(?:\.[^/]+)?\.jsonc?$/u.test(path);

function activeEntries(deps, root, archiveRoot) {
  const entries = [];
  const directories = ["."];
  while (directories.length > 0) {
    const directory = directories.pop();
    for (const name of deps.children(root, directory)) {
      if (!canonical(name) || name.includes("/")) throw new Error(`Invalid directory entry: ${directory}`);
      const path = directory === "." ? name : `${directory}/${name}`;
      if (path === archiveRoot || within(path, "packages/tsts")
        || path.split("/").some(part => [".git", "node_modules", "dist", ".analysis", ".temp"].includes(part))) continue;
      const entry = deps.entry(root, path);
      if (entry === null) continue;
      if (entry.kind === "directory") directories.push(path);
      else entries.push({ path, kind: entry.kind });
    }
  }
  return entries;
}

function jsonReference(value, forbidden, key = "") {
  if (key === "exclude" && Array.isArray(value) && value.every(item => typeof item === "string")) return false;
  if (typeof value === "string") return forbidden(value);
  if (Array.isArray(value)) return value.some(item => jsonReference(item, forbidden));
  return value !== null && typeof value === "object" && Object.entries(value).some(([name, item]) =>
    forbidden(name) || jsonReference(item, forbidden, name));
}

function configurationInputs(files, data, forbidden, add) {
  const virtual = "/quarantine";
  const configurations = new Map([...files].filter(([path]) => tsconfig(path)));
  const documents = new Map();
  const bases = new Set();
  for (const [path, text] of configurations) {
    let document;
    try { document = JSON.parse(text); } catch { continue; }
    if (document === null || typeof document !== "object" || Array.isArray(document)) {
      add("old-config-edge", path);
      continue;
    }
    documents.set(path, document);
    const extended = typeof document.extends === "string" ? [document.extends] : Array.isArray(document.extends) ? document.extends : [];
    for (const base of extended) if (typeof base === "string" && base.startsWith(".")) {
      const selected = posix.normalize(posix.join(posix.dirname(path), base));
      bases.add(selected.endsWith(".json") ? selected : `${selected}.json`);
    }
  }
  const fileSystem = createInMemoryFileSystem({ files: new Map([...files].map(([path, text]) => [`${virtual}/${path}`, text])),
    includeBundledLibraries: false });
  const host = createCompilerHost({ currentDirectory: virtual, fileSystem, includeBundledLibraries: false });
  for (const [path] of configurations) {
    const document = documents.get(path);
    if (bases.has(path) && document !== undefined && !["files", "include", "references"].some(key => Object.hasOwn(document, key))) continue;
    const [parsed, errors] = GetParsedCommandLineOfConfigFile(`${virtual}/${path}`, {}, undefined, host, undefined);
    if (parsed === undefined || [...(errors ?? []), ...(parsed.Errors ?? [])].some(error => ![18002, 18003].includes(error.code))) {
      add("old-config-edge", path);
      continue;
    }
    const roots = path === "packages/host/tsconfig.json" ? [data.currentRoots.hostSource] : Object.values(data.currentRoots);
    for (const input of parsed.ParsedConfig.FileNames ?? []) {
      const relative = posix.relative(virtual, input);
      if (!canonical(relative) || forbidden(relative) || !roots.some(root => within(relative, root))) add("old-config-edge", path);
    }
    for (const reference of parsed.ParsedConfig.ProjectReferences ?? []) {
      const relative = posix.relative(virtual, reference.Path);
      const target = relative.endsWith(".json") ? relative : posix.join(relative, "tsconfig.json");
      if (!canonical(relative) || forbidden(relative) || !configurations.has(target)) add("old-config-edge", path);
    }
  }
}

export function verifyQuarantine(deps, root) {
  const findings = new Map();
  const add = (code, path) => findings.set(`${code}\0${path}`, Object.freeze({ code, path }));
  let data;
  try { data = JSON.parse(deps.bytes(root, dataPath).toString("utf8")); }
  catch { return Object.freeze([Object.freeze({ code: "old-config-edge", path: dataPath })]); }
  const archiveDirectory = data?.areas?.[0]?.directory;
  const archiveRoot = typeof archiveDirectory === "string" ? archiveDirectory.split("/")[0] : undefined;
  if (!canonical(archiveRoot) || !Array.isArray(data.areas) || data.currentRoots === null || typeof data.currentRoots !== "object"
    || !canonical(data.currentRoots.hostSource) || !Object.values(data.currentRoots).every(canonical))
    return Object.freeze([Object.freeze({ code: "old-config-edge", path: dataPath })]);
  const escaped = archiveRoot.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const expression = new RegExp(`(?<![A-Za-z0-9._~-])${escaped}(?![A-Za-z0-9._~-])`, "u");
  const forbidden = text => expression.test(text.replaceAll("\\", "/"));
  const files = new Map();
  for (const entry of activeEntries(deps, root, archiveRoot)) {
    if (!["regular", "executable", "symlink"].includes(entry.kind)) continue;
    const text = deps.bytes(root, entry.path).toString("utf8");
    if (entry.kind === "symlink") {
      if (forbidden(text)) add("old-config-edge", entry.path);
      continue;
    }
    files.set(entry.path, text);
    if (entry.path === dataPath || /\.(?:md|txt)$/u.test(entry.path)) continue;
    if (/\.jsonc?$/u.test(entry.path)) {
      try { if (jsonReference(JSON.parse(text), forbidden)) add("old-config-edge", entry.path); }
      catch { if (entry.path.endsWith(".json") || forbidden(text)) add("old-config-edge", entry.path); }
    } else if (forbidden(text)) add("old-config-edge", entry.path);
  }
  configurationInputs(files, data, forbidden, add);
  return Object.freeze([...findings.values()].sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
}

export function createQuarantineDeps() {
  const safePath = (root, path) => {
    if (!canonical(path)) throw new Error(`Noncanonical quarantine path: ${path}`);
    const parts = path.split("/");
    let parent = root;
    for (const part of parts.slice(0, -1)) {
      parent = resolve(parent, part);
      try { if (!lstatSync(parent).isDirectory()) return null; }
      catch (error) { if (error.code === "ENOENT") return null; throw error; }
    }
    return resolve(root, path);
  };
  return Object.freeze({
    entry(root, path) {
      const absolute = safePath(root, path);
      if (absolute === null) return null;
      try {
        const stat = lstatSync(absolute);
        return Object.freeze({ kind: stat.isSymbolicLink() ? "symlink" : stat.isDirectory() ? "directory"
          : stat.isFile() ? (stat.mode & 0o111) !== 0 ? "executable" : "regular" : "other" });
      } catch (error) { if (error.code === "ENOENT") return null; throw error; }
    },
    children(root, path) {
      const absolute = safePath(root, path);
      if (absolute === null || !lstatSync(absolute).isDirectory()) throw new Error(`Not a directory: ${path}`);
      return readdirSync(absolute).sort();
    },
    bytes(root, path) {
      const absolute = safePath(root, path);
      if (absolute === null) throw new Error(`Unsafe quarantine read: ${path}`);
      return lstatSync(absolute).isSymbolicLink() ? Buffer.from(readlinkSync(absolute)) : readFileSync(absolute);
    },
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = resolve(process.argv[2] ?? fileURLToPath(new URL("../..", import.meta.url)));
  const findings = verifyQuarantine(createQuarantineDeps(), root);
  process.stdout.write(`${JSON.stringify(findings, null, 2)}\n`);
  process.exitCode = findings.length === 0 ? 0 : 1;
}
