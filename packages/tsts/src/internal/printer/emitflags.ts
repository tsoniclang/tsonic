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
export const EFSingleLine: EmitFlags = 1 << 0; // The contents of this node should be emitted on a single line.
export const EFMultiLine: EmitFlags = 1 << 1; // The contents of this node should be emitted on multiple lines.
export const EFNoLeadingSourceMap: EmitFlags = 1 << 2; // Do not emit a leading source map location for this node.
export const EFNoTrailingSourceMap: EmitFlags = 1 << 3; // Do not emit a trailing source map location for this node.
export const EFNoNestedSourceMaps: EmitFlags = 1 << 4; // Do not emit source map locations for children of this node.
export const EFNoTokenLeadingSourceMaps: EmitFlags = 1 << 5; // Do not emit leading source map location for token nodes.
export const EFNoTokenTrailingSourceMaps: EmitFlags = 1 << 6; // Do not emit trailing source map location for token nodes.
export const EFNoLeadingComments: EmitFlags = 1 << 7; // Do not emit leading comments for this node.
export const EFNoTrailingComments: EmitFlags = 1 << 8; // Do not emit trailing comments for this node.
export const EFNoNestedComments: EmitFlags = 1 << 9; // Do not emit nested comments for children of this node.
export const EFHelperName: EmitFlags = 1 << 10; // The Identifier refers to an *unscoped* emit helper (one that is emitted at the top of the file)
export const EFExportName: EmitFlags = 1 << 11; // Ensure an export prefix is added for an identifier that points to an exported declaration with a local name (see SymbolFlags.ExportHasLocal).
export const EFLocalName: EmitFlags = 1 << 12; // Ensure an export prefix is not added for an identifier that points to an exported declaration.
export const EFIndented: EmitFlags = 1 << 13; // Adds an explicit extra indentation level for class and function bodies when printing (used to match old emitter).
export const EFNoIndentation: EmitFlags = 1 << 14; // Do not indent the node.
export const EFReuseTempVariableScope: EmitFlags = 1 << 15; // Reuse the existing temp variable scope during emit.
export const EFCustomPrologue: EmitFlags = 1 << 16; // Treat the statement as if it were a prologue directive (NOTE: Prologue directives are *not* transformed).
export const EFNoAsciiEscaping: EmitFlags = 1 << 17; // When synthesizing nodes that lack an original node or textSourceNode, we want to write the text on the node with ASCII escaping substitutions.
export const EFExternalHelpers: EmitFlags = 1 << 18; // This source file has external helpers
export const EFStartOnNewLine: EmitFlags = 1 << 19; // Start this node on a new line
export const EFIndirectCall: EmitFlags = 1 << 20; // Emit CallExpression as an indirect call: `(0, f)()`
export const EFAsyncFunctionBody: EmitFlags = 1 << 21; // The node was originally an async function body.
export const EFNoLexicalArguments: EmitFlags = 1 << 22; // Do not capture `arguments` for this arrow function. Set on arrows lowered from class static blocks, where `arguments` is an error; preserves Strada's emit behavior.
export const EFTransformPrivateStaticElements: EmitFlags = 1 << 23; // Indicates static private elements in a file or class should be transformed regardless of --target (used by esDecorators transform).
export const EFNoLexicalThis: EmitFlags = 1 << 24; // Do not capture `this` for this node's subtree. Set on relocated static initializers, where `this` is handled by the class fields transform.

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
export const EFNone: EmitFlags = 0;
export const EFNoSourceMap: EmitFlags = EFNoLeadingSourceMap | EFNoTrailingSourceMap; // Do not emit a source map location for this node.
export const EFNoTokenSourceMaps: EmitFlags = EFNoTokenLeadingSourceMaps | EFNoTokenTrailingSourceMaps; // Do not emit source map locations for tokens of this node.
export const EFNoComments: EmitFlags = EFNoLeadingComments | EFNoTrailingComments; // Do not emit comments for this node.
