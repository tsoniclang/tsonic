// @ts-check
import { readFileSync, realpathSync } from "node:fs";
import { isBuiltin } from "node:module";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { hostModules } from "./host-modules.mjs";
import { buildTypeScriptModuleAnalysis } from "./module-graph.mjs";
import { publicModuleDependency } from "./public-declarations.mjs";
import { checkerImportFindings, moduleLifetimeFindings } from "./source-boundaries.mjs";
import { readArchitectureTypeScript } from "./typescript-source.mjs";
import { SymbolFlagsAlias } from "../../../packages/tsts/dist/src/index.js";

const retiredPackages = Object.freeze(["@tsonic/target-api", "@tsonic/source-core", "@tsonic/js-source-profile"]);
const retiredMembers = Object.freeze(["effectiveTypes", "semantics", "sourceFacts", "typeFor", "emptyBindings",
  "storageAnalysis", "sealFormalMemberWriteDemands", "createTargetSourceProgram", "readCsharpRawLocation"]);
const producerMembers = Object.freeze(["builder", "interner", "seed", "register", "sealRegistration", "solve",
  "produce", "producer", "seal", "set", "delete", "clear", "resourceScope", "evidence", "intern"]);

/** @param {string} file */
function owner(file) {
  return hostModules.find(module => file.startsWith(`${module.directory}/`) &&
    !file.slice(module.directory.length + 1).includes("/"));
}

/** @param {string | undefined} file @param {(typeof hostModules)[number]} module */
function contract(file, module) {
  return file === module.contract || file === module.contract.replace(/\.ts$/u, ".d.ts");
}

/** @param {string} root @param {string} file */
function safeFile(root, file) {
  if (typeof file !== "string" || file.length === 0 || isAbsolute(file) || file.includes("\\") ||
    file.split("/").some(part => part === ".." || part === "." || part.length === 0))
    throw new Error("Host gate inputs require canonical repository-relative file paths.");
  const path = realpathSync(resolve(root, file));
  const child = relative(root, path);
  if (child === ".." || child.startsWith(`..${sep}`) || isAbsolute(child)) throw new Error("Host gate input escapes its root.");
  return path;
}

/** @type {(input: import("./host-gates.mjs").HostGateInput) => readonly import("./host-gates.mjs").HostGateFinding[]} */
export const inspectHostStructure = input => {
  const root = realpathSync(input.root);
  if (!Array.isArray(input.files) || !Array.isArray(input.declarationFiles) ||
    new Set(input.files).size !== input.files.length || new Set(input.declarationFiles).size !== input.declarationFiles.length)
    throw new Error("Host gate inputs require complete distinct source and declaration vectors.");
  const files = new Map([...new Set([...input.files, ...input.declarationFiles])].map(file =>
    [file, readFileSync(safeFile(root, file), "utf8")]));
  const declarations = new Set(input.declarationFiles);
  const source = readArchitectureTypeScript(files);
  const { ast } = source;
  /** @param {import("../../../packages/tsts/dist/src/index.js").Node} node */
  const productionMember = node => {
    const name = ast.name(node);
    const type = ast.typeNode(node);
    return name !== undefined && producerMembers.includes(ast.text(name)) &&
      (ast.is.IsMethodSignatureDeclaration(node) || type !== undefined && ast.is.IsFunctionTypeNode(type));
  };
  const analysis = buildTypeScriptModuleAnalysis(files);
  /** @type {import("./host-gates.mjs").HostGateFinding[]} */
  const findings = [];
  /** @param {import("./host-gates.mjs").HostGate} gate @param {string} file @param {import("../../../packages/tsts/dist/src/index.js").Node | undefined} node @param {string} message */
  const add = (gate, file, node, message) => {
    const range = node === undefined ? undefined : ast.authoredRange(node);
    if (range !== undefined && range.kind !== "authored") throw new Error("Architecture findings require an actual authored input site.");
    const start = range === undefined ? 0 : range.start;
    if (!findings.some(finding => finding.gate === gate && finding.file === file && finding.start === start && finding.message === message))
      findings.push(Object.freeze({ gate, file, start, message }));
  };
  const sourceFiles = new Map(source.sourceFiles.map(file => {
    if (file === undefined) throw new Error("Architecture inputs require every actual parsed source file.");
    return [ast.getFileName(file).slice("/architecture/".length), file];
  }));
  /** @param {string} file @param {string} specifier */
  const site = (file, specifier) => {
    /** @type {import("../../../packages/tsts/dist/src/index.js").Node | undefined} */
    let found;
    /** @param {import("../../../packages/tsts/dist/src/index.js").Node | undefined} node */
    const visit = node => {
      if (found !== undefined || node === undefined) return;
      const dependency = publicModuleDependency(ast, node);
      if (dependency !== undefined && ast.text(dependency.specifier) === specifier) { found = node; return; }
      if (ast.is.IsCallExpression(node) && ast.kindName(ast.as.AsCallExpression(node)?.Expression) === "KindImportKeyword" &&
        ast.arguments(node).some(argument => ast.text(argument) === specifier)) { found = node; return; }
      ast.forEachChild(node, visit);
    };
    visit(sourceFiles.get(file));
    return found;
  };

  for (const edge of analysis.edges) {
    const from = owner(edge.source), to = edge.target === undefined ? undefined : owner(edge.target);
    const node = site(edge.source, edge.specifier);
    const external = from === undefined && !edge.source.startsWith("packages/");
    const publicContract = to?.name === "publication" && contract(edge.target, to);
    if (retiredPackages.some(name => edge.specifier === name || edge.specifier.startsWith(`${name}/`)))
      add("retired-api", edge.source, node, "A retired semantic package cannot resolve as a current Host contract.");
    if (external && !isBuiltin(edge.specifier) && !publicContract &&
      (edge.kind === "relative" || edge.specifier.startsWith("@tsonic/")))
      add("publication-consumer", edge.source, node, "External consumers may depend only on the Publication contract.");
    if (edge.kind === "relative" && edge.unresolved) {
      add("isolated-compile", edge.source, node, "A relative dependency must resolve uniquely within the supplied current module and contracts.");
      continue;
    }
    if (from !== undefined && to !== undefined && (contract(edge.source, from) || declarations.has(edge.source)) && !contract(edge.target, to))
      add("contract-closure", edge.source, node, "A declaration contract cannot close over an implementation.");
    if (from === undefined || to === undefined || from === to) continue;
    const registration = from.name === "orchestration" && edge.target === to.registration;
    if (!contract(edge.target, to) && !registration)
      add("contract-imports", edge.source, node, "Peer implementations are private; use the declared contract port.");
    if (to.layer > from.layer || !from.dependencies.includes(to.name) && !registration)
      add("layers", edge.source, node, "This module does not declare that lower or peer contract dependency.");
  }

  /** @type {Set<import("../../../packages/tsts/dist/src/index.js").Symbol>} */
  const rawSymbols = new Set();
  /** @type {Set<import("../../../packages/tsts/dist/src/index.js").Symbol>} */
  const productionSymbols = new Set();
  /** @type {Map<import("../../../packages/tsts/dist/src/index.js").Symbol, import("../../../packages/tsts/dist/src/index.js").Node>} */
  const aliases = new Map();
  /** @param {import("../../../packages/tsts/dist/src/index.js").Node} node */
  const checker = node => {
    const file = ast.getSourceFile(node);
    if (file === undefined) throw new Error("An architecture reference requires its original source file.");
    return source.getSourceFileQueries(file).checker;
  };
  /** @param {import("../../../packages/tsts/dist/src/index.js").Node | undefined} node */
  const symbol = node => {
    if (node === undefined) return undefined;
    const queries = checker(node);
    let selected = queries.getSymbolAtLocation(node);
    const active = new Set();
    while (selected !== undefined && (selected.Flags & SymbolFlagsAlias) !== 0) {
      if (active.has(selected)) throw new Error("An architecture alias chain cannot cycle.");
      active.add(selected);
      const original = queries.getAliasedSymbol(selected);
      if (original === undefined || !queries.getSymbolDeclarations(original).some(node => node !== undefined)) break;
      selected = original;
    }
    return selected;
  };
  for (const [file, node] of sourceFiles) {
    const module = owner(file);
    if (module === undefined && file.startsWith("packages/"))
      add("directory-ownership", file, undefined, "Product implementation must belong to exactly one declared module directory.");
    if (module === undefined) continue;
    for (const finding of checkerImportFindings(source, node)) {
      add("ingress-checker", file, undefined, finding.rule);
    }
    for (const finding of moduleLifetimeFindings(source, node, { immutableData: true })) {
      add("program-lifetime", file, undefined, finding.rule);
    }
    /** @param {import("../../../packages/tsts/dist/src/index.js").Node | undefined} current */
    const collect = current => {
      if (current === undefined) return;
      const dependency = publicModuleDependency(ast, current);
      if (dependency !== undefined && (ast.text(dependency.specifier) === "@tsonic/tsts" ||
        ast.text(dependency.specifier).startsWith("@tsonic/tsts/"))) {
        /** @param {import("../../../packages/tsts/dist/src/index.js").Node | undefined} child */
        const gather = child => {
          if (child === undefined) return;
          if (ast.is.IsIdentifier(child)) {
            const selected = symbol(child);
            if (selected !== undefined) rawSymbols.add(selected);
          }
          ast.forEachChild(child, gather);
        };
        gather(current);
      }
      if (ast.is.IsTypeAliasDeclaration(current) || ast.is.IsInterfaceDeclaration(current) || ast.is.IsClassDeclaration(current)) {
        const selected = symbol(ast.name(current));
        if (selected !== undefined) aliases.set(selected, current);
      }
      ast.forEachChild(current, collect);
    };
    collect(node);
  }
  for (let previous = -1; previous !== rawSymbols.size + productionSymbols.size;) {
    previous = rawSymbols.size + productionSymbols.size;
    for (const [selected, node] of aliases) {
      let raw = false, production = false;
      /** @param {import("../../../packages/tsts/dist/src/index.js").Node | undefined} current */
      const visit = current => {
        if (current === undefined) return;
        const reference = symbol(current);
        if (ast.is.IsIdentifier(current) && reference !== undefined && rawSymbols.has(reference)) raw = true;
        if (ast.is.IsIdentifier(current) && reference !== undefined && productionSymbols.has(reference)) production = true;
        if (productionMember(current)) production = true;
        ast.forEachChild(current, visit);
      };
      const type = ast.typeNode(node);
      if (type !== undefined) visit(type);
      else for (const member of ast.members(node)) visit(member);
      if (raw) rawSymbols.add(selected);
      if (production) productionSymbols.add(selected);
    }
  }

  for (const [file, node] of sourceFiles) {
    const module = owner(file);
    if (module === undefined) continue;
    const isContract = contract(file, module) || declarations.has(file);
    const publication = module.name === "publication";
    const rawAllowed = module.name === "ingress" && !isContract;
    /** @type {Set<import("../../../packages/tsts/dist/src/index.js").Symbol>} */
    const imports = new Set();
    /** @param {import("../../../packages/tsts/dist/src/index.js").Node | undefined} current */
    const visit = current => {
      if (current === undefined) return;
      const kind = ast.kindName(current);
      if (ast.is.IsImportSpecifier(current) || ast.is.IsExportSpecifier(current)) {
        const selected = ast.is.IsImportSpecifier(current) ? ast.as.AsImportSpecifier(current) : ast.as.AsExportSpecifier(current);
        if (selected?.PropertyName !== undefined && ast.text(selected.PropertyName) !== ast.text(ast.name(current)))
          add("one-current-name", file, current, "Renamed import and export bindings create a second current name.");
        if (ast.is.IsImportSpecifier(current)) {
          const binding = symbol(ast.name(current));
          if (binding !== undefined) imports.add(binding);
        }
      }
      if (ast.is.IsExportDeclaration(current)) {
        const selected = ast.as.AsExportDeclaration(current);
        if (selected?.ExportClause === undefined || ast.is.IsNamespaceExport(selected.ExportClause))
          add("one-current-name", file, current, "Wildcard and namespace forwarding facades are not an owner contract.");
      }
      if (["KindAnyKeyword", "KindAsExpression", "KindTypeAssertionExpression", "KindNonNullExpression", "KindEnumDeclaration",
        "KindModuleDeclaration", "KindImportEqualsDeclaration", "KindExportAssignment"].includes(kind))
        add("strict-source", file, current, "Host implementation requires strict narrowing, not assertions or runtime-shape shortcuts.");
      const reference = ast.is.IsIdentifier(current) ? symbol(current) : undefined;
      if (ast.is.IsIdentifier(current) && (ast.is.IsTypeReferenceNode(ast.parent(current)) || ast.is.IsQualifiedName(ast.parent(current))) &&
        reference !== undefined && rawSymbols.has(reference) && !rawAllowed)
        add("ingress-checker", file, current, "Raw checker capability, including an alias, is confined to Ingress implementation.");
      if (publication && reference !== undefined && productionSymbols.has(reference) && ast.is.IsTypeReferenceNode(ast.parent(current)))
        add("read-only-publication", file, current, "Publication cannot reach production authority through an imported or aliased contract.");
      const name = ast.name(current);
      if (name !== undefined && (ast.is.IsPropertySignatureDeclaration(current) || ast.is.IsMethodSignatureDeclaration(current) ||
        ast.is.IsPropertyDeclaration(current) || ast.is.IsMethodDeclaration(current))) {
        const text = ast.text(name);
        if (retiredMembers.includes(text)) add("retired-api", file, current, "A retired handler or semantic accessor cannot be reintroduced.");
        if (publication && productionMember(current)) add("read-only-publication", file, current, "Publication exposes answers, never production or mutable program authority.");
        if (isContract && ast.is.IsPropertySignatureDeclaration(current)) {
          const type = ast.typeNode(current);
          if (!ast.hasModifierKind(current, "readonly"))
            add("contract-closure", file, current, "Contract data properties must be explicitly immutable.");
          if (ast.is.IsFunctionTypeNode(type)) {
            const selected = ast.as.AsFunctionTypeNode(type);
            if (ast.parameters(type).some(parameter => ast.is.IsFunctionTypeNode(ast.typeNode(parameter))) ||
              ast.is.IsFunctionTypeNode(selected?.Type))
              add("layers", file, current, "A contract cannot smuggle a semantic provider callback across layers.");
          }
        }
      }
      if (isContract && ast.is.IsTypeReferenceNode(current)) {
        const selected = ast.as.AsTypeReferenceNode(current);
        if (["ReturnType", "Parameters", "InstanceType"].includes(ast.text(selected?.TypeName)))
          add("contract-closure", file, current, "Factory-derived contract types expose an implementation rather than explicit closed data.");
      }
      if (isContract && ["KindUnknownKeyword", "KindObjectKeyword"].includes(kind))
        add("contract-closure", file, current, "Contract payloads require closed data rather than an opaque capability disguise.");
      if (ast.is.IsFunctionDeclaration(current) || ast.is.IsArrowFunction(current)) {
        const body = ast.body(current);
        const statements = body !== undefined && ast.is.IsBlock(body) ? ast.statements(body) : [];
        const returned = statements.length === 1 && ast.is.IsReturnStatement(statements[0])
          ? ast.as.AsReturnStatement(statements[0])?.Expression : body !== undefined && ast.is.IsCallExpression(body) ? body : undefined;
        if (returned !== undefined && ast.is.IsCallExpression(returned)) {
          const callee = ast.as.AsCallExpression(returned)?.Expression;
          const reference = symbol(callee);
          if (reference !== undefined && imports.has(reference)) add("one-current-name", file, current, "A forwarding function is not a new implementation owner.");
        }
      }
      if (ast.is.IsPropertyAccessExpression(current) && retiredMembers.includes(ast.text(ast.name(current))))
        add("retired-api", file, current, "A retired semantic access path cannot resolve in the current architecture.");
      ast.forEachChild(current, visit);
    };
    visit(node);
  }
  return Object.freeze(findings.sort((left, right) => left.file.localeCompare(right.file) ||
    left.start - right.start || left.gate.localeCompare(right.gate) || left.message.localeCompare(right.message)));
};
