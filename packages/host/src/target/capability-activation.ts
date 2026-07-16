import type { AstReader, Node, SourceFile } from "@tsonic/tsts";
import type { TargetCapabilityImplementation, TargetSelection } from "@tsonic/target-api";
import { getStaticModuleReference } from "../analysis/module-reference.js";
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
  return collectModuleSpecifiers(ast, sourceFiles, false);
}

function collectValueModuleSpecifiers(ast: AstReader, sourceFiles: readonly SourceFile[]): readonly string[] {
  return collectModuleSpecifiers(ast, sourceFiles, true);
}

function collectModuleSpecifiers(
  ast: AstReader,
  sourceFiles: readonly SourceFile[],
  runtimeOnly: boolean,
): readonly string[] {
  const specifiers = new Set<string>();
  for (const sourceFile of sourceFiles) {
    for (const statement of ast.statements(sourceFile)) {
      if (statement === undefined) {
        continue;
      }
      const reference = getStaticModuleReference(ast, statement);
      if (reference === undefined || (runtimeOnly && !reference.hasRuntimeValue)) {
        continue;
      }
      const moduleSpecifier = readModuleSpecifierText(ast, reference.moduleSpecifier);
      if (moduleSpecifier !== undefined) {
        specifiers.add(moduleSpecifier);
      }
    }
  }
  return [...specifiers].sort();
}

function readModuleSpecifierText(ast: AstReader, moduleSpecifier: Node | undefined): string | undefined {
  if (moduleSpecifier === undefined) {
    return undefined;
  }
  const text = ast.text(moduleSpecifier);
  return text.length === 0 ? undefined : text;
}
