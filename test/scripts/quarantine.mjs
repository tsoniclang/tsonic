import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync, readlinkSync } from "node:fs";
import { isAbsolute, posix, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const referencePin = "e9a3764bc1291823d9ef97ffe2879c7d58d87cfd";
const modularPin = "ad9beca6c46dd5bdb9c3ed302e26fbd9f9975363";
const areas = Object.freeze([
  Object.freeze({ directory: "_old/reference", pin: referencePin,
    manifest: "test/architecture/quarantine/reference.paths", count: 1556,
    digest: "f596f4d11c42fb54b99572983715c990c5d24286d65da3ebc7fece4b714caa24" }),
  Object.freeze({ directory: "_old/host-modular-20261109", pin: modularPin,
    manifest: "test/architecture/quarantine/host-modular.paths", count: 61,
    digest: "d0f9f06b330f935b0e4fe72934af682f55f1aabb95e96c4d40f55becddf5fdd8" }),
]);
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
const oldPackages = Object.freeze(["cli", "create-tsonic", "source-core", "target-api", "js-source-profile"]);
const oldRoots = Object.freeze([
  ...oldPackages.map(name => `packages/${name}`), "packages/host/src",
  ...["host", "host-spec", "cli-build", "source-core", "target-api", "js-source-profile",
    "fixtures", "helpers", "infrastructure"].map(name => `test/${name}`),
]);
const currentFiles = Object.freeze([
  ...guards, ...configuration, "test/scripts/quarantine.mjs", "test/architecture/quarantine.test.mjs",
  ...areas.map(area => area.manifest),
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

function oldEdge(text, owner, originals) {
  const value = text.replaceAll("\\", "/");
  for (const token of value.split(/[\s"'`;,()[\]{}=]+/u)) {
    if (token.length === 0 || token.startsWith("--")) continue;
    if (token === "_old" || token.startsWith("_old/") || token.includes("/_old/")) return true;
    const packageToken = token.replace(/^node_modules\//u, "");
    if (oldPackages.some(name => packageToken === `@tsonic/${name}` || packageToken.startsWith(`@tsonic/${name}/`))) return true;
    const candidates = [posix.normalize(token), posix.normalize(posix.join(posix.dirname(owner), token))];
    if (candidates.some(path => within(path, "_old") || oldRoots.some(directory => within(path, directory))
      || originals.has(path) && !currentFiles.includes(path))) return true;
  }
  return false;
}

function configurationEdges(deps, root, originals, add) {
  const inspect = (value, owner, key = "") => {
    if (key === "exclude") return;
    if (typeof value === "string") {
      if (oldEdge(value, owner, originals)) add("old-config-edge", owner);
    } else if (Array.isArray(value)) {
      for (const item of value) inspect(item, owner, key);
    } else if (value !== null && typeof value === "object") {
      for (const [name, item] of Object.entries(value)) {
        if (oldEdge(name, owner, originals)) add("old-config-edge", owner);
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
    } else if (oldEdge(text, owner, originals)) {
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
  const originals = new Set();
  for (const entry of collectFiles(deps, root, "_old")) {
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
  for (const directory of ["packages", "scripts", "test"]) {
    for (const entry of collectFiles(deps, root, directory)) {
      const path = entry.path;
      if (within(path, "packages/tsts")
        || path.split("/").some(part => ["node_modules", "dist", ".analysis", ".temp"].includes(part))) continue;
      if (!currentFiles.includes(path) && (originals.has(path) || oldRoots.some(oldRoot => within(path, oldRoot))))
        add("active-old-source", path);
      if (["regular", "executable"].includes(entry.kind) && /\.(?:[cm]?[jt]s|sh)$/u.test(path)) {
        const text = deps.bytes(root, path).toString("utf8");
        const imports = [...text.matchAll(/\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b(?:import|export)\s+(?:[^;\n]*?\s+from\s+)?["']([^"']+)["']|\b(?:import|require)\s*\(\s*["']([^"']+)["']/gu)]
          .filter(match => match[1] !== undefined || match[2] !== undefined);
        if (imports.some(match => oldEdge(match[1] ?? match[2], path, originals))) add("old-config-edge", path);
      }
    }
  }
  configurationEdges(deps, root, originals, add);
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
