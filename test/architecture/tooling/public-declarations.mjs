import { readFileSync } from "node:fs";
import { isBuiltin } from "node:module";
import { resolve } from "node:path";
import { readSourceInventory } from "./file-inventory.mjs";
import { readArchitectureTypeScript } from "./typescript-source.mjs";

export function readPublicDeclarationInputs(packageRoots) {
  const files = new Map();
  const entries = [];
  const modulePaths = {};
  for (const root of packageRoots) {
    const manifest = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
    const declarations = readSourceInventory(resolve(root, "dist"), { extensions: [".d.ts"] });
    if (declarations.size === 0) throw new Error(`Missing built declarations for ${manifest.name}.`);
    for (const [file, text] of declarations) files.set(resolve(root, "dist", file), text);
    for (const [subpath, entry] of Object.entries(manifest.exports ?? { ".": { types: manifest.types } })) {
      if (subpath === "./package.json") continue;
      const types = typeof entry === "string" ? entry : entry.types;
      if (typeof types !== "string" || !types.endsWith(".d.ts") || subpath.includes("*")) {
        throw new Error(`An exact declaration export is required for ${manifest.name}${subpath}.`);
      }
      const file = resolve(root, types);
      if (!files.has(file)) throw new Error(`Missing built declaration export ${file}.`);
      const name = subpath === "." ? manifest.name : `${manifest.name}/${subpath.slice(2)}`;
      modulePaths[name] = [file];
      entries.push(Object.freeze({ name, file }));
    }
  }
  return Object.freeze({ files, entries: Object.freeze(entries), modulePaths });
}

export function collectConsumedPublicExports(sources) {
  const source = readArchitectureTypeScript(sources);
  const ast = source.ast;
  const modules = new Map();
  const add = (entry, name) => {
    const previous = modules.get(entry);
    if (previous === "all") return;
    if (name === "all") modules.set(entry, "all");
    else {
      const names = previous ?? new Set();
      names.add(name);
      modules.set(entry, names);
    }
  };
  for (const file of source.sourceFiles) {
    const visit = node => {
      const dependency = publicModuleDependency(ast, node);
      if (dependency !== undefined) {
        const entry = ast.text(dependency.specifier);
        if (!entry.startsWith(".") && !entry.startsWith("/") && !isBuiltin(entry) && !entry.endsWith(".json")) {
          if (dependency.names === "all") add(entry, "all");
          else for (const name of dependency.names) add(entry, name);
        }
      }
      ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
    };
    visit(file);
  }
  return [...modules].sort(([left], [right]) => left.localeCompare(right)).map(([entry, exports]) =>
    Object.freeze({ entry, exports: exports === "all" ? exports : Object.freeze([...exports].sort()) }));
}

export function publicModuleDependency(ast, node) {
  const importedName = element => {
    const selected = ast.is.IsImportSpecifier(element) ? ast.as.AsImportSpecifier(element)
      : ast.is.IsExportSpecifier(element) ? ast.as.AsExportSpecifier(element) : undefined;
    if (selected === undefined) throw new Error("Invalid public dependency specifier.");
    const original = selected.PropertyName ?? ast.name(element);
    if (original === undefined) throw new Error("Missing original public dependency name.");
    return ast.text(original);
  };
  if (ast.is.IsImportDeclaration(node)) {
    const declaration = ast.as.AsImportDeclaration(node);
    if (declaration.ModuleSpecifier === undefined) throw new Error("Missing public import module.");
    if (declaration.ImportClause === undefined) return { specifier: declaration.ModuleSpecifier, names: "all" };
    if (!ast.is.IsImportClause(declaration.ImportClause)) throw new Error("Invalid public import clause.");
    const clause = ast.as.AsImportClause(declaration.ImportClause);
    const names = ast.name(declaration.ImportClause) === undefined ? [] : ["default"];
    if (clause.NamedBindings !== undefined) {
      if (ast.is.IsNamespaceImport(clause.NamedBindings)) return { specifier: declaration.ModuleSpecifier, names: "all" };
      if (!ast.is.IsNamedImports(clause.NamedBindings)) throw new Error("Invalid public import bindings.");
      names.push(...ast.elements(clause.NamedBindings).map(importedName));
    }
    return { specifier: declaration.ModuleSpecifier, names };
  }
  if (ast.is.IsExportDeclaration(node)) {
    const declaration = ast.as.AsExportDeclaration(node);
    if (declaration.ModuleSpecifier === undefined) return undefined;
    const clause = declaration.ExportClause;
    if (clause === undefined || ast.is.IsNamespaceExport(clause)) return { specifier: declaration.ModuleSpecifier, names: "all" };
    if (!ast.is.IsNamedExports(clause)) throw new Error("Invalid public export bindings.");
    return { specifier: declaration.ModuleSpecifier, names: ast.elements(clause).map(importedName) };
  }
  if (ast.is.IsImportTypeNode(node)) {
    const selected = ast.as.AsImportTypeNode(node);
    if (selected.Argument === undefined || !ast.is.IsLiteralTypeNode(selected.Argument)) throw new Error("A public import type requires its literal module.");
    const specifier = ast.as.AsLiteralTypeNode(selected.Argument).Literal;
    if (specifier === undefined || !ast.is.IsStringLiteral(specifier)) throw new Error("A public import type requires its original string module.");
    let qualifier = selected.Qualifier;
    if (qualifier === undefined) return { specifier, names: "all" };
    while (qualifier !== undefined && ast.is.IsQualifiedName(qualifier)) qualifier = ast.as.AsQualifiedName(qualifier).Left;
    if (qualifier === undefined || !ast.is.IsIdentifier(qualifier)) throw new Error("A public import type requires its original exported name.");
    return { specifier, names: [ast.text(qualifier)] };
  }
  return undefined;
}
