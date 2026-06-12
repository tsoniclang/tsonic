import type { bool } from "@tsonic/core/types.js";
import type { GoError, GoPtr, GoSlice } from "../../go/compat.js";
import type { HasFileName, SourceFile } from "../ast/ast.js";
import type { CompilerOptions, ModuleKind } from "../core/compileroptions.js";
import type { SourceOutputAndProjectReference } from "../tsoptions/parsedcommandline.js";
import type { Path } from "../tspath/path.js";
import type { EmitResolver } from "./emitresolver.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emithost.go::type::EmitHost","kind":"type","status":"implemented","sigHash":"86d3825eb042c6035fe2cb5b2b3b1f40c7a5774c29d4ec77071e82aed8b8c86b","bodyHash":"5824fbdddcfa79228815746e7c18c8837e83754070f0a6e3fb680936ba26c57e"}
 *
 * Go source:
 * EmitHost interface {
 * 	Options() *core.CompilerOptions
 * 	SourceFiles() []*ast.SourceFile
 * 	UseCaseSensitiveFileNames() bool
 * 	GetCurrentDirectory() string
 * 	CommonSourceDirectory() string
 * 	IsEmitBlocked(file string) bool
 * 	WriteFile(fileName string, text string) error
 * 	GetEmitModuleFormatOfFile(file ast.HasFileName) core.ModuleKind
 * 	GetEmitResolver() EmitResolver
 * 	GetProjectReferenceFromSource(path tspath.Path) *tsoptions.SourceOutputAndProjectReference
 * 	IsSourceFileFromExternalLibrary(file *ast.SourceFile) bool
 * }
 */
export interface EmitHost {
  Options(): GoPtr<CompilerOptions>;
  SourceFiles(): GoSlice<GoPtr<SourceFile>>;
  UseCaseSensitiveFileNames(): bool;
  GetCurrentDirectory(): string;
  CommonSourceDirectory(): string;
  IsEmitBlocked(file: string): bool;
  WriteFile(fileName: string, text: string): GoError;
  GetEmitModuleFormatOfFile(file: HasFileName): ModuleKind;
  GetEmitResolver(): EmitResolver;
  GetProjectReferenceFromSource(path: Path): GoPtr<SourceOutputAndProjectReference>;
  IsSourceFileFromExternalLibrary(file: GoPtr<SourceFile>): bool;
}
