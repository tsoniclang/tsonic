import { Node_Text, SourceFile_Diagnostics, SourceFile_FileName, SourceFile_GetPositionMap, SourceFile_Imports, SourceFile_JSDiagnostics, SourceFile_JSDocDiagnostics, SourceFile_Path, SourceFile_as_ast_HasFileName } from "../internal/ast/ast.js";
import { PositionMap_UTF8ToUTF16 } from "../internal/ast/positionmap.js";
import { IsExportDeclaration, IsExternalModuleReference, IsImportDeclaration, IsImportEqualsDeclaration, IsImportTypeNode, IsJSImportDeclaration, IsLiteralTypeNode, IsModuleBlock, IsModuleDeclaration, IsSourceFile } from "../internal/ast/generated/predicates.js";
import { Node_End } from "../internal/ast/spine.js";
import { IsAmbientModule, IsImportCall, IsRequireCall, WalkUpParenthesizedExpressions } from "../internal/ast/utilities.js";
import { getModeForTypeReferenceDirectiveInFile, getModeForUsageLocation, processAllProgramFiles } from "../internal/compiler/fileloader.js";
import { projectReferenceFileMapper_getCompilerOptionsForFile } from "../internal/compiler/projectreferencefilemapper.js";
import { ResolutionModeCommonJS, ResolutionModeESM } from "../internal/core/compileroptions.js";
import { TextRange_End, TextRange_Pos } from "../internal/core/text.js";
import { GetTokenPosOfNode } from "../internal/scanner/scanner.js";
import { GetLibFileName } from "../internal/tsoptions/enummaps.js";
import { ParsedCommandLine_FileNames, ParsedCommandLine_GetConfigFileParsingDiagnostics } from "../internal/tsoptions/parsedcommandline.js";
import { ResolveTripleslashReference, ToPath } from "../internal/tspath/path.js";
function statementPlacement(statement) {
    const owner = statement.Parent;
    if (owner === undefined)
        throw new Error("The parser returned a source-import statement without its parent.");
    if (IsSourceFile(owner))
        return "statement";
    const declaration = owner.Parent;
    if (IsModuleBlock(owner) && declaration !== undefined && IsModuleDeclaration(declaration) && IsAmbientModule(declaration))
        return "ambient-module";
    throw new Error("The parser returned a source-import statement outside its source file or ambient module.");
}
function referenceSyntax(node) {
    const parent = node.Parent;
    if (parent === undefined)
        throw new Error("The parser returned a source-import occurrence without its parent.");
    if (IsImportDeclaration(parent))
        return { kind: "import", placement: statementPlacement(parent) };
    if (IsExportDeclaration(parent))
        return { kind: "export", placement: statementPlacement(parent) };
    if (IsJSImportDeclaration(parent))
        return { kind: "import-type", placement: statementPlacement(parent) };
    if (IsExternalModuleReference(parent)) {
        const declaration = parent.Parent;
        if (declaration === undefined || !IsImportEqualsDeclaration(declaration))
            throw new Error("The parser returned a require reference without an import-equals declaration.");
        return { kind: "require", placement: statementPlacement(declaration) };
    }
    if (IsRequireCall(parent, true))
        return { kind: "require", placement: "expression" };
    if (IsImportCall(WalkUpParenthesizedExpressions(parent)))
        return { kind: "dynamic-import", placement: "expression" };
    if (IsLiteralTypeNode(parent) && IsImportTypeNode(parent?.Parent))
        return { kind: "import-type", placement: "expression" };
    throw new Error("The parser returned an unsupported source-import parent.");
}
function referenceMode(mode) {
    if (mode === ResolutionModeCommonJS)
        return "require";
    if (mode === ResolutionModeESM)
        return "import";
    return "none";
}
function resolution(fileName) {
    return fileName === undefined || fileName === ""
        ? { kind: "unresolved" }
        : { kind: "resolved", fileName };
}
export function prepareSourceImports(input) {
    const processed = processAllProgramFiles({ Host: input.host, Config: input.config }, true);
    const files = [];
    const diagnostics = [];
    const diagnosticIdentities = new Set();
    const addDiagnostic = (diagnostic) => {
        if (diagnostic !== undefined && !diagnosticIdentities.has(diagnostic)) {
            diagnosticIdentities.add(diagnostic);
            diagnostics.push(diagnostic);
        }
    };
    for (const diagnostic of ParsedCommandLine_GetConfigFileParsingDiagnostics(input.config))
        addDiagnostic(diagnostic);
    for (const resolutions of processed.resolvedModules.values()) {
        for (const resolved of resolutions?.values() ?? []) {
            for (const diagnostic of resolved?.ResolutionDiagnostics ?? [])
                addDiagnostic(diagnostic);
        }
    }
    for (const resolutions of processed.typeResolutionsInFile.values()) {
        for (const resolved of resolutions?.values() ?? []) {
            for (const diagnostic of resolved?.ResolutionDiagnostics ?? [])
                addDiagnostic(diagnostic);
        }
    }
    const canonicalPath = (fileName) => ToPath(fileName, input.host.GetCurrentDirectory(), input.host.FS().UseCaseSensitiveFileNames());
    const roots = ParsedCommandLine_FileNames(input.config).map(fileName => ({
        fileName,
        state: processed.filesByPath.get(canonicalPath(fileName)) === undefined ? "missing" : "loaded",
    }));
    for (const sourceFile of processed.files) {
        if (sourceFile === undefined)
            throw new Error("The syntax-only file loader returned an absent source file.");
        const fileName = SourceFile_FileName(sourceFile);
        const path = SourceFile_Path(sourceFile);
        const metadata = processed.sourceFileMetaDatas.get(path);
        if (metadata === undefined)
            throw new Error("The syntax-only file loader omitted source metadata.");
        const options = projectReferenceFileMapper_getCompilerOptionsForFile(processed.projectReferenceFileMapper, SourceFile_as_ast_HasFileName(sourceFile));
        const references = [];
        const referenceNodes = new Set();
        // The parser's positions are UTF-8 byte offsets. Both ends of every range are converted
        // through the source file's own position map; a byte length is never used as a length.
        const positionMap = SourceFile_GetPositionMap(sourceFile);
        if (positionMap === undefined)
            throw new Error("The syntax-only file loader returned a source file without a position map.");
        const utf16Range = (startByte, endByte) => {
            const start = PositionMap_UTF8ToUTF16(positionMap, startByte);
            return { start, length: PositionMap_UTF8ToUTF16(positionMap, endByte) - start };
        };
        for (const diagnostic of SourceFile_Diagnostics(sourceFile))
            addDiagnostic(diagnostic);
        for (const diagnostic of SourceFile_JSDiagnostics(sourceFile) ?? [])
            addDiagnostic(diagnostic);
        for (const diagnostic of SourceFile_JSDocDiagnostics(sourceFile) ?? [])
            addDiagnostic(diagnostic);
        for (const node of SourceFile_Imports(sourceFile) ?? []) {
            if (node === undefined)
                throw new Error("The parser returned an absent source-import occurrence.");
            if (referenceNodes.has(node))
                continue;
            referenceNodes.add(node);
            const specifier = Node_Text(node);
            const mode = getModeForUsageLocation(fileName, metadata, node, options);
            const resolved = processed.resolvedModules.get(path)?.get({ Name: specifier, Mode: mode });
            const range = utf16Range(GetTokenPosOfNode(node, sourceFile, false), Node_End(node));
            references.push({ ...referenceSyntax(node), specifier, start: range.start,
                length: range.length, mode: referenceMode(mode), resolution: resolution(resolved?.ResolvedFileName) });
        }
        const addReference = (reference, kind) => {
            if (reference === undefined)
                throw new Error("The parser returned an absent triple-slash occurrence.");
            let resolvedFileName;
            let mode = "none";
            if (kind === "reference-path") {
                const target = ResolveTripleslashReference(reference.FileName, fileName);
                const targetFile = processed.filesByPath.get(canonicalPath(target));
                if (targetFile !== undefined)
                    resolvedFileName = SourceFile_FileName(targetFile);
            }
            else if (kind === "reference-types") {
                const actualMode = getModeForTypeReferenceDirectiveInFile(reference, sourceFile, metadata, options);
                mode = referenceMode(actualMode);
                const resolutions = processed.typeResolutionsInFile.get(path);
                resolvedFileName = resolutions?.get({ Name: reference.FileName, Mode: actualMode })?.ResolvedFileName;
            }
            else {
                const [name, known] = GetLibFileName(reference.FileName);
                if (known) {
                    for (const library of processed.libFiles.values()) {
                        if (library?.Name === name) {
                            const targetFile = processed.filesByPath.get(canonicalPath(library.path));
                            if (targetFile !== undefined)
                                resolvedFileName = SourceFile_FileName(targetFile);
                            break;
                        }
                    }
                }
            }
            const range = utf16Range(TextRange_Pos(reference), TextRange_End(reference));
            references.push({ kind, placement: "directive", specifier: reference.FileName,
                start: range.start, length: range.length,
                mode, resolution: resolution(resolvedFileName) });
        };
        for (const reference of sourceFile.ReferencedFiles)
            addReference(reference, "reference-path");
        for (const reference of sourceFile.TypeReferenceDirectives)
            addReference(reference, "reference-types");
        for (const reference of sourceFile.LibReferenceDirectives)
            addReference(reference, "reference-lib");
        references.sort((left, right) => left.start - right.start || left.length - right.length);
        files.push({ fileName, declarationFile: sourceFile.IsDeclarationFile, references });
    }
    return { roots, files, diagnostics };
}
//# sourceMappingURL=source-import-preparation.js.map