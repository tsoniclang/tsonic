import type { GoPtr } from "../../../go/compat.js";
import type { SourceFile } from "../../ast/ast.js";
import type { SourceFileParseOptions } from "../../ast/parseoptions.js";
import type { CompilerHost } from "../../compiler/host.js";
import type { Message } from "../../diagnostics/diagnostics.js";
import type { ParsedCommandLine } from "../../tsoptions/parsedcommandline.js";
import type { Path } from "../../tspath/path.js";
import type { FS as FS_d7943d56 } from "../../vfs/vfs.js";
import { host_DefaultLibraryPath, host_FS, host_GetCurrentDirectory, host_GetResolvedProjectReference, host_GetSourceFile } from "./host.js";
import type { host } from "./host.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/compilerHost.go::type::compilerHost","kind":"type","status":"implemented","sigHash":"982024fc2e1946fec6a927ad0cf4e28a846e3a63f8797cb85d3f4f9b52080235","bodyHash":"4bf4babef578ff9bdfa956d0b584af72db5fcca9f8fd79bf7ca2904620f748b9"}
 *
 * Go source:
 * compilerHost struct {
 * 	host  *host
 * 	trace func(msg *diagnostics.Message, args ...any)
 * }
 */
export interface compilerHost {
  host: GoPtr<host>;
  trace: (msg: GoPtr<Message>, ...args: Array<unknown>) => void;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/compilerHost.go::varGroup::_","kind":"varGroup","status":"implemented","sigHash":"49fbaf64ae10ed60e869e0234672578cdcd492d18042f56b9c710f8c12be2c3e","bodyHash":"6753ea52078cf2082833506648d3a866602a9da76070eca8a79cce5009abf01a"}
 *
 * Go source:
 * var _ compiler.CompilerHost = (*compilerHost)(nil)
 */
export let __56b7611d_0: CompilerHost = compilerHost_as_compiler_CompilerHost(undefined);

export function compilerHost_as_compiler_CompilerHost(receiver: GoPtr<compilerHost>): CompilerHost {
  return {
    FS: (): FS_d7943d56 => compilerHost_FS(receiver),
    DefaultLibraryPath: (): string => compilerHost_DefaultLibraryPath(receiver),
    GetCurrentDirectory: (): string => compilerHost_GetCurrentDirectory(receiver),
    Trace: (msg: GoPtr<Message>, ...args: Array<unknown>): void => compilerHost_Trace(receiver, msg, ...args),
    GetSourceFile: (opts: SourceFileParseOptions): GoPtr<SourceFile> => compilerHost_GetSourceFile(receiver, opts),
    GetResolvedProjectReference: (fileName: string, path: Path): GoPtr<ParsedCommandLine> => compilerHost_GetResolvedProjectReference(receiver, fileName, path),
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/compilerHost.go::method::compilerHost.FS","kind":"method","status":"implemented","sigHash":"7ac0a1648e426ff99ce6a3ac7e77e71a456472c1a332481b2b8db77fe0a4e059","bodyHash":"42172599a24a12bc5ece2e684eb2b12cbcc88f81ae02481050cc5e06779766fe"}
 *
 * Go source:
 * func (h *compilerHost) FS() vfs.FS {
 * 	return h.host.FS()
 * }
 */
export function compilerHost_FS(receiver: GoPtr<compilerHost>): FS_d7943d56 {
  return host_FS(receiver!.host);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/compilerHost.go::method::compilerHost.DefaultLibraryPath","kind":"method","status":"implemented","sigHash":"a8d4b4fc269ee0449007c06f8d637a123a84b81789d5f37cc9bb9f3cb451316f","bodyHash":"1f10325cdf08740aa78df23c613c4d75bb534ded8942afded904027fd61c48b2"}
 *
 * Go source:
 * func (h *compilerHost) DefaultLibraryPath() string {
 * 	return h.host.DefaultLibraryPath()
 * }
 */
export function compilerHost_DefaultLibraryPath(receiver: GoPtr<compilerHost>): string {
  return host_DefaultLibraryPath(receiver!.host);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/compilerHost.go::method::compilerHost.GetCurrentDirectory","kind":"method","status":"implemented","sigHash":"8802fe9fb802445dcb46fe0c4a81219208beeec440660865d52ae456fd5588c0","bodyHash":"bc695275a7027114a74cbfb176e0e65758d51938d649045b91e2abffc69b1044"}
 *
 * Go source:
 * func (h *compilerHost) GetCurrentDirectory() string {
 * 	return h.host.GetCurrentDirectory()
 * }
 */
export function compilerHost_GetCurrentDirectory(receiver: GoPtr<compilerHost>): string {
  return host_GetCurrentDirectory(receiver!.host);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/compilerHost.go::method::compilerHost.Trace","kind":"method","status":"implemented","sigHash":"1b934b532f93eb7e5fd29017668ca705872b4fa2ba9b3015ff218a044ca4b398","bodyHash":"3fe6651e527f96c4bc07fd45856420a3530276c5f144636cc77ba7f50cdc186a"}
 *
 * Go source:
 * func (h *compilerHost) Trace(msg *diagnostics.Message, args ...any) {
 * 	h.trace(msg, args...)
 * }
 */
export function compilerHost_Trace(receiver: GoPtr<compilerHost>, msg: GoPtr<Message>, ...args: Array<unknown>): void {
  receiver!.trace(msg, ...args);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/compilerHost.go::method::compilerHost.GetSourceFile","kind":"method","status":"implemented","sigHash":"a8a084935626b36306b1da45c54ef8fbc502ddff10eabda4755f65c7de9b3e14","bodyHash":"c4bb5903678b51382e9f8e39a43306699d51643767aa320b88fa35acd7304ee6"}
 *
 * Go source:
 * func (h *compilerHost) GetSourceFile(opts ast.SourceFileParseOptions) *ast.SourceFile {
 * 	return h.host.GetSourceFile(opts)
 * }
 */
export function compilerHost_GetSourceFile(receiver: GoPtr<compilerHost>, opts: SourceFileParseOptions): GoPtr<SourceFile> {
  return host_GetSourceFile(receiver!.host, opts);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/execute/build/compilerHost.go::method::compilerHost.GetResolvedProjectReference","kind":"method","status":"implemented","sigHash":"9d02fa528e0c84ae5bf9345ad093fcefcc4675b7ea3a3893522917afb784f7a2","bodyHash":"0b9f18f6ff7607306c1b004b20bf8af4de1b07297fcecb696a5ed0a34f64ccc5"}
 *
 * Go source:
 * func (h *compilerHost) GetResolvedProjectReference(fileName string, path tspath.Path) *tsoptions.ParsedCommandLine {
 * 	return h.host.GetResolvedProjectReference(fileName, path)
 * }
 */
export function compilerHost_GetResolvedProjectReference(receiver: GoPtr<compilerHost>, fileName: string, path: Path): GoPtr<ParsedCommandLine> {
  return host_GetResolvedProjectReference(receiver!.host, fileName, path);
}
