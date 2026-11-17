import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { keelOwnedTargets } from "../architecture/tooling/keel-owned-contracts.mjs";
import { createCompilerSessionFromFiles } from "../../packages/tsts/dist/src/index.js";

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

  // Type declarations reached from the carrier root; only these (and inline type literals) describe carriers.
  const carrierTypes = new Set([carrierDeclarationId(rootDeclaration)]);

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
        if (required) carrierTypes.add(identity);
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
  // A declared result type produces carriers only through an arm that is a carrier type, or an inline structural
  // literal with a carrier kind written in that declared type itself. A named record whose own `kind` happens to equal a
  // carrier kind (a memory layout, a binding fact, a native syntax node union such as `tuple` or `reference` arms, an
  // operation fact with a `closure` arm) is not a carrier: the arms of a named non-carrier alias are its own discriminants.
  function hasCarrierArm(node, module, seen = new Set(), throughNamedRecord = false) {
    const kind = ast.kindName(node);
    if (["KindParenthesizedType", "KindUnionType", "KindIntersectionType"].includes(kind)) {
      return (kind === "KindParenthesizedType" ? [ast.typeNode(node)] : ast.children(node))
        .some(child => child !== undefined && hasCarrierArm(child, module, seen, throughNamedRecord));
    }
    if (kind === "KindTypeLiteral") {
      return !throughNamedRecord && kindsFor(node, module).some(selected => knownKinds.has(selected));
    }
    if (!["KindTypeReference", "KindExpressionWithTypeArguments"].includes(kind)) return false;
    const selected = reference(node, module);
    if (selected === undefined) return false;
    const identity = carrierDeclarationId(selected);
    if (carrierTypes.has(identity)) return true;
    if (seen.has(identity)) return false;
    seen.add(identity);
    const declaration = types.get(identity);
    if (declaration !== undefined && ast.kindName(declaration) === "KindTypeAliasDeclaration") {
      return hasCarrierArm(ast.typeNode(declaration), selected.module, seen, true);
    }
    if (declaration === undefined && selected.module === module && ["Extract", "Exclude", "NonNullable"].includes(selected.symbol)) {
      return hasCarrierArm(ast.typeArguments(node)[0], module, seen, throughNamedRecord);
    }
    return false;
  }
  // An object literal whose checked contextual type is entirely named non-carrier records (for example a pattern or
  // element record passed to a typed producer) constructs that record, whatever its `kind` literal says.
  function declarationIdentity(declarationNode) {
    for (let current = declarationNode; current !== undefined; current = ast.parent(current)) {
      const kind = ast.kindName(current);
      if (kind !== "KindTypeAliasDeclaration" && kind !== "KindInterfaceDeclaration") continue;
      const file = ast.getSourceFile(current);
      return file === undefined ? undefined : carrierDeclarationId({ module: ast.getFileName(file).slice(prefix.length), symbol: ast.text(ast.name(current)) });
    }
    return undefined;
  }
  function namedNonCarrier(type, queries, seen = new Set()) {
    if (type === undefined || seen.has(type)) return false;
    seen.add(type);
    const named = queries.checker.getTypeAliasSymbol(type) ?? queries.checker.getTypeSymbol(type);
    const identities = named === undefined ? [] : queries.checker.getSymbolDeclarations(named).map(declarationIdentity);
    if (identities.length !== 0 && identities.every(identity => identity !== undefined && types.has(identity))) {
      return identities.every(identity => !carrierTypes.has(identity));
    }
    if (!queries.typeShape.isUnion(type)) return false;
    const members = queries.typeShape.getUnionOrIntersectionTypes(type);
    return members.length !== 0 && members.every(member => namedNonCarrier(member, queries, seen));
  }
  function constructsNonCarrierRecord(objectLiteral) {
    const file = ast.getSourceFile(objectLiteral);
    if (file === undefined) return false;
    return namedNonCarrier(source.getSourceFileQueries(file).checker.getContextualType(objectLiteral), source.getSourceFileQueries(file));
  }
  // A checked type is a carrier when it is (an arm of) a carrier type, or an unnamed structural object whose `kind` is a
  // carrier discriminant. Arms of named non-carrier records are not carriers.
  function checkedCarrier(type, queries, seen = new Set()) {
    if (type === undefined || seen.has(type)) return false;
    seen.add(type);
    const named = queries.checker.getTypeAliasSymbol(type) ?? queries.checker.getTypeSymbol(type);
    const identities = named === undefined ? [] : queries.checker.getSymbolDeclarations(named).map(declarationIdentity);
    if (identities.some(identity => identity !== undefined && carrierTypes.has(identity))) return true;
    if (identities.length !== 0 && identities.every(identity => identity !== undefined && types.has(identity))) return false;
    if (queries.typeShape.isUnion(type)) {
      return queries.typeShape.getUnionOrIntersectionTypes(type).some(member => checkedCarrier(member, queries, seen));
    }
    const discriminant = queries.checker.getTypeOfPropertyOfType(type, "kind");
    if (discriminant === undefined) return false;
    return [...queries.checker.typeToString(discriminant).matchAll(/"([^"]*)"/gu)].some(match => knownKinds.has(match[1]));
  }
  // An untyped value produces carriers only when its checked (inferred) value or result type is a carrier.
  function inferredCarrier(node, callable) {
    const name = ast.name(node);
    const file = ast.getSourceFile(node);
    if (name === undefined || file === undefined) return false;
    const queries = source.getSourceFileQueries(file);
    const type = queries.checker.getTypeAtLocation(name);
    if (type === undefined) return false;
    if (callable === undefined) return checkedCarrier(type, queries);
    return (queries.checker.getCallSignaturesOfType(type) ?? [])
      .some(signature => checkedCarrier(queries.checker.getReturnTypeOfSignature(signature), queries));
  }
  const candidates = new Map([...values].filter(([, { declaration, node, callable }]) =>
    ast.typeNode(callable ?? node) === undefined
      ? inferredCarrier(node, callable)
      : hasCarrierArm(ast.typeNode(callable ?? node), declaration.module)));
  const direct = new Set();
  const calls = new Map();
  for (const [identity, { declaration, node, callable }] of candidates) {
    const invoked = new Set();
    walk(callable === undefined ? node.Initializer : ast.body(callable), child => {
      const kind = ast.kindName(child);
      // An object literal or a rest binding (`{ field, ...rest }`) builds a new object; a binding pattern without a rest
      // element only reads fields of an existing value and constructs nothing.
      if (ast.typeNode(callable ?? node) !== undefined && (kind === "KindObjectLiteralExpression" ||
          kind === "KindObjectBindingPattern" && ast.children(child).some(element =>
            ast.children(element).some(token => ast.kindName(token) === "KindDotDotDotToken")))) direct.add(identity);
      const name = ast.name(child);
      if (kind === "KindPropertyAssignment" && name !== undefined &&
          (ast.is.IsIdentifier(name) || ast.is.IsStringLiteral(name)) && ast.text(name) === "kind" &&
          !constructsNonCarrierRecord(ast.parent(child))) {
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
  const declarationBodies = new Map([...values].map(([identity, { node, callable }]) => {
    const selected = callable ?? node;
    const range = ast.authoredRange(selected);
    return [identity, range.kind !== "authored" ? undefined : createHash("sha256")
      .update(ast.getSourceText(ast.getSourceFile(selected)).slice(range.start, range.end)).digest("hex")];
  }));
  return { kinds, contracts, exports, declarationKinds, declarationBodies };
}

// Neutral responsibility keys: "<family>/<name>" in lower-case words, never naming a target.
export const carrierResponsibilityPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)+$/u;
const targetNamePattern = /rust|csharp|c#|clr|dotnet|\.net|cargo|roslyn/iu;

export function validateCarrierRegistry(rows, vocabulary) {
  const failures = [];
  const ids = new Set();
  const contracts = new Map();
  const kinds = new Map();
  const expected = new Set(vocabulary.contracts.map(carrierDeclarationId));
  for (const row of rows) {
    const fields = Object.keys(row).sort();
    if (JSON.stringify(fields) !== JSON.stringify(["declaration", "frozen", "id", "kinds", "responsibility"])) {
      failures.push(`Invalid carrier row fields: ${row.id}`);
    }
    if (ids.has(row.id)) failures.push(`Duplicate carrier identity: ${row.id}`);
    ids.add(row.id);
    const declaration = carrierDeclarationId(row.declaration);
    if (!vocabulary.exports.has(declaration)) failures.push(`Stale carrier declaration: ${declaration}`);
    if (!Array.isArray(row.kinds) || row.kinds.length === 0 || new Set(row.kinds).size !== row.kinds.length ||
        row.kinds.some(kind => !vocabulary.kinds.includes(kind))) failures.push(`Unknown carrier discriminant: ${row.id}`);
    if (typeof row.frozen !== "boolean") failures.push(`Missing freeze classification: ${row.id}`);
    if (typeof row.responsibility !== "string" || !carrierResponsibilityPattern.test(row.responsibility) ||
        targetNamePattern.test(row.responsibility)) failures.push(`Carrier responsibility is not a neutral key: ${row.id}`);
    if (row.id.startsWith("kind:")) {
      const kind = row.id.slice("kind:".length);
      if (row.kinds.length !== 1 || row.kinds[0] !== kind) failures.push(`Invalid structural carrier identity: ${row.id}`);
      if (row.responsibility !== `kinds/${kind}`) failures.push(`Structural carrier responsibility must be kinds/${kind}: ${row.id}`);
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

// Joins the targets' registries by responsibility. A responsibility in one target only needs a shared difference entry
// for that target; an entry for a paired responsibility records a native difference inside the pair. Every entry names
// the row it explains (target, responsibility and declaration symbol), a signed register difference and a reason.
export function validateCarrierParity(registries, differences, signedDifferences) {
  const failures = [];
  const keys = new Map(Object.entries(registries).map(([target, registry]) =>
    [target, new Set([...registry.rows.map(row => row.responsibility),
      ...registry.roles.map(role => role.carrierResponsibility)])]));
  const explained = new Set();
  const seen = new Set();
  for (const entry of differences) {
    const label = `${entry.target}:${entry.responsibility}`;
    const row = `${label}:${entry.symbol}`;
    if (seen.has(row)) failures.push(`Duplicate carrier difference: ${row}`);
    seen.add(row);
    explained.add(label);
    if (!keys.has(entry.target)) failures.push(`Carrier difference names an unknown target: ${label}`);
    else if (!registries[entry.target].rows.some(candidate => candidate.responsibility === entry.responsibility &&
      candidate.declaration.symbol === entry.symbol)) failures.push(`Stale carrier difference: ${label}`);
    if (!signedDifferences.has(entry.register) || typeof entry.reason !== "string" || entry.reason.trim().length === 0) {
      failures.push(`Unproved native carrier difference: ${label}`);
    }
  }
  for (const [target, own] of keys) {
    for (const responsibility of own) {
      const paired = [...keys].some(([other, set]) => other !== target && set.has(responsibility));
      if (!paired && !explained.has(`${target}:${responsibility}`)) {
        failures.push(`Unexplained one-sided carrier responsibility: ${target}:${responsibility}`);
      }
    }
  }
  return failures;
}

// Carrier registries are test and audit data under test/target-model/types/carriers/registry/. Product source must
// neither contain nor consume them.
export function productCarrierRegistryReferences(files) {
  return [...files].filter(([, text]) => /\bTargetCarrierRegistryEntry\b|\bcarrierRegistry\b|CarrierRegistry\b|carriers\/registry/u.test(text))
    .map(([file]) => file);
}

export async function loadCarrierRegistry(root) {
  const files = await readCarrierRegistrySourceFiles(root);
  const vocabulary = deriveCarrierVocabulary(files, { module: "src/target-model/types/model.ts", symbol: "TargetTypeRef" });
  const roles = keelOwnedTargets[path.basename(root)].functions.filter(role => role.carrierResponsibility !== undefined);
  for (const role of roles) {
    const identity = carrierDeclarationId({ module: role.file, symbol: role.symbol });
    if (role.role !== "analysis" || !carrierResponsibilityPattern.test(role.carrierResponsibility) ||
      vocabulary.declarationBodies.get(identity) !== role.bodySha256)
      throw new Error(`Stale checked carrier responsibility: ${identity}`);
  }
  const { carrierRegistry } = await import(pathToFileURL(path.join(root, "test/target-model/types/carriers/registry/index.mjs")).href);
  return { files, vocabulary, rows: carrierRegistry, roles };
}
