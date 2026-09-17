import { lstatSync, mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { basename, isAbsolute, join, normalize, sep } from "node:path";
import { after } from "node:test";

const workspaces = new Map();
let cleanupRegistered = false;
let completedContext;

after(context => { completedContext = context; });

export function createTestWorkspace(parent, prefix) {
  if (typeof parent !== "string" || !isAbsolute(parent) ||
      !normalize(parent).split(sep).some(part => part === ".temp" || part === ".tests")) {
    throw new Error("Test workspaces require an absolute .temp or .tests parent.");
  }
  if (typeof prefix !== "string" || prefix.length === 0 ||
      prefix === "." || prefix === ".." || prefix !== basename(prefix) || prefix.includes("\0")) {
    throw new Error("Test workspace prefixes must be nonempty file names.");
  }
  mkdirSync(parent, { recursive: true });
  const directory = mkdtempSync(join(realpathSync(parent), prefix));
  workspaces.set(directory, lstatSync(directory, { bigint: true }));
  if (!cleanupRegistered) {
    process.once("exit", cleanupWorkspaces);
    cleanupRegistered = true;
  }
  return directory;
}

function cleanupWorkspaces(exitCode) {
  if (exitCode !== 0 || completedContext?.passed !== true) {
    for (const directory of workspaces.keys()) {
      process.stderr.write(`Retained failed test workspace: ${JSON.stringify(directory)}\n`);
    }
    return;
  }
  for (const [directory, created] of workspaces) {
    try {
      let current;
      try {
        current = lstatSync(directory, { bigint: true });
      } catch (error) {
        if (error.code === "ENOENT") continue;
        throw error;
      }
      if (!current.isDirectory() || current.dev !== created.dev ||
          current.ino !== created.ino || realpathSync(directory) !== directory) {
        throw new Error("Test workspace identity changed; refusing removal.");
      }
      rmSync(directory, { recursive: true });
    } catch (error) {
      process.exitCode = 1;
      process.stderr.write(`Test workspace cleanup failed for ${JSON.stringify(directory)}: ${error.message}\n`);
    }
  }
}
