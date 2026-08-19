import { dirname, extname, posix } from "node:path";
import { createCompilerSessionFromFiles } from "../../../packages/tsts/dist/src/index.js";

const sourceExtensions = Object.freeze([".ts", ".tsx", ".mts", ".cts"]);

export function buildTypeScriptModuleGraph(sourceFiles) {
  return buildTypeScriptModuleAnalysis(sourceFiles).edges;
}

export function buildTypeScriptModuleAnalysis(sourceFiles) {
  const files = new Map(
    [...sourceFiles].map(([path, text]) => [`/architecture/${path}`, text]),
  );
  const session = createCompilerSessionFromFiles({
    currentDirectory: "/architecture",
    files,
    rootFiles: [...sourceFiles.keys()],
    compilerOptions: {
      allowJs: false,
      module: "esnext",
      moduleResolution: "bundler",
      noLib: true,
      noResolve: true,
      skipLibCheck: true,
      target: "esnext",
    },
  });
  const source = session.checkSource();
  const edges = [];
  const modules = [];
  for (const sourceFile of source.sourceFiles) {
    const absoluteFileName = source.ast.getFileName(sourceFile);
    if (!absoluteFileName.startsWith("/architecture/")) {
      continue;
    }
    const file = absoluteFileName.slice("/architecture/".length);
    modules.push(Object.freeze({
      file,
      topLevelKinds: Object.freeze(
        source.ast.statements(sourceFile)
          .filter((statement) => statement !== undefined)
          .map((statement) => source.ast.kindName(statement)),
      ),
    }));
    for (const specifier of collectModuleSpecifiers(source.ast, sourceFile)) {
      if (specifier.startsWith(".")) {
        const resolution = resolveRelativeModule(file, specifier, sourceFiles);
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

export function resolveRelativeModule(sourceFile, specifier, sourceFiles) {
  const base = posix.normalize(posix.join(dirname(sourceFile), specifier));
  const candidates = [];
  const extension = extname(base);
  if (extension === ".js" || extension === ".mjs" || extension === ".cjs") {
    const stem = base.slice(0, -extension.length);
    candidates.push(...sourceExtensions.map((candidate) => `${stem}${candidate}`));
  } else if (sourceExtensions.includes(extension)) {
    candidates.push(base);
  } else {
    candidates.push(
      ...sourceExtensions.map((candidate) => `${base}${candidate}`),
      ...sourceExtensions.map((candidate) => `${base}/index${candidate}`),
    );
  }
  const matches = candidates.filter((candidate) => sourceFiles.has(candidate));
  return Object.freeze({
    target: matches.length === 1 ? matches[0] : undefined,
    candidates: Object.freeze(candidates),
    ambiguous: matches.length > 1,
  });
}

function collectModuleSpecifiers(ast, sourceFile) {
  const specifiers = [];
  const visit = (node) => {
    const kind = ast.kindName(node);
    if (kind === "KindImportDeclaration" || kind === "KindExportDeclaration") {
      const moduleNode = ast.children(node).find((child) =>
        ast.kindName(child) === "KindStringLiteral"
      );
      if (moduleNode !== undefined) {
        specifiers.push(ast.text(moduleNode));
      }
    } else if (kind === "KindCallExpression") {
      const children = ast.children(node);
      if (
        children.some((child) => ast.kindName(child) === "KindImportKeyword")
      ) {
        const [argument] = ast.arguments(node);
        if (argument !== undefined && ast.kindName(argument) === "KindStringLiteral") {
          specifiers.push(ast.text(argument));
        }
      }
    }
    ast.forEachChild(node, visit);
  };
  visit(sourceFile);
  return Object.freeze(specifiers);
}

function compareEdges(left, right) {
  return left.source.localeCompare(right.source) ||
    left.specifier.localeCompare(right.specifier) ||
    (left.target ?? "").localeCompare(right.target ?? "");
}
