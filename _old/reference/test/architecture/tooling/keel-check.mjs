import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { keelCheckIds } from "./keel-contract.mjs";
import { keelDigest } from "./keel-source-analysis.mjs";
import { evaluateKeelViolationInventory } from "./keel-certification-checks.mjs";
import { defaultKeelWorkspace, evaluateKeelWorkspace, readKeelDeterminism } from "./keel-workspace.mjs";
import { keelDefaultManifest } from "./keel-owned-contracts.mjs";
import { createKeelWorkspaceInventory } from "./keel-inventory.mjs";

export function runKeelChecks(arguments_) {
  const options = parseArguments(arguments_);
  if (options.help) {
    process.stdout.write("keel-check.mjs [--manifest FILE] [--workspace DIR] [--baseline FILE] [--write-baseline FILE | --shrink-baseline FILE] [--determinism FILE] [--final]\n");
    return 0;
  }
  const manifestText = options.manifest === undefined ? JSON.stringify(keelDefaultManifest()) : readFileSync(options.manifest, "utf8");
  const manifest = JSON.parse(manifestText);
  const actual = evaluateKeelWorkspace(options.workspace ?? defaultKeelWorkspace(), manifest, {
    final: options.final ?? false,
    determinism: options.determinism === undefined ? [] : readKeelDeterminism(options.determinism),
  });
  if (options.writeBaseline !== undefined) {
    const inventory = createKeelWorkspaceInventory(actual, manifestText, new URL("../../..", import.meta.url).pathname);
    writeFileSync(options.writeBaseline, `${JSON.stringify(inventory, null, 2)}\n`, { flag: "wx" });
    report(actual, actual.findings, "baseline-created-not-certification");
    return 0;
  }
  if (options.shrinkBaseline !== undefined && options.baseline === undefined) throw new Error("Shrinking requires the previous exact baseline.");
  if (options.baseline !== undefined && !existsSync(options.baseline)) throw new Error("The declared Keel baseline does not exist.");
  const compared = options.baseline === undefined ? undefined
    : evaluateKeelViolationInventory(actual.findings, JSON.parse(readFileSync(options.baseline, "utf8")), keelDigest(manifestText));
  const rejected = compared?.newViolations ?? actual.findings;
  if (options.shrinkBaseline !== undefined) {
    if (rejected.length !== 0) throw new Error("A shrinking baseline cannot accept any new violation.");
    writeFileSync(options.shrinkBaseline, `${JSON.stringify(compared.inventory, null, 2)}\n`, { flag: "wx" });
  }
  report(actual, rejected, options.final ? "final" : options.baseline === undefined ? "unconditional" : "shrinking-baseline");
  if (rejected.length !== 0) process.stderr.write(`${rejected.slice(0, 40).map(row =>
    `${row.check} ${row.repo}:${row.file}#${row.subject}: ${row.reason}`).join("\n")}\n`);
  return rejected.length === 0 ? 0 : 1;
}

export function parseKeelArguments(arguments_) {
  return parseArguments(arguments_);
}

function parseArguments(arguments_) {
  const names = new Map([
    ["--manifest", "manifest"], ["--workspace", "workspace"], ["--baseline", "baseline"],
    ["--write-baseline", "writeBaseline"], ["--shrink-baseline", "shrinkBaseline"], ["--determinism", "determinism"],
  ]);
  const options = {};
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    const name = argument === "--final" ? "final" : argument === "--help" ? "help" : names.get(argument);
    if (name === undefined || Object.hasOwn(options, name)) throw new Error(`Unknown or duplicate Keel argument '${argument}'.`);
    if (name === "final" || name === "help") { options[name] = true; continue; }
    const value = arguments_[++index];
    if (value === undefined || value.startsWith("--")) throw new Error(`Keel argument '${argument}' needs a path.`);
    options[name] = resolve(value);
  }
  if (options.writeBaseline !== undefined && options.shrinkBaseline !== undefined) throw new Error("Baseline creation and shrinking are separate operations.");
  if (options.writeBaseline !== undefined && options.baseline !== undefined) throw new Error("Baseline creation cannot also consume an existing waiver inventory.");
  if (options.final && (options.baseline !== undefined || options.writeBaseline !== undefined || options.shrinkBaseline !== undefined)) {
    throw new Error("Final certification is unconditional and cannot consume or create a violations baseline.");
  }
  return Object.freeze(options);
}

function report(actual, rejected, mode) {
  process.stdout.write(`${JSON.stringify({
    mode, pins: actual.pins, sourceDigests: actual.sourceDigests, totalFunctions: actual.totalFunctions,
    capabilityGaps: actual.capabilityGaps,
    checks: Object.fromEntries(keelCheckIds.map(check => [check, {
      observed: actual.findings.filter(row => row.check === check).length,
      new: rejected.filter(row => row.check === check).length,
      executed: check !== "AC11" || actual.determinismExecuted,
    }])),
    accepted: rejected.length === 0 && mode !== "baseline-created-not-certification",
  }, null, 2)}\n`);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { process.exitCode = runKeelChecks(process.argv.slice(2)); }
  catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  }
}
