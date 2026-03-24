import { existsSync, readFileSync } from "node:fs";
import {
  appendSourceFunctionSignature,
  type SourceFunctionSignatureSurface,
} from "../../../package-manifests/source-function-surfaces.js";
import type { Result } from "../../../types.js";
import { getPropertyNameText, printTypeNodeText } from "../portable-types.js";
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
  const exportedValueAnonymousTypeTextsByName = new Map<
    string,
    readonly string[]
  >();
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

  const renderAnonymousTypeTextFromExpression = (
    expression: ts.Expression
  ): string | undefined => {
    const current = unwrapExpression(expression);

    if (ts.isObjectLiteralExpression(current)) {
      const members: string[] = [];
      for (const property of current.properties) {
        if (ts.isSpreadAssignment(property)) return undefined;

        if (ts.isPropertyAssignment(property)) {
          const propertyName = getPropertyNameText(property.name);
          if (!propertyName) return undefined;
          const propertyTypeText = renderAnonymousTypeTextFromExpression(
            property.initializer
          );
          if (!propertyTypeText) return undefined;
          members.push(`${propertyName}: ${propertyTypeText}`);
          continue;
        }

        if (ts.isShorthandPropertyAssignment(property)) {
          const propertyName = property.name.text;
          members.push(`${propertyName}: unknown`);
          continue;
        }

        if (ts.isMethodDeclaration(property)) {
          const methodName = getPropertyNameText(property.name);
          if (!methodName) return undefined;
          const typeParametersText = property.typeParameters
            ? `<${property.typeParameters
                .map((typeParameter) => typeParameter.name.text)
                .join(", ")}>`
            : "";
          const parametersText = property.parameters
            .map((parameter, index) => {
              const parameterName = ts.isIdentifier(parameter.name)
                ? parameter.name.text
                : `p${index + 1}`;
              const optionalMark = parameter.questionToken ? "?" : "";
              const restPrefix = parameter.dotDotDotToken ? "..." : "";
              const parameterTypeText = parameter.type
                ? printTypeNodeText(parameter.type, sourceFile)
                : "unknown";
              return `${restPrefix}${parameterName}${optionalMark}: ${parameterTypeText}`;
            })
            .join(", ");
          const returnTypeText = property.type
            ? printTypeNodeText(property.type, sourceFile)
            : "unknown";
          members.push(
            `${methodName}${typeParametersText}(${parametersText}): ${returnTypeText}`
          );
          continue;
        }

        if (ts.isGetAccessorDeclaration(property)) {
          const propertyName = getPropertyNameText(property.name);
          if (!propertyName) return undefined;
          members.push(
            `${propertyName}: ${property.type ? printTypeNodeText(property.type, sourceFile) : "unknown"}`
          );
          continue;
        }

        if (ts.isSetAccessorDeclaration(property)) {
          const propertyName = getPropertyNameText(property.name);
          if (!propertyName) return undefined;
          const setterType = property.parameters[0]?.type;
          members.push(
            `${propertyName}: ${setterType ? printTypeNodeText(setterType, sourceFile) : "unknown"}`
          );
          continue;
        }

        return undefined;
      }

      return `{ ${members.join("; ")} }`;
    }

    if (ts.isArrayLiteralExpression(current)) {
      if (current.elements.length === 0) return "unknown[]";
      const elementTypeTexts = current.elements
        .map((element) =>
          ts.isSpreadElement(element)
            ? undefined
            : renderAnonymousTypeTextFromExpression(element)
        )
        .filter((entry): entry is string => entry !== undefined);
      if (elementTypeTexts.length !== current.elements.length) return undefined;
      const uniqueElementTypeTexts = Array.from(new Set(elementTypeTexts));
      return uniqueElementTypeTexts.length === 1
        ? `${uniqueElementTypeTexts[0]}[]`
        : `(${uniqueElementTypeTexts.join(" | ")})[]`;
    }

    if (
      ts.isStringLiteralLike(current) ||
      ts.isNoSubstitutionTemplateLiteral(current)
    ) {
      return "string";
    }
    if (ts.isNumericLiteral(current) || ts.isBigIntLiteral(current)) {
      return "number";
    }
    if (
      current.kind === ts.SyntaxKind.TrueKeyword ||
      current.kind === ts.SyntaxKind.FalseKeyword
    ) {
      return "boolean";
    }
    if (current.kind === ts.SyntaxKind.NullKeyword) {
      return "null";
    }
    if (
      ts.isIdentifier(current) &&
      current.text === "undefined"
    ) {
      return "undefined";
    }

    return undefined;
  };

  const collectAnonymousTypeTextsFromExpression = (
    expression: ts.Expression | undefined
  ): readonly string[] => {
    if (!expression) return [];

    const collected: string[] = [];
    const seen = new Set<string>();
    const visit = (node: ts.Expression): void => {
      const current = unwrapExpression(node);
      const rendered = renderAnonymousTypeTextFromExpression(current);
      if (rendered?.startsWith("{ ") && !seen.has(rendered)) {
        seen.add(rendered);
        collected.push(rendered);
      }

      if (ts.isObjectLiteralExpression(current)) {
        for (const property of current.properties) {
          if (ts.isPropertyAssignment(property)) {
            visit(property.initializer);
            continue;
          }
          if (ts.isShorthandPropertyAssignment(property)) {
            continue;
          }
          if (ts.isMethodDeclaration(property)) {
            if (property.body) {
              ts.forEachChild(property.body, (child) => {
                if (ts.isExpressionStatement(child)) {
                  visit(child.expression);
                }
              });
            }
            continue;
          }
          if (ts.isSpreadAssignment(property)) {
            visit(property.expression);
          }
        }
        return;
      }

      if (ts.isArrayLiteralExpression(current)) {
        for (const element of current.elements) {
          if (ts.isSpreadElement(element)) {
            visit(element.expression);
            continue;
          }
          visit(element);
        }
        return;
      }

      if (ts.isCallExpression(current) || ts.isNewExpression(current)) {
        for (const argument of current.arguments ?? []) {
          visit(argument);
        }
        return;
      }

      if (ts.isConditionalExpression(current)) {
        visit(current.condition);
        visit(current.whenTrue);
        visit(current.whenFalse);
        return;
      }

      if (ts.isBinaryExpression(current)) {
        visit(current.left);
        visit(current.right);
        return;
      }

      if (ts.isAwaitExpression(current)) {
        visit(current.expression);
        return;
      }

      if (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)) {
        visit(current.expression);
      }
    };

    visit(expression);
    return collected;
  };

  const unwrapExpression = (expression: ts.Expression): ts.Expression => {
    let current = expression;
    while (
      ts.isParenthesizedExpression(current) ||
      ts.isAsExpression(current) ||
      ts.isTypeAssertionExpression(current) ||
      ts.isSatisfiesExpression(current) ||
      ts.isNonNullExpression(current)
    ) {
      current = current.expression;
    }
    return current;
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
          const anonymousTypeTexts =
            collectAnonymousTypeTextsFromExpression(initializer);
          if (anonymousTypeTexts.length > 0) {
            exportedValueAnonymousTypeTextsByName.set(
              exportName,
              anonymousTypeTexts
            );
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
      exportedValueAnonymousTypeTextsByName,
      memberTypesByClassAndMember,
      anonymousTypeLiteralsByShape,
    },
  };
};
