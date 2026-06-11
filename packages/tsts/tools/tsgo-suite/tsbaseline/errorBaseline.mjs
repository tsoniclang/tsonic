// Faithful JS port of internal/testutil/tsbaseline/error_baseline.go (pinned TS-Go):
// GetErrorBaseline/iterateErrorBaseline render the full errors.txt baseline — the
// minimal diagnostics block, global errors, then each input file's source interleaved
// with squiggle markers and `!!! <category> TS<code>:` messages. Non-pretty path only
// (the harness compiles tests with Pretty unset).
import { removeTestPathPrefixes, isDefaultLibraryFile } from "./typeSymbolWalker.mjs";

const distRoot = new URL("../../../dist/src/", import.meta.url);
const dist = (p) => import(new URL(p, distRoot).href);

const [
  { WrapASTDiagnostics, CompareASTDiagnostics, WriteFormatDiagnostics, WriteLocation, ToDiagnostics, FlattenDiagnosticMessage },
  { Default: LocaleDefault },
  { ComputeECMALineStarts },
  { ComparePaths, GetBaseFileName },
  { Category_Name },
] = await Promise.all([
  dist("internal/diagnosticwriter/diagnosticwriter.js"),
  dist("internal/locale/locale.js"),
  dist("internal/core/core.js"),
  dist("internal/tspath/path.js"),
  dist("internal/diagnostics/diagnostics.js"),
]);

const harnessNewLine = "\r\n";
const formatOpts = {
  NewLine: harnessNewLine,
  __tsgoEmbedded0: { CurrentDirectory: "", UseCaseSensitiveFileNames: false },
  Locale: LocaleDefault,
};

const diagnosticsLocationPrefix = /^(lib.*\.d\.ts)\(\d+,\d+\)/gim;
const diagnosticsLocationPattern = /(lib.*\.d\.ts):\d+:\d+/gi;
const lineDelimiter = /\r?\n/;
const nonWhitespace = /\S/g;

function writerToString(write) {
  const chunks = [];
  const writer = {
    Write: (bytes) => {
      chunks.push(Buffer.from(bytes).toString("utf8"));
      return [bytes.length, undefined];
    },
  };
  write(writer);
  return chunks.join("");
}

function isTsConfigFile(path) {
  return GetBaseFileName(path).toLowerCase().includes("tsconfig") && path.toLowerCase().endsWith("json");
}

function isBuiltFile(path) {
  // util.go isBuiltFile: under the harness built/local folder; not materialized here.
  return path.startsWith("/.ts/");
}

function formatLocation(file, pos) {
  return writerToString((writer) => {
    WriteLocation(writer, file, pos, formatOpts, (output, text, _style) => {
      output.Write(Buffer.from(text, "utf8"));
      return [text.length, undefined];
    });
  });
}

function minimalDiagnosticsToString(diagnostics) {
  return writerToString((writer) => {
    WriteFormatDiagnostics(writer, ToDiagnostics(diagnostics), formatOpts);
  });
}

function runeLength(text) {
  return [...text].length;
}

// error_baseline.go GetErrorBaseline (non-pretty) = Join(iterateErrorBaseline, "")
export function getErrorBaseline(inputFiles, rawDiagnostics) {
  return iterateErrorBaseline(inputFiles, rawDiagnostics).join("");
}

// error_baseline.go iterateErrorBaseline
export function iterateErrorBaseline(inputFiles, rawDiagnostics) {
  const diagnostics = [...WrapASTDiagnostics(rawDiagnostics ?? [])];
  diagnostics.sort(CompareASTDiagnostics);

  let outputLines = "";
  let totalErrorsReportedInNonLibraryNonTsconfigFiles = 0;
  let errorsReported = 0;
  let firstLine = true;
  const newLine = () => {
    if (firstLine) {
      firstLine = false;
      return "";
    }
    return harnessNewLine;
  };

  const result = [];

  const outputErrorText = (diag) => {
    const message = FlattenDiagnosticMessage(diag, harnessNewLine, LocaleDefault);
    const errLines = [];
    for (let line of removeTestPathPrefixes(message).split("\n")) {
      if (line.endsWith("\r")) {
        line = line.slice(0, -1);
      }
      if (line.length === 0) {
        continue;
      }
      errLines.push(`!!! ${categoryName(diag)} TS${diag.Code()}: ${line}`);
    }
    for (const info of diag.RelatedInformation() ?? []) {
      let location = "";
      if (info.File() !== undefined) {
        location = ` ${formatLocation(info.File(), info.Pos())}`;
      }
      location = removeTestPathPrefixes(location);
      if (location.length > 0 && isDefaultLibraryFile(info.File().FileName())) {
        location = location.replace(diagnosticsLocationPattern, "$1:--:--");
      }
      errLines.push(`!!! related TS${info.Code()}${location}: ${FlattenDiagnosticMessage(info, harnessNewLine, LocaleDefault)}`);
    }
    for (const e of errLines) {
      outputLines += newLine() + e;
    }
    errorsReported++;
    if (diag.File() === undefined || (!isDefaultLibraryFile(diag.File().FileName()) && !isTsConfigFile(diag.File().FileName()))) {
      totalErrorsReportedInNonLibraryNonTsconfigFiles++;
    }
  };

  let topDiagnostics = minimalDiagnosticsToString(diagnostics);
  topDiagnostics = removeTestPathPrefixes(topDiagnostics);
  topDiagnostics = topDiagnostics.replace(diagnosticsLocationPrefix, "$1(--,--)");
  result.push(topDiagnostics + harnessNewLine + harnessNewLine);

  // Report global errors
  for (const error of diagnostics) {
    if (error.File() === undefined) {
      outputErrorText(error);
    }
  }
  result.push(outputLines);
  outputLines = "";
  errorsReported = 0;

  // 'merge' the lines of each input file with any errors associated with it
  const dupeCase = new Set();
  for (const inputFile of inputFiles) {
    const fileErrors = diagnostics.filter((e) =>
      e.File() !== undefined &&
      ComparePaths(removeTestPathPrefixes(e.File().FileName()), removeTestPathPrefixes(inputFile.unitName), { CurrentDirectory: "", UseCaseSensitiveFileNames: false }) === 0);

    outputLines += `${newLine()}==== ${removeTestPathPrefixes(inputFile.unitName)} (${fileErrors.length} errors) ====`;

    let markedErrorCount = 0;
    const lineStarts = ComputeECMALineStarts(inputFile.content);
    const lines = inputFile.content.split(lineDelimiter);

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      let line = lines[lineIndex];
      if (line.length > 0 && line.endsWith("\r")) {
        line = line.slice(0, -1);
      }
      const thisLineStart = Number(lineStarts[lineIndex]);
      const nextLineStart = lineIndex === lines.length - 1 ? inputFile.content.length : Number(lineStarts[lineIndex + 1]);
      outputLines += `${newLine()}    ${line}`;
      for (const errDiagnostic of fileErrors) {
        const errStart = errDiagnostic.Pos();
        const end = errStart + errDiagnostic.Len();
        if (end >= thisLineStart && (errStart < nextLineStart || lineIndex === lines.length - 1)) {
          const relativeOffset = errStart - thisLineStart;
          const length = (end - errStart) - globalThis.Math.max(0, thisLineStart - errStart);
          const squiggleStart = globalThis.Math.max(0, relativeOffset);
          outputLines += `${newLine()}    ${line.slice(0, squiggleStart).replace(nonWhitespace, " ")}`;
          const squiggleEnd = globalThis.Math.max(squiggleStart, globalThis.Math.min(squiggleStart + length, line.length));
          outputLines += "~".repeat(runeLength(line.slice(squiggleStart, squiggleEnd)));
          if (lineIndex === lines.length - 1 || nextLineStart > end) {
            outputErrorText(errDiagnostic);
            markedErrorCount++;
          }
        }
      }
    }

    if (markedErrorCount !== fileErrors.length) {
      throw new globalThis.Error(`errorBaseline: count of errors in ${inputFile.unitName}: marked ${markedErrorCount} != ${fileErrors.length}`);
    }
    const isDupe = dupeCase.has(sanitizeTestFilePath(inputFile.unitName));
    result.push(outputLines);
    if (isDupe) {
      totalErrorsReportedInNonLibraryNonTsconfigFiles -= errorsReported;
    }
    dupeCase.add(sanitizeTestFilePath(inputFile.unitName));
    outputLines = "";
    errorsReported = 0;
  }

  const numLibraryDiagnostics = diagnostics.filter((d) =>
    d.File() !== undefined && (isDefaultLibraryFile(d.File().FileName()) || isBuiltFile(d.File().FileName()))).length;
  const numTsconfigDiagnostics = diagnostics.filter((d) =>
    d.File() !== undefined && isTsConfigFile(d.File().FileName())).length;
  if (totalErrorsReportedInNonLibraryNonTsconfigFiles + numLibraryDiagnostics + numTsconfigDiagnostics !== diagnostics.length) {
    throw new globalThis.Error(`errorBaseline: total number of errors: ${totalErrorsReportedInNonLibraryNonTsconfigFiles} + ${numLibraryDiagnostics} + ${numTsconfigDiagnostics} != ${diagnostics.length}`);
  }

  return result;
}

function categoryName(diag) {
  return Category_Name(diag.Category());
}

// util.go sanitizeTestFilePath (lower-cases for dupe detection)
function sanitizeTestFilePath(path) {
  return removeTestPathPrefixes(path).toLowerCase();
}
