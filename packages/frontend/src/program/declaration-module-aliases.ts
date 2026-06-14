import * as fs from "node:fs";
import type { GoPtr, TstsNode } from "@tsonic/tsts";
import {
  getTstsExportModuleSpecifiersFromStatements,
  getTstsIdentifierText,
  getTstsNodeText,
  parseTstsSourceFile,
  TstsSyntax,
  visitTstsSubtree,
} from "@tsonic/tsts";

export type DeclarationModuleAlias = {
  readonly targetSpecifier: string;
  readonly declarationFile: string;
};

export type DeclarationGlobalImport = {
  readonly globalName: string;
  readonly targetSpecifier: string;
  readonly exportName: string;
  readonly declarationFile: string;
};

const readEntityNameText = (name: GoPtr<TstsNode>): string => {
  if (!name) return "";
  const identifier = getTstsIdentifierText(name);
  if (identifier) return identifier;
  if (TstsSyntax.IsQualifiedName(name)) {
    const qualifiedName = TstsSyntax.AsQualifiedName(name);
    const left = readEntityNameText(qualifiedName?.Left);
    const right = readEntityNameText(qualifiedName?.Right);
    return left && right ? `${left}.${right}` : left || right;
  }
  if (TstsSyntax.IsPropertyAccessExpression(name)) {
    const access = TstsSyntax.AsPropertyAccessExpression(name);
    const left = readEntityNameText(access?.Expression);
    const right = readEntityNameText(TstsSyntax.Node_Name(name));
    return left && right ? `${left}.${right}` : left || right;
  }
  return getTstsNodeText(name) ?? "";
};

const collectFromModuleDeclaration = (
  node: TstsNode,
  aliases: Map<string, DeclarationModuleAlias>,
  declarationFile: string
): void => {
  const moduleName = TstsSyntax.Node_Name(node);
  if (moduleName?.Kind !== TstsSyntax.KindStringLiteral) {
    return;
  }

  let body = TstsSyntax.Node_Body(node);
  while (body && TstsSyntax.IsModuleDeclaration(body)) {
    body = TstsSyntax.Node_Body(body);
  }

  if (!body || !TstsSyntax.IsModuleBlock(body)) {
    return;
  }

  const targets = Array.from(
    new Set(
      getTstsExportModuleSpecifiersFromStatements(
        TstsSyntax.Node_Statements(body) ?? []
      )
    )
  );
  if (targets.length !== 1) {
    return;
  }

  const targetSpecifier = targets[0];
  if (!targetSpecifier) {
    return;
  }

  aliases.set(getTstsNodeText(moduleName) ?? "", {
    targetSpecifier,
    declarationFile,
  });
};

export const discoverDeclarationModuleAliases = (
  declarationFiles: readonly string[]
): ReadonlyMap<string, DeclarationModuleAlias> => {
  const aliases = new Map<string, DeclarationModuleAlias>();

  for (const declarationFile of declarationFiles) {
    let sourceText: string;
    try {
      sourceText = fs.readFileSync(declarationFile, "utf-8");
    } catch {
      continue;
    }

    const sourceFile = parseTstsSourceFile(sourceText, {
      fileName: declarationFile,
    });
    visitTstsSubtree(sourceFile, (node) => {
      if (node && TstsSyntax.IsModuleDeclaration(node)) {
        collectFromModuleDeclaration(node, aliases, declarationFile);
      }
    });
  }

  return aliases;
};

const collectAmbientGlobalImportsFromNode = (
  node: TstsNode,
  declarationFile: string,
  imports: DeclarationGlobalImport[]
): void => {
  if (!TstsSyntax.IsVariableDeclaration(node)) {
    return;
  }

  const nameNode = TstsSyntax.Node_Name(node);
  const globalName = getTstsIdentifierText(nameNode);
  if (!globalName) {
    return;
  }

  const typeNode = TstsSyntax.Node_Type(node);
  const importType = typeNode ? TstsSyntax.AsImportTypeNode(typeNode) : undefined;
  if (!importType?.IsTypeOf) {
    return;
  }

  const argumentLiteral =
    importType.Argument && TstsSyntax.IsLiteralTypeNode(importType.Argument)
      ? TstsSyntax.AsLiteralTypeNode(importType.Argument)?.Literal
      : undefined;
  if (argumentLiteral?.Kind !== TstsSyntax.KindStringLiteral) {
    return;
  }

  const exportName = importType.Qualifier
    ? readEntityNameText(importType.Qualifier).trim()
    : undefined;
  if (!exportName) {
    return;
  }

  let current = node.Parent;
  let isAmbientGlobal = false;
  while (current) {
    if (
      TstsSyntax.IsModuleDeclaration(current) &&
      getTstsIdentifierText(TstsSyntax.Node_Name(current)) === "global"
    ) {
      isAmbientGlobal = true;
      break;
    }
    current = current.Parent;
  }

  if (!isAmbientGlobal) {
    return;
  }

  imports.push({
    globalName,
    targetSpecifier: getTstsNodeText(argumentLiteral) ?? "",
    exportName,
    declarationFile,
  });
};

export const discoverDeclarationGlobalImports = (
  declarationFiles: readonly string[]
): readonly DeclarationGlobalImport[] => {
  const imports: DeclarationGlobalImport[] = [];

  for (const declarationFile of declarationFiles) {
    let sourceText: string;
    try {
      sourceText = fs.readFileSync(declarationFile, "utf-8");
    } catch {
      continue;
    }

    const sourceFile = parseTstsSourceFile(sourceText, {
      fileName: declarationFile,
    });
    visitTstsSubtree(sourceFile, (node) => {
      if (node) collectAmbientGlobalImportsFromNode(node, declarationFile, imports);
    });
  }

  return imports;
};
