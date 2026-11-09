/** @type {readonly [string, number, string, readonly string[]][]} */
const rows = [
  ["model", 0, "Define immutable target-neutral data and pure factual algebra.", []],
  ["context", 0, "Govern one program's registered queries and finite lifetime.", ["model"]],
  ["libraries", 0, "Describe immutable authored libraries and declaration identities.", ["model"]],
  ["ingress", 1, "Capture authenticated observations from one checked program.", ["model", "context", "libraries"]],
  ["navigation", 2, "Describe authenticated authored structure and original relationships.", ["ingress"]],
  ["descriptors", 2, "Own canonical Evidence and binding-sensitive projections.", ["ingress", "navigation", "callables", "objects", "type-flow"]],
  ["relations", 2, "Prove specified relations between authenticated domains.", ["descriptors", "objects"]],
  ["constants", 2, "Prove exact constants and ranges at their actual phase.", ["navigation", "ingress", "descriptors", "core-facts", "type-flow"]],
  ["enums", 2, "Publish nominal enum domains and justified integer widths.", ["navigation", "ingress", "constants", "descriptors"]],
  ["objects", 2, "Publish complete member structure and ordered construction correspondence.", ["navigation", "ingress", "descriptors", "relations", "type-flow"]],
  ["profile", 2, "Interpret laws of the authenticated selected source profile.", ["ingress", "libraries", "descriptors", "callables", "type-flow"]],
  ["core-facts", 2, "Publish validated extension facts with original provenance.", ["ingress", "navigation", "constants", "descriptors", "objects"]],
  ["callables", 2, "Resolve callable contracts and complete application execution boundaries.", ["ingress", "navigation", "descriptors", "relations", "profile", "type-flow", "admission"]],
  ["type-flow", 2, "Solve the program's one demanded constraint graph.", ["navigation", "descriptors", "relations", "objects", "callables", "constants", "enums", "profile", "core-facts", "protocols", "admission"]],
  ["admission", 2, "Decide form support at the original occurrence.", ["navigation", "libraries", "core-facts"]],
  ["protocols", 2, "Publish selected target-neutral execution protocols.", ["type-flow", "callables", "objects", "profile", "core-facts"]],
  ["control-flow", 3, "Describe reachable regions and completions of original bodies.", ["navigation", "callables", "type-flow", "admission", "protocols"]],
  ["storage", 3, "Resolve storage subjects and transport under actual activations.", ["navigation", "type-flow", "objects", "callables", "protocols", "control-flow", "profile", "core-facts"]],
  ["memory", 3, "Publish scoped memory proofs over the canonical storage graph.", ["storage", "core-facts", "descriptors", "relations", "objects", "constants"]],
  ["ownership", 3, "Prove retention and continuation obligations for actual uses.", ["storage", "control-flow", "callables", "protocols", "profile"]],
  ["error-storage", 3, "Determine mutation and preservation requirements of error storage.", ["storage", "control-flow", "profile", "protocols"]],
  ["safety", 3, "Establish authored safety permissions for exact operations.", ["core-facts", "navigation", "control-flow", "protocols"]],
  ["publication", 4, "Expose the authenticated read-only external compilation contract.", ["navigation", "descriptors", "relations", "constants", "enums", "objects", "profile", "core-facts", "callables", "type-flow", "admission", "protocols", "control-flow", "storage", "memory", "ownership", "error-storage", "safety"]],
  ["project", 5, "Validate configuration and canonical filesystem boundaries.", ["model"]],
  ["packages", 5, "Resolve source packages and declaration-file closure.", ["project"]],
  ["plugins", 5, "Resolve selected target and contribution closure.", ["project", "packages", "publication"]],
  ["artifacts", 5, "Reconstruct and transactionally publish declared artifacts.", ["publication", "project"]],
  ["orchestration", 5, "Run one lifecycle from selected input through external handoff.", ["context", "project", "packages", "plugins", "ingress", "publication", "artifacts"]],
  ["command", 6, "Translate command requests into the Host compilation lifecycle.", ["orchestration", "project", "artifacts"]],
  ["scaffolding", 6, "Create a project from a validated starter description.", ["plugins", "publication", "project"]],
];

export const hostModules = Object.freeze(rows.map(([name, layer, responsibility, dependencies]) => {
  const directory = name === "command" ? "packages/cli/src" : name === "scaffolding"
    ? "packages/create-tsonic/src" : `packages/host/src/${name}`;
  const common = layer >= 2 && layer <= 4 ? ["model", "context"] : layer === 5 || layer === 6 ? ["model"] : [];
  return Object.freeze({ name, layer, responsibility, directory,
    contract: `${directory}/contract.ts`, registration: layer >= 1 && layer <= 4 ? `${directory}/register.ts` : undefined,
    dependencies: Object.freeze([...new Set([...common, ...dependencies])]) });
}));
