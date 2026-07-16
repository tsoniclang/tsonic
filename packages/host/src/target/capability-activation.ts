import type { AstReader, Node, SourceFile } from "@tsonic/tsts";
import type { TargetCapabilityImplementation, TargetSelection } from "@tsonic/target-api";
import { moduleSpecifierMatchesOwnership } from "./extensions.js";

export function collectImportActivatedTargetCapabilities(
  ast: AstReader,
  sourceFiles: readonly SourceFile[],
  installedCapabilities: readonly TargetCapabilityImplementation[],
  target: TargetSelection,
): readonly TargetCapabilityImplementation[] {
  if (installedCapabilities.length === 0) {
    return [];
  }
  const moduleSpecifiers = collectStaticModuleSpecifiers(ast, sourceFiles);
  const directlyActivated = installedCapabilities.filter((capability) =>
    capability.targetId === target.id &&
    capability.moduleOwnership.some((ownership) =>
      moduleSpecifiers.some((specifier) => moduleSpecifierMatchesOwnership(specifier, ownership.specifierPrefix))
    )
  );
  return closeRequiredCapabilities(directlyActivated, installedCapabilities, target.id);
}

export function collectRuntimeActivatedTargetCapabilities(
  ast: AstReader,
  sourceFiles: readonly SourceFile[],
  selectedCapabilities: readonly TargetCapabilityImplementation[],
): readonly TargetCapabilityImplementation[] {
  if (selectedCapabilities.length === 0) {
    return [];
  }
  const valueModuleSpecifiers = collectValueModuleSpecifiers(ast, sourceFiles);
  const directlyActivated = selectedCapabilities.filter((capability) =>
    capability.moduleOwnership.some((ownership) =>
      valueModuleSpecifiers.some((specifier) => moduleSpecifierMatchesOwnership(specifier, ownership.specifierPrefix))
    )
  );
  return closeRequiredCapabilities(directlyActivated, selectedCapabilities, selectedCapabilities[0]?.targetId);
}

function closeRequiredCapabilities(
  roots: readonly TargetCapabilityImplementation[],
  available: readonly TargetCapabilityImplementation[],
  targetId: string | undefined,
): readonly TargetCapabilityImplementation[] {
  const availableById = new Map(available
    .filter((capability) => targetId === undefined || capability.targetId === targetId)
    .map((capability) => [capability.id, capability]));
  const selectedIds = new Set(roots.map((capability) => capability.id));
  const pending = [...roots];
  for (let index = 0; index < pending.length; index++) {
    for (const requiredId of pending[index]!.requiredCapabilities ?? []) {
      const required = availableById.get(requiredId);
      if (required !== undefined && !selectedIds.has(required.id)) {
        selectedIds.add(required.id);
        pending.push(required);
      }
    }
  }
  return available.filter((capability) => selectedIds.has(capability.id));
}

function collectStaticModuleSpecifiers(ast: AstReader, sourceFiles: readonly SourceFile[]): readonly string[] {
  const specifiers = new Set<string>();
  for (const sourceFile of sourceFiles) {
    for (const statement of ast.statements(sourceFile)) {
      if (statement === undefined) {
        continue;
      }
      const moduleSpecifier = getStaticModuleSpecifier(ast, statement);
      if (moduleSpecifier !== undefined) {
        specifiers.add(moduleSpecifier);
      }
    }
  }
  return [...specifiers].sort();
}

function collectValueModuleSpecifiers(ast: AstReader, sourceFiles: readonly SourceFile[]): readonly string[] {
  const specifiers = new Set<string>();
  for (const sourceFile of sourceFiles) {
    for (const statement of ast.statements(sourceFile)) {
      if (statement === undefined) {
        continue;
      }
      const moduleSpecifier = getValueModuleSpecifier(ast, statement);
      if (moduleSpecifier !== undefined) {
        specifiers.add(moduleSpecifier);
      }
    }
  }
  return [...specifiers].sort();
}

function getStaticModuleSpecifier(ast: AstReader, statement: Node): string | undefined {
  if (ast.is.IsImportDeclaration(statement)) {
    return readModuleSpecifierText(ast, ast.as.AsImportDeclaration(statement)?.ModuleSpecifier);
  }
  if (ast.is.IsExportDeclaration(statement)) {
    return readModuleSpecifierText(ast, ast.as.AsExportDeclaration(statement)?.ModuleSpecifier);
  }
  return undefined;
}

function getValueModuleSpecifier(ast: AstReader, statement: Node): string | undefined {
  if (ast.is.IsImportDeclaration(statement)) {
    if (isExclusivelyTypeOnlyImportDeclaration(ast, statement)) {
      return undefined;
    }
    return readModuleSpecifierText(ast, ast.as.AsImportDeclaration(statement)?.ModuleSpecifier);
  }
  if (ast.is.IsExportDeclaration(statement)) {
    if (ast.isTypeOnlyImportOrExportDeclaration(statement)) {
      return undefined;
    }
    return readModuleSpecifierText(ast, ast.as.AsExportDeclaration(statement)?.ModuleSpecifier);
  }
  return undefined;
}

function isExclusivelyTypeOnlyImportDeclaration(ast: AstReader, declaration: Node): boolean {
  if (ast.isTypeOnlyImportDeclaration(declaration)) {
    return true;
  }
  const importClause = ast.as.AsImportDeclaration(declaration)?.ImportClause;
  const namedBindings = importClause === undefined ? undefined : ast.as.AsImportClause(importClause)?.NamedBindings;
  if (importClause === undefined || namedBindings === undefined) {
    return false;
  }
  if (ast.is.IsNamespaceImport(namedBindings) || !ast.is.IsNamedImports(namedBindings)) {
    return false;
  }
  const elements = ast.elements(namedBindings);
  return elements.length > 0 &&
    elements.every((element) => element !== undefined && ast.as.AsImportSpecifier(element)?.IsTypeOnly === true);
}

function readModuleSpecifierText(ast: AstReader, moduleSpecifier: Node | undefined): string | undefined {
  if (moduleSpecifier === undefined) {
    return undefined;
  }
  const text = ast.text(moduleSpecifier);
  return text.length === 0 ? undefined : text;
}
