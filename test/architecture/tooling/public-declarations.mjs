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
      if (ast.is.IsImportDeclaration(node)) {
        const declaration = ast.as.AsImportDeclaration(node);
        const entry = declaration.ModuleSpecifier === undefined ? undefined : ast.text(declaration.ModuleSpecifier);
        if (entry !== undefined && !entry.startsWith(".") && !entry.startsWith("/") && !isBuiltin(entry) && !entry.endsWith(".json")) {
          const importClause = declaration.ImportClause;
          if (importClause === undefined) add(entry, "all");
          else {
            if (!ast.is.IsImportClause(importClause)) throw new Error("Invalid public import clause.");
            const clause = ast.as.AsImportClause(importClause);
            if (ast.name(importClause) !== undefined) add(entry, "default");
            if (clause.NamedBindings !== undefined) {
              if (ast.is.IsNamespaceImport(clause.NamedBindings)) add(entry, "all");
              else {
                if (!ast.is.IsNamedImports(clause.NamedBindings)) throw new Error("Invalid public import bindings.");
                for (const element of ast.elements(clause.NamedBindings)) {
                  if (!ast.is.IsImportSpecifier(element)) throw new Error("Invalid public import specifier.");
                  const imported = ast.as.AsImportSpecifier(element).PropertyName ?? ast.name(element);
                  if (imported === undefined) throw new Error("Missing original public import name.");
                  add(entry, ast.text(imported));
                }
              }
            }
          }
        }
      }
      ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
    };
    visit(file);
  }
  return [...modules].sort(([left], [right]) => left.localeCompare(right)).map(([entry, exports]) =>
    Object.freeze({ entry, exports: exports === "all" ? exports : Object.freeze([...exports].sort()) }));
}
