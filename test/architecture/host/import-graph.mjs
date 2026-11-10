import { posix } from "node:path";
import { createCompilerSessionFromFiles } from "../../../packages/tsts/dist/src/index.js";

export function parseSources(files) {
  return createCompilerSessionFromFiles({
    currentDirectory: "/host-gate",
    files: new Map([...files].map(([path, text]) => [`/host-gate/${path}`, text])),
    rootFiles: [...files.keys()],
    compilerOptions: { allowJs: true, module: "esnext", moduleResolution: "bundler", noLib: true,
      noResolve: true, skipLibCheck: true, target: "es2022" },
  }).checkSource();
}

export function readImportGraph(source, files) {
  const { ast } = source;
  const edges = [];
  for (const file of source.sourceFiles) {
    const path = ast.getFileName(file).slice("/host-gate/".length);
    if (!files.has(path)) continue;
    const reference = (node, literal) => {
      const kind = ast.kindName(literal);
      if (!["KindStringLiteral", "KindNoSubstitutionTemplateLiteral"].includes(kind)) return;
      const specifier = ast.text(literal);
      const range = ast.authoredRange(node);
      if (range.kind !== "authored") throw new Error("Import edges require original authored source sites.");
      const before = files.get(path).slice(0, range.start).split("\n");
      edges.push(Object.freeze({ source: path, specifier,
        target: specifier.startsWith(".") ? resolveImport(path, specifier, files) : null,
        line: before.length, column: before[before.length - 1].length + 1, start: range.start }));
    };
    const visit = node => {
      if (ast.is.IsImportDeclaration(node)) reference(node, ast.as.AsImportDeclaration(node).ModuleSpecifier);
      else if (ast.is.IsExportDeclaration(node)) reference(node, ast.as.AsExportDeclaration(node).ModuleSpecifier);
      else if (ast.is.IsImportTypeNode(node)) {
        const argument = ast.as.AsImportTypeNode(node).Argument;
        if (ast.is.IsLiteralTypeNode(argument)) reference(node, ast.as.AsLiteralTypeNode(argument).Literal);
      } else if (ast.is.IsCallExpression(node) && ast.kindName(ast.as.AsCallExpression(node).Expression) === "KindImportKeyword") {
        reference(node, ast.arguments(node)[0]);
      }
      ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
    };
    visit(file);
  }
  return Object.freeze(edges.sort((left, right) => left.source.localeCompare(right.source) || left.start - right.start));
}

function resolveImport(path, specifier, files) {
  const base = posix.normalize(posix.join(posix.dirname(path), specifier));
  const extension = posix.extname(base);
  const stem = [".js", ".mjs", ".cjs"].includes(extension) ? base.slice(0, -extension.length) : base;
  const candidates = [".js", ".mjs", ".cjs"].includes(extension)
    ? [base, ...[".ts", ".mts", ".cts", ".tsx", ".d.ts", ".d.mts", ".d.cts"].map(suffix => `${stem}${suffix}`)]
    : [base];
  const matches = candidates.filter(candidate => files.has(candidate));
  return matches.length === 1 ? matches[0] : null;
}

export function cyclicSources(edges) {
  const adjacency = new Map();
  for (const edge of edges) {
    if (edge.target === null) continue;
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
    adjacency.get(edge.source).push(edge.target);
  }
  const indices = new Map();
  const low = new Map();
  const stack = [];
  const active = new Set();
  const cycles = new Map();
  const visit = path => {
    indices.set(path, indices.size);
    low.set(path, indices.get(path));
    stack.push(path);
    active.add(path);
    for (const target of adjacency.get(path) ?? []) {
      if (!indices.has(target)) {
        visit(target);
        low.set(path, Math.min(low.get(path), low.get(target)));
      } else if (active.has(target)) low.set(path, Math.min(low.get(path), indices.get(target)));
    }
    if (low.get(path) !== indices.get(path)) return;
    const members = [];
    let member;
    do {
      member = stack.pop();
      active.delete(member);
      members.push(member);
    } while (member !== path);
    if (members.length > 1 || (adjacency.get(path) ?? []).includes(path)) {
      for (const entry of members) cycles.set(entry, path);
    }
  };
  for (const path of adjacency.keys()) if (!indices.has(path)) visit(path);
  return cycles;
}
