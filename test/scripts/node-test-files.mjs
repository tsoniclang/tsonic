import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function discoverTestFiles(directory, suffix = ".test.mjs", maximumDepth = Infinity) {
  if (!existsSync(directory)) return [];
  const files = [];
  function visit(current, depth) {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = resolve(current, entry.name);
      if (entry.isDirectory() && depth < maximumDepth) visit(path, depth + 1);
      else if (entry.isFile() && path.endsWith(suffix)) files.push(path);
    }
  }
  visit(directory, 0);
  return files.sort();
}

export function selectAffectedTestTasks(tasks, changedPaths, roots, data, includeSmoke = true) {
  if (data.schemaVersion !== 1 || !Array.isArray(data.owners) || !Array.isArray(data.smoke)) {
    throw new Error("Affected tests require folder ownership and smoke data.");
  }
  const selected = new Set();
  const changed = new Set(changedPaths.map(path => resolve(path)));
  const files = task => task.files ?? [task.file];
  const under = (path, folder) => path === folder || path.startsWith(`${folder}/`);
  for (const path of changed) {
    const owners = data.owners.filter(owner => typeof roots[owner.scope] === "string" &&
      under(path, resolve(roots[owner.scope], owner.source)));
    const length = Math.max(...owners.map(owner => resolve(roots[owner.scope], owner.source).length));
    const matching = owners.filter(owner => resolve(roots[owner.scope], owner.source).length === length);
    if (matching.length === 0) throw new Error(`Changed path has no declared test-folder owner: ${path}`);
    let represented = false;
    for (const owner of matching) {
      const root = roots[owner.scope];
      const owned = tasks.filter(task => task.scope === owner.scope);
      const folders = owner.tests.map(folder => resolve(root, folder));
      if (owner.mirror === true) {
        let suffix = relative(resolve(root, owner.source), dirname(path));
        while (suffix !== "..") {
          const nested = folders.map(folder => resolve(folder, suffix));
          const direct = owned.filter(task => files(task).some(file => nested.some(folder => under(file, folder))));
          if (direct.length > 0) { direct.forEach(task => selected.add(task.id)); represented = true; break; }
          if (suffix === "." || suffix === "") break;
          suffix = dirname(suffix);
        }
      } else {
        for (const task of owned) {
          if (files(task).some(file => folders.some(folder => under(file, folder)))) {
            selected.add(task.id); represented = true;
          }
        }
      }
      for (const task of owned) {
        if (files(task).some(file => (owner.readers ?? []).some(folder => under(file, resolve(root, folder))))) selected.add(task.id);
      }
    }
    if (!represented) throw new Error(`Changed path has no represented owner tests: ${path}`);
  }
  for (const task of tasks) {
    if (files(task).some(file => readsChangedPath(file, new Set()))) selected.add(task.id);
  }
  if (includeSmoke) {
    for (const entry of data.smoke) {
      if (roots[entry.scope] === undefined || !tasks.some(task => task.scope === entry.scope)) continue;
      const path = resolve(roots[entry.scope], entry.file);
      const matching = tasks.filter(task => task.scope === entry.scope && files(task).includes(path));
      if (matching.length === 0) throw new Error(`Smoke test is not represented: ${entry.scope}:${entry.file}`);
      matching.forEach(task => selected.add(task.id));
    }
  }
  return tasks.filter(task => selected.has(task.id));

  function readsChangedPath(file, visited) {
    if (changed.has(file)) return true;
    if (visited.has(file) || !/\.[cm]?[jt]s$/u.test(file) || !existsSync(file)) return false;
    visited.add(file);
    const text = readFileSync(file, "utf8");
    for (const path of changed) {
      for (const root of Object.values(roots)) {
        if (under(path, root) && text.includes(relative(root, path))) return true;
      }
    }
    for (const match of text.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)["'](\.[^"']+)["']/gu)) {
      const dependency = resolve(dirname(file), match[1]);
      if (changed.has(dependency) || dependency.includes("/test/") && readsChangedPath(dependency, visited)) return true;
    }
    return false;
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const directory = process.argv[2];
  if (directory === undefined) throw new Error("A test directory is required.");
  const files = discoverTestFiles(directory);
  if (files.length === 0) throw new Error(`No test files were discovered in ${directory}.`);
  process.stdout.write(`${files.join("\0")}\0`);
}
