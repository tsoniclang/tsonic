// Faithful JS port of internal/testutil/tsbaseline/type_symbol_baseline.go (pinned TS-Go).
// Lives in tools/ because porter policy keeps upstream test helpers out of the active
// compiler source tree; the harness reaches the ported compiler through dist, exactly like
// run.mjs does. Function structure and control flow mirror the Go source; the Go originals
// are referenced per function.
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const distRoot = new URL("../../../dist/src/", import.meta.url);
const dist = (p) => import(new URL(p, distRoot).href);

const [
  { FS: osFS },
  { WrapFS, LibPath },
  { ParseCommandLine },
  { ParsedCommandLine_FileNames, ParsedCommandLine_CompilerOptions },
  { GetParsedCommandLineOfConfigFile },
  { NewCompilerHost },
  {
    NewProgram, Program_GetSourceFile, Program_GetTypeCheckerForFile, Program_Options, Program_Emit,
    Program_GetProgramDiagnostics, Program_GetSyntacticDiagnostics, Program_GetSemanticDiagnostics,
    Program_GetGlobalDiagnostics, Program_GetDeclarationDiagnostics,
  },
  { Checker_GetTypeAtLocation },
  { Checker_GetSymbolAtLocation },
  { Checker_SymbolToStringEx },
  { IsTypeAny },
  {
    TypeFormatFlagsNoTruncation,
    TypeFormatFlagsAllowUniqueESSymbolType,
    TypeFormatFlagsGenerateNamesForShadowedTypeParams,
    TypeFormatFlagsNodeBuilderFlagsMask,
    TypeFormatFlagsInTypeAlias,
    SymbolFormatFlagsAllowAnyNodeKind,
    Type_AsIntrinsicType,
    IntrinsicType_IntrinsicName,
  },
  { NewNodeBuilder, NodeBuilder_TypeToTypeNode },
  { FlagsIgnoreErrors, InternalFlagsAllowUnresolvedNames },
  { GetEmitContext, EmitContext_Reset },
  { NewPrinter },
  { Printer_Write },
  { NewTextWriter },
  { SkipTrivia, GetECMALineOfPosition, GetECMALineAndUTF16CharacterOfPosition },
  { GetSourceTextOfNodeFromSourceFile, IsIntrinsicJsxName },
  astUtilities,
  predicates,
  { SourceFile_Text, SourceFile_FileName, Node_Text, Node_Type, Node_Expression, Node_TagName, Node_PropertyName, IsTypeOrJSTypeAliasDeclaration },
  { Node_Pos, Node_Name, Node_ForEachChild },
  { EscapeAllInternalSymbolNames },
  kinds,
  { NodeFlagsReparsed },
  { GetBaseFileName },
  { TSTrue },
  { CompilerOptions_GetEmitDeclarations },
  { WrapASTDiagnostics, CompareASTDiagnostics, WriteFormatDiagnostic, FormatDiagnosticsWithColorAndContext, ToDiagnostics },
  { Default: LocaleDefault },
  { Background },
] = await Promise.all([
  dist("internal/vfs/osvfs/os.js"),
  dist("internal/bundled/bundled.js"),
  dist("internal/tsoptions/commandlineparser.js"),
  dist("internal/tsoptions/parsedcommandline.js"),
  dist("internal/tsoptions/tsconfigparsing.js"),
  dist("internal/compiler/host.js"),
  dist("internal/compiler/program.js"),
  dist("internal/checker/checker/types.js"),
  dist("internal/checker/checker/symbols.js"),
  dist("internal/checker/printer.js"),
  dist("internal/checker/utilities.js"),
  dist("internal/checker/types.js"),
  dist("internal/checker/nodebuilder.js"),
  dist("internal/nodebuilder/types.js"),
  dist("internal/printer/emitcontext.js"),
  dist("internal/printer/printer/expressions.js"),
  dist("internal/printer/printer/emit-core.js"),
  dist("internal/printer/textwriter.js"),
  dist("internal/scanner/scanner.js"),
  dist("internal/scanner/utilities.js"),
  dist("internal/ast/utilities.js"),
  dist("internal/ast/generated/predicates.js"),
  dist("internal/ast/ast.js"),
  dist("internal/ast/spine.js"),
  dist("internal/ast/symbol.js"),
  dist("internal/ast/generated/kinds.js"),
  dist("internal/ast/generated/flags.js"),
  dist("internal/tspath/path.js"),
  dist("internal/core/tristate.js"),
  dist("internal/core/compileroptions.js"),
  dist("internal/diagnosticwriter/diagnosticwriter.js"),
  dist("internal/locale/locale.js"),
  dist("go/context.js"),
]);

export const NoContent = "<no content>";

const codeLinesRegexp = /[\r\u2028\u2029]|\r?\n/;
const bracketLineRegex = /^\s*[{|}]\s*$/;
const lineDelimiter = /\r?\n/g;

// util.go removeTestPathPrefixes (retainTrailingDirectorySeparator=false branch)
export function removeTestPathPrefixes(text) {
  return text
    .replaceAll("/.ts/", "")
    .replaceAll("/.lib/", "")
    .replaceAll("/.src/", "")
    .replaceAll("bundled:///libs/", "")
    .replaceAll("file:///./ts/", "file:///")
    .replaceAll("file:///./lib/", "file:///")
    .replaceAll("file:///./src/", "file:///");
}

// util.go isDefaultLibraryFile
export function isDefaultLibraryFile(filePath) {
  const fileName = GetBaseFileName(filePath);
  return fileName.startsWith("lib.") && fileName.endsWith(".d.ts");
}

// The suite's CLI invocation runs before the in-process Program is built, so the case
// directory already contains the emitted outputs. Upstream compiles in a vfs holding
// only the test units; without filtering, an emitted y.d.ts would shadow a y.js input
// during module resolution and corrupt both program file order and checked types. Hide
// exactly the paths the caller classifies as emitted outputs.
function hidePaths(fs, isHiddenPath) {
  const visibleEntryName = (dir, name) => !isHiddenPath(`${dir.replace(/\/+$/, "")}/${name}`);
  return {
    UseCaseSensitiveFileNames: () => fs.UseCaseSensitiveFileNames(),
    FileExists: (path) => !isHiddenPath(path) && fs.FileExists(path),
    ReadFile: (path) => (isHiddenPath(path) ? ["", false] : fs.ReadFile(path)),
    WriteFile: (path, data) => fs.WriteFile(path, data),
    AppendFile: (path, data) => fs.AppendFile(path, data),
    Remove: (path) => fs.Remove(path),
    Chtimes: (path, aTime, mTime) => fs.Chtimes(path, aTime, mTime),
    DirectoryExists: (path) => fs.DirectoryExists(path),
    GetAccessibleEntries: (path) => {
      const entries = fs.GetAccessibleEntries(path);
      return { ...entries, Files: (entries.Files ?? []).filter((name) => visibleEntryName(path, name)) };
    },
    Stat: (path) => (isHiddenPath(path) ? undefined : fs.Stat(path)),
    WalkDir: (root, walkFn) => fs.WalkDir(root, (path, dirEntry, err) => {
      if (dirEntry !== undefined && !dirEntry.IsDir() && isHiddenPath(path)) {
        return undefined;
      }
      return walkFn(path, dirEntry, err);
    }),
    Realpath: (path) => fs.Realpath(path),
  };
}

// Builds the in-process Program for a materialized case directory using the same command
// line the suite passed to the TSTS CLI. Mirrors how cmd/tsgo constructs its compile
// (bundled-lib-wrapped OS FS, bundled default library path).
export function createProgramForCase(caseDir, args, isHiddenPath) {
  const baseFS = WrapFS(osFS());
  const fs = isHiddenPath === undefined ? baseFS : hidePaths(baseFS, isHiddenPath);
  const parseHost = {
    FS: () => fs,
    GetCurrentDirectory: () => caseDir,
  };
  let parsed;
  const projectIndex = args.indexOf("-p");
  if (projectIndex !== -1) {
    const sys = {
      FS: () => fs,
      GetCurrentDirectory: () => caseDir,
    };
    parsed = GetParsedCommandLineOfConfigFile(args[projectIndex + 1], undefined, undefined, sys, undefined);
    if (Array.isArray(parsed)) {
      parsed = parsed[0];
    }
  } else {
    parsed = ParseCommandLine(args, parseHost);
  }
  if (parsed === undefined) {
    return undefined;
  }
  const host = NewCompilerHost(caseDir, fs, LibPath(), undefined, undefined);
  const program = NewProgram({
    Host: host,
    Config: parsed,
    UseSourceOfProjectReference: false,
    SingleThreaded: TSTrue,
    CreateCheckerPool: undefined,
    TypingsLocation: "",
    ProjectName: "",
    Tracing: undefined,
  });
  return { program, rootFileNames: ParsedCommandLine_FileNames(parsed) ?? [], compilerOptions: ParsedCommandLine_CompilerOptions(parsed) };
}

// harnessutil.go compileFilesWithHost: every diagnostics stage is collected
// unconditionally (program, syntactic, semantic, global, declaration), THEN the program
// emits. The staged tsc pipeline (execute/tsc GetDiagnosticsOfAnyProgram) skips the
// semantic check when program diagnostics exist, but declaration-emit node reuse depends
// on checker links populated by that check, so the harness emit can differ from the CLI
// emit (typedefHoisting: TS5055 program diagnostics + reused JSDoc annotations). The
// reference baselines are harness output; this mirrors the harness compile. Emit output
// is captured in memory via the WriteFile override; files the program blocked
// (blockEmittingOfFile, e.g. would-overwrite-input) never reach it, exactly like the
// harness vfs.
export function runHarnessCompile(program) {
  const ctx = Background();
  const diagnostics = [];
  diagnostics.push(...(Program_GetProgramDiagnostics(program) ?? []));
  diagnostics.push(...(Program_GetSyntacticDiagnostics(program, ctx, undefined) ?? []));
  diagnostics.push(...(Program_GetSemanticDiagnostics(program, ctx, undefined) ?? []));
  diagnostics.push(...(Program_GetGlobalDiagnostics(program, ctx) ?? []));
  if (CompilerOptions_GetEmitDeclarations(Program_Options(program))) {
    diagnostics.push(...(Program_GetDeclarationDiagnostics(program, ctx, undefined) ?? []));
  }
  const outputs = new Map();
  const emitResult = Program_Emit(program, ctx, {
    TargetSourceFile: undefined,
    EmitOnly: 0,
    WriteFile: (fileName, text, _data) => {
      outputs.set(fileName, text);
      return undefined;
    },
  });
  return { diagnostics, outputs, emitResult };
}

// error_baseline.go diagnostics presentation (minimalDiagnosticsToString + the lib
// location masking applied to it): wrap, sort with CompareASTDiagnostics, format with
// the harness FormattingOptions (NewLine only — paths print as-is), then strip the
// harness test-path prefixes (/.src/ etc.) and mask lib file locations. This is the
// exact headline text the upstream errors.txt baselines carry; the staged CLI pipeline
// cannot reproduce it once an earlier stage reported (it skips the semantic check), so
// the comparison must run on the harness compile's diagnostics.
const libLocationPrefixPattern = /^(lib.*\.d\.ts)\(\d+,\d+\)/gim;

export function formatHarnessDiagnostics(currentDirectory, diagnostics, pretty = false) {
  const wrapped = [...WrapASTDiagnostics(diagnostics ?? [])];
  wrapped.sort(CompareASTDiagnostics);
  const formatOpts = {
    NewLine: "\n",
    __tsgoEmbedded0: { CurrentDirectory: currentDirectory ?? "", UseCaseSensitiveFileNames: true },
    Locale: LocaleDefault,
  };
  const chunks = [];
  const writer = {
    Write: (bytes) => {
      chunks.push(Buffer.from(bytes).toString("utf8"));
      return [bytes.length, undefined];
    },
  };
  if (pretty) {
    // error_baseline.go minimalDiagnosticsToString pretty branch.
    FormatDiagnosticsWithColorAndContext(writer, ToDiagnostics(wrapped), formatOpts);
  } else {
    for (const diagnostic of wrapped) {
      WriteFormatDiagnostic(writer, diagnostic, formatOpts);
    }
  }
  return removeTestPathPrefixes(chunks.join("")).replace(libLocationPrefixPattern, "$1(--,--)");
}

// type_symbol_baseline.go newTypeWriterWalker
function newTypeWriterWalker(program, hadErrorBaseline) {
  return {
    program,
    hadErrorBaseline,
    currentSourceFile: undefined,
    declarationTextCache: new Map(),
  };
}

// type_symbol_baseline.go (walker *typeWriterWalker) getTypeCheckerForCurrentFile
function getTypeCheckerForCurrentFile(walker) {
  return Program_GetTypeCheckerForFile(walker.program, Background(), walker.currentSourceFile);
}

// type_symbol_baseline.go forEachASTNode
function forEachASTNode(node) {
  const result = [];
  const work = [node];
  const resChildren = [];
  const addChild = (child) => {
    resChildren.push(child);
    return false;
  };
  while (work.length > 0) {
    const elem = work.pop();
    if ((elem.Flags & NodeFlagsReparsed) === 0 || elem.Kind === kinds.KindAsExpression || elem.Kind === kinds.KindSatisfiesExpression ||
      ((elem.Parent.Kind === kinds.KindSatisfiesExpression || elem.Parent.Kind === kinds.KindAsExpression) && elem === Node_Expression(elem.Parent))) {
      if ((elem.Flags & NodeFlagsReparsed) === 0 || elem.Parent.Kind === kinds.KindAsExpression || elem.Parent.Kind === kinds.KindSatisfiesExpression) {
        result.push(elem);
      }
      Node_ForEachChild(elem, addChild);
      resChildren.reverse();
      work.push(...resChildren);
      resChildren.length = 0;
    }
  }
  return result;
}

// type_symbol_baseline.go (walker *typeWriterWalker) visitNode
function visitNode(walker, node, isSymbolWalk) {
  const nodes = forEachASTNode(node);
  const results = [];
  for (const n of nodes) {
    if (astUtilities.IsExpressionNode(n) || n.Kind === kinds.KindIdentifier || astUtilities.IsDeclarationName(n)) {
      const result = writeTypeOrSymbol(walker, n, isSymbolWalk);
      if (result !== undefined) {
        results.push(result);
      }
    }
  }
  return results;
}

// type_symbol_baseline.go isImportStatementName
function isImportStatementName(node) {
  if (predicates.IsImportSpecifier(node.Parent) && (node === Node_Name(node.Parent) || node === Node_PropertyName(node.Parent))) {
    return true;
  }
  if (predicates.IsImportClause(node.Parent) && node === Node_Name(node.Parent)) {
    return true;
  }
  if (predicates.IsImportEqualsDeclaration(node.Parent) && node === Node_Name(node.Parent)) {
    return true;
  }
  return false;
}

// type_symbol_baseline.go isExportStatementName
function isExportStatementName(node) {
  if (predicates.IsExportAssignment(node.Parent) && node === Node_Expression(node.Parent)) {
    return true;
  }
  if (predicates.IsExportSpecifier(node.Parent) && (node === Node_Name(node.Parent) || node === Node_PropertyName(node.Parent))) {
    return true;
  }
  return false;
}

// type_symbol_baseline.go isIntrinsicJsxTag
function isIntrinsicJsxTag(node, sourceFile) {
  if (!(predicates.IsJsxOpeningElement(node.Parent) || predicates.IsJsxClosingElement(node.Parent) || predicates.IsJsxSelfClosingElement(node.Parent))) {
    return false;
  }
  if (Node_TagName(node.Parent) !== node) {
    return false;
  }
  const text = GetSourceTextOfNodeFromSourceFile(sourceFile, node, false);
  return IsIntrinsicJsxName(text);
}

// type_symbol_baseline.go (walker *typeWriterWalker) writeTypeOrSymbol
function writeTypeOrSymbol(walker, node, isSymbolWalk) {
  const actualPos = SkipTrivia(SourceFile_Text(walker.currentSourceFile), Node_Pos(node));
  const line = GetECMALineOfPosition(walker.currentSourceFile, actualPos);
  const sourceText = GetSourceTextOfNodeFromSourceFile(walker.currentSourceFile, node, false);
  const [fileChecker, done] = getTypeCheckerForCurrentFile(walker);
  try {
    const [ctx, putCtx] = GetEmitContext();
    try {
      if (!isSymbolWalk) {
        // Don't try to get the type of something that's already a type.
        // Exception for `T` in `type T = something` because that may evaluate to some interesting type.
        if (astUtilities.IsPartOfTypeNode(node) ||
          (node.Kind === kinds.KindAsExpression || node.Kind === kinds.KindSatisfiesExpression) && (Node_Type(node).Flags & NodeFlagsReparsed) !== 0 ||
          predicates.IsIdentifier(node) &&
            (astUtilities.GetMeaningFromDeclaration(node.Parent) & astUtilities.SemanticMeaningValue) === 0 &&
            !(IsTypeOrJSTypeAliasDeclaration(node.Parent) && node === Node_Name(node.Parent))) {
          return undefined;
        }

        if (predicates.IsOmittedExpression(node)) {
          return undefined;
        }

        let t;
        // Workaround to ensure we output 'C' instead of 'typeof C' for base class expressions
        if (astUtilities.IsExpressionWithTypeArgumentsInClassExtendsClause(node.Parent)) {
          t = Checker_GetTypeAtLocation(fileChecker, node.Parent);
        }
        if (t === undefined || IsTypeAny(t)) {
          t = Checker_GetTypeAtLocation(fileChecker, node);
        }
        let typeString;
        if (!walker.hadErrorBaseline &&
          IsTypeAny(t) &&
          !predicates.IsBindingElement(node.Parent) &&
          !astUtilities.IsPropertyAccessOrQualifiedName(node.Parent) &&
          !astUtilities.IsLabelName(node) &&
          !astUtilities.IsGlobalScopeAugmentation(node.Parent) &&
          !predicates.IsMetaProperty(node.Parent) &&
          !isImportStatementName(node) &&
          !isExportStatementName(node) &&
          !isIntrinsicJsxTag(node, walker.currentSourceFile)) {
          typeString = IntrinsicType_IntrinsicName(Type_AsIntrinsicType(t));
        } else {
          EmitContext_Reset(ctx);
          const builder = NewNodeBuilder(fileChecker, ctx);
          const typeFormatFlags = TypeFormatFlagsNoTruncation | TypeFormatFlagsAllowUniqueESSymbolType | TypeFormatFlagsGenerateNamesForShadowedTypeParams;
          let typeNode = NodeBuilder_TypeToTypeNode(builder, t, node.Parent, (typeFormatFlags & TypeFormatFlagsNodeBuilderFlagsMask) | FlagsIgnoreErrors, InternalFlagsAllowUnresolvedNames, undefined);
          if (predicates.IsIdentifier(node) && predicates.IsTypeAliasDeclaration(node.Parent) && Node_Name(node.Parent) === node && predicates.IsIdentifier(typeNode) && Node_Text(typeNode) === Node_Text(node)) {
            // for a complex type alias `type T = ...`, showing "T : T" isn't very helpful for type tests. When the type produced is the same as
            // the name of the type alias, recreate the type string without reusing the alias name
            typeNode = NodeBuilder_TypeToTypeNode(builder, t, node.Parent, ((typeFormatFlags | TypeFormatFlagsInTypeAlias) & TypeFormatFlagsNodeBuilderFlagsMask) | FlagsIgnoreErrors, InternalFlagsAllowUnresolvedNames, undefined);
          }

          const writer = NewTextWriter("", 0);
          const typePrinter = NewPrinter({ RemoveComments: true }, {}, ctx);
          Printer_Write(typePrinter, typeNode, walker.currentSourceFile, writer, undefined);
          typeString = writer.String();
        }
        return {
          line,
          sourceText,
          symbol: "",
          typ: typeString,
          underline: "",
        };
      }

      const symbol = Checker_GetSymbolAtLocation(fileChecker, node);
      if (symbol === undefined) {
        return undefined;
      }

      let symbolString = "Symbol(" + EscapeAllInternalSymbolNames(Checker_SymbolToStringEx(fileChecker, symbol, node.Parent, 0, SymbolFormatFlagsAllowAnyNodeKind));
      let count = 0;
      for (const declaration of symbol.Declarations ?? []) {
        if (count >= 5) {
          symbolString += ` ... and ${(symbol.Declarations?.length ?? 0) - count} more`;
          break;
        }
        count++;
        symbolString += ", ";
        const cached = walker.declarationTextCache.get(declaration);
        if (cached !== undefined) {
          symbolString += cached;
          continue;
        }

        const declSourceFile = astUtilities.GetSourceFileOfNode(declaration);
        const [declLine, declChar] = GetECMALineAndUTF16CharacterOfPosition(declSourceFile, Node_Pos(declaration));
        const fileName = GetBaseFileName(SourceFile_FileName(declSourceFile));
        symbolString += "Decl(";
        symbolString += fileName;
        symbolString += ", ";
        if (isDefaultLibraryFile(fileName)) {
          symbolString += "--, --)";
        } else {
          symbolString += `${declLine}, ${declChar})`;
        }
      }
      symbolString += ")";
      return {
        line,
        sourceText,
        symbol: symbolString,
        typ: "",
        underline: "",
      };
    } finally {
      putCtx();
    }
  } finally {
    done();
  }
}

// type_symbol_baseline.go (walker *typeWriterWalker) getTypes / getSymbols
function getResults(walker, programPath, isSymbolWalk) {
  const sourceFile = Program_GetSourceFile(walker.program, programPath);
  if (sourceFile === undefined) {
    return [];
  }
  walker.currentSourceFile = sourceFile;
  return visitNode(walker, sourceFile, isSymbolWalk);
}

// type_symbol_baseline.go iterateBaseline
function iterateBaseline(allFiles, fullWalker, isSymbolBaseline) {
  const baselines = [];

  for (const file of allFiles) {
    const unitName = file.unitName;
    let typeLines = "=== " + unitName + " ===\r\n";
    const codeLines = file.content.split(codeLinesRegexp);
    const results = getResults(fullWalker, file.programPath, isSymbolBaseline);
    let lastIndexWritten = -1;
    for (const result of results) {
      if (isSymbolBaseline && result.symbol === "") {
        return baselines;
      }
      if (lastIndexWritten === -1) {
        typeLines += codeLines.slice(0, result.line + 1).join("\r\n");
        typeLines += "\r\n";
      } else if (lastIndexWritten !== result.line) {
        if (!(lastIndexWritten + 1 < codeLines.length &&
          (bracketLineRegex.test(codeLines[lastIndexWritten + 1]) || codeLines[lastIndexWritten + 1].trim() === ""))) {
          typeLines += "\r\n";
        }
        typeLines += codeLines.slice(lastIndexWritten + 1, result.line + 1).join("\r\n");
        typeLines += "\r\n";
      }
      lastIndexWritten = result.line;
      const typeOrSymbolString = isSymbolBaseline ? result.symbol : result.typ;
      const lineText = result.sourceText.replace(lineDelimiter, "");
      typeLines += ">";
      typeLines += `${lineText} : ${typeOrSymbolString}`;
      typeLines += "\r\n";
      if (result.underline !== "") {
        typeLines += ">";
        typeLines += " ".repeat(lineText.length);
        typeLines += " : ";
        typeLines += result.underline;
        typeLines += "\r\n";
      }
    }

    if (lastIndexWritten + 1 < codeLines.length) {
      if (!(lastIndexWritten + 1 < codeLines.length &&
        (bracketLineRegex.test(codeLines[lastIndexWritten + 1]) || codeLines[lastIndexWritten + 1].trim() === ""))) {
        typeLines += "\r\n";
      }
      typeLines += codeLines.slice(lastIndexWritten + 1).join("\r\n");
    }
    typeLines += "\r\n";

    baselines.push(removeTestPathPrefixes(typeLines));
  }

  return baselines;
}

// type_symbol_baseline.go generateBaseline
function generateBaseline(allFiles, fullWalker, header, isSymbolBaseline) {
  let result = "";
  const baselines = iterateBaseline(allFiles, fullWalker, isSymbolBaseline);
  for (const value of baselines) {
    result += value;
  }
  if (result.length > 0) {
    return `//// [${header}] ////\r\n\r\n${result}`;
  }
  return NoContent;
}

// Entry point for the suite runner. Mirrors DoTypeAndSymbolBaseline's fullWalker usage
// (the Go test-only diff fixups and t.Run wrappers do not apply here).
export function generateTypeAndSymbolBaselines({ caseDir, args, allFiles, header, hasErrorBaseline, program }) {
  program ??= createProgramForCase(caseDir, args)?.program;
  if (program === undefined) {
    throw new Error(`tsbaseline: could not create a program for ${caseDir}`);
  }
  // compiler_runner.go filters allFiles to the files actually present in the program.
  const programFiles = allFiles.filter((file) => Program_GetSourceFile(program, file.programPath) !== undefined);
  const fullWalker = newTypeWriterWalker(program, hasErrorBaseline);
  const types = generateBaseline(programFiles, fullWalker, header, false);
  const symbols = generateBaseline(programFiles, fullWalker, header, true);
  return { types, symbols };
}
