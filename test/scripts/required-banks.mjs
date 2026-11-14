// The test banks npm test selects, as stated once in package.json config, and the check that none of them is empty. The
// guarded build runs the check before node --test discovers files, so an empty or removed root fails the entry even when it
// is the root that holds the entry's own cases.
import { globSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const bankKeys = ["testArchitecture", "testCases", "testUnits"];

// The configured patterns of the package at a directory.
export function bankPatterns(directory) {
  const config = JSON.parse(readFileSync(resolve(directory, "package.json"), "utf8")).config;
  return bankKeys.map(key => config[key]);
}

// The configured patterns that match no file at a directory: required banks that are empty.
export function emptyBanks(directory) {
  return bankPatterns(directory).filter(pattern => globSync(pattern, { cwd: directory }).length === 0);
}
