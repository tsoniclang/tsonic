import * as fs from "node:fs";
import * as ts from "typescript";

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

const readEntityNameText = (name: ts.Node): string => {
  if (ts.isIdentifier(name)) {
    return name.text;
  }
  if (ts.isQualifiedName(name)) {
    return `${readEntityNameText(name.left)}.${name.right.text}`;
  }
  if (ts.isPropertyAccessExpression(name)) {
    return `${readEntityNameText(name.expression)}.${name.name.text}`;
  }
  return ts.isStringLiteral(name) ? name.text : name.getText();
};

const getScriptKindFromPath = (filePath: string): ts.ScriptKind => {
  if (filePath.endsWith(".ts") || filePath.endsWith(".d.ts")) {
    return ts.ScriptKind.TS;
  }
  if (
    filePath.endsWith(".mts") ||
    filePath.endsWith(".d.mts") ||
    filePath.endsWith(".cts") ||
    filePath.endsWith(".d.cts")
  ) {
    return ts.ScriptKind.TS;
  }
  return ts.ScriptKind.Unknown;
};

const collectAliasTargets = (
  statements: readonly ts.Statement[]
): readonly string[] => {
  const targets: string[] = [];

  for (const statement of statements) {
    if (
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      targets.push(statement.moduleSpecifier.text);
    }
  }

  return targets;
};

const collectFromModuleDeclaration = (
  node: ts.ModuleDeclaration,
  aliases: Map<string, DeclarationModuleAlias>,
  declarationFile: string
): void => {
  if (!ts.isStringLiteral(node.name) || !node.body) {
    return;
  }

  let body: ts.ModuleBody | undefined = node.body;
  while (body && ts.isModuleDeclaration(body)) {
    body = body.body;
  }

  if (!body || !ts.isModuleBlock(body)) {
    return;
  }

  const targets = Array.from(new Set(collectAliasTargets(body.statements)));
  if (targets.length !== 1) {
    return;
  }

  const targetSpecifier = targets[0];
  if (!targetSpecifier) {
    return;
  }

  aliases.set(node.name.text, {
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

    const sourceFile = ts.createSourceFile(
      declarationFile,
      sourceText,
      ts.ScriptTarget.Latest,
      false,
      getScriptKindFromPath(declarationFile)
    );

    const visit = (node: ts.Node): void => {
      if (ts.isModuleDeclaration(node)) {
        collectFromModuleDeclaration(node, aliases, declarationFile);
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  return aliases;
};

const collectAmbientGlobalImportsFromNode = (
  node: ts.Node,
  declarationFile: string,
  imports: DeclarationGlobalImport[]
): void => {
  if (
    !ts.isVariableDeclaration(node) ||
    !ts.isIdentifier(node.name)
  ) {
    return;
  }

  const typeNode = node.type;
  if (!typeNode || !ts.isImportTypeNode(typeNode) || !typeNode.isTypeOf) {
    return;
  }

  const argument =
    ts.isLiteralTypeNode(typeNode.argument) &&
    ts.isStringLiteral(typeNode.argument.literal)
      ? typeNode.argument.literal
      : undefined;
  if (!argument) {
    return;
  }

  const exportName = typeNode.qualifier
    ? readEntityNameText(typeNode.qualifier).trim()
    : undefined;
  if (!exportName) {
    return;
  }

  let current: ts.Node | undefined = node.parent;
  let isAmbientGlobal = false;
  while (current) {
    if (
      ts.isModuleDeclaration(current) &&
      ts.isIdentifier(current.name) &&
      current.name.text === "global"
    ) {
      isAmbientGlobal = true;
      break;
    }
    current = current.parent;
  }

  if (!isAmbientGlobal) {
    return;
  }

  imports.push({
    globalName: node.name.text,
    targetSpecifier: argument.text,
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

    const sourceFile = ts.createSourceFile(
      declarationFile,
      sourceText,
      ts.ScriptTarget.Latest,
      false,
      getScriptKindFromPath(declarationFile)
    );

    const visit = (node: ts.Node): void => {
      collectAmbientGlobalImportsFromNode(node, declarationFile, imports);
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  return imports;
};
