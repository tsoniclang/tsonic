#!/usr/bin/env node
// Generates the tsgo-accepted overlay files under tools/tsgo-suite/tsgo-accepted/.
//
// Where the pinned TS-Go compiler demonstrably diverges from the Strada-generated reference
// baselines, the exact-baseline gate compares TSTS against pinned TS-Go's actual output
// instead (TSTS is a mechanical mirror of TS-Go, not of Strada). This tool produces those
// overlay sections by running the REAL pinned TS-Go compiler — built from
// packages/tsts/_vendor/typescript-go — over the same per-file transpile invocations the
// TSTS transpile service executes, with the same effective compiler options and the same
// barebones lib.
//
// Usage:
//   go build -o /tmp/tsgo ./packages/tsts/_vendor/typescript-go/cmd/tsgo
//   node packages/tsts/tools/tsgo-suite/capture-tsgo-accepted.mjs --tsgo /tmp/tsgo
//
// The manifest (tsgo-accepted/manifest.json) lists every overlay file and the sections it
// must carry. A captured section that does NOT differ from the Strada baseline section is an
// error: the overlay must stay minimal, covering only real divergences.
import { spawnSync, execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseFileBasedTest,
  parseBaselineSections,
  compilerOptionsForMaterializedCase,
  transpileInvocationsForMaterializedCase,
  compilerCommandLineArgsForMaterializedCase,
  TSGO_ACCEPTED_ABSENT_MARKER,
} from "./run.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, "../../../..");
const packageRoot = join(repoRoot, "packages/tsts");
const vendorRoot = join(packageRoot, "_vendor/typescript-go");
const typeScriptSubmoduleCaseRoot = join(vendorRoot, "_submodules/TypeScript/tests/cases");
const typeScriptSubmoduleBaselineRoot = join(vendorRoot, "_submodules/TypeScript/tests/baselines/reference");
const overlayRoot = join(scriptDir, "tsgo-accepted");
const captureRoot = join(repoRoot, ".temp/tsgo-accepted-capture");

const args = process.argv.slice(2);
const tsgoIndex = args.indexOf("--tsgo");
if (tsgoIndex === -1 || args[tsgoIndex + 1] === undefined) {
  console.error("Usage: capture-tsgo-accepted.mjs --tsgo <path-to-pinned-tsgo-binary>");
  process.exit(2);
}
const tsgoBinary = args[tsgoIndex + 1];

const { barebonesLibContent } = await import(join(packageRoot, "dist/src/index.js"));
const manifest = JSON.parse(readFileSync(join(overlayRoot, "manifest.json"), "utf8"));
const pinnedRevision = execFileSync("git", ["-C", vendorRoot, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();

const normalize = (text) => text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n$/, "");

function settingsForEntry(parsed, configuration) {
  const settings = new Map(parsed.globalOptions ?? []);
  for (const [option, value] of parsed.settings ?? []) {
    settings.set(option, value);
  }
  if (configuration !== null && configuration !== undefined && configuration !== "") {
    for (const part of configuration.split(",")) {
      const [option, ...valueParts] = part.split("=");
      settings.set(option.toLowerCase(), valueParts.join("="));
    }
  }
  return settings;
}

// Mirror of the TSTS transpile service's forced options (src/services/transpile.ts,
// transpileCommandLineArgs) translated to pinned-TS-Go CLI flags. The service supplies the
// barebones lib through its in-memory host; the CLI equivalent is --noLib plus the lib file
// as an explicit input.
function serviceEquivalentArgs(invocation) {
  const cliArgs = compilerCommandLineArgsForMaterializedCase(invocation.compilerOptions, []);
  cliArgs.push("--noResolve");
  if (invocation.compilerOptions.verbatimModuleSyntax !== true) {
    cliArgs.push("--isolatedModules");
  }
  if (invocation.kind === "declaration") {
    cliArgs.push("--noLib");
    return { cliArgs, inputs: ["lib.d.ts", invocation.inputFile] };
  }
  cliArgs.push("--declaration", "false", "--declarationMap", "false", "--noLib");
  return { cliArgs, inputs: [invocation.inputFile] };
}

function diagnosticSortKey(line) {
  const match = /^(.*?)\((\d+),(\d+)\): error TS(\d+):/.exec(line);
  if (match === null) {
    return { file: line, line: 0, column: 0, code: 0 };
  }
  return { file: match[1], line: Number(match[2]), column: Number(match[3]), code: Number(match[4]) };
}

function compareDiagnosticLines(left, right) {
  const a = diagnosticSortKey(left);
  const b = diagnosticSortKey(right);
  if (a.file !== b.file) {
    return a.file < b.file ? -1 : 1;
  }
  return a.line - b.line || a.column - b.column || a.code - b.code;
}

let failures = 0;
for (const entry of manifest) {
  const casePath = join(typeScriptSubmoduleCaseRoot, entry.caseFile);
  const parsed = parseFileBasedTest(readFileSync(casePath, "utf8"), basename(entry.caseFile));
  const settings = settingsForEntry(parsed, entry.configuration);
  const inputFiles = parsed.units.map((unit) => unit.fileName);
  const compilerOptions = compilerOptionsForMaterializedCase(settings, parsed, inputFiles);
  const invocations = transpileInvocationsForMaterializedCase(compilerOptions, parsed, undefined, settings);

  const caseDir = join(captureRoot, entry.artifact.replace(/[^A-Za-z0-9.=()-]/g, "_"));
  rmSync(caseDir, { recursive: true, force: true });
  mkdirSync(caseDir, { recursive: true });
  for (const unit of parsed.units) {
    if (unit.fileName.includes("/") || unit.fileName.includes("\\")) {
      throw new Error(`capture-tsgo-accepted: case '${entry.caseFile}' uses nested unit paths; extend the materializer before capturing it.`);
    }
    writeFileSync(join(caseDir, unit.fileName), unit.content);
  }
  writeFileSync(join(caseDir, "lib.d.ts"), barebonesLibContent);

  const diagnosticLines = [];
  for (const invocation of invocations) {
    const { cliArgs, inputs } = serviceEquivalentArgs(invocation);
    const result = spawnSync(tsgoBinary, [...cliArgs, ...inputs], { cwd: caseDir, encoding: "utf8" });
    if (result.error !== undefined) {
      throw result.error;
    }
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
    for (const line of output.split(/\r?\n/)) {
      // Only file-positioned diagnostics: the TSTS transpile service returns syntactic/program/emit
      // diagnostics for the single input file; the CLI additionally prints global program
      // diagnostics (e.g. TS2318 missing global types under --noLib) that the service never
      // surfaces. Global diagnostics carry no file position.
      if (/^.+\(\d+,\d+\): error TS\d+:/.test(line)) {
        diagnosticLines.push(line);
      }
    }
  }
  diagnosticLines.sort(compareDiagnosticLines);

  const stradaSections = parseBaselineSections(readFileSync(join(typeScriptSubmoduleBaselineRoot, entry.corpus === "typescript" ? entry.suite : entry.suite, entry.artifact), "utf8"));
  const sections = [];
  for (const sectionName of entry.sections) {
    let content;
    if (sectionName === "Diagnostics reported") {
      content = diagnosticLines.join("\n");
    } else {
      content = normalize(readFileSync(join(caseDir, sectionName), "utf8"));
    }
    const stradaSection = stradaSections.find((section) => section.name === sectionName);
    if (stradaSection === undefined) {
      console.error(`FAIL ${entry.artifact}#${sectionName}: the Strada baseline has no such section; overlays may only override existing sections.`);
      failures += 1;
      continue;
    }
    if (normalize(stradaSection.content) === content) {
      console.error(`FAIL ${entry.artifact}#${sectionName}: pinned TS-Go output matches the Strada baseline; remove this section from the manifest.`);
      failures += 1;
      continue;
    }
    sections.push({ name: sectionName, content });
  }
  // Absent sections: pinned TS-Go intentionally emits nothing (e.g. a .d.ts the new pin blocks
  // under --isolatedDeclarations) while the Strada reference baseline still has it. Prove both
  // facts, then record an explicit absence marker the runner applies by dropping the section.
  for (const sectionName of entry.absentSections ?? []) {
    const stradaSection = stradaSections.find((section) => section.name === sectionName);
    if (stradaSection === undefined) {
      console.error(`FAIL ${entry.artifact}#${sectionName}: marked absent, but the Strada baseline has no such section to be absent against.`);
      failures += 1;
      continue;
    }
    if (existsSync(join(caseDir, sectionName))) {
      console.error(`FAIL ${entry.artifact}#${sectionName}: marked absent, but pinned TS-Go DID emit it; move it back to 'sections'.`);
      failures += 1;
      continue;
    }
    sections.push({ name: sectionName, content: TSGO_ACCEPTED_ABSENT_MARKER });
  }
  if (sections.length !== entry.sections.length + (entry.absentSections?.length ?? 0)) {
    continue;
  }

  const overlayPath = join(overlayRoot, entry.corpus, entry.suite, entry.artifact);
  mkdirSync(dirname(overlayPath), { recursive: true });
  const header = [
    `Generated by tools/tsgo-suite/capture-tsgo-accepted.mjs from pinned TS-Go ${pinnedRevision}.`,
    `Do not hand-edit. Sections below replace the same-named sections of the Strada reference`,
    `baseline '${entry.artifact}' because pinned TS-Go demonstrably diverges from Strada there.`,
    "",
  ].join("\n");
  const body = sections.map((section) => `//// [${section.name}] ////\n${section.content}\n`).join("");
  writeFileSync(overlayPath, `${header}${body}`);
  console.log(`WROTE ${overlayPath} (${sections.map((section) => section.name).join(", ")})`);
}

if (failures !== 0) {
  console.error(`capture-tsgo-accepted: ${failures} section(s) failed validation.`);
  process.exit(1);
}
