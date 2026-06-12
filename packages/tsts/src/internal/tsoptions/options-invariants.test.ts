import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CompilerOptions } from "../core/compileroptions.js";
import { OptionsDeclarations } from "./declscompiler.js";
import { parseCompilerOptions } from "./parsinghelpers.js";

const compilerOptionsSourcePath = join(process.cwd(), "packages/tsts/src/internal/core/compileroptions.ts");

function compilerOptionJsonKey(fieldName: string): string {
  if (fieldName === "ESModuleInterop") {
    return "esModuleInterop";
  }
  return fieldName.slice(0, 1).toLowerCase() + fieldName.slice(1);
}

function compilerOptionKeys(): string[] {
  const sourceText = readFileSync(compilerOptionsSourcePath, "utf8");
  const body = /export interface CompilerOptions \{([\s\S]*?)\n\}/.exec(sourceText)?.[1];
  assert.ok(body !== undefined, "CompilerOptions interface not found");

  const keys: string[] = [];
  for (const line of body.split("\n")) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\??:/.exec(line);
    if (match === null) {
      continue;
    }
    const fieldName = match[1];
    assert.ok(fieldName !== undefined);
    if (fieldName.startsWith("__")) {
      continue;
    }
    keys.push(compilerOptionJsonKey(fieldName));
  }
  return keys;
}

test("parseCompilerOptions recognizes every CompilerOptions field", () => {
  const missingKeys: string[] = [];
  for (const key of compilerOptionKeys()) {
    const options = {} as CompilerOptions;
    if (!parseCompilerOptions(key, undefined, options)) {
      missingKeys.push(key);
    }
  }

  assert.deepEqual(missingKeys, []);
});

test("OptionsDeclarations mirrors the CompilerOptions declaration surface", () => {
  const declarations = new Map<string, string>();
  for (const declaration of OptionsDeclarations) {
    declarations.set(declaration!.Name.toLowerCase(), declaration!.Name);
  }

  const internalOptions = new Set([
    "allownontsextensions",
    "build",
    "configfilepath",
    "nodtsresolution",
    "noemitforjsfiles",
    "pathsbasepath",
    "suppressoutputpathcheck",
  ]);
  const missingDeclarations: string[] = [];

  for (const key of compilerOptionKeys()) {
    const lowerKey = key.toLowerCase();
    if (declarations.has(lowerKey)) {
      declarations.delete(lowerKey);
      continue;
    }
    if (!internalOptions.has(lowerKey)) {
      missingDeclarations.push(key);
    }
  }

  declarations.delete("plugins");

  assert.deepEqual(missingDeclarations, []);
  assert.deepEqual([...declarations.values()].sort(), []);
});

test("OptionsDeclarations marks semantic-diagnostic options as affecting build info", () => {
  const missingBuildInfoFlags: string[] = [];
  for (const option of OptionsDeclarations) {
    if (option!.AffectsSemanticDiagnostics && !option!.AffectsBuildInfo) {
      missingBuildInfoFlags.push(option!.Name);
    }
  }

  assert.deepEqual(missingBuildInfoFlags, []);
});
