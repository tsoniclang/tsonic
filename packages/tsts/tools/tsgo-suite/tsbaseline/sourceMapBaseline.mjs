// Faithful JS port of internal/testutil/tsbaseline/sourcemap_baseline.go (pinned TS-Go),
// assembling the `<case>.js.map` whole-file baseline: every emitted source map (program
// source order, name-sorted stragglers) followed by a source-map-visualization preview
// link built from the paired emitted JS and the map's sources.
import { fileOutput, orderedEmittedFiles } from "./jsEmitBaseline.mjs";

const distRoot = new URL("../../../dist/src/", import.meta.url);
const dist = (p) => import(new URL(p, distRoot).href);

const [
  { CompilerOptions_GetAreDeclarationMapsEnabled },
  { Tristate_IsTrue },
  { Program_GetSourceFiles },
  { SourceFile_FileName, SourceFile_Text },
] = await Promise.all([
  dist("internal/core/compileroptions.js"),
  dist("internal/core/tristate.js"),
  dist("internal/compiler/program.js"),
  dist("internal/ast/ast.js"),
]);

export const NoContent = "<no content>";

// sourcemap_baseline.go base64EncodeChunk: QueryEscape followed by QueryUnescape is an
// identity transform for valid UTF-8; the chunk is the plain std-base64 of the bytes.
function base64EncodeChunk(s) {
  return Buffer.from(s, "utf8").toString("base64");
}

// sourcemap_baseline.go createSourceMapPreviewLink
function createSourceMapPreviewLink(sourceMap, outputs, inputs) {
  let sourcemapJSON;
  try {
    sourcemapJSON = JSON.parse(sourceMap.content);
  } catch (error) {
    throw new Error(`sourceMapBaseline: source map '${sourceMap.unitName}' is not valid JSON: ${error}`);
  }

  const outputJSFile = outputs.find((file) => file.unitName.endsWith(sourcemapJSON.file));
  if (outputJSFile === undefined) {
    return "";
  }

  const sourceTDs = (sourcemapJSON.sources ?? []).map((source) => inputs.find((file) => file.unitName.endsWith(source)));
  if (sourceTDs.some((file) => file === undefined)) {
    return "";
  }

  let hash = "\n//// https://sokra.github.io/source-map-visualization#base64,";
  hash += base64EncodeChunk(outputJSFile.content);
  hash += ",";
  hash += base64EncodeChunk(sourceMap.content);
  for (const td of sourceTDs) {
    hash += ",";
    hash += base64EncodeChunk(td.content);
  }
  hash += "\n";
  return hash;
}

// sourcemap_baseline.go DoSourcemapBaseline (assembly portion). Returns the baseline text
// or undefined when upstream would not write a sourcemap baseline at all.
export function generateSourceMapBaseline({ program, compilerOptions, hasDiagnostics, fullEmitPaths, emittedOutputs }) {
  const declMaps = CompilerOptions_GetAreDeclarationMapsEnabled(compilerOptions);
  if (Tristate_IsTrue(compilerOptions.InlineSourceMap)) {
    return undefined;
  }
  if (!Tristate_IsTrue(compilerOptions.SourceMap) && !declMaps) {
    return undefined;
  }

  const { JS, DTS, Maps } = orderedEmittedFiles(program, emittedOutputs);
  if ((Tristate_IsTrue(compilerOptions.NoEmitOnError) && hasDiagnostics) || Maps.length === 0) {
    return NoContent;
  }

  // harnessutil newCompilationResult: result.Inputs() lists every PROGRAM source file
  // (program order, program coordinates) — the preview-link suffix matching picks the
  // FIRST program file whose name ends with the map's source entry.
  const inputs = Program_GetSourceFiles(program).map((sourceFile) => ({
    unitName: SourceFile_FileName(sourceFile),
    content: SourceFile_Text(sourceFile),
  }));
  const outputs = [...JS, ...DTS];

  let sourceMapCode = "";
  for (const sourceMap of Maps) {
    if (sourceMapCode.length > 0) {
      sourceMapCode += "\n";
    }
    sourceMapCode += fileOutput(sourceMap, fullEmitPaths);
    sourceMapCode += createSourceMapPreviewLink(sourceMap, outputs, inputs);
  }
  return sourceMapCode;
}
