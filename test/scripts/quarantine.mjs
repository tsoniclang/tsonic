import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync, readlinkSync } from "node:fs";
import { isAbsolute, posix, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const pins = Object.freeze([
  "e9a3764bc1291823d9ef97ffe2879c7d58d87cfd",
  "ad9beca6c46dd5bdb9c3ed302e26fbd9f9975363",
]);
const dataPath = "test/architecture/quarantine/areas.json";
const dataDigest = "f54dd587361c0a0100d2376391a53a2534e83407c93b8250e02e3d3ae2543473";
const guards = Object.freeze([
  "scripts/check-branch-hygiene.sh", "scripts/run-bounded.sh",
  ...["bounded-run.sh", "bounded-test-scope.sh", "guard-command.mjs", "guard-cgroup.mjs",
    "guard-report.mjs", "guard-snapshot.mjs", "memory-admission.mjs", "test-resource-budget.mjs",
    "calibrate-utilization.mjs"].map(name => `test/scripts/${name}`),
]);
const configuration = Object.freeze([
  "package.json", "package-lock.json", "tsconfig.json", "tsconfig.base.json",
  "packages/host/package.json", "packages/host/tsconfig.json", "scripts/build/all.sh",
  "test/scripts/build.mjs", "test/scripts/build.sh", "test/scripts/suite-definition.mjs",
  "test/scripts/smoke-set.json", "scripts/release/npm-wave.json",
]);
const activeFiles = Object.freeze([
  ...guards, ...configuration, "test/scripts/quarantine.mjs", "test/architecture/quarantine.test.mjs",
  dataPath,
]);
const workspaces = Object.freeze(["packages/tsts", "packages/host"]);
const compareText = (left, right) => left < right ? -1 : left > right ? 1 : 0;
const within = (path, directory) => path === directory || path.startsWith(`${directory}/`);
const canonical = path => typeof path === "string" && path.length > 0 && !isAbsolute(path)
  && !path.includes("\\") && !path.includes("\0") && posix.normalize(path) === path
  && path !== ".." && !path.startsWith("../") && !path.endsWith("/");

function collectFiles(deps, root, path) {
  const entry = deps.entry(root, path);
  if (entry === null) return [];
  if (entry.kind !== "directory") return [{ path, kind: entry.kind }];
  return deps.children(root, path).flatMap(name => {
    if (!canonical(name) || name.includes("/")) throw new Error(`Invalid directory entry: ${path}`);
    return collectFiles(deps, root, `${path}/${name}`);
  });
}

function retiredRoots(data) {
  return [data.oldRoots.hostSource, ...data.oldRoots.packages, ...Object.values(data.oldRoots.tests)];
}

function referencePolicy(data, originals, currentFiles) {
  const roots = retiredRoots(data);
  const names = [data.areas[0].directory.split("/")[0],
    ...data.oldPackages.map(name => `@tsonic/${name}`),
    ...roots,
    ...[...originals].filter(path => !currentFiles.has(path) && !roots.some(directory => within(path, directory))),
  ];
  const alternatives = [...new Set(names)].map(name => name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"));
  const expression = new RegExp(`(?<![A-Za-z0-9._~-])(?:${alternatives.join("|")})(?![A-Za-z0-9._~-])`, "u");
  return text => expression.test(text.replaceAll("\\", "/"));
}

function jsonReferences(value, forbidden, key = "") {
  if (key === "exclude") return false;
  if (typeof value === "string") return forbidden(value);
  if (Array.isArray(value)) return value.some(item => jsonReferences(item, forbidden, key));
  if (value !== null && typeof value === "object")
    return Object.entries(value).some(([name, item]) => forbidden(name) || jsonReferences(item, forbidden, name));
  return false;
}

function textReferences(text, path, forbidden) {
  if (/\.jsonc?$/u.test(path)) {
    try { return jsonReferences(JSON.parse(text), forbidden); } catch { return forbidden(text); }
  }
  return forbidden(text);
}

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

function configurationEdges(deps, root, forbidden, add) {
  const inspect = (value, owner, key = "") => {
    if (key === "exclude") return;
    if (typeof value === "string") {
      if (forbidden(value)) add("old-config-edge", owner);
    } else if (Array.isArray(value)) {
      for (const item of value) inspect(item, owner, key);
    } else if (value !== null && typeof value === "object") {
      for (const [name, item] of Object.entries(value)) {
        if (forbidden(name)) add("old-config-edge", owner);
        inspect(item, owner, name);
      }
    }
  };
  const documents = new Map();
  for (const owner of configuration) {
    const entry = deps.entry(root, owner);
    if (entry === null || !["regular", "executable"].includes(entry.kind)) {
      add("old-config-edge", owner);
      continue;
    }
    const text = deps.bytes(root, owner).toString("utf8");
    if (owner.endsWith(".json")) {
      try {
        const document = JSON.parse(text);
        documents.set(owner, document);
        inspect(document, owner);
      } catch {
        add("old-config-edge", owner);
      }
    } else if (forbidden(text)) {
      add("old-config-edge", owner);
    }
  }
  const packageDocument = documents.get("package.json");
  if (JSON.stringify(packageDocument?.workspaces) !== JSON.stringify(workspaces)) add("old-config-edge", "package.json");
  const lock = documents.get("package-lock.json");
  if (JSON.stringify(lock?.packages?.[""]?.workspaces) !== JSON.stringify(workspaces)
    || !lock?.packages?.["packages/host"] || !lock?.packages?.["packages/tsts"])
    add("old-config-edge", "package-lock.json");
  const host = documents.get("packages/host/package.json");
  if (!host || host.private !== true || ["main", "types", "module", "bin", "browser"].some(key => key in host)
    || JSON.stringify(host.files) !== "[]" || JSON.stringify(host.exports) !== "{}"
    || Object.keys(host.scripts ?? {}).length !== 0)
    add("old-config-edge", "packages/host/package.json");
  for (const owner of ["tsconfig.json", "packages/host/tsconfig.json"]) {
    const document = documents.get(owner);
    if (JSON.stringify(document?.files) !== "[]" || JSON.stringify(document?.references) !== "[]"
      || "include" in (document ?? {})) add("old-config-edge", owner);
  }
}

export function verifyQuarantine(deps, root) {
  const findings = new Map();
  const add = (code, path) => findings.set(`${code}\0${path}`, Object.freeze({ code, path }));
  if (deps.entry(root, dataPath)?.kind !== "regular") return Object.freeze([Object.freeze({ code: "bad-pin", path: dataPath })]);
  const dataBytes = deps.bytes(root, dataPath);
  if (createHash("sha256").update(dataBytes).digest("hex") !== dataDigest)
    return Object.freeze([Object.freeze({ code: "bad-pin", path: dataPath })]);
  const data = JSON.parse(dataBytes.toString("utf8"));
  const areas = data.areas.map((area, index) => ({ ...area, pin: pins[index] }));
  const archiveRoot = areas[0].directory.split("/")[0];
  const dataFiles = new Set([dataPath, ...areas.map(area => area.manifest)]);
  const currentFiles = new Set([...activeFiles, ...dataFiles]);
  const oldRoots = retiredRoots(data);
  const originals = new Set();
  for (const entry of collectFiles(deps, root, archiveRoot)) {
    if (!areas.some(area => within(entry.path, area.directory))) add("unexpected-file", entry.path);
  }
  for (const area of areas) {
    const manifestEntry = deps.entry(root, area.manifest);
    if (manifestEntry?.kind !== "regular") {
      add("bad-pin", area.manifest);
      continue;
    }
    const manifest = deps.bytes(root, area.manifest);
    const paths = manifest.toString("utf8").split("\n");
    paths.pop();
    if (createHash("sha256").update(manifest).digest("hex") !== area.digest
      || paths.length !== area.count || paths.some(path => !canonical(path))
      || JSON.stringify(paths) !== JSON.stringify([...new Set(paths)].sort(compareText))) {
      add("bad-pin", area.manifest);
      continue;
    }
    for (const path of paths) originals.add(path);
    const tree = deps.gitTree(area.pin);
    if (tree === null || tree.pin !== area.pin) {
      add("bad-pin", area.pin);
      continue;
    }
    const pinned = new Map(tree.entries.map(entry => [entry.path, entry]));
    const actual = new Map(collectFiles(deps, root, area.directory).map(entry => [entry.path, entry]));
    const expected = new Set(paths.map(path => `${area.directory}/${path}`));
    for (const path of actual.keys()) if (!expected.has(path)) add("unexpected-file", path);
    for (const original of paths) {
      const path = `${area.directory}/${original}`;
      const source = pinned.get(original);
      if (!source || !["regular", "executable", "symlink"].includes(source.kind)) {
        add("bad-pin", `${area.pin}:${original}`);
        continue;
      }
      const entry = actual.get(path);
      if (!entry) {
        add("missing-file", path);
      } else if (entry.kind !== source.kind) {
        add("different-kind", path);
      } else {
        const bytes = deps.gitBlob(source.oid);
        if (bytes === null) add("bad-pin", `${area.pin}:${original}`);
        else if (!deps.bytes(root, path).equals(bytes)) add("different-bytes", path);
      }
    }
  }
  const forbidden = referencePolicy(data, originals, currentFiles);
  for (const entry of activeEntries(deps, root, archiveRoot)) {
    const path = entry.path;
    if (!currentFiles.has(path) && (originals.has(path) || oldRoots.some(oldRoot => within(path, oldRoot))))
      add("active-old-source", path);
    if (entry.kind === "symlink") {
      if (forbidden(deps.bytes(root, path).toString("utf8"))) add("old-config-edge", path);
    } else if (!dataFiles.has(path) && ["regular", "executable"].includes(entry.kind)
      && !/\.(?:md|txt)$/u.test(path)) {
      if (textReferences(deps.bytes(root, path).toString("utf8"), path, forbidden)) add("old-config-edge", path);
    }
  }
  configurationEdges(deps, root, forbidden, add);
  return Object.freeze([...findings.values()].sort((left, right) => compareText(left.code, right.code) || compareText(left.path, right.path)));
}

export function createQuarantineDeps(repository) {
  const git = argumentsList => spawnSync("git", argumentsList, { cwd: repository, encoding: null, maxBuffer: 64 * 1024 * 1024 });
  const safePath = (root, path) => {
    if (!canonical(path)) throw new Error(`Noncanonical quarantine path: ${path}`);
    const parts = path.split("/");
    let parent = root;
    for (const part of parts.slice(0, -1)) {
      parent = resolve(parent, part);
      try {
        if (!lstatSync(parent).isDirectory()) return null;
      } catch (error) {
        if (error.code === "ENOENT") return null;
        throw error;
      }
    }
    return resolve(root, path);
  };
  return Object.freeze({
    gitTree(pin) {
      const identity = git(["rev-parse", "--verify", `${pin}^{commit}`]);
      if (identity.status !== 0) return null;
      const result = git(["ls-tree", "-rz", pin]);
      if (result.status !== 0) return null;
      const entries = result.stdout.toString("utf8").split("\0").filter(Boolean).map(line => {
        const [header, path] = line.split("\t");
        const [mode, , oid] = header.split(" ");
        const kind = { "100644": "regular", "100755": "executable", "120000": "symlink" }[mode] ?? "other";
        return Object.freeze({ path, kind, oid });
      });
      return Object.freeze({ pin: identity.stdout.toString("utf8").trim(), entries });
    },
    gitBlob(oid) {
      const result = git(["cat-file", "blob", oid]);
      return result.status === 0 ? result.stdout : null;
    },
    entry(root, path) {
      const absolute = safePath(root, path);
      if (absolute === null) return null;
      try {
        const stat = lstatSync(absolute);
        return Object.freeze({ kind: stat.isSymbolicLink() ? "symlink" : stat.isDirectory() ? "directory"
          : stat.isFile() ? (stat.mode & 0o111) !== 0 ? "executable" : "regular" : "other" });
      } catch (error) {
        if (error.code === "ENOENT") return null;
        throw error;
      }
    },
    children(root, path) {
      const absolute = safePath(root, path);
      if (absolute === null || !lstatSync(absolute).isDirectory()) throw new Error(`Not a directory: ${path}`);
      return readdirSync(absolute).sort(compareText);
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
  const repository = resolve(process.argv[3] ?? root);
  const findings = verifyQuarantine(createQuarantineDeps(repository), root);
  process.stdout.write(`${JSON.stringify(findings, null, 2)}\n`);
  process.exitCode = findings.length === 0 ? 0 : 1;
}
