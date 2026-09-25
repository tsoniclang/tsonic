import { resolve } from "node:path";
import { validateCertificationEntry } from "./contract.mjs";
import { changedTreePaths, pathIsCovered } from "./inputs.mjs";

export function validateCertificationChecks(checks, repositories) {
  if (!Array.isArray(checks)) throw new Error("Release certification requires declared focused checks.");
  const names = new Set();
  const inputs = [];
  for (const check of checks) {
    if (check === null || typeof check !== "object" ||
        Object.keys(check).sort().join() !== "name,paths,tests" ||
        !/^check-[a-z][a-z0-9-]*$/u.test(check.name) || names.has(check.name)) {
      throw new Error("Invalid or duplicate focused certification check.");
    }
    names.add(check.name);
    for (const field of ["paths", "tests"]) {
      if (!Array.isArray(check[field]) || check[field].length === 0) throw new Error(`Focused ${field} cannot be empty.`);
      for (const input of check[field]) {
        if (input === null || typeof input !== "object" || Object.keys(input).sort().join() !== "path,repository" ||
            !repositories.has(input.repository) || typeof input.path !== "string" ||
            !/^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*\/?$/u.test(input.path) ||
            input.path.split("/").some(part => part === "." || part === "..")) {
          throw new Error("Focused certification paths must be explicit repository-relative paths.");
        }
        if (field === "tests" && (!input.path.endsWith(".test.mjs") ||
            !check.paths.some(path => path.repository === input.repository && pathIsCovered(input.path, path.path)))) {
          throw new Error("Every focused test must belong to its declared input scope.");
        }
      }
    }
    for (const input of check.paths) {
      if (inputs.some(previous => previous.repository === input.repository &&
          (pathIsCovered(input.path, previous.path) || pathIsCovered(previous.path, input.path)))) {
        throw new Error("Focused certification input scopes overlap.");
      }
      inputs.push(input);
    }
    if (new Set(check.tests.map(input => `${input.repository}/${input.path}`)).size !== check.tests.length) {
      throw new Error("Duplicate focused certification test.");
    }
  }
  return Object.freeze(checks.map(check => Object.freeze({
    name: check.name,
    paths: Object.freeze(check.paths.map(input => Object.freeze({ ...input }))),
    tests: Object.freeze(check.tests.map(input => Object.freeze({ ...input }))),
  })));
}

export function focusedCertificationEntry(check, wave) {
  const tests = check.tests.map(input => resolve(wave.layout.repositoryRoots.get(input.repository), input.path));
  return validateCertificationEntry({
    repository: "tsonic", profile: "host", banks: ["node"],
    inputs: [...new Set(wave.certification.flatMap(entry => entry.inputs))],
    tools: ["node", "npm"], skipped: 0,
    command: ["node", "--test", ...tests],
    worker: ["node", "scripts/certification/capture-tests.mjs", "node", "node", "--test", "--test-reporter=tap", ...tests],
  });
}

export function requiredCertificationChecks(before, current, checks) {
  const required = new Set();
  for (let index = 0; index < before.repositories.length; index += 1) {
    const prior = before.repositories[index];
    const next = current.repositories[index];
    if (prior.repository !== next.repository || prior.root !== next.root) throw new Error("Certification input closure changed.");
    if (prior.tree === next.tree) continue;
    for (const path of changedTreePaths(prior.root, prior.tree, next.tree)) {
      const owner = checks.find(check => check.paths.some(input =>
        input.repository === prior.repository && pathIsCovered(path, input.path)));
      if (owner === undefined) throw new Error(`Changed source input requires its full bank: ${prior.repository}/${path}`);
      required.add(owner.name);
    }
  }
  return [...required];
}
