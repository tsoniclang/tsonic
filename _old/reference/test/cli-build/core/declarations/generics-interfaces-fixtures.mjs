import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { assert, cliPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";

const bannedGeneratedRuntimeSemantics = [
  /\bdynamic\b/u,
  /\bSystem\.Reflection\b/u,
  /\bGetProperty\b/u,
  /\bGetProperties\b/u,
  /\bGetMethod\b/u,
  /\bGetMethods\b/u,
  /\bMethodInfo\.Invoke\b/u,
  /\bMakeGenericMethod\b/u,
  /\bActivator\.CreateInstance\b/u,
  /\bAssembly\.Load\b/u,
];

export { bannedGeneratedRuntimeSemantics };
