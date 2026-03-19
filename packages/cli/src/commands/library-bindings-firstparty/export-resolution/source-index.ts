import { existsSync, readFileSync } from "node:fs";
import {
  appendSourceFunctionSignature,
  type SourceFunctionSignatureSurface,
} from "../../../aikya/source-function-surfaces.js";
import type { Result } from "../../../types.js";
import {
  getPropertyNameText,
  printTypeNodeText,
} from "../portable-types.js";
import { renderSourceTypeNodeForAliasLookup } from "../source-type-text.js";
import type {
  ModuleSourceIndex,
  SourceAnonymousTypeLiteralDef,
  SourceMemberTypeDef,
  SourceTypeAliasDef,
  SourceTypeImport,
  SourceValueTypeDef,
} from "../types.js";
import * as ts from "typescript";

export const buildModuleSourceIndex = (
  absoluteFilePath: string,
  fileKey: string
): Result<ModuleSourceIndex, string> => {
  if (!existsSync(absoluteFilePath)) {
    return {
      ok: false,
      error: `Failed to read source file for bindings generation: ${absoluteFilePath}`,
    };
  }

  const content = readFileSync(absoluteFilePath, "utf-8");
  const scriptKind = absoluteFilePath.endsWith(".tsx")
    ? ts.ScriptKind.TSX
    : absoluteFilePath.endsWith(".js")
      ? ts.ScriptKind.JS
      : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(
    absoluteFilePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    scriptKind
  );

  const wrapperImportsByLocalName = new Map<string, SourceTypeImport>();
  const typeImportsByLocalName = new Map<string, SourceTypeImport>();
  const typeAliasesByName = new Map<string, SourceTypeAliasDef>();
  const exportedTypeDeclarationNames = new Set<string>();
  const exportedFunctionSignaturesByName = new Map<
    string,
    SourceFunctionSignatureSurface[]
  >();
  const exportedValueTypesByName = new Map<string, SourceValueTypeDef>();
  const memberTypesByClassAndMember = new Map<
    string,
    Map<string, SourceMemberTypeDef>
  >();
  const anonymousTypeLiteralsByShape = new Map<
    string,
    SourceAnonymousTypeLiteralDef
  >();

  const printTypeParametersText = (
    typeParameters: readonly ts.TypeParameterDeclaration[] | undefined
  ): string => {
    if (!typeParameters || typeParameters.length === 0) return "";
    return `<${typeParameters.map((tp) => tp.getText(sourceFile)).join(", ")}>`;
  };

  const printParameterSignature = (
    param: ts.ParameterDeclaration
  ): { readonly prefixText: string; readonly typeText: string } => {
    const rest = param.dotDotDotToken ? "..." : "";
    const name = param.name.getText(sourceFile);
    const optional = param.questionToken ? "?" : "";
    return {
      prefixText: `${rest}${name}${optional}: `,
      typeText: param.type
        ? printTypeNodeText(param.type, sourceFile)
        : "unknown",
    };
  };

  const addExportedFunctionSignature = (
    name: string,
    signature: SourceFunctionSignatureSurface
  ): void => {
    appendSourceFunctionSignature(
      exportedFunctionSignaturesByName,
      name,
      signature
    );
  };

  const registerAnonymousTypeLiteralsInTypeNode = (
    typeNode: ts.TypeNode | undefined
  ): void => {
    if (!typeNode) return;

    const visit = (current: ts.Node): void => {
      if (ts.isTypeLiteralNode(current)) {
        const shape = renderSourceTypeNodeForAliasLookup(current, new Map());
        if (!anonymousTypeLiteralsByShape.has(shape)) {
          const members = new Map<string, SourceMemberTypeDef>();
          for (const member of current.members) {
            if (!ts.isPropertySignature(member)) continue;
            if (!member.name || !member.type) continue;
            const memberName = getPropertyNameText(member.name);
            if (!memberName) continue;
            members.set(memberName, {
              typeNode: member.type,
              typeText: printTypeNodeText(member.type, sourceFile),
              isOptional: member.questionToken !== undefined,
            });
          }
          anonymousTypeLiteralsByShape.set(shape, {
            typeText: printTypeNodeText(current, sourceFile),
            members,
          });
        }
      }
      ts.forEachChild(current, visit);
    };

    visit(typeNode);
  };

  for (const stmt of sourceFile.statements) {
    if (ts.isImportDeclaration(stmt)) {
      const moduleSpecifier = ts.isStringLiteral(stmt.moduleSpecifier)
        ? stmt.moduleSpecifier.text
        : undefined;
      if (!moduleSpecifier) continue;

      const clause = stmt.importClause;
      if (!clause) continue;

      const namedBindings = clause.namedBindings;
      if (!namedBindings || !ts.isNamedImports(namedBindings)) continue;

      for (const spec of namedBindings.elements) {
        const localName = spec.name.text;
        const importedName = (spec.propertyName ?? spec.name).text;
        typeImportsByLocalName.set(localName, {
          source: moduleSpecifier,
          importedName,
        });
        if (importedName === "ExtensionMethods") {
          wrapperImportsByLocalName.set(localName, {
            source: moduleSpecifier,
            importedName,
          });
        }
      }
      continue;
    }

    if (ts.isTypeAliasDeclaration(stmt)) {
      const aliasName = stmt.name.text;
      const hasExport = stmt.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
      );
      const typeParameterNames = (stmt.typeParameters ?? []).map(
        (tp) => tp.name.text
      );
      typeAliasesByName.set(aliasName, {
        typeParametersText: printTypeParametersText(stmt.typeParameters),
        typeParameterNames,
        type: stmt.type,
        typeText: printTypeNodeText(stmt.type, sourceFile),
      });
      registerAnonymousTypeLiteralsInTypeNode(stmt.type);
      if (hasExport) {
        exportedTypeDeclarationNames.add(aliasName);
      }
      continue;
    }

    if (ts.isFunctionDeclaration(stmt)) {
      const hasExport = stmt.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
      );
      if (!hasExport || !stmt.name || !stmt.type) continue;
      for (const parameter of stmt.parameters) {
        registerAnonymousTypeLiteralsInTypeNode(parameter.type);
      }
      registerAnonymousTypeLiteralsInTypeNode(stmt.type);
      const parameters = stmt.parameters.map(printParameterSignature);
      addExportedFunctionSignature(stmt.name.text, {
        typeParametersText: printTypeParametersText(stmt.typeParameters),
        typeParameterCount: stmt.typeParameters?.length ?? 0,
        parameters,
        returnTypeText: printTypeNodeText(stmt.type, sourceFile),
      });
      continue;
    }

    if (ts.isVariableStatement(stmt)) {
      const hasExport = stmt.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
      );
      if (!hasExport) continue;
      for (const declaration of stmt.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) continue;
        const exportName = declaration.name.text;
        const initializer = declaration.initializer;
        if (!initializer) continue;
        if (
          !ts.isArrowFunction(initializer) &&
          !ts.isFunctionExpression(initializer)
        ) {
          if (declaration.type) {
            registerAnonymousTypeLiteralsInTypeNode(declaration.type);
            exportedValueTypesByName.set(exportName, {
              typeText: printTypeNodeText(declaration.type, sourceFile),
            });
          }
          continue;
        }
        if (!initializer.type) continue;
        for (const parameter of initializer.parameters) {
          registerAnonymousTypeLiteralsInTypeNode(parameter.type);
        }
        registerAnonymousTypeLiteralsInTypeNode(initializer.type);
        const parameters = initializer.parameters.map(printParameterSignature);
        addExportedFunctionSignature(exportName, {
          typeParametersText: printTypeParametersText(
            initializer.typeParameters
          ),
          typeParameterCount: initializer.typeParameters?.length ?? 0,
          parameters,
          returnTypeText: printTypeNodeText(initializer.type, sourceFile),
        });
      }
      continue;
    }

    if (ts.isClassDeclaration(stmt) && stmt.name) {
      const className = stmt.name.text;
      const hasExport = stmt.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
      );
      if (hasExport) {
        exportedTypeDeclarationNames.add(className);
      }
      const members =
        memberTypesByClassAndMember.get(className) ??
        new Map<string, SourceMemberTypeDef>();

      for (const member of stmt.members) {
        if (ts.isGetAccessorDeclaration(member)) {
          if (!member.name || !member.type) continue;
          const name = getPropertyNameText(member.name);
          if (!name) continue;
          members.set(name, {
            typeNode: member.type,
            typeText: printTypeNodeText(member.type, sourceFile),
            isOptional: false,
          });
          continue;
        }

        if (ts.isPropertyDeclaration(member)) {
          if (!member.name || !member.type) continue;
          const name = getPropertyNameText(member.name);
          if (!name) continue;
          registerAnonymousTypeLiteralsInTypeNode(member.type);
          members.set(name, {
            typeNode: member.type,
            typeText: printTypeNodeText(member.type, sourceFile),
            isOptional: member.questionToken !== undefined,
          });
        }
      }

      if (members.size > 0) {
        memberTypesByClassAndMember.set(className, members);
      }
      continue;
    }

    if (ts.isInterfaceDeclaration(stmt)) {
      const interfaceName = stmt.name.text;
      const hasExport = stmt.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
      );
      if (hasExport) {
        exportedTypeDeclarationNames.add(interfaceName);
      }
      const members =
        memberTypesByClassAndMember.get(interfaceName) ??
        new Map<string, SourceMemberTypeDef>();

      for (const member of stmt.members) {
        if (!ts.isPropertySignature(member)) continue;
        if (!member.name || !member.type) continue;
        const name = getPropertyNameText(member.name);
        if (!name) continue;
        registerAnonymousTypeLiteralsInTypeNode(member.type);

        members.set(name, {
          typeNode: member.type,
          typeText: printTypeNodeText(member.type, sourceFile),
          isOptional: member.questionToken !== undefined,
        });
      }

      if (members.size > 0) {
        memberTypesByClassAndMember.set(interfaceName, members);
      }
      continue;
    }

    if (ts.isEnumDeclaration(stmt)) {
      const hasExport = stmt.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
      );
      if (hasExport) {
        exportedTypeDeclarationNames.add(stmt.name.text);
      }
    }
  }

  return {
    ok: true,
    value: {
      fileKey,
      wrapperImportsByLocalName,
      typeImportsByLocalName,
      typeAliasesByName,
      exportedTypeDeclarationNames,
      exportedFunctionSignaturesByName,
      exportedValueTypesByName,
      memberTypesByClassAndMember,
      anonymousTypeLiteralsByShape,
    },
  };
};
