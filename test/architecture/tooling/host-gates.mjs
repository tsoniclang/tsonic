// @ts-check
import { readFileSync, realpathSync } from "node:fs";
import { createHash } from "node:crypto";
import { isBuiltin } from "node:module";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { hostModules, hostUnmigratedFiles } from "./host-modules.mjs";
import { buildTypeScriptModuleAnalysis } from "./module-graph.mjs";
import { publicModuleDependency } from "./public-declarations.mjs";
import { checkerImportFindings, moduleLifetimeFindings } from "./source-boundaries.mjs";
import { readArchitectureTypeScript } from "./typescript-source.mjs";
import { SymbolFlagsAlias } from "../../../packages/tsts/dist/src/index.js";

const retiredPackages = Object.freeze(["@tsonic/target-api", "@tsonic/source-core", "@tsonic/js-source-profile"]);
const retiredMembers = Object.freeze(["effectiveTypes", "semantics", "sourceFacts", "typeFor", "emptyBindings",
  "storageAnalysis", "sealFormalMemberWriteDemands", "createTargetSourceProgram"]);
const producerMembers = Object.freeze(["builder", "interner", "seed", "register", "sealRegistration", "solve",
  "provide", "produce", "producer", "seal", "set", "delete", "clear", "resourceScope", "withDepth", "evidence", "intern"]);

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
  if (path !== resolve(root, file)) throw new Error("Host gates require original owned files, not aliased source paths.");
  return path;
}

/** @type {(input: import("./host-gates.mjs").HostMigrationInput) => import("./host-gates.mjs").HostMigrationReport} */
export const inspectHostMigration = input => {
  const root = realpathSync(input.root);
  if (!Array.isArray(input.files) || new Set(input.files).size !== input.files.length)
    throw new Error("Host migration inspection requires a complete distinct file vector.");
  if (input.complete === true && hostUnmigratedFiles.length !== 0)
    throw new Error("Host done requires an empty unmigrated-file catalogue.");
  const reference = new Map(hostUnmigratedFiles.map(entry => [entry.file, entry]));
  const active = hostModules.filter(module => input.files.includes(module.contract) ||
    input.files.includes(`${module.directory}/register.ts`));
  /** @type {string[]} */
  const currentFiles = [];
  /** @type {import("./host-gates.mjs").HostMigrationEntry[]} */
  const unmigrated = [];
  for (const file of input.files) {
    const bytes = readFileSync(safeFile(root, file));
    const entry = reference.get(file);
    const port = /\/(?:contract|register)(?:\.d)?\.(?:[cm]?[jt]sx?)$/u.test(file);
    const migrated = active.some(module => file.startsWith(`${module.directory}/`));
    const blob = createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
    if (entry !== undefined && !port && !migrated && blob === entry.referenceBlob) unmigrated.push(entry);
    else currentFiles.push(file);
  }
  return Object.freeze({ currentFiles: Object.freeze(currentFiles.sort()),
    unmigrated: Object.freeze(unmigrated.sort((left, right) => left.file.localeCompare(right.file))) });
};

/** @type {(input: import("./host-gates.mjs").HostGateInput) => readonly import("./host-gates.mjs").HostGateFinding[]} */
export const inspectHostStructure = input => {
  const root = realpathSync(input.root);
  if (!Array.isArray(input.files) || !Array.isArray(input.declarationFiles) ||
    input.files.length + input.declarationFiles.length === 0 ||
    new Set(input.files).size !== input.files.length || new Set(input.declarationFiles).size !== input.declarationFiles.length)
    throw new Error("Host gate inputs require complete distinct source and declaration vectors.");
  const files = new Map([...new Set([...input.files, ...input.declarationFiles])].map(file =>
    [file, readFileSync(safeFile(root, file), "utf8")]));
  const declarations = new Set(input.declarationFiles);
  const source = readArchitectureTypeScript(files);
  const { ast } = source;
  /** @param {import("../../../packages/tsts/dist/src/index.js").Node | undefined} name */
  const memberName = name => {
    if (name !== undefined && ast.is.IsComputedPropertyName(name)) {
      const expression = ast.as.AsComputedPropertyName(name)?.Expression;
      return expression !== undefined && ast.is.IsStringLiteral(expression) ? ast.text(expression) : undefined;
    }
    return name !== undefined && (ast.is.IsIdentifier(name) || ast.is.IsStringLiteral(name) || ast.is.IsNumericLiteral(name))
      ? ast.text(name) : undefined;
  };
  /** @param {import("../../../packages/tsts/dist/src/index.js").Node | undefined} original */
  const callableType = original => {
    let node = original;
    while (node !== undefined && ast.is.IsParenthesizedTypeNode(node)) node = ast.as.AsParenthesizedTypeNode(node)?.Type;
    return node !== undefined && ast.is.IsFunctionTypeNode(node);
  };
  /** @param {import("../../../packages/tsts/dist/src/index.js").Node} node */
  const productionMember = node => {
    const name = ast.name(node);
    const type = ast.typeNode(node);
    const text = memberName(name);
    return text !== undefined && producerMembers.includes(text) &&
      (ast.is.IsMethodSignatureDeclaration(node) || callableType(type));
  };
  const analysis = buildTypeScriptModuleAnalysis(files);
  const closedFiles = new Set([...declarations, ...[...files.keys()].filter(file => {
    const module = owner(file);
    return module !== undefined && contract(file, module);
  })]);
  for (let previous = -1; previous !== closedFiles.size;) {
    previous = closedFiles.size;
    for (const edge of analysis.edges) {
      if (edge.target !== undefined && closedFiles.has(edge.source) && owner(edge.source) === owner(edge.target))
        closedFiles.add(edge.target);
    }
  }
  /** @type {import("./host-gates.mjs").HostGateFinding[]} */
  const findings = [];
  /** @param {import("./host-gates.mjs").HostGate} gate @param {string} file @param {import("../../../packages/tsts/dist/src/index.js").Node | number | undefined} node @param {string} message */
  const add = (gate, file, node, message) => {
    const range = node === undefined || typeof node === "number" ? undefined : ast.authoredRange(node);
    if (range !== undefined && range.kind !== "authored") throw new Error("Architecture findings require an actual authored input site.");
    const start = typeof node === "number" ? node : range === undefined ? 0 : range.start;
    if (!findings.some(finding => finding.gate === gate && finding.file === file && finding.start === start))
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
    const retired = retiredPackages.some(name => edge.specifier === name || edge.specifier.startsWith(`${name}/`));
    if (retired)
      add("retired-api", edge.source, node, "A retired semantic package cannot resolve as a current Host contract.");
    if (from !== undefined && edge.kind === "package" && !retired) {
      const checkerPlatform = edge.specifier === "@tsonic/tsts" || edge.specifier.startsWith("@tsonic/tsts/");
      if (checkerPlatform && (from.name !== "ingress" || closedFiles.has(edge.source)))
        add("ingress-checker", edge.source, node, "Raw checker capability belongs only to the Ingress implementation.");
      if (edge.specifier === "@tsonic/host" || edge.specifier.startsWith("@tsonic/host/"))
        add("contract-imports", edge.source, node, "Internal Host dependencies use the explicit contract source port, never package-output resolution.");
      else if (!isBuiltin(edge.specifier) && !checkerPlatform)
        add("isolated-compile", edge.source, node, "An undeclared package cannot enter the isolated source and declaration closure.");
      else if (isBuiltin(edge.specifier) && from.layer < 5)
        add("layers", edge.source, node, "Platform I/O is owned by Host orchestration and I/O modules, not a semantic service or data contract.");
    }
    if (external && !isBuiltin(edge.specifier) && !publicContract &&
      (edge.kind === "relative" || edge.specifier.startsWith("@tsonic/")))
      add("publication-consumer", edge.source, node, "External consumers may depend only on the Publication contract.");
    if (edge.kind === "relative" && edge.unresolved) {
      add("isolated-compile", edge.source, node, "A relative dependency must resolve uniquely within the supplied current module and contracts.");
      continue;
    }
    if (from !== undefined && to !== undefined && from !== to && closedFiles.has(edge.source) && !contract(edge.target, to))
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
  /** @type {Set<import("../../../packages/tsts/dist/src/index.js").Symbol>} */
  const mutableSymbols = new Set();
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
  /** @param {import("../../../packages/tsts/dist/src/index.js").Node} node */
  const typeShape = node => {
    const file = ast.getSourceFile(node);
    if (file === undefined) throw new Error("An architecture type requires its original source file.");
    return source.getSourceFileQueries(file).typeShape;
  };
  /** @type {Map<import("../../../packages/tsts/dist/src/index.js").Node, import("../../../packages/tsts/dist/src/index.js").Node | undefined>} */
  const mappedDeclarations = new Map();
  /** @param {import("../../../packages/tsts/dist/src/index.js").Node} node */
  const mappedDeclaration = node => {
    if (mappedDeclarations.has(node)) return mappedDeclarations.get(node);
    if (ast.is.IsMappedTypeNode(node)) return node;
    if (!ast.is.IsTypeReferenceNode(node) && !ast.is.IsImportTypeNode(node)) return undefined;
    const queries = checker(node);
    const type = typeShape(node).getTypeFromTypeNode(node);
    const name = ast.is.IsTypeReferenceNode(node) ? ast.as.AsTypeReferenceNode(node)?.TypeName : undefined;
    const candidates = [...queries.getSymbolDeclarations(queries.getTypeSymbol(type)),
      ...queries.getSymbolDeclarations(symbol(name)).map(candidate => ast.typeNode(candidate))];
    const declaration = candidates.find(candidate => candidate !== undefined && ast.is.IsMappedTypeNode(candidate));
    mappedDeclarations.set(node, declaration);
    return declaration;
  };
  /** @type {Map<import("../../../packages/tsts/dist/src/index.js").Node, boolean>} */
  const mappedInputs = new Map();
  /** @param {import("../../../packages/tsts/dist/src/index.js").Node} node @returns {boolean} */
  const mappedInput = node => {
    const cached = mappedInputs.get(node);
    if (cached !== undefined) return cached;
    let child = node;
    let parent = ast.parent(child);
    while (parent !== undefined) {
      if (ast.is.IsTypeReferenceNode(parent) && ast.typeArguments(parent).includes(child) && mappedDeclaration(parent) !== undefined) {
        let operand = child;
        while (ast.is.IsParenthesizedTypeNode(operand)) {
          const inner = ast.as.AsParenthesizedTypeNode(operand)?.Type;
          if (inner === undefined) break;
          operand = inner;
        }
        const name = ast.is.IsTypeReferenceNode(operand) ? ast.as.AsTypeReferenceNode(operand)?.TypeName : undefined;
        let entity = node;
        while (ast.parent(entity) !== undefined && ast.is.IsQualifiedName(ast.parent(entity))) entity = ast.parent(entity) ?? entity;
        const transformed = node === operand || entity === name ||
          ast.parent(node) === operand && (ast.is.IsPropertySignatureDeclaration(node) || ast.is.IsIndexSignatureDeclaration(node));
        mappedInputs.set(node, transformed);
        return transformed;
      }
      child = parent;
      parent = ast.parent(parent);
    }
    mappedInputs.set(node, false);
    return false;
  };
  /** @param {import("../../../packages/tsts/dist/src/index.js").Node} node */
  const mappedKeySource = node => {
    const mapped = ast.as.AsMappedTypeNode(node);
    let constraint = mapped?.TypeParameter === undefined ? undefined : ast.as.AsTypeParameterDeclaration(mapped.TypeParameter)?.Constraint;
    /** @type {Set<import("../../../packages/tsts/dist/src/index.js").Node>} */
    const active = new Set();
    while (constraint !== undefined && !active.has(constraint)) {
      active.add(constraint);
      if (ast.is.IsParenthesizedTypeNode(constraint)) {
        constraint = ast.as.AsParenthesizedTypeNode(constraint)?.Type;
        continue;
      }
      if (ast.is.IsTypeOperatorNode(constraint))
        return ast.operatorKindName(constraint) === "KindKeyOfKeyword" ? ast.as.AsTypeOperatorNode(constraint)?.Type : undefined;
      const name = ast.is.IsTypeReferenceNode(constraint) ? ast.as.AsTypeReferenceNode(constraint)?.TypeName : undefined;
      const selected = symbol(name);
      const declaration = selected === undefined ? undefined : aliases.get(selected);
      constraint = declaration !== undefined && ast.is.IsTypeAliasDeclaration(declaration) ? ast.typeNode(declaration) : undefined;
    }
    return undefined;
  };
  /** @param {import("../../../packages/tsts/dist/src/index.js").Node} node */
  const mutableMapped = node => {
    const shape = typeShape(node);
    const queries = checker(node);
    /** @param {import("../../../packages/tsts/dist/src/index.js").Type | undefined} type */
    const parameter = type => queries.getSymbolDeclarations(queries.getTypeSymbol(type))
      .some(declaration => declaration !== undefined && ast.is.IsTypeParameterDeclaration(declaration));
    const input = ast.is.IsMappedTypeNode(node) ? mappedKeySource(node) : undefined;
    if (input !== undefined && parameter(shape.getTypeFromTypeNode(input)) ||
      ast.typeArguments(node).some(argument => argument !== undefined && parameter(shape.getTypeFromTypeNode(argument)))) return false;
    /** @type {Set<import("../../../packages/tsts/dist/src/index.js").Type>} */
    const active = new Set();
    /** @type {Map<import("../../../packages/tsts/dist/src/index.js").Type, boolean>} */
    const completed = new Map();
    /** @param {import("../../../packages/tsts/dist/src/index.js").Type | undefined} type @returns {boolean} */
    const visit = type => {
      if (type === undefined || active.has(type) || parameter(type)) return false;
      const cached = completed.get(type);
      if (cached !== undefined) return cached;
      if (shape.isStringLike(type) || shape.isNumberLike(type) || shape.isBooleanLike(type) ||
        shape.isBigIntLike(type) || shape.isSymbolLike(type) || shape.isNullish(type)) return false;
      active.add(type);
      const mutable = shape.isUnion(type) || shape.isIntersection(type)
        ? shape.getUnionOrIntersectionTypes(type).some(visit)
        : shape.getPropertyInfos(type).some(property => {
          const declarations = property.rootSymbols.flatMap(root => queries.getSymbolDeclarations(root));
          const method = declarations.length > 0 && declarations.every(declaration => declaration !== undefined &&
            (ast.is.IsMethodSignatureDeclaration(declaration) || ast.is.IsMethodDeclaration(declaration)));
          return !method && (!property.readonly || visit(property.type));
        }) || shape.getIndexInfos(type).some(index => !index.readonly || visit(index.valueType));
      active.delete(type);
      completed.set(type, mutable);
      return mutable;
    };
    return visit(shape.getTypeFromTypeNode(node));
  };
  /** @param {import("../../../packages/tsts/dist/src/index.js").Node} original @returns {boolean} */
  const readonlySequence = original => {
    let parent = ast.parent(original);
    while (parent !== undefined && ast.is.IsParenthesizedTypeNode(parent)) parent = ast.parent(parent);
    if (parent !== undefined && ast.is.IsTypeOperatorNode(parent))
      return ast.operatorKindName(parent) === "KindReadonlyKeyword";
    if (parent !== undefined && (ast.is.IsRestTypeNode(parent) || ast.is.IsNamedTupleMember(parent) &&
      ast.as.AsNamedTupleMember(parent)?.DotDotDotToken !== undefined)) {
      const tuple = ast.parent(parent);
      return tuple !== undefined && ast.is.IsTupleTypeNode(tuple) && readonlySequence(tuple);
    }
    return false;
  };
  /** @param {import("../../../packages/tsts/dist/src/index.js").Node} node */
  const mutableCollection = node => {
    const name = ast.is.IsTypeReferenceNode(node) ? ast.as.AsTypeReferenceNode(node)?.TypeName
      : ast.is.IsExpressionWithTypeArguments(node) ? ast.as.AsExpressionWithTypeArguments(node)?.Expression : undefined;
    const terminal = name !== undefined && ast.is.IsQualifiedName(name) ? ast.as.AsQualifiedName(name)?.Right
      : name !== undefined && ast.is.IsPropertyAccessExpression(name) ? ast.name(name) : name;
    const text = terminal !== undefined && ast.is.IsIdentifier(terminal) ? ast.text(terminal) : undefined;
    if (text === undefined || !["Array", "Map", "Set", "WeakMap", "WeakSet"].includes(text)) return false;
    const declaration = symbol(name);
    if (declaration !== undefined && checker(node).getSymbolDeclarations(declaration).length > 0) return false;
    return text !== "Array" || !readonlySequence(node);
  };
  /** @param {import("../../../packages/tsts/dist/src/index.js").Node} node */
  const mutableData = node => {
    if (mutableCollection(node)) return true;
    if (mappedInput(node)) return false;
    if (ast.is.IsSetAccessorDeclaration(node)) return true;
    const mapped = mappedDeclaration(node);
    if (mapped !== undefined) {
      const original = ast.as.AsMappedTypeNode(mapped);
      const modifier = ast.kindName(original?.ReadonlyToken);
      if (modifier === "KindMinusToken") return true;
      if (mutableMapped(node)) return true;
      if (ast.is.IsMappedTypeNode(node) && original?.ReadonlyToken === undefined) return mappedKeySource(node) === undefined;
      return false;
    }
    if (ast.is.IsPropertySignatureDeclaration(node) || ast.is.IsIndexSignatureDeclaration(node))
      return !ast.hasModifierKind(node, "readonly");
    return (ast.is.IsArrayTypeNode(node) || ast.is.IsTupleTypeNode(node)) && !readonlySequence(node);
  };
  for (const [file, node] of sourceFiles) {
    const module = owner(file);
    if (module === undefined && file.startsWith("packages/"))
      add("directory-ownership", file, undefined, "Product implementation must belong to exactly one declared module directory.");
    if (module === undefined) continue;
    for (const finding of checkerImportFindings(source, node)) {
      add("ingress-checker", file, finding.start, finding.rule);
    }
    for (const finding of moduleLifetimeFindings(source, node, { immutableData: true })) {
      add("program-lifetime", file, finding.start, finding.rule);
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
  for (let previous = -1; previous !== rawSymbols.size + productionSymbols.size + mutableSymbols.size;) {
    previous = rawSymbols.size + productionSymbols.size + mutableSymbols.size;
    for (const [selected, node] of aliases) {
      let raw = false, production = false, mutable = false;
      /** @param {import("../../../packages/tsts/dist/src/index.js").Node | undefined} current */
      const visit = current => {
        if (current === undefined) return;
        const reference = symbol(current);
        if (ast.is.IsIdentifier(current) && reference !== undefined && rawSymbols.has(reference)) raw = true;
        if (ast.is.IsIdentifier(current) && reference !== undefined && productionSymbols.has(reference)) production = true;
        if (productionMember(current)) production = true;
        if (mutableData(current) || ast.is.IsIdentifier(current) && reference !== undefined &&
          mutableSymbols.has(reference) && !mappedInput(current)) mutable = true;
        ast.forEachChild(current, visit);
      };
      const type = ast.typeNode(node);
      if (type !== undefined) visit(type);
      else ast.forEachChild(node, visit);
      if (raw) rawSymbols.add(selected);
      if (production) productionSymbols.add(selected);
      if (mutable) mutableSymbols.add(selected);
    }
  }

  for (const [file, node] of sourceFiles) {
    const module = owner(file);
    if (module === undefined) continue;
    const isContract = closedFiles.has(file);
    const publication = module.name === "publication";
    const rawAllowed = module.name === "ingress" && !isContract;
    /** @type {Set<import("../../../packages/tsts/dist/src/index.js").Symbol>} */
    const imports = new Set();
    /** @param {import("../../../packages/tsts/dist/src/index.js").Node | undefined} current */
    const visit = current => {
      if (current === undefined) return;
      const kind = ast.kindName(current);
      if (isContract && (ast.is.IsFunctionDeclaration(current) && ast.body(current) !== undefined ||
        ast.is.IsArrowFunction(current) || ast.is.IsFunctionExpression(current) || ast.is.IsClassDeclaration(current) ||
        ast.is.IsCallExpression(current) || ast.is.IsNewExpression(current)))
        add("contract-closure", file, current, "Closed contract source contains data declarations, not executable implementations.");
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
      const parent = ast.parent(current);
      const typeReference = parent !== undefined && (ast.is.IsTypeReferenceNode(parent) || ast.is.IsQualifiedName(parent) ||
        ast.is.IsExpressionWithTypeArguments(parent) || ast.is.IsImportTypeNode(parent));
      if (ast.is.IsIdentifier(current) && typeReference &&
        reference !== undefined && rawSymbols.has(reference) && !rawAllowed)
        add("ingress-checker", file, current, "Raw checker capability, including an alias, is confined to Ingress implementation.");
      if (publication && reference !== undefined && typeReference &&
        (productionSymbols.has(reference) || mutableSymbols.has(reference) && !mappedInput(current)))
        add("read-only-publication", file, current, "Publication cannot reach production authority through an imported or aliased contract.");
      const name = ast.name(current);
      if (name !== undefined && (ast.is.IsPropertySignatureDeclaration(current) || ast.is.IsMethodSignatureDeclaration(current) ||
        ast.is.IsPropertyDeclaration(current) || ast.is.IsMethodDeclaration(current))) {
        const text = memberName(name);
        if (text !== undefined && retiredMembers.includes(text)) add("retired-api", file, current, "A retired handler or semantic accessor cannot be reintroduced.");
        if (publication && productionMember(current)) add("read-only-publication", file, current, "Publication exposes answers, never production or mutable program authority.");
      }
      const mappedName = ast.is.IsTypeReferenceNode(current) ? ast.as.AsTypeReferenceNode(current)?.TypeName : undefined;
      const mappedSymbol = mappedName === undefined ? undefined : symbol(mappedName);
      const inheritedMutable = mappedSymbol !== undefined && mutableSymbols.has(mappedSymbol) && mappedDeclaration(current) !== undefined;
      if (isContract && !inheritedMutable && mutableData(current)) {
        add("contract-closure", file, current, "Every reachable contract data member and collection must be immutable.");
        if (publication)
          add("read-only-publication", file, current, "Publication cannot expose mutable data through a readonly binding.");
      }
      if (isContract && ast.is.IsTypeReferenceNode(current)) {
        const selected = ast.as.AsTypeReferenceNode(current);
        if (selected?.TypeName !== undefined && ast.is.IsIdentifier(selected.TypeName) &&
          ["ReturnType", "Parameters", "InstanceType"].includes(ast.text(selected.TypeName)))
          add("contract-closure", file, current, "Factory-derived contract types expose an implementation rather than explicit closed data.");
      }
      if (isContract && ["KindUnknownKeyword", "KindObjectKeyword"].includes(kind)) {
        const parent = ast.parent(current);
        const condition = parent !== undefined && ast.is.IsConditionalTypeNode(parent) ? ast.as.AsConditionalTypeNode(parent) : undefined;
        const parameter = parent !== undefined && ast.is.IsTypeParameterDeclaration(parent) ? ast.as.AsTypeParameterDeclaration(parent) : undefined;
        if (condition?.CheckType !== current && condition?.ExtendsType !== current && parameter?.Constraint !== current)
          add("contract-closure", file, current, "Contract payloads require closed data rather than an opaque capability disguise.");
      }
      if (ast.is.IsFunctionDeclaration(current) || ast.is.IsArrowFunction(current)) {
        const body = ast.body(current);
        const statements = body !== undefined && ast.is.IsBlock(body) ? ast.statements(body) : [];
        const returned = statements.length === 1 && ast.is.IsReturnStatement(statements[0])
          ? ast.as.AsReturnStatement(statements[0])?.Expression : body !== undefined && ast.is.IsCallExpression(body) ? body : undefined;
        if (returned !== undefined && ast.is.IsCallExpression(returned)) {
          const callee = ast.as.AsCallExpression(returned)?.Expression;
          const reference = symbol(callee);
          const parameters = ast.parameters(current);
          const arguments_ = ast.arguments(returned);
          const forwarding = parameters.length === arguments_.length && parameters.every((parameter, index) => {
            if (parameter === undefined || !ast.is.IsParameterDeclaration(parameter) ||
              ast.as.AsParameterDeclaration(parameter)?.Initializer !== undefined) return false;
            const name = ast.name(parameter);
            const argument = arguments_[index];
            const value = argument !== undefined && ast.is.IsSpreadElement(argument) ? ast.as.AsSpreadElement(argument)?.Expression : argument;
            return name !== undefined && ast.is.IsIdentifier(name) && value !== undefined && ast.is.IsIdentifier(value) &&
              symbol(name) === symbol(value);
          });
          if (reference !== undefined && imports.has(reference) && forwarding)
            add("one-current-name", file, current, "A forwarding function is not a new implementation owner.");
        }
      }
      if (ast.is.IsPropertyAccessExpression(current) && retiredMembers.includes(ast.text(ast.name(current))))
        add("retired-api", file, current, "A retired semantic access path cannot resolve in the current architecture.");
      ast.forEachChild(current, visit);
    };
    visit(node);
  }
  return Object.freeze(findings.sort((left, right) => left.file.localeCompare(right.file) ||
    left.start - right.start || left.gate.localeCompare(right.gate)));
};
