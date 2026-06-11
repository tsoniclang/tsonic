// Faithful JS port of internal/testutil/tsbaseline/js_emit_baseline.go (pinned TS-Go),
// assembling the `<case>.js` whole-file baseline from the case inputs plus the emitted
// JS/DTS outputs in program source order (mirroring harnessutil's inputsAndOutputs
// population), the JSON-output parse-error baselines, and the //// [DtsFileErrors]
// block (the declaration recompile's error baseline), and the noCheck-repeat
// comparison ("!!!! File ..." patience diffs). Difference from the Go original:
// sections are assembled with \n and compared after newline normalization (the suite
// normalizes both sides), where Go writes \r\n.
import { getErrorBaseline } from "./errorBaseline.mjs";

const distRoot = new URL("../../../dist/src/", import.meta.url);
const dist = (p) => import(new URL(p, distRoot).href);

const [
  { Program_GetSourceFiles, Program_Options, Program_GetCurrentDirectory, Program_UseCaseSensitiveFileNames, Program_CommonSourceDirectory },
  { GetOutputExtension },
  { SourceFile_FileName, SourceFile_Diagnostics },
  { IsDeclarationFileName, ChangeExtension, GetDeclarationEmitExtensionForPath },
  { GetBaseFileName, ResolvePath, CombinePaths, GetRelativePathFromDirectory },
  { ParseSourceFile },
  { ScriptKindJSON },
  { Diff, UnifiedDiffTextWithOptions },
  { SplitLines },
] = await Promise.all([
  dist("internal/compiler/program.js"),
  dist("internal/outputpaths/outputpaths.js"),
  dist("internal/ast/ast.js"),
  dist("internal/tspath/extension.js"),
  dist("internal/tspath/path.js"),
  dist("internal/parser/parser/statements-declarations.js"),
  dist("internal/core/scriptkind.js"),
  dist("go/github.com/peter-evans/patience.js"),
  dist("internal/stringutil/util.js"),
]);

import { removeTestPathPrefixes } from "./typeSymbolWalker.mjs";

export const NoContent = "<no content>";

// baseline.go DiffText: patience diff, unified output, 3 lines of context.
function diffText(oldName, newName, expected, actual) {
  const lines = Diff(SplitLines(expected), SplitLines(actual));
  return UnifiedDiffTextWithOptions(lines, {
    Precontext: 3,
    Postcontext: 3,
    SrcHeader: oldName,
    DstHeader: newName,
  });
}

// js_emit_baseline.go fileOutput
export function fileOutput(file, fullEmitPaths) {
  const fileName = fullEmitPaths ? removeTestPathPrefixes(file.unitName) : GetBaseFileName(file.unitName);
  return `//// [${fileName}]\n${file.content}`;
}

function compareTestFiles(a, b) {
  return a.unitName < b.unitName ? -1 : a.unitName > b.unitName ? 1 : 0;
}

// harnessutil.go compilation-output population: pair each non-declaration program source
// file (in program order) with the harness-local getOutputPath computation, then append
// stragglers sorted by unit name. `emittedOutputs` is keyed in the program's own
// coordinates (the vfs paths the harness WriteFile override received).
export function orderedEmittedFiles(program, emittedOutputs) {
  const js = new Map();
  const dts = new Map();
  const maps = new Map();
  for (const [name, content] of emittedOutputs) {
    // harnessutil.go: the JS bucket takes JS extensions AND .json outputs.
    if (/\.[cm]?jsx?$/i.test(name) || /\.json$/i.test(name)) {
      js.set(name, content);
    } else if (/\.d\.[cm]?ts$/i.test(name)) {
      dts.set(name, content);
    } else if (/\.map$/i.test(name)) {
      maps.set(name, content);
    }
  }
  const JS = [];
  const DTS = [];
  const Maps = [];
  const take = (map, into, outputPath) => {
    if (outputPath === undefined || outputPath === "") {
      return;
    }
    if (map.has(outputPath)) {
      into.push({ unitName: outputPath, content: map.get(outputPath) });
      map.delete(outputPath);
    }
  };
  const options = Program_Options(program);
  const currentDirectory = Program_GetCurrentDirectory(program);
  const useCaseSensitiveFileNames = Program_UseCaseSensitiveFileNames(program);
  // harnessutil.go CompilationResult.getOutputPath. Note the Go quirk: the rebase
  // target is always Options.OutDir even when DeclarationDir passed the outDir
  // guard, so declarationDir != outDir outputs never pair and always land in the
  // name-sorted leftovers.
  const getOutputPath = (path, ext) => {
    let resolved = ResolvePath(currentDirectory, path);
    let outDir;
    if (ext === ".d.ts" || ext === ".d.mts" || ext === ".d.cts" || (ext.endsWith(".ts") && ext.includes(".d."))) {
      outDir = options.DeclarationDir ?? "";
      if (outDir === "") {
        outDir = options.OutDir ?? "";
      }
    } else {
      outDir = options.OutDir ?? "";
    }
    if (outDir !== "") {
      const common = Program_CommonSourceDirectory(program);
      if (common !== "") {
        resolved = GetRelativePathFromDirectory(common, resolved, {
          UseCaseSensitiveFileNames: useCaseSensitiveFileNames,
          CurrentDirectory: currentDirectory,
        });
        resolved = CombinePaths(ResolvePath(currentDirectory, options.OutDir ?? ""), resolved);
      }
    }
    return ChangeExtension(resolved, ext);
  };
  for (const sourceFile of Program_GetSourceFiles(program)) {
    const fileName = SourceFile_FileName(sourceFile);
    if (IsDeclarationFileName(fileName)) {
      continue;
    }
    const extname = GetOutputExtension(fileName, options.Jsx);
    take(js, JS, getOutputPath(fileName, extname));
    take(dts, DTS, getOutputPath(fileName, GetDeclarationEmitExtensionForPath(fileName)));
    // harnessutil pairs only the JS source map (extname+".map"); declaration maps are
    // never paired and always land in the name-sorted leftovers.
    take(maps, Maps, getOutputPath(fileName, extname + ".map"));
  }
  // add any unhandled outputs, ordered by unit name
  JS.push(...[...js].map(([rel, content]) => ({ unitName: rel, content })).sort(compareTestFiles));
  DTS.push(...[...dts].map(([rel, content]) => ({ unitName: rel, content })).sort(compareTestFiles));
  Maps.push(...[...maps].map(([rel, content]) => ({ unitName: rel, content })).sort(compareTestFiles));
  return { JS, DTS, Maps };
}

// js_emit_baseline.go DoJSEmitBaseline (assembly portion)
export function generateJsEmitBaseline({ program, toBeCompiled, otherFiles, tsConfigFiles, header, hasDiagnostics, fullEmitPaths, emittedOutputs, declarationCompilation, noCheckRepeat }) {
  let tsCode = `//// [${header}] ////\n\n`;
  const tsSources = [...otherFiles, ...toBeCompiled];
  for (let index = 0; index < tsSources.length; index++) {
    const file = tsSources[index];
    tsCode += `//// [${GetBaseFileName(file.unitName)}]\n`;
    tsCode += file.content;
    if (index < tsSources.length - 1) {
      tsCode += "\n";
    }
  }

  const { JS, DTS } = orderedEmittedFiles(program, emittedOutputs);

  let jsCode = "";
  for (const file of JS) {
    if (jsCode.length > 0 && !jsCode.endsWith("\n")) {
      jsCode += "\n";
    }
    if (!hasDiagnostics && file.unitName.endsWith(".json")) {
      const parseResult = ParseSourceFile({ FileName: file.unitName, Path: file.unitName }, file.content, ScriptKindJSON);
      const parseDiagnostics = SourceFile_Diagnostics(parseResult) ?? [];
      if (parseDiagnostics.length > 0) {
        jsCode += getErrorBaseline([file], parseDiagnostics);
        continue;
      }
    }
    jsCode += fileOutput(file, fullEmitPaths);
  }

  if (DTS.length > 0) {
    jsCode += "\n\n";
    for (const declFile of DTS) {
      jsCode += fileOutput(declFile, fullEmitPaths);
    }
  }

  if (declarationCompilation !== undefined && (declarationCompilation.declResult.diagnostics ?? []).length > 0) {
    jsCode += "\n\n//// [DtsFileErrors]\n";
    jsCode += "\n\n";
    jsCode += getErrorBaseline(
      [...(tsConfigFiles ?? []), ...declarationCompilation.declInputFiles, ...declarationCompilation.declOtherFiles],
      declarationCompilation.declResult.diagnostics,
    );
  }

  // js_emit_baseline.go noCheck-repeat comparison: the same compilation re-run with
  // noCheck must emit identical JS and DTS; differences print `!!!! File ...` blocks
  // with a patience unified diff (baseline.DiffText, 3 lines of context).
  if (noCheckRepeat !== undefined) {
    const original = orderedEmittedFiles(program, emittedOutputs);
    const withoutChecking = orderedEmittedFiles(noCheckRepeat.program, noCheckRepeat.emittedOutputs);
    const byName = (files) => new Map(files.map((file) => [file.unitName, file]));
    const compareResultFileSets = (a, b) => {
      const originals = byName(b);
      for (const doc of a) {
        const originalFile = originals.get(doc.unitName);
        if (originalFile === undefined) {
          jsCode += `\n\n!!!! File ${removeTestPathPrefixes(doc.unitName)} missing from original emit, but present in noCheck emit\n`;
          jsCode += fileOutput(doc, fullEmitPaths);
        } else if (originalFile.content !== doc.content) {
          jsCode += `\n\n!!!! File ${removeTestPathPrefixes(doc.unitName)} differs from original emit in noCheck emit\n`;
          const fileName = fullEmitPaths ? removeTestPathPrefixes(doc.unitName) : GetBaseFileName(doc.unitName);
          jsCode += `//// [${fileName}]\n`;
          jsCode += diffText("Expected\tThe full check baseline", "Actual\twith noCheck set", originalFile.content, doc.content);
        }
      }
    };
    compareResultFileSets(withoutChecking.DTS, original.DTS);
    compareResultFileSets(withoutChecking.JS, original.JS);
  }

  if (jsCode.length > 0) {
    return `${tsCode}\n\n${jsCode}`;
  }
  return NoContent;
}
