import { Node_Elements, Node_Expression, Node_Initializer, Node_ModifierFlags, Node_ModuleSpecifier, Node_Text, SourceFile_FileName, SourceFile_Path, SourceFile_Text, } from "../internal/ast/ast.js";
import { Node_Name } from "../internal/ast/spine.js";
import { NewHasFileName } from "../internal/ast/utilities.js";
import { AsExportAssignment, AsExportDeclaration, AsExportSpecifier, AsNamedExports, AsNamespaceExport, AsStringLiteral, AsVariableDeclarationList, AsVariableStatement, } from "../internal/ast/generated/casts.js";
import { KindBigIntLiteral, KindFalseKeyword, KindNoSubstitutionTemplateLiteral, KindNullKeyword, KindNumericLiteral, KindRegularExpressionLiteral, KindStringLiteral, KindTrueKeyword, } from "../internal/ast/generated/kinds.js";
import { IsClassDeclaration, IsEnumDeclaration, IsExportAssignment, IsExportDeclaration, IsFunctionDeclaration, IsImportDeclaration, IsInterfaceDeclaration, IsModuleDeclaration, IsNamedExports, IsNamespaceExport, IsTypeAliasDeclaration, IsVariableStatement, } from "../internal/ast/generated/predicates.js";
import { ModifierFlagsDefault, ModifierFlagsExport } from "../internal/ast/modifierflags.js";
import { Program_GetResolvedModuleFromModuleSpecifier } from "../internal/compiler/program.js";
import { ResolvedModule_IsResolved } from "../internal/module/types.js";
import { createExtensionImportIndex, } from "./import-index.js";
const nodesOf = (list) => list?.Nodes ?? [];
const isLiteralExpression = (node) => {
    switch (node?.Kind) {
        case KindBigIntLiteral:
        case KindFalseKeyword:
        case KindNoSubstitutionTemplateLiteral:
        case KindNullKeyword:
        case KindNumericLiteral:
        case KindRegularExpressionLiteral:
        case KindStringLiteral:
        case KindTrueKeyword:
            return true;
        default:
            return false;
    }
};
const nodeText = (node) => {
    const text = node === undefined ? "" : Node_Text(node);
    return text === "" ? undefined : text;
};
const sourceFileKey = (sourceFile) => sourceFile === undefined ? "" : SourceFile_FileName(sourceFile);
const toResolvedModule = (resolvedModule) => {
    if (resolvedModule === undefined || !ResolvedModule_IsResolved(resolvedModule)) {
        return undefined;
    }
    const packageId = resolvedModule.PackageId;
    return {
        resolvedFileName: resolvedModule.ResolvedFileName,
        originalPath: resolvedModule.OriginalPath,
        extension: resolvedModule.Extension,
        packageName: packageId.Name === "" ? undefined : packageId.Name,
        packageSubmoduleName: packageId.SubModuleName === "" ? undefined : packageId.SubModuleName,
        packageVersion: packageId.Version === "" ? undefined : packageId.Version,
        isExternalLibraryImport: resolvedModule.IsExternalLibraryImport === true,
    };
};
const resolveModuleSpecifier = (program, sourceFile, moduleSpecifier) => {
    if (!program || !sourceFile || !moduleSpecifier) {
        return undefined;
    }
    const stringLiteral = AsStringLiteral(moduleSpecifier);
    if (!stringLiteral) {
        return undefined;
    }
    return toResolvedModule(Program_GetResolvedModuleFromModuleSpecifier(program, NewHasFileName(SourceFile_FileName(sourceFile), SourceFile_Path(sourceFile)), stringLiteral));
};
const resolvedImportModules = (program, sourceFile) => {
    const importIndex = createExtensionImportIndex(sourceFile);
    return importIndex.modules.map((module) => ({
        ...module,
        resolvedModule: resolveModuleSpecifier(program, sourceFile, Node_ModuleSpecifier(module.importNode)),
    }));
};
const pushNamedExportSpecifiers = (exports, sourceFile, program, exportNode, exportClause, moduleSpecifier, declarationIsTypeOnly) => {
    const namedExports = AsNamedExports(exportClause);
    for (const specifierNode of nodesOf(namedExports?.Elements)) {
        const specifier = AsExportSpecifier(specifierNode);
        if (!specifier) {
            continue;
        }
        const exportedName = nodeText(specifier.name);
        const localName = nodeText(specifier.PropertyName) ?? exportedName;
        if (!exportedName) {
            continue;
        }
        exports.push({
            kind: "named",
            exportedName,
            localName,
            sourceSpecifier: nodeText(moduleSpecifier),
            isTypeOnly: declarationIsTypeOnly || specifier.IsTypeOnly === true,
            exportNode,
            bindingNode: specifierNode,
            resolvedModule: resolveModuleSpecifier(program, sourceFile, moduleSpecifier),
        });
    }
};
const pushExportDeclaration = (exports, sourceFile, program, exportNode) => {
    const declaration = AsExportDeclaration(exportNode);
    if (!declaration) {
        return;
    }
    const moduleSpecifier = declaration.ModuleSpecifier;
    const exportClause = declaration.ExportClause;
    if (!exportClause) {
        exports.push({
            kind: "star",
            sourceSpecifier: nodeText(moduleSpecifier),
            isTypeOnly: declaration.IsTypeOnly === true,
            exportNode,
            bindingNode: exportNode,
            resolvedModule: resolveModuleSpecifier(program, sourceFile, moduleSpecifier),
        });
        return;
    }
    if (IsNamedExports(exportClause)) {
        pushNamedExportSpecifiers(exports, sourceFile, program, exportNode, exportClause, moduleSpecifier, declaration.IsTypeOnly === true);
        return;
    }
    if (IsNamespaceExport(exportClause)) {
        const namespaceExport = AsNamespaceExport(exportClause);
        const exportedName = nodeText(namespaceExport?.name);
        exports.push({
            kind: "namespace",
            exportedName,
            sourceSpecifier: nodeText(moduleSpecifier),
            isTypeOnly: declaration.IsTypeOnly === true,
            exportNode,
            bindingNode: exportClause,
            resolvedModule: resolveModuleSpecifier(program, sourceFile, moduleSpecifier),
        });
    }
};
const pushExportAssignment = (exports, exportNode) => {
    const assignment = AsExportAssignment(exportNode);
    if (!assignment) {
        return;
    }
    exports.push({
        kind: assignment.IsExportEquals === true ? "export-equals" : "default",
        localName: nodeText(Node_Expression(exportNode)),
        isTypeOnly: false,
        exportNode,
        bindingNode: Node_Expression(exportNode),
    });
};
const pushExportedVariables = (exports, statement, isDefault) => {
    const declarationList = AsVariableStatement(statement)?.DeclarationList;
    const declarations = AsVariableDeclarationList(declarationList)?.Declarations;
    for (const declaration of nodesOf(declarations)) {
        const localName = nodeText(Node_Name(declaration));
        if (!localName) {
            continue;
        }
        exports.push({
            kind: isDefault ? "default" : "named",
            exportedName: isDefault ? "default" : localName,
            localName,
            isTypeOnly: false,
            exportNode: statement,
            bindingNode: declaration,
        });
    }
};
const hasExecutableInitializer = (node) => {
    const declarationList = AsVariableStatement(node)?.DeclarationList;
    const declarations = AsVariableDeclarationList(declarationList)?.Declarations;
    return nodesOf(declarations).some((declaration) => {
        const initializer = Node_Initializer(declaration);
        return initializer !== undefined && !isLiteralExpression(initializer);
    });
};
const isTopLevelCode = (node) => {
    if (IsModuleDeclaration(node))
        return false;
    if (IsImportDeclaration(node))
        return false;
    if (IsExportDeclaration(node))
        return false;
    if (IsExportAssignment(node))
        return false;
    if (IsTypeAliasDeclaration(node))
        return false;
    if (IsInterfaceDeclaration(node))
        return false;
    if (IsFunctionDeclaration(node))
        return false;
    if (IsClassDeclaration(node))
        return false;
    if (IsEnumDeclaration(node))
        return false;
    if (IsVariableStatement(node))
        return hasExecutableInitializer(node);
    return true;
};
const pushExportedDeclaration = (exports, statement) => {
    const modifiers = Node_ModifierFlags(statement);
    if ((modifiers & ModifierFlagsExport) === 0) {
        return;
    }
    const isDefault = (modifiers & ModifierFlagsDefault) !== 0;
    if (IsVariableStatement(statement)) {
        pushExportedVariables(exports, statement, isDefault);
        return;
    }
    if (IsFunctionDeclaration(statement) ||
        IsClassDeclaration(statement) ||
        IsInterfaceDeclaration(statement) ||
        IsTypeAliasDeclaration(statement) ||
        IsEnumDeclaration(statement) ||
        IsModuleDeclaration(statement)) {
        const localName = nodeText(Node_Name(statement));
        exports.push({
            kind: isDefault ? "default" : "named",
            exportedName: isDefault ? "default" : localName,
            localName,
            isTypeOnly: IsInterfaceDeclaration(statement) || IsTypeAliasDeclaration(statement),
            exportNode: statement,
            bindingNode: Node_Name(statement),
        });
    }
};
const collectExports = (program, sourceFile) => {
    const exports = [];
    for (const statement of nodesOf(sourceFile?.Statements)) {
        if (IsExportDeclaration(statement)) {
            pushExportDeclaration(exports, sourceFile, program, statement);
            continue;
        }
        if (IsExportAssignment(statement)) {
            pushExportAssignment(exports, statement);
            continue;
        }
        pushExportedDeclaration(exports, statement);
    }
    return exports;
};
export const createExtensionModuleGraph = (program, sourceFiles) => {
    const modules = sourceFiles
        .filter((sourceFile) => sourceFile !== undefined)
        .map((sourceFile) => ({
        sourceFile,
        fileName: SourceFile_FileName(sourceFile),
        text: SourceFile_Text(sourceFile),
        imports: resolvedImportModules(program, sourceFile),
        exports: collectExports(program, sourceFile),
        hasTopLevelCode: nodesOf(sourceFile.Statements).some(isTopLevelCode),
    }));
    const byFileName = new Map(modules.map((module) => [module.fileName, module]));
    const getSourceFileModule = (sourceFile) => byFileName.get(sourceFileKey(sourceFile));
    return {
        modules,
        getSourceFileModule,
        getImports: (sourceFile) => getSourceFileModule(sourceFile)?.imports ?? [],
        getExports: (sourceFile) => getSourceFileModule(sourceFile)?.exports ?? [],
        getResolvedModule: (sourceFile, specifier) => getSourceFileModule(sourceFile)?.imports.find((module) => module.specifier === specifier)?.resolvedModule ??
            getSourceFileModule(sourceFile)?.exports.find((binding) => binding.sourceSpecifier === specifier)?.resolvedModule,
        getImportBinding: (sourceFile, localName) => getSourceFileModule(sourceFile)
            ?.imports.flatMap((module) => module.bindings)
            .find((binding) => binding.localName === localName),
        getExportBinding: (sourceFile, exportedName) => getSourceFileModule(sourceFile)?.exports.find((binding) => binding.exportedName === exportedName),
    };
};
//# sourceMappingURL=module-graph.js.map