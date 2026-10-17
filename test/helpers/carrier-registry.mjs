import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createCompilerSessionFromFiles } from "../../packages/tsts/dist/src/index.js";
import { analyzeCheckedTypeScriptModules } from "../architecture/tooling/module-graph.mjs";

export const carrierDeclarationId = declaration => `${declaration.module}#${declaration.symbol}`;

export async function readCarrierModelFiles(root) {
  return readCarrierTypeScriptFiles(root, "src/target-model/types");
}

export async function readCarrierRegistrySourceFiles(root) {
  return readCarrierTypeScriptFiles(root, "src");
}

async function readCarrierTypeScriptFiles(root, directory) {
  const files = new Map();
  async function visit(directory) {
    for (const entry of await readdir(path.join(root, directory), { withFileTypes: true })) {
      const file = path.posix.join(directory, entry.name);
      if (entry.isDirectory()) await visit(file);
      else if (entry.isFile() && file.endsWith(".ts")) {
        files.set(file, await readFile(path.join(root, file), "utf8"));
      }
    }
  }
  await visit(directory);
  return files;
}

export async function readCarrierDivergenceRegister() {
  const text = await readFile(new URL("../../docs/architecture/csharp-rust-structure.md", import.meta.url), "utf8");
  return new Set([...text.matchAll(/^\| (S11-\d+|V-\d+) \|/gmu)].map(match => match[1]));
}

export function inspectCarrierRegistrySource(files, signedDifferences) {
  const sources = new Map(files);
  const failures = [];
  const prefix = "/carrier-registry-source/";
  const session = createCompilerSessionFromFiles({
    currentDirectory: prefix.slice(0, -1),
    files: new Map([...files].map(([file, text]) => [`${prefix}${file}`, text])),
    rootFiles: [...files.keys()],
    compilerOptions: { module: "esnext", moduleResolution: "bundler", target: "esnext", noLib: true, noResolve: true },
  });
  if (session.getDiagnostics("syntactic").length !== 0) {
    return { sources, failures: ["Carrier registry source has invalid syntax."], modules: [] };
  }
  const source = session.checkSource();
  const { ast } = source;
  const modules = new Map();

  function fields(node, required, optional = []) {
    if (node === undefined || !ast.is.IsObjectLiteralExpression(node)) return undefined;
    const result = new Map();
    for (const property of ast.properties(node)) {
      if (!ast.is.IsPropertyAssignment(property)) return undefined;
      const name = ast.name(property);
      if (name === undefined || !ast.is.IsIdentifier(name) && !ast.is.IsStringLiteral(name)) return undefined;
      const key = ast.text(name);
      if (result.has(key) || !required.includes(key) && !optional.includes(key)) return undefined;
      result.set(key, ast.as.AsPropertyAssignment(property).Initializer);
    }
    return required.every(key => result.has(key)) ? result : undefined;
  }

  function literal(node) {
    return node !== undefined && ast.is.IsStringLiteral(node) && ast.text(node).trim().length > 0;
  }

  function declaration(node) {
    const selected = fields(node, ["module", "symbol"]);
    return selected !== undefined && [...selected.values()].every(literal) ? selected : undefined;
  }

  function rowRanges(node) {
    const row = fields(node, ["id", "kinds", "declaration", "counterpart", "frozen"], ["divergence"]);
    if (row === undefined || !literal(row.get("id")) || !ast.is.IsArrayLiteralExpression(row.get("kinds")) ||
        !ast.elements(row.get("kinds")).every(literal) || declaration(row.get("declaration")) === undefined ||
        !["KindTrueKeyword", "KindFalseKeyword"].includes(ast.kindName(row.get("frozen")))) return undefined;
    const ranges = [];
    if (ast.kindName(row.get("counterpart")) !== "KindNullKeyword") {
      const counterpart = declaration(row.get("counterpart"));
      if (counterpart === undefined) return undefined;
      ranges.push(...[...counterpart.values()].map(value => ast.authoredRange(value)));
    }
    if (row.has("divergence")) {
      const divergence = fields(row.get("divergence"), ["register", "reason"]);
      if (divergence === undefined || ![...divergence.values()].every(literal) ||
          !signedDifferences.has(ast.text(divergence.get("register")))) return undefined;
      ranges.push(ast.authoredRange(divergence.get("reason")));
    }
    return ranges.every(range => range.kind === "authored") ? ranges : undefined;
  }

  for (const sourceFile of source.sourceFiles) {
    const file = ast.getFileName(sourceFile).slice(prefix.length);
    if (!files.has(file)) continue;
    const statements = ast.statements(sourceFile);
    const imports = statements.filter(statement => ast.is.IsImportDeclaration(statement));
    const registryImports = imports.flatMap(statement => {
      const imported = ast.as.AsImportDeclaration(statement);
      if (ast.text(imported.ModuleSpecifier) !== "@tsonic/target-api" ||
          imported.ImportClause?.NamedBindings === undefined) return [];
      return ast.children(imported.ImportClause?.NamedBindings).filter(specifier =>
        ast.is.IsImportSpecifier(specifier) &&
        ast.text(ast.as.AsImportSpecifier(specifier).PropertyName ?? ast.name(specifier)) === "TargetCarrierRegistryEntry")
        .map(specifier => ({ statement, name: ast.text(ast.name(specifier)) }));
    });
    if (registryImports.length === 0) continue;
    const reject = () => failures.push(`Carrier registry source is not inert declared metadata: ${file}`);
    const body = statements.filter(statement => !ast.is.IsImportDeclaration(statement));
    if (registryImports.length !== 1 || !ast.isTypeOnlyImportDeclaration(registryImports[0].statement) ||
        body.length !== 1 || !ast.is.IsVariableStatement(body[0]) || !ast.hasModifierKind(body[0], "export") ||
        ast.variableDeclarationKind(body[0]) !== "const") { reject(); continue; }
    const declarations = ast.as.AsVariableStatement(body[0]).DeclarationList.Declarations.Nodes;
    if (declarations.length !== 1) { reject(); continue; }
    const selected = declarations[0];
    const qualifiedType = ast.typeNode(selected);
    const arrayType = ast.kindName(qualifiedType) === "KindTypeOperator" ? ast.typeNode(qualifiedType) : qualifiedType;
    const entryType = arrayType !== undefined && ast.is.IsArrayTypeNode(arrayType)
      ? ast.as.AsArrayTypeNode(arrayType).ElementType : undefined;
    const entryName = entryType === undefined ? undefined : ast.children(entryType).find(child => ast.is.IsIdentifier(child));
    const initializer = selected.Initializer;
    const call = initializer === undefined ? undefined : ast.as.AsCallExpression(initializer);
    const callee = call === undefined ? undefined : ast.as.AsPropertyAccessExpression(call.Expression);
    const [array] = call === undefined ? [] : ast.arguments(initializer);
    if (ast.name(selected) === undefined || !ast.is.IsIdentifier(ast.name(selected)) || ast.text(ast.name(selected)) === "Object" ||
        entryType === undefined || !ast.is.IsTypeReferenceNode(entryType) || ast.text(entryName) !== registryImports[0].name ||
        ast.typeArguments(entryType).length !== 1 || call === undefined || call.QuestionDotToken !== undefined ||
        callee === undefined || callee.QuestionDotToken !== undefined || !ast.is.IsIdentifier(callee.Expression) ||
        ast.text(callee.Expression) !== "Object" || ast.text(ast.name(callee)) !== "freeze" ||
        ast.arguments(initializer).length !== 1 || ast.typeArguments(initializer).length !== 0 ||
        !ast.is.IsArrayLiteralExpression(array)) { reject(); continue; }
    const elements = ast.elements(array);
    const aggregate = elements.length > 0 && elements.every(element => ast.is.IsSpreadElement(element) &&
      ast.is.IsIdentifier(ast.as.AsSpreadElement(element).Expression));
    const runtimeImports = imports.filter(statement => !ast.isTypeOnlyImportDeclaration(statement));
    const typeImportsValid = imports.filter(statement => ast.isTypeOnlyImportDeclaration(statement)).every(statement => {
      const imported = ast.as.AsImportDeclaration(statement);
      const module = ast.text(imported.ModuleSpecifier);
      const expected = module === "@tsonic/target-api" ? "TargetCarrierRegistryEntry"
        : module === "../model.js" ? "TargetTypeRef" : undefined;
      const bindings = imported.ImportClause?.NamedBindings;
      return expected !== undefined && imported.ImportClause.name === undefined && bindings !== undefined &&
        ast.children(bindings).length > 0 && ast.children(bindings).every(specifier =>
          ast.is.IsImportSpecifier(specifier) &&
          ast.text(ast.as.AsImportSpecifier(specifier).PropertyName ?? ast.name(specifier)) === expected);
    });
    if (!typeImportsValid || !aggregate && runtimeImports.length !== 0) { reject(); continue; }
    const ranges = aggregate ? [] : elements.map(rowRanges);
    if (ranges.some(value => value === undefined)) { reject(); continue; }
    modules.set(file, { aggregate, ranges: ranges.flat(), runtimeSpecifiers: new Set(runtimeImports.map(statement =>
      ast.text(ast.as.AsImportDeclaration(statement).ModuleSpecifier))) });
  }

  const analysis = analyzeCheckedTypeScriptModules(source, files, prefix);
  for (const edge of analysis.edges) {
    if (modules.has(edge.target) && !modules.get(edge.source)?.aggregate) {
      failures.push(`Production consumer of carrier registry metadata: ${edge.source}`);
    }
    if (modules.get(edge.source)?.aggregate && modules.get(edge.source).runtimeSpecifiers.has(edge.specifier) &&
        !modules.has(edge.target)) {
      failures.push(`Carrier registry aggregate imports non-metadata: ${edge.source}`);
    }
  }
  if (failures.length === 0) {
    for (const [file, metadata] of modules) {
      let text = files.get(file);
      for (const range of metadata.ranges.sort((left, right) => right.start - left.start)) {
        text = text.slice(0, range.start) + " ".repeat(range.end - range.start) + text.slice(range.end);
      }
      sources.set(file, text);
    }
  }
  return { sources, failures, modules: [...modules.keys()] };
}

export function deriveCarrierVocabulary(files, rootDeclaration) {
  const prefix = "/carrier-registry/";
  const session = createCompilerSessionFromFiles({
    currentDirectory: prefix.slice(0, -1),
    files: new Map([...files].map(([file, text]) => [`${prefix}${file}`, text])),
    rootFiles: [...files.keys()],
    compilerOptions: { module: "esnext", moduleResolution: "bundler", target: "esnext", noLib: true },
  });
  if (session.getDiagnostics("syntactic").length !== 0) throw new Error("Carrier vocabulary has invalid syntax.");
  const source = session.checkSource();
  const ast = source.ast;
  const declarations = new Map();
  const exports = new Set();
  const aliases = new Map();
  const values = new Map();
  const types = new Map();

  function walk(node, visit) {
    if (visit(node) === false) return;
    ast.forEachChild(node, child => walk(child, visit));
  }

  function exported(node) {
    for (let current = node; current !== undefined; current = ast.parent(current)) {
      if (current !== node && ast.kindName(current) === "KindFunctionDeclaration") return false;
      if (ast.hasModifierKind(current, "export")) return true;
    }
    return false;
  }

  for (const file of source.sourceFiles) {
    const module = ast.getFileName(file).slice(prefix.length);
    if (!files.has(module)) continue;
    walk(file, node => {
      const kind = ast.kindName(node);
      if (kind === "KindImportDeclaration") {
        const specifier = ast.children(node).find(child => ast.kindName(child) === "KindStringLiteral");
        const importedModule = ast.text(specifier);
        if (!importedModule.startsWith(".")) return false;
        const imported = path.posix.normalize(path.posix.join(path.posix.dirname(module), importedModule.replace(/\.js$/u, ".ts")));
        walk(node, child => {
          if (ast.kindName(child) !== "KindImportSpecifier") return;
          const identifiers = ast.children(child).filter(item => ast.kindName(item) === "KindIdentifier");
          aliases.set(`${module}#${ast.text(ast.name(child))}`, {
            module: imported,
            symbol: ast.text(identifiers[0]),
          });
        });
        return false;
      }
      if (!["KindTypeAliasDeclaration", "KindInterfaceDeclaration", "KindFunctionDeclaration", "KindVariableDeclaration"].includes(kind)) return;
      const name = ast.name(node);
      if (ast.kindName(name) !== "KindIdentifier") return;
      const declaration = { module, symbol: ast.text(name) };
      const identity = carrierDeclarationId(declaration);
      declarations.set(identity, { declaration, node });
      if (exported(node)) exports.add(identity);
      if (["KindTypeAliasDeclaration", "KindInterfaceDeclaration"].includes(kind)) types.set(identity, node);
      if (kind === "KindFunctionDeclaration") values.set(identity, { declaration, node, callable: node });
      if (kind === "KindVariableDeclaration") {
        const initializer = node.Initializer;
        const callable = ["KindArrowFunction", "KindFunctionExpression"].includes(ast.kindName(initializer)) ? initializer : undefined;
        values.set(identity, { declaration, node, callable });
      }
      if (["KindFunctionDeclaration", "KindVariableDeclaration"].includes(kind)) return false;
    });
  }

  function reference(node, module) {
    const identifier = ast.kindName(node) === "KindIdentifier" ? node
      : ast.children(node).find(child => ast.kindName(child) === "KindIdentifier");
    if (identifier === undefined) return undefined;
    const symbol = ast.text(identifier);
    return aliases.get(`${module}#${symbol}`) ?? { module, symbol };
  }

  function kindsFor(node, module, seen = new Set(), required = false) {
    const kind = ast.kindName(node);
    if (["KindTypeAliasDeclaration", "KindParenthesizedType"].includes(kind)) {
      return kindsFor(ast.typeNode(node), module, seen, required);
    }
    if (["KindUnionType", "KindIntersectionType"].includes(kind)) {
      return ast.children(node).flatMap(child => kindsFor(child, module, new Set(seen), required));
    }
    if (["KindTypeLiteral", "KindInterfaceDeclaration"].includes(kind)) {
      const result = [];
      for (const member of ast.members(node)) {
        if (ast.text(ast.name(member)) !== "kind") continue;
        walk(ast.typeNode(member), child => {
          if (ast.kindName(child) === "KindStringLiteral") result.push(ast.text(child));
        });
      }
      if (kind === "KindInterfaceDeclaration") {
        for (const base of ast.extendsHeritageElements(node)) result.push(...kindsFor(base, module, new Set(seen), required));
      }
      if (required && result.length === 0) throw new Error("Carrier vocabulary has an unproved structural arm.");
      return result;
    }
    if (["KindTypeReference", "KindExpressionWithTypeArguments"].includes(kind)) {
      const selected = reference(node, module);
      if (selected === undefined) {
        if (required) throw new Error("Carrier vocabulary has an unresolved type reference.");
        return [];
      }
      const identity = carrierDeclarationId(selected);
      if (seen.has(identity)) {
        if (required) throw new Error("Carrier vocabulary has a recursive structural alias.");
        return [];
      }
      const declaration = types.get(identity);
      if (declaration !== undefined) {
        seen.add(identity);
        return kindsFor(declaration, selected.module, seen, required);
      }
      if (selected.module === module && ["Extract", "Exclude", "NonNullable"].includes(selected.symbol)) {
        return kindsFor(ast.typeArguments(node)[0], module, seen, required);
      }
    }
    if (required) throw new Error("Carrier vocabulary has an unproved structural arm.");
    return [];
  }

  const root = types.get(carrierDeclarationId(rootDeclaration));
  if (root === undefined) throw new Error("Carrier vocabulary root does not exist.");
  const kinds = [...new Set(kindsFor(root, rootDeclaration.module, new Set(), true))].sort();
  if (kinds.length === 0) throw new Error("Carrier vocabulary root has no discriminants.");
  const knownKinds = new Set(kinds);
  const candidates = new Map([...values].filter(([, { declaration, node, callable }]) =>
    ast.typeNode(callable ?? node) === undefined ||
    kindsFor(ast.typeNode(callable ?? node), declaration.module).some(kind => knownKinds.has(kind))));
  const direct = new Set();
  const calls = new Map();
  for (const [identity, { declaration, node, callable }] of candidates) {
    const invoked = new Set();
    walk(callable === undefined ? node.Initializer : ast.body(callable), child => {
      const kind = ast.kindName(child);
      if (ast.typeNode(callable ?? node) !== undefined &&
          ["KindObjectLiteralExpression", "KindObjectBindingPattern"].includes(kind)) direct.add(identity);
      if (kind === "KindPropertyAssignment" && ast.text(ast.name(child)) === "kind") {
        walk(child.Initializer, value => {
          if (ast.kindName(value) === "KindStringLiteral" && knownKinds.has(ast.text(value))) direct.add(identity);
        });
      }
      if (kind === "KindCallExpression") {
        const selected = reference(child.Expression, declaration.module);
        if (selected !== undefined) invoked.add(carrierDeclarationId(selected));
      }
    });
    calls.set(identity, invoked);
  }
  function constructs(identity, seen = new Set()) {
    if (direct.has(identity)) return true;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return [...calls.get(identity) ?? []].some(called => constructs(called, new Set(seen)));
  }
  const contracts = [...candidates].filter(([identity]) => exports.has(identity) && constructs(identity))
    .map(([, { declaration }]) => declaration);
  const declarationKinds = new Map([...types].filter(([identity]) => exports.has(identity)).map(([identity, node]) =>
    [identity, [...new Set(kindsFor(node, declarations.get(identity).declaration.module))].filter(kind => knownKinds.has(kind))]));
  return { kinds, contracts, exports, declarationKinds };
}

export function validateCarrierRegistry(rows, vocabulary) {
  const failures = [];
  const ids = new Set();
  const contracts = new Map();
  const kinds = new Map();
  const expected = new Set(vocabulary.contracts.map(carrierDeclarationId));
  for (const row of rows) {
    const fields = Object.keys(row).sort();
    const expectedFields = ["counterpart", "declaration", ...(row.divergence === undefined ? [] : ["divergence"]), "frozen", "id", "kinds"].sort();
    if (JSON.stringify(fields) !== JSON.stringify(expectedFields)) failures.push(`Invalid carrier row fields: ${row.id}`);
    if (ids.has(row.id)) failures.push(`Duplicate carrier identity: ${row.id}`);
    ids.add(row.id);
    const declaration = carrierDeclarationId(row.declaration);
    if (!vocabulary.exports.has(declaration)) failures.push(`Stale carrier declaration: ${declaration}`);
    if (!Array.isArray(row.kinds) || row.kinds.length === 0 || new Set(row.kinds).size !== row.kinds.length ||
        row.kinds.some(kind => !vocabulary.kinds.includes(kind))) failures.push(`Unknown carrier discriminant: ${row.id}`);
    if (typeof row.frozen !== "boolean") failures.push(`Missing freeze classification: ${row.id}`);
    if (row.id.startsWith("kind:")) {
      const kind = row.id.slice("kind:".length);
      if (row.kinds.length !== 1 || row.kinds[0] !== kind) failures.push(`Invalid structural carrier identity: ${row.id}`);
      kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
    } else {
      if (row.id !== declaration || !expected.has(declaration)) failures.push(`Unknown concrete carrier contract: ${row.id}`);
      contracts.set(declaration, (contracts.get(declaration) ?? 0) + 1);
    }
  }
  for (const kind of vocabulary.kinds) {
    if (kinds.get(kind) !== 1) failures.push(`Structural carrier must have one owner: ${kind}`);
  }
  for (const declaration of expected) {
    if (contracts.get(declaration) !== 1) failures.push(`Concrete carrier must have one owner: ${declaration}`);
  }
  return failures;
}

export function validateCarrierRegistrySymmetry(left, right, signedDifferences) {
  const failures = [];
  for (const [current, counterpart] of [[left, right], [right, left]]) {
    const opposite = new Set(counterpart.rows.map(row => carrierDeclarationId(row.declaration)));
    for (const row of current.rows) {
      if ((row.counterpart === null || row.id.startsWith("kind:") && !counterpart.vocabulary.kinds.includes(row.kinds[0])) &&
          row.divergence === undefined) failures.push(`Unexplained one-sided carrier: ${row.id}`);
      if (row.counterpart !== null) {
        const selected = carrierDeclarationId(row.counterpart);
        if (!counterpart.vocabulary.exports.has(selected) || !opposite.has(selected)) failures.push(`Missing carrier counterpart: ${row.id}`);
        if (row.id.startsWith("kind:") && counterpart.vocabulary.kinds.includes(row.kinds[0]) &&
            !counterpart.vocabulary.declarationKinds.get(selected)?.includes(row.kinds[0]) &&
            !counterpart.rows.some(candidate => carrierDeclarationId(candidate.declaration) === selected &&
              candidate.kinds.includes(row.kinds[0]))) {
          failures.push(`Structural carrier counterpart kind mismatch: ${row.id}`);
        }
      }
      if (row.divergence !== undefined && (!signedDifferences.has(row.divergence.register) ||
          typeof row.divergence.reason !== "string" || row.divergence.reason.trim().length === 0)) {
        failures.push(`Unproved native carrier difference: ${row.id}`);
      }
    }
  }
  return failures;
}

export async function loadCarrierRegistry(root) {
  const files = await readCarrierModelFiles(root);
  const vocabulary = deriveCarrierVocabulary(files, { module: "src/target-model/types/model.ts", symbol: "TargetTypeRef" });
  const { carrierRegistry } = await import(pathToFileURL(path.join(root, "dist/target-model/types/carriers/registry.js")).href);
  return { files, vocabulary, rows: carrierRegistry };
}
