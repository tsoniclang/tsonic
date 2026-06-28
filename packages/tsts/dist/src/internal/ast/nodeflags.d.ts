import type { int, uint } from "../../go/scalars.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/nodeflags.go::type::NodeFlags","kind":"type","status":"implemented","sigHash":"1ab8cedf51e53d4d4a76535f180fa467201a4ee1d08d7a155aaeb2a90ab16ad7","bodyHash":"5197d1ac139ca86c7af2d2cefe73128e846310afb8e0533c210c8308c6d55e12"}
 *
 * Go source:
 * NodeFlags uint32
 */
export type NodeFlags = uint;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/nodeflags.go::constGroup::NodeFlagsNone+NodeFlagsLet+NodeFlagsConst+NodeFlagsUsing+NodeFlagsReparsed+NodeFlagsSynthesized+NodeFlagsOptionalChain+NodeFlagsExportContext+NodeFlagsContainsThis+NodeFlagsHasImplicitReturn+NodeFlagsHasExplicitReturn+NodeFlagsDisallowInContext+NodeFlagsYieldContext+NodeFlagsDecoratorContext+NodeFlagsAwaitContext+NodeFlagsDisallowConditionalTypesContext+NodeFlagsThisNodeHasError+NodeFlagsJavaScriptFile+NodeFlagsThisNodeOrAnySubNodesHasError+NodeFlagsHasAsyncFunctions+NodeFlagsPossiblyContainsDynamicImport+NodeFlagsPossiblyContainsImportMeta+NodeFlagsHasJSDoc+NodeFlagsJSDoc+NodeFlagsAmbient+NodeFlagsInWithStatement+NodeFlagsJsonFile+NodeFlagsPossiblyContainsDeprecatedTag+NodeFlagsUnreachable+NodeFlagsReparserTransformedLiteral+NodeFlagsBlockScoped+NodeFlagsConstant+NodeFlagsAwaitUsing+NodeFlagsReachabilityCheckFlags+NodeFlagsReachabilityAndEmitFlags+NodeFlagsContextFlags+NodeFlagsTypeExcludesFlags+NodeFlagsPermanentlySetIncrementalFlags+NodeFlagsIdentifierHasExtendedUnicodeEscape+NodeFlagsIdentifierIsInJSDocNamespace+NodeFlagsNestedNamespace","kind":"constGroup","status":"implemented","sigHash":"5f7d883710e53a47dfde1d85856df1d169e7d7d185fe376ca9d16616b5713606","bodyHash":"62e4941f6289e84d8e3f5d52ca8d29377d26ad54eb24cd175f340a44de8043fb"}
 *
 * Go source:
 * const (
 * 	NodeFlagsNone                            NodeFlags = 0
 * 	NodeFlagsLet                             NodeFlags = 1 << 0  // Variable declaration
 * 	NodeFlagsConst                           NodeFlags = 1 << 1  // Variable declaration
 * 	NodeFlagsUsing                           NodeFlags = 1 << 2  // Variable declaration
 * 	NodeFlagsReparsed                        NodeFlags = 1 << 3  // Node was synthesized during parsing
 * 	NodeFlagsSynthesized                     NodeFlags = 1 << 4  // Node was synthesized during transformation
 * 	NodeFlagsOptionalChain                   NodeFlags = 1 << 5  // Chained MemberExpression rooted to a pseudo-OptionalExpression
 * 	NodeFlagsExportContext                   NodeFlags = 1 << 6  // Export context (initialized by binding)
 * 	NodeFlagsContainsThis                    NodeFlags = 1 << 7  // Interface contains references to "this"
 * 	NodeFlagsHasImplicitReturn               NodeFlags = 1 << 8  // If function implicitly returns on one of codepaths (initialized by binding)
 * 	NodeFlagsHasExplicitReturn               NodeFlags = 1 << 9  // If function has explicit reachable return on one of codepaths (initialized by binding)
 * 	NodeFlagsDisallowInContext               NodeFlags = 1 << 10 // If node was parsed in a context where 'in-expressions' are not allowed
 * 	NodeFlagsYieldContext                    NodeFlags = 1 << 11 // If node was parsed in the 'yield' context created when parsing a generator
 * 	NodeFlagsDecoratorContext                NodeFlags = 1 << 12 // If node was parsed as part of a decorator
 * 	NodeFlagsAwaitContext                    NodeFlags = 1 << 13 // If node was parsed in the 'await' context created when parsing an async function
 * 	NodeFlagsDisallowConditionalTypesContext NodeFlags = 1 << 14 // If node was parsed in a context where conditional types are not allowed
 * 	NodeFlagsThisNodeHasError                NodeFlags = 1 << 15 // If the parser encountered an error when parsing the code that created this node
 * 	NodeFlagsJavaScriptFile                  NodeFlags = 1 << 16 // If node was parsed in a JavaScript
 * 	NodeFlagsThisNodeOrAnySubNodesHasError   NodeFlags = 1 << 17 // If this node or any of its children had an error
 * 	NodeFlagsHasAsyncFunctions               NodeFlags = 1 << 18 // If the file has async functions (initialized by binding)
 * 	// NodeFlagsHasAggregatedChildData is deprecated. Use `subtreeFacts` instead.
 *
 * 	// These flags will be set when the parser encounters a dynamic import expression or 'import.meta' to avoid
 * 	// walking the tree if the flags are not set. However, these flags are just a approximation
 * 	// (hence why it's named "PossiblyContainsDynamicImport") because once set, the flags never get cleared.
 * 	// During editing, if a dynamic import is removed, incremental parsing will *NOT* clear this flag.
 * 	// This means that the tree will always be traversed during module resolution, or when looking for external module indicators.
 * 	// However, the removal operation should not occur often and in the case of the
 * 	// removal, it is likely that users will add the import anyway.
 * 	// The advantage of this approach is its simplicity. For the case of batch compilation,
 * 	// we guarantee that users won't have to pay the price of walking the tree if a dynamic import isn't used.
 * 	NodeFlagsPossiblyContainsDynamicImport NodeFlags = 1 << 19
 * 	NodeFlagsPossiblyContainsImportMeta    NodeFlags = 1 << 20
 *
 * 	NodeFlagsHasJSDoc                      NodeFlags = 1 << 21 // If node has preceding JSDoc comment(s)
 * 	NodeFlagsJSDoc                         NodeFlags = 1 << 22 // If node was parsed inside jsdoc
 * 	NodeFlagsAmbient                       NodeFlags = 1 << 23 // If node was inside an ambient context -- a declaration file, or inside something with the `declare` modifier.
 * 	NodeFlagsInWithStatement               NodeFlags = 1 << 24 // If any ancestor of node was the `statement` of a WithStatement (not the `expression`)
 * 	NodeFlagsJsonFile                      NodeFlags = 1 << 25 // If node was parsed in a Json
 * 	NodeFlagsPossiblyContainsDeprecatedTag NodeFlags = 1 << 26 // Set during parse if comment text contains '@deprecated'; must confirm via JSDoc lookup
 * 	NodeFlagsUnreachable                   NodeFlags = 1 << 27 // If node is unreachable according to the binder
 * 	NodeFlagsReparserTransformedLiteral    NodeFlags = 1 << 28 // If node was transformed during parsing, making its' naive text source not match the AST
 *
 * 	NodeFlagsBlockScoped = NodeFlagsLet | NodeFlagsConst | NodeFlagsUsing
 * 	NodeFlagsConstant    = NodeFlagsConst | NodeFlagsUsing
 * 	NodeFlagsAwaitUsing  = NodeFlagsConst | NodeFlagsUsing // Variable declaration (NOTE: on a single node these flags would otherwise be mutually exclusive)
 *
 * 	NodeFlagsReachabilityCheckFlags   = NodeFlagsHasImplicitReturn | NodeFlagsHasExplicitReturn
 * 	NodeFlagsReachabilityAndEmitFlags = NodeFlagsReachabilityCheckFlags | NodeFlagsHasAsyncFunctions
 *
 * 	// Parsing context flags
 * 	NodeFlagsContextFlags NodeFlags = NodeFlagsDisallowInContext | NodeFlagsDisallowConditionalTypesContext | NodeFlagsYieldContext | NodeFlagsDecoratorContext | NodeFlagsAwaitContext | NodeFlagsJavaScriptFile | NodeFlagsInWithStatement | NodeFlagsAmbient
 *
 * 	// Exclude these flags when parsing a Type
 * 	NodeFlagsTypeExcludesFlags NodeFlags = NodeFlagsYieldContext | NodeFlagsAwaitContext
 *
 * 	// Represents all flags that are potentially set once and
 * 	// never cleared on SourceFiles which get re-used in between incremental parses.
 * 	// See the comment above on `PossiblyContainsDynamicImport` and `PossiblyContainsImportMeta`.
 * 	NodeFlagsPermanentlySetIncrementalFlags NodeFlags = NodeFlagsPossiblyContainsDynamicImport | NodeFlagsPossiblyContainsImportMeta
 *
 * 	// The following flags repurpose other NodeFlags as different meanings for Identifier nodes
 * 	NodeFlagsIdentifierHasExtendedUnicodeEscape NodeFlags = NodeFlagsContainsThis      // Indicates whether the identifier contains an extended unicode escape sequence
 * 	NodeFlagsIdentifierIsInJSDocNamespace       NodeFlags = NodeFlagsHasAsyncFunctions // Indicates the identifier is the innermost name of a JSDoc namespace declaration
 *
 * 	// The following flag repurposes other NodeFlags for ModuleDeclaration nodes
 * 	NodeFlagsNestedNamespace NodeFlags = NodeFlagsOptionalChain // If ModuleDeclaration is a nested namespace (e.g. inner part of A.B.C)
 * )
 */
export declare const NodeFlagsNone: NodeFlags;
export declare const NodeFlagsLet: NodeFlags;
export declare const NodeFlagsConst: NodeFlags;
export declare const NodeFlagsUsing: NodeFlags;
export declare const NodeFlagsReparsed: NodeFlags;
export declare const NodeFlagsSynthesized: NodeFlags;
export declare const NodeFlagsOptionalChain: NodeFlags;
export declare const NodeFlagsExportContext: NodeFlags;
export declare const NodeFlagsContainsThis: NodeFlags;
export declare const NodeFlagsHasImplicitReturn: NodeFlags;
export declare const NodeFlagsHasExplicitReturn: NodeFlags;
export declare const NodeFlagsDisallowInContext: NodeFlags;
export declare const NodeFlagsYieldContext: NodeFlags;
export declare const NodeFlagsDecoratorContext: NodeFlags;
export declare const NodeFlagsAwaitContext: NodeFlags;
export declare const NodeFlagsDisallowConditionalTypesContext: NodeFlags;
export declare const NodeFlagsThisNodeHasError: NodeFlags;
export declare const NodeFlagsJavaScriptFile: NodeFlags;
export declare const NodeFlagsThisNodeOrAnySubNodesHasError: NodeFlags;
export declare const NodeFlagsHasAsyncFunctions: NodeFlags;
export declare const NodeFlagsPossiblyContainsDynamicImport: NodeFlags;
export declare const NodeFlagsPossiblyContainsImportMeta: NodeFlags;
export declare const NodeFlagsHasJSDoc: NodeFlags;
export declare const NodeFlagsJSDoc: NodeFlags;
export declare const NodeFlagsAmbient: NodeFlags;
export declare const NodeFlagsInWithStatement: NodeFlags;
export declare const NodeFlagsJsonFile: NodeFlags;
export declare const NodeFlagsPossiblyContainsDeprecatedTag: NodeFlags;
export declare const NodeFlagsUnreachable: NodeFlags;
export declare const NodeFlagsReparserTransformedLiteral: NodeFlags;
export declare const NodeFlagsBlockScoped: int;
export declare const NodeFlagsConstant: int;
export declare const NodeFlagsAwaitUsing: int;
export declare const NodeFlagsReachabilityCheckFlags: int;
export declare const NodeFlagsReachabilityAndEmitFlags: int;
export declare const NodeFlagsContextFlags: NodeFlags;
export declare const NodeFlagsTypeExcludesFlags: NodeFlags;
export declare const NodeFlagsPermanentlySetIncrementalFlags: NodeFlags;
export declare const NodeFlagsIdentifierHasExtendedUnicodeEscape: NodeFlags;
export declare const NodeFlagsIdentifierIsInJSDocNamespace: NodeFlags;
export declare const NodeFlagsNestedNamespace: NodeFlags;
//# sourceMappingURL=nodeflags.d.ts.map