import type { uint } from "../../go/scalars.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitflags.go::type::EmitFlags","kind":"type","status":"implemented","sigHash":"ee59f590d3720aa14847f8b36b602f63cf53c9ed0889cdb41f1d322c3b09de2b","bodyHash":"87bef90f852c48705ef5683f813808b557f897cd4dd50b366a8940f6053fa84d"}
 *
 * Go source:
 * EmitFlags uint32
 */
export type EmitFlags = uint;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitflags.go::constGroup::EFSingleLine+EFMultiLine+EFNoLeadingSourceMap+EFNoTrailingSourceMap+EFNoNestedSourceMaps+EFNoTokenLeadingSourceMaps+EFNoTokenTrailingSourceMaps+EFNoLeadingComments+EFNoTrailingComments+EFNoNestedComments+EFHelperName+EFExportName+EFLocalName+EFIndented+EFNoIndentation+EFReuseTempVariableScope+EFCustomPrologue+EFNoAsciiEscaping+EFExternalHelpers+EFStartOnNewLine+EFIndirectCall+EFAsyncFunctionBody+EFNoLexicalArguments+EFTransformPrivateStaticElements+EFNoLexicalThis","kind":"constGroup","status":"implemented","sigHash":"0790eb588abf3125c1927af63feb9f6bfbf32dd47052e5c6f95423cfb55dbc95","bodyHash":"d55710a28560dfd58f6ec0325b05f95737f83f13adb51b010984af7b55dc4a98"}
 *
 * Go source:
 * const (
 * 	EFSingleLine                     EmitFlags = 1 << iota // The contents of this node should be emitted on a single line.
 * 	EFMultiLine                                            // The contents of this node should be emitted on multiple lines.
 * 	EFNoLeadingSourceMap                                   // Do not emit a leading source map location for this node.
 * 	EFNoTrailingSourceMap                                  // Do not emit a trailing source map location for this node.
 * 	EFNoNestedSourceMaps                                   // Do not emit source map locations for children of this node.
 * 	EFNoTokenLeadingSourceMaps                             // Do not emit leading source map location for token nodes.
 * 	EFNoTokenTrailingSourceMaps                            // Do not emit trailing source map location for token nodes.
 * 	EFNoLeadingComments                                    // Do not emit leading comments for this node.
 * 	EFNoTrailingComments                                   // Do not emit trailing comments for this node.
 * 	EFNoNestedComments                                     // Do not emit nested comments for children of this node.
 * 	EFHelperName                                           // The Identifier refers to an *unscoped* emit helper (one that is emitted at the top of the file)
 * 	EFExportName                                           // Ensure an export prefix is added for an identifier that points to an exported declaration with a local name (see SymbolFlags.ExportHasLocal).
 * 	EFLocalName                                            // Ensure an export prefix is not added for an identifier that points to an exported declaration.
 * 	EFIndented                                             // Adds an explicit extra indentation level for class and function bodies when printing (used to match old emitter).
 * 	EFNoIndentation                                        // Do not indent the node.
 * 	EFReuseTempVariableScope                               // Reuse the existing temp variable scope during emit.
 * 	EFCustomPrologue                                       // Treat the statement as if it were a prologue directive (NOTE: Prologue directives are *not* transformed).
 * 	EFNoAsciiEscaping                                      // When synthesizing nodes that lack an original node or textSourceNode, we want to write the text on the node with ASCII escaping substitutions.
 * 	EFExternalHelpers                                      // This source file has external helpers
 * 	EFStartOnNewLine                                       // Start this node on a new line
 * 	EFIndirectCall                                         // Emit CallExpression as an indirect call: `(0, f)()`
 * 	EFAsyncFunctionBody                                    // The node was originally an async function body.
 * 	EFNoLexicalArguments                                   // Do not capture `arguments` for this arrow function. Set on arrows lowered from class static blocks, where `arguments` is an error; preserves Strada's emit behavior.
 * 	EFTransformPrivateStaticElements                       // Indicates static private elements in a file or class should be transformed regardless of --target (used by esDecorators transform).
 * 	EFNoLexicalThis                                        // Do not capture `this` for this node's subtree. Set on relocated static initializers, where `this` is handled by the class fields transform.
 * )
 */
export declare const EFSingleLine: EmitFlags;
export declare const EFMultiLine: EmitFlags;
export declare const EFNoLeadingSourceMap: EmitFlags;
export declare const EFNoTrailingSourceMap: EmitFlags;
export declare const EFNoNestedSourceMaps: EmitFlags;
export declare const EFNoTokenLeadingSourceMaps: EmitFlags;
export declare const EFNoTokenTrailingSourceMaps: EmitFlags;
export declare const EFNoLeadingComments: EmitFlags;
export declare const EFNoTrailingComments: EmitFlags;
export declare const EFNoNestedComments: EmitFlags;
export declare const EFHelperName: EmitFlags;
export declare const EFExportName: EmitFlags;
export declare const EFLocalName: EmitFlags;
export declare const EFIndented: EmitFlags;
export declare const EFNoIndentation: EmitFlags;
export declare const EFReuseTempVariableScope: EmitFlags;
export declare const EFCustomPrologue: EmitFlags;
export declare const EFNoAsciiEscaping: EmitFlags;
export declare const EFExternalHelpers: EmitFlags;
export declare const EFStartOnNewLine: EmitFlags;
export declare const EFIndirectCall: EmitFlags;
export declare const EFAsyncFunctionBody: EmitFlags;
export declare const EFNoLexicalArguments: EmitFlags;
export declare const EFTransformPrivateStaticElements: EmitFlags;
export declare const EFNoLexicalThis: EmitFlags;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/emitflags.go::constGroup::EFNone+EFNoSourceMap+EFNoTokenSourceMaps+EFNoComments","kind":"constGroup","status":"implemented","sigHash":"a700daeebdaad66b66ac5279de5363afb1864ca17d4a4095fc3bbd44de0237f2","bodyHash":"f465f44a026a29c9b31524728c12067da13ae28a8485b93d6feef87df4a0f9dd"}
 *
 * Go source:
 * const (
 * 	EFNone              EmitFlags = 0
 * 	EFNoSourceMap                 = EFNoLeadingSourceMap | EFNoTrailingSourceMap             // Do not emit a source map location for this node.
 * 	EFNoTokenSourceMaps           = EFNoTokenLeadingSourceMaps | EFNoTokenTrailingSourceMaps // Do not emit source map locations for tokens of this node.
 * 	EFNoComments                  = EFNoLeadingComments | EFNoTrailingComments               // Do not emit comments for this node.
 * )
 */
export declare const EFNone: EmitFlags;
export declare const EFNoSourceMap: EmitFlags;
export declare const EFNoTokenSourceMaps: EmitFlags;
export declare const EFNoComments: EmitFlags;
//# sourceMappingURL=emitflags.d.ts.map