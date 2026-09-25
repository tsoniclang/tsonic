import { evaluateBarrelModules } from "./architecture-rules.mjs";
import { buildTypeScriptModuleAnalysis } from "./module-graph.mjs";

const providerPrefix = "nodejs/src/provider/";
const rootOwners = new Set([
  "package.ts", "runtime.ts", "metadata-indexes.ts", "target-relations.ts",
]);
const families = ["model/", "declarations/", "assembly/", "modules/"];

export function evaluateNodeProviderContract(sources, { targetPackage, factoryName }) {
  const findings = [];
  const factoryOwners = [];
  const graph = buildTypeScriptModuleAnalysis(sources);
  for (const [file, source] of sources) {
    if (/\b(?:registerSourceDeclarationProvider|SourceDeclarationProvider|ProviderOwnership|resolveModule|ownsModule|getDeclarationModel|rebase\w*Provider\w*|visitProviderType)\b/u.test(source)) {
      findings.push(`${file}: local source-provider transport`);
    }
    const calls = source.match(new RegExp(`\\b${factoryName}\\s*\\(`, "gu")) ?? [];
    factoryOwners.push(...calls.map(() => file));
    if (!file.startsWith(providerPrefix)) continue;
    const ownedPath = file.slice(providerPrefix.length);
    if (ownedPath === "package.ts" && /\b(?:providerModuleId|(?:Csharp|Rust)ProviderModuleDefinition)\b/u.test(source)) {
      findings.push(`${file}: package composition cannot own module declaration policy`);
    }
    if (!rootOwners.has(ownedPath) && !families.some(family => ownedPath.startsWith(family))) {
      findings.push(`${file}: missing coherent module or package owner`);
    }
    if (/(?:^|\/)helpers\.ts$/u.test(ownedPath)) findings.push(`${file}: vague helper owner`);
    if (source.split("\n").length > 600) findings.push(`${file}: exceeds 600 lines`);
    if (ownedPath.startsWith("modules/") && !ownedPath.slice("modules/".length).includes("/")) {
      const family = file.slice(0, -3);
      if ([...sources.keys()].some(candidate => candidate.startsWith(`${family}/`))) {
        findings.push(`${file}: multi-part module must be nested inside its family`);
      }
    }
  }
  if (factoryOwners.length !== 1 || factoryOwners[0] !== `${providerPrefix}package.ts`) {
    findings.push(`SDK factory must have one canonical package owner: ${factoryOwners.join(", ")}`);
  }
  for (const edge of graph.edges) {
    if (edge.unresolved) findings.push(`${edge.source}: unresolved module ${edge.specifier}`);
    if (edge.kind === "package" && (edge.specifier === targetPackage || edge.specifier.startsWith(`${targetPackage}/`)) && edge.specifier !== `${targetPackage}/provider`) {
      findings.push(`${edge.source}: target imports must use the public provider SDK`);
    }
    if (edge.source.startsWith(`${providerPrefix}model/`) && edge.target?.startsWith(providerPrefix) && !edge.target.startsWith(`${providerPrefix}model/`)) {
      findings.push(`${edge.source}: immutable model cannot depend on declaration or module assembly`);
    }
    if (edge.source.startsWith(`${providerPrefix}modules/`) && (edge.target === `${providerPrefix}package.ts` || edge.target?.startsWith(`${providerPrefix}assembly/`))) {
      findings.push(`${edge.source}: module data cannot depend on package assembly`);
    }
  }
  const dependencies = new Map();
  for (const edge of graph.edges) {
    if (edge.target === undefined) continue;
    const targets = dependencies.get(edge.source) ?? [];
    targets.push(edge.target);
    dependencies.set(edge.source, targets);
  }
  for (const [source, target] of [
    ["nodejs/src/index.ts", "nodejs/src/capability.ts"],
    ["nodejs/src/capability.ts", `${providerPrefix}package.ts`],
  ]) {
    if (!dependencies.get(source)?.includes(target)) {
      findings.push(`${source}: public capability must connect to ${target}`);
    }
  }
  const reachable = new Set();
  const pending = [`${providerPrefix}package.ts`];
  while (pending.length > 0) {
    const file = pending.pop();
    if (reachable.has(file)) continue;
    reachable.add(file);
    pending.push(...(dependencies.get(file) ?? []));
  }
  for (const file of sources.keys()) {
    if (file.startsWith(`${providerPrefix}modules/`) && !reachable.has(file)) {
      findings.push(`${file}: module fragment has no owning package import`);
    }
  }
  findings.push(...evaluateBarrelModules(graph.modules).map(finding => `${finding.source}: ${finding.ruleId} ${finding.reason}`));
  return findings.sort();
}
