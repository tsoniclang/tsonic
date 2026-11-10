import { posix } from "node:path";
import { createCompilerSessionFromFiles, SymbolFlagsAlias } from "../../../packages/tsts/dist/src/index.js";
import { sourceOwner } from "./catalogue.mjs";

export function sourceSymbol(source, node, initial) {
  if (node === undefined) return undefined;
  const file = source.ast.getSourceFile(node);
  if (file === undefined) throw new Error("An architecture reference requires its original source file.");
  const queries = source.getSourceFileQueries(file).checker;
  let selected = initial ?? queries.getSymbolAtLocation(node);
  const active = new Set();
  while (selected !== undefined && (selected.Flags & SymbolFlagsAlias) !== 0) {
    if (active.has(selected)) throw new Error("An architecture alias chain cannot cycle.");
    active.add(selected);
    const original = queries.getAliasedSymbol(selected);
    if (original === undefined || !queries.getSymbolDeclarations(original).some(node => node !== undefined)) break;
    selected = original;
  }
  return selected;
}

export function publicCallables(source, files, catalogue) {
  const values = new Map();
  for (const file of source.sourceFiles) {
    if (file === undefined) continue;
    const path = source.ast.getFileName(file).slice("/host-gate/".length);
    const module = sourceOwner(catalogue, path);
    if (!files.has(path) || module === undefined || !["component", "library"].includes(module.kind) ||
      module.kind === "library" && path !== module.entry) continue;
    const queries = source.getSourceFileQueries(file).checker;
    const identity = sourceSymbol(source, file);
    if (identity === undefined) continue;
    for (const exported of queries.getExportsOfModule(identity)) {
      const selected = sourceSymbol(source, file, exported);
      const declaration = queries.getSymbolValueDeclaration(selected);
      if (declaration === undefined) continue;
      const declarationPath = source.ast.getFileName(source.ast.getSourceFile(declaration)).slice("/host-gate/".length);
      if (sourceOwner(catalogue, declarationPath) !== module) continue;
      const signatures = queries.getCallSignaturesOfType(queries.getTypeOfSymbol(selected))
        .map(signature => queries.getSignatureDeclaration(signature)).filter(node => node !== undefined);
      if (signatures.length > 0) values.set(declaration, Object.freeze({ module, signatures: Object.freeze(signatures) }));
    }
  }
  return values;
}

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
  const factories = new Set();
  const namespaces = new Set();
  const loaders = new Set();
  const declarations = [];
  for (const file of source.sourceFiles) {
    if (file === undefined || !files.has(ast.getFileName(file).slice("/host-gate/".length))) continue;
    const collect = node => {
      const moduleSpecifier = ast.is.IsImportDeclaration(node) ? ast.as.AsImportDeclaration(node).ModuleSpecifier
        : ast.is.IsExportDeclaration(node) ? ast.as.AsExportDeclaration(node).ModuleSpecifier : undefined;
      if (["node:module", "module"].includes(ast.text(moduleSpecifier))) {
        const bindings = child => {
          const identity = sourceSymbol(source, ast.name(child));
          const binding = ast.is.IsImportSpecifier(child) ? ast.as.AsImportSpecifier(child)
            : ast.is.IsExportSpecifier(child) ? ast.as.AsExportSpecifier(child) : undefined;
          if (identity !== undefined && binding !== undefined && ast.text(binding.PropertyName ?? ast.name(child)) === "createRequire") factories.add(identity);
          if (identity !== undefined && (ast.is.IsNamespaceImport(child) || ast.is.IsNamespaceExport(child) || ast.is.IsImportClause(child))) namespaces.add(identity);
          ast.forEachChild(child, nested => { if (nested !== undefined) bindings(nested); });
        };
        bindings(node);
      }
      if (ast.is.IsVariableDeclaration(node)) declarations.push(node);
      ast.forEachChild(node, child => { if (child !== undefined) collect(child); });
    };
    collect(file);
  }
  const factory = expression => {
    const node = unwrapExpression(ast, expression);
    if (node === undefined) return false;
    if (ast.is.IsIdentifier(node)) return factories.has(sourceSymbol(source, node));
    if (!ast.is.IsPropertyAccessExpression(node)) return false;
    const access = ast.as.AsPropertyAccessExpression(node);
    return ast.text(ast.name(node)) === "createRequire" && namespaces.has(sourceSymbol(source, unwrapExpression(ast, access.Expression)));
  };
  for (let previous = -1; previous !== factories.size + namespaces.size + loaders.size;) {
    previous = factories.size + namespaces.size + loaders.size;
    for (const declaration of declarations) {
      const name = ast.name(declaration);
      if (name === undefined || !ast.is.IsIdentifier(name)) continue;
      const identity = sourceSymbol(source, name);
      const initializer = unwrapExpression(ast, ast.as.AsVariableDeclaration(declaration).Initializer);
      if (identity === undefined || initializer === undefined) continue;
      if (factory(initializer)) factories.add(identity);
      if (namespaces.has(sourceSymbol(source, initializer))) namespaces.add(identity);
      if (loaders.has(sourceSymbol(source, initializer)) || ast.is.IsCallExpression(initializer) && factory(ast.as.AsCallExpression(initializer).Expression))
        loaders.add(identity);
    }
  }
  for (const file of source.sourceFiles) {
    if (file === undefined) continue;
    const path = ast.getFileName(file).slice("/host-gate/".length);
    if (!files.has(path)) continue;
    const reference = (node, literal) => {
      literal = unwrapExpression(ast, literal);
      const specifier = ["KindStringLiteral", "KindNoSubstitutionTemplateLiteral"].includes(ast.kindName(literal)) ? ast.text(literal) : null;
      const range = ast.authoredRange(node);
      if (range.kind !== "authored") throw new Error("Import edges require original authored source sites.");
      const before = files.get(path).slice(0, range.start).split("\n");
      edges.push(Object.freeze({ source: path, specifier,
        target: specifier !== null && specifier.startsWith(".") ? resolveImport(path, specifier, files) : null,
        line: before.length, column: before[before.length - 1].length + 1, start: range.start }));
    };
    const visit = node => {
      if (ast.is.IsImportDeclaration(node)) reference(node, ast.as.AsImportDeclaration(node).ModuleSpecifier);
      else if (ast.is.IsExportDeclaration(node) && ast.as.AsExportDeclaration(node).ModuleSpecifier !== undefined) reference(node, ast.as.AsExportDeclaration(node).ModuleSpecifier);
      else if (ast.is.IsImportTypeNode(node)) {
        const argument = ast.as.AsImportTypeNode(node).Argument;
        if (ast.is.IsLiteralTypeNode(argument)) reference(node, ast.as.AsLiteralTypeNode(argument).Literal);
      } else if (ast.is.IsCallExpression(node) && ast.kindName(ast.as.AsCallExpression(node).Expression) === "KindImportKeyword") {
        reference(node, ast.arguments(node)[0]);
      } else if (ast.is.IsCallExpression(node)) {
        const callee = unwrapExpression(ast, ast.as.AsCallExpression(node).Expression);
        if (loaders.has(sourceSymbol(source, callee)) || callee !== undefined && ast.is.IsCallExpression(callee) && factory(ast.as.AsCallExpression(callee).Expression))
          reference(node, ast.arguments(node)[0]);
      }
      ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
    };
    visit(file);
  }
  return Object.freeze(edges.sort((left, right) => left.source.localeCompare(right.source) || left.start - right.start));
}

function unwrapExpression(ast, original) {
  let node = original;
  while (node !== undefined) {
    const operand = ast.is.IsParenthesizedExpression(node) ? ast.as.AsParenthesizedExpression(node).Expression
      : ast.is.IsAsExpression(node) ? ast.as.AsAsExpression(node).Expression
        : ast.is.IsSatisfiesExpression(node) ? ast.as.AsSatisfiesExpression(node).Expression
          : ast.is.IsNonNullExpression(node) ? ast.as.AsNonNullExpression(node).Expression
            : ast.is.IsTypeAssertion(node) ? ast.as.AsTypeAssertion(node).Expression : undefined;
    if (operand === undefined) break;
    node = operand;
  }
  return node;
}

export function quarantineReference(value, roots) {
  const parts = value.replaceAll("\\", "/").split("/");
  return roots.some(root => {
    const namespace = root.split("/")[0];
    return parts.some(part => part === namespace || part.endsWith(`:${namespace}`));
  });
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
