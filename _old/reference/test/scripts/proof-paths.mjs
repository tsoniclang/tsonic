import { readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const dataPath = fileURLToPath(new URL("../fixtures/proof-paths.json", import.meta.url));
const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

export function createProofPathResolver({ workspaceRoot: root, moves }) {
  const workspace = realpathSync(root);
  if (moves === null || typeof moves !== "object" || Array.isArray(moves))
    throw new Error("Proof moves require their explicit current path relation.");
  for (const [origin, targets] of Object.entries(moves)) {
    canonicalPath(origin);
    if (!Array.isArray(targets) || targets.length === 0 || new Set(targets).size !== targets.length)
      throw new Error(`Proof move has missing or duplicate targets: ${origin}`);
    for (const target of targets) canonicalPath(target);
  }
  const relation = Object.freeze(Object.fromEntries(
    Object.entries(moves).map(([origin, targets]) => [origin, Object.freeze([...targets])]),
  ));

  const paths = (repositoryRoot, proofs) => {
    const repository = realpathSync(repositoryRoot);
    const repositoryPath = relative(workspace, repository);
    if (repositoryPath !== "") canonicalPath(repositoryPath);
    if (!Array.isArray(proofs) || proofs.some(proof => typeof proof !== "string" || proof.length === 0))
      throw new Error("Proof paths require a vector of nonempty current evidence references.");
    const result = new Set();
    const active = new Set();
    const visit = origin => {
      if (active.has(origin)) throw new Error(`Cyclic proof move: ${origin}`);
      active.add(origin);
      const targets = Object.hasOwn(relation, origin) ? relation[origin] : [origin];
      for (const target of targets) {
        if (target !== origin && Object.hasOwn(relation, target)) visit(target);
        else {
          const path = resolve(workspace, target);
          canonicalPath(relative(workspace, realpathSync(path)));
          if (!statSync(path).isFile()) throw new Error(`Proof is not an executable evidence file: ${target}`);
          result.add(relative(repository, path).split(sep).join("/"));
        }
      }
      active.delete(origin);
    };
    for (const proof of proofs) {
      if (isAbsolute(proof) || proof.includes("\\")) throw new Error(`Proof reference is not relative: ${proof}`);
      const origin = relative(workspace, resolve(repository, proof)).split(sep).join("/");
      canonicalPath(origin);
      visit(origin);
    }
    return Object.freeze([...result]);
  };

  const readTest = async (repositoryRoot, proof, name) => {
    if (typeof name !== "string" || name.length === 0) throw new Error("Proof lookup requires its exact original test name.");
    const files = paths(repositoryRoot, [proof]);
    const sources = new Map(files.map(path => [
      relative(workspace, resolve(repositoryRoot, path)).split(sep).join("/"),
      readFileSync(resolve(repositoryRoot, path), "utf8"),
    ]));
    const { readArchitectureTypeScript } = await import("../architecture/tooling/typescript-source.mjs");
    const checked = readArchitectureTypeScript(sources);
    const { ast } = checked;
    const matches = [];
    for (const file of checked.sourceFiles) {
      const path = ast.getFileName(file).slice("/architecture/".length);
      if (!sources.has(path)) continue;
      for (const statement of ast.statements(file)) {
        if (!ast.is.IsExpressionStatement(statement)) continue;
        const expression = ast.as.AsExpressionStatement(statement).Expression;
        if (!ast.is.IsCallExpression(expression)) continue;
        const callee = ast.as.AsCallExpression(expression).Expression;
        if (!ast.is.IsIdentifier(callee) || ast.text(callee) !== "test") continue;
        const [title] = ast.arguments(expression);
        if (title === undefined || !ast.is.IsStringLiteral(title) || ast.text(title) !== name) continue;
        const source = Buffer.from(sources.get(path)).subarray(ast.pos(statement), ast.end(statement)).toString("utf8");
        matches.push(Object.freeze({ path: relative(repositoryRoot, resolve(workspace, path)).split(sep).join("/"), name, source }));
      }
    }
    if (matches.length !== 1) throw new Error(`Proof test must resolve exactly once: ${proof}: ${name} (${matches.length})`);
    return matches[0];
  };
  return Object.freeze({ paths, readTest });
}

export function proofMovesFromKeymap(keymap) {
  if (!Array.isArray(keymap?.files)) throw new Error("Proof regeneration requires the exact test split key map.");
  const moves = {};
  const origins = new Set();
  for (const entry of keymap.files) {
    const origin = modulePath(entry.module);
    if (origins.has(origin)) throw new Error(`Proof key map repeats an original: ${origin}`);
    origins.add(origin);
    if (!Array.isArray(entry.parts) || entry.parts.length === 0)
      throw new Error(`Proof key map has no current parts: ${origin}`);
    const targets = entry.parts.map(part => modulePath(part.module));
    if (new Set(targets).size !== targets.length)
      throw new Error(`Proof key map repeats a current part: ${origin}`);
    if (targets.length !== 1 || targets[0] !== origin) moves[origin] = targets;
  }
  return moves;
}

function modulePath(module) {
  if (typeof module !== "string" || module.indexOf(":") < 1)
    throw new Error("Proof key map requires an exact repository:module identity.");
  const index = module.indexOf(":");
  const path = `${module.slice(0, index)}/${module.slice(index + 1)}`;
  canonicalPath(path);
  return path;
}

function canonicalPath(path) {
  if (typeof path !== "string" || isAbsolute(path) || path.includes("\\") ||
    path.split("/").some(part => part === "" || part === "." || part === ".."))
    throw new Error(`Proof path is outside its canonical workspace domain: ${String(path)}`);
}

export const currentProofs = createProofPathResolver({
  workspaceRoot,
  moves: JSON.parse(readFileSync(dataPath, "utf8")).moves,
});

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [keymapPath] = process.argv.slice(2);
  if (keymapPath === undefined || process.argv.length !== 3)
    throw new Error("Usage: node test/scripts/proof-paths.mjs <exact-test-keymap.json>");
  const moves = { ...JSON.parse(readFileSync(dataPath, "utf8")).moves,
    ...proofMovesFromKeymap(JSON.parse(readFileSync(keymapPath, "utf8"))) };
  const resolver = createProofPathResolver({ workspaceRoot, moves });
  for (const origin of Object.keys(moves)) resolver.paths(workspaceRoot, [origin]);
  writeFileSync(dataPath, `${JSON.stringify({ schemaVersion: 1, moves }, null, 2)}\n`);
}
