import { dirname, extname, posix } from "node:path";
import { sourceTransparentExpressionOperand } from "../../../packages/target-api/dist/source-model/ast.js";
import { getStaticModuleReference } from "../../../packages/target-api/dist/public/provider.js";
import { readArchitectureTypeScript } from "./typescript-source.mjs";

const sourceExtensions = Object.freeze([".ts", ".tsx", ".mts", ".cts"]);

export function buildTypeScriptModuleGraph(sourceFiles) {
  return buildTypeScriptModuleAnalysis(sourceFiles).edges;
}

export function buildTypeScriptModuleAnalysis(sourceFiles) {
  const source = readArchitectureTypeScript(sourceFiles);
  return analyzeCheckedTypeScriptModules(source, sourceFiles, "/architecture/", []);
}

export function analyzeCheckedTypeScriptModules(source, sourceFiles, prefix, resolutionRoots) {
  if (!Array.isArray(resolutionRoots) || resolutionRoots.some(root => typeof root !== "string" || root.length === 0))
    throw new Error("Checked module analysis requires its explicit source/output resolution roots.");
  const edges = [];
  const modules = [];
  for (const sourceFile of source.sourceFiles) {
    const absoluteFileName = source.ast.getFileName(sourceFile);
    if (!absoluteFileName.startsWith(prefix)) {
      continue;
    }
    const file = absoluteFileName.slice(prefix.length);
    if (!sourceFiles.has(file)) continue;
    const references = collectModuleSpecifiers(source.ast, sourceFile);
    const functions = checkedFunctionUses(source, sourceFile, sourceFiles, prefix);
    modules.push(Object.freeze({
      file,
      functionExports: functions.exports,
      functionReads: functions.reads,
      runtimeSpecifiers: Object.freeze(references.filter(reference => reference.runtime).map(reference => reference.specifier)),
      topLevelKinds: Object.freeze(
        source.ast.statements(sourceFile)
          .filter((statement) => statement !== undefined)
          .map((statement) => source.ast.kindName(statement)),
      ),
    }));
    for (const { specifier } of references) {
      if (specifier.startsWith(".")) {
        const resolution = resolveRelativeModule(file, specifier, sourceFiles, resolutionRoots);
        edges.push(Object.freeze({
          source: file,
          specifier,
          target: resolution.target,
          kind: "relative",
          unresolved: resolution.target === undefined,
        }));
      } else {
        edges.push(Object.freeze({
          source: file,
          specifier,
          target: undefined,
          kind: "package",
          unresolved: false,
        }));
      }
    }
  }
  return Object.freeze({
    edges: Object.freeze(edges.sort(compareEdges)),
    modules: Object.freeze(modules.sort((left, right) => left.file.localeCompare(right.file))),
  });
}

export function resolveRelativeModule(sourceFile, specifier, sourceFiles, resolutionRoots) {
  const base = posix.normalize(posix.join(dirname(sourceFile), specifier));
  const roots = resolutionRoots.map(root => posix.normalize(root));
  const bases = new Set([base]);
  for (const root of roots) {
    if (base === root || base.startsWith(`${root}/`)) {
      const relative = posix.relative(root, base);
      for (const destination of roots) bases.add(posix.join(destination, relative));
    }
  }
  const candidates = [];
  for (const candidateBase of bases) {
    const extension = extname(candidateBase);
    if (extension === ".js" || extension === ".mjs" || extension === ".cjs") {
      const stem = candidateBase.slice(0, -extension.length);
      candidates.push(...sourceExtensions.map((candidate) => `${stem}${candidate}`));
      candidates.push(candidateBase);
    } else if (sourceExtensions.includes(extension)) {
      candidates.push(candidateBase);
    } else {
      candidates.push(
        ...sourceExtensions.map((candidate) => `${candidateBase}${candidate}`),
        ...sourceExtensions.map((candidate) => `${candidateBase}/index${candidate}`),
      );
    }
  }
  const matches = candidates.filter((candidate) => sourceFiles.has(candidate));
  return Object.freeze({
    target: matches.length === 1 ? matches[0] : undefined,
    candidates: Object.freeze(candidates),
    ambiguous: matches.length > 1,
  });
}

function checkedFunctionUses(source, sourceFile, sourceFiles, prefix) {
  const ast = source.ast;
  const checker = source.getSourceFileQueries(sourceFile).checker;
  const exports = new Set();
  const reads = new Set();
  const resolve = symbol => {
    if (symbol === undefined) return undefined;
    if (checker.getSymbolDeclarations(symbol).some(node => ["KindImportSpecifier", "KindImportClause", "KindExportSpecifier",
      "KindNamespaceImport", "KindNamespaceExport"].includes(ast.kindName(node)))) symbol = checker.getAliasedSymbol(symbol);
    if (symbol === undefined) return undefined;
    const declaration = checker.getSymbolValueDeclaration(symbol) ?? checker.getPrimarySymbolDeclaration(symbol);
    if (declaration === undefined) return undefined;
    const kind = ast.kindName(declaration);
    if (kind !== "KindFunctionDeclaration" && !(kind === "KindVariableDeclaration" &&
      ["KindArrowFunction", "KindFunctionExpression"].includes(ast.kindName(declaration.Initializer)))) return undefined;
    const file = ast.getFileName(ast.getSourceFile(declaration));
    if (!file.startsWith(prefix) || !sourceFiles.has(file.slice(prefix.length))) return undefined;
    return { declaration, identity: `${file.slice(prefix.length)}#${ast.text(ast.name(declaration))}` };
  };
  const module = checker.getSymbolAtLocation(sourceFile);
  if (module !== undefined) for (const symbol of checker.getExportsOfModule(module)) {
    const target = resolve(symbol);
    if (target !== undefined) exports.add(target.identity);
  }
  const visit = node => {
    if (ast.kindName(node) === "KindIdentifier" || ast.kindName(node) === "KindPropertyAccessExpression") {
      const parent = ast.parent(node);
      const symbol = ast.kindName(parent) === "KindShorthandPropertyAssignment" && ast.name(parent) === node
        ? checker.getLexicallyResolvedSymbol(node) : checker.getSymbolAtLocation(node);
      const target = resolve(symbol);
      if (target !== undefined) {
        let reference = true;
        for (let parent = ast.parent(node); parent !== undefined; parent = ast.parent(parent)) {
          if (parent === target.declaration || ["KindImportDeclaration", "KindExportDeclaration"].includes(ast.kindName(parent))) {
            reference = false;
            break;
          }
        }
        if (reference) reads.add(target.identity);
      }
    }
    ast.forEachChild(node, visit);
  };
  visit(sourceFile);
  return { exports: Object.freeze([...exports].sort()), reads: Object.freeze([...reads].sort()) };
}

function collectModuleSpecifiers(ast, sourceFile) {
  const specifiers = [];
  const visit = (node) => {
    const kind = ast.kindName(node);
    if (kind === "KindImportDeclaration" || kind === "KindExportDeclaration") {
      const reference = getStaticModuleReference(ast, node);
      if (reference !== undefined) {
        specifiers.push({ specifier: ast.text(reference.moduleSpecifier), runtime: reference.hasRuntimeValue });
      }
    } else if (kind === "KindImportType") {
      const specifier = literalModuleSpecifier(ast, ast.as.AsImportTypeNode(node).Argument);
      if (specifier !== undefined) specifiers.push({ specifier, runtime: false });
    } else if (kind === "KindCallExpression") {
      const children = ast.children(node);
      if (
        children.some((child) => ast.kindName(child) === "KindImportKeyword")
      ) {
        const [argument] = ast.arguments(node);
        const specifier = literalModuleSpecifier(ast, argument);
        if (specifier !== undefined) specifiers.push({ specifier, runtime: true });
      }
    }
    ast.forEachChild(node, visit);
  };
  visit(sourceFile);
  return Object.freeze(specifiers);
}

function literalModuleSpecifier(ast, node) {
  let literal = node;
  while (literal !== undefined) {
    const operand = ast.is.IsLiteralTypeNode(literal) ? ast.as.AsLiteralTypeNode(literal).Literal
      : sourceTransparentExpressionOperand(ast, literal);
    if (operand === undefined) break;
    literal = operand;
  }
  return ast.kindName(literal) === "KindStringLiteral" || ast.kindName(literal) === "KindNoSubstitutionTemplateLiteral"
    ? ast.text(literal) : undefined;
}

function compareEdges(left, right) {
  return left.source.localeCompare(right.source) ||
    left.specifier.localeCompare(right.specifier) ||
    (left.target ?? "").localeCompare(right.target ?? "");
}
