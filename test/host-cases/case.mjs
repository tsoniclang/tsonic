import { posix } from "node:path";
import { compareCaseValues } from "./compare.mjs";

const levels = Object.freeze(["function", "pass", "verifier", "pipeline", "corpus"]);
const formats = Object.freeze(["json", "ts", "hir", "tir", "mir", "facts", "program"]);

/** @type {import("./contracts.d.mts").RunCase} */
export async function runCase(deps, descriptorPath) {
  const failed = (code, detail) => Object.freeze({ status: "failed", path: descriptorPath, code, detail });
  const canonical = path => typeof path === "string" && path.length > 0 && !path.includes("\\") && !path.includes("\0") &&
    !path.startsWith("/") && !path.split("/").some(part => ["", ".", ".."].includes(part));
  if (!canonical(descriptorPath) || !descriptorPath.startsWith("test/host-cases/") || !descriptorPath.endsWith(".case.json"))
    return failed("descriptor", "A canonical module/level/name.case.json path is required.");
  let descriptor;
  try {
    if (await deps.canonical(descriptorPath) !== descriptorPath) return failed("descriptor", "The descriptor must be its original owned file.");
    descriptor = JSON.parse(await deps.readText(descriptorPath));
  }
  catch { return failed("descriptor", "The authored descriptor is missing or invalid JSON."); }
  if (descriptor === null || typeof descriptor !== "object" || Array.isArray(descriptor) ||
    Object.keys(descriptor).sort().join(",") !== "expected,input,level,name,rule")
    return failed("descriptor", "Exactly name, level, rule, input and expected are required.");
  const { name, level, rule, input, expected } = descriptor;
  if (typeof name !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(name) || !levels.includes(level) ||
    typeof rule !== "string" || rule.trim().length === 0) return failed("descriptor", "Case name, canonical level and named rule are required.");
  const directory = posix.dirname(descriptorPath);
  const domain = directory.slice("test/host-cases/".length).split("/");
  const actualLevel = domain.pop();
  const module = domain.join("/");
  if (actualLevel !== level || module.length === 0 || !deps.modules.includes(module) ||
    posix.basename(descriptorPath) !== `${name}.case.json`) return failed("location", "Descriptor module, level and basename must agree.");
  for (const [path, role] of [[input, "input"], [expected, "expected"]]) {
    if (!canonical(path) || posix.dirname(path) !== directory || !formats.some(format => posix.basename(path) === `${name}.${role}.${format}`))
      return failed("location", "Input and expected must be authored adjacent files with closed formats and the same basename.");
    try {
      const resolved = await deps.canonical(path);
      if (resolved !== null && resolved !== path) return failed("location", "Case files cannot alias or escape their owned directory.");
    } catch { return failed(role, `The authored ${role} file is missing.`); }
  }
  const allowed = new Set([posix.basename(descriptorPath), posix.basename(input), posix.basename(expected)]);
  const siblings = await deps.list(directory);
  if (siblings.some(path => path.startsWith(`${name}.`) && !allowed.has(path))) return failed("inventory", "Unexpected case result file.");
  let inputText;
  let expectedText;
  try { inputText = await deps.readText(input); }
  catch { return failed("input", "The authored input file is missing."); }
  try { expectedText = await deps.readText(expected); }
  catch { return failed("expected", "The authored expected file is missing."); }
  const adapter = deps.adapters[level];
  if (typeof adapter !== "function") return failed("adapter", "The requested owning level has no real adapter.");
  let expectedValue;
  try { expectedValue = await deps.decode(expectedText, posix.extname(expected).slice(1)); }
  catch { return failed("expected", "The authored expected result is invalid."); }
  const result = await adapter(Object.freeze({ module, name, rule, format: posix.extname(input).slice(1), text: inputText }));
  if (!validOutcome(result) || !validOutcome(expectedValue)) return failed("outcome", "A complete accepted or refused outcome and full diagnostics vector are required.");
  if (!compareCaseValues(result, expectedValue)) return failed("mismatch", "The complete outcome, value or ordered diagnostic vector differs.");
  return Object.freeze({ status: "passed", path: descriptorPath, outcome: result });
}

function validOutcome(value) {
  if (!compareCaseValues(value, value)) return false;
  if (value === null || typeof value !== "object" || Array.isArray(value) || !["accepted", "refused"].includes(value.kind) || !Array.isArray(value.diagnostics)) return false;
  const keys = Object.keys(value).sort().join(",");
  if (keys !== (value.kind === "accepted" ? "diagnostics,kind,value" : "diagnostics,kind") || value.kind === "refused" && value.diagnostics.length === 0) return false;
  return value.diagnostics.every(diagnostic => diagnostic !== null && typeof diagnostic === "object" && !Array.isArray(diagnostic) &&
    typeof diagnostic.code === "string" && typeof diagnostic.message === "string" && Object.hasOwn(diagnostic, "site"));
}
