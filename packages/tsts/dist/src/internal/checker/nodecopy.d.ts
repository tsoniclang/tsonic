import type { bool, int } from "../../go/scalars.js";
import type { GoPtr, GoSlice } from "../../go/compat.js";
import type { Node, NodeVisitor } from "../ast/spine.js";
import type { SourceFile } from "../ast/ast.js";
import type { TypeNode } from "../ast/generated/unions.js";
import type { Symbol } from "../ast/symbol.js";
import type { SymbolFlags } from "../ast/generated/flags.js";
import type { SymbolTracker } from "../nodebuilder/types.js";
import type { NodeBuilderContext, NodeBuilderImpl, TrackedSymbolArgs } from "./nodebuilderimpl.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodecopy.go::method::NodeBuilderImpl.reuseNode","kind":"method","status":"implemented","sigHash":"4dd3d0a7af1286966a11e12383e2ef457a4a06fd6f05408d7ceada8f3bde9de2","bodyHash":"163e063ba136506af7ea7baaafbe0a06ab5cb754809819c5fc86ba9c3c19fd30"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) reuseNode(node *ast.Node) *ast.Node {
 * 	if node == nil {
 * 		return node
 * 	}
 *
 * 	return b.tryReuseExistingNodeHelper(node)
 * }
 */
export declare function NodeBuilderImpl_reuseNode(receiver: GoPtr<NodeBuilderImpl>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodecopy.go::method::NodeBuilderImpl.tryJSTypeNodeToTypeNode","kind":"method","status":"implemented","sigHash":"5488dfba909936bf6f3262e21428eac3034269906a941a606bbd3ff454921403","bodyHash":"6c7ed7aad1729cfc610232786f3b82f72d711f588f7b98d82888d2a14bcf9f2c"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) tryJSTypeNodeToTypeNode(node *ast.Node) *ast.Node {
 * 	return b.reuseNode(node)
 * }
 */
export declare function NodeBuilderImpl_tryJSTypeNodeToTypeNode(receiver: GoPtr<NodeBuilderImpl>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodecopy.go::method::NodeBuilderImpl.reuseName","kind":"method","status":"implemented","sigHash":"5df99735ef14d158dfea3be1c7b4f2f0919d2c484d5cb4a9e518d1ea020d1cc4","bodyHash":"8a732b81e3c69d1ce54c94ed84befa993c5dd959f2009c9fd0b298896296f181"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) reuseName(node *ast.Node, isMethod bool) *ast.Node {
 * 	res := b.reuseNode(node)
 * 	if res == nil {
 * 		return res
 * 	}
 *
 * 	text, ok := ast.TryGetTextOfPropertyName(res)
 * 	if !ok {
 * 		return res
 * 	}
 *
 * 	kind := classifyPropertyName(text, ast.IsStringLiteral(res), isMethod)
 * 	if ast.IsIdentifier(res) && kind == propertyNameNodeKindIdentifier {
 * 		return res
 * 	}
 * 	if ast.IsStringLiteral(res) && kind == propertyNameNodeKindStringLiteral {
 * 		return res
 * 	}
 *
 * 	var renamed *ast.Node
 * 	switch kind {
 * 	case propertyNameNodeKindIdentifier:
 * 		renamed = b.newIdentifier(text, nil)
 * 	case propertyNameNodeKindStringLiteral:
 * 		renamed = b.f.NewStringLiteral(text, ast.TokenFlagsNone)
 * 	default:
 * 		return res
 * 	}
 * 	b.e.SetOriginal(renamed, res)
 * 	return b.setTextRange(renamed, res)
 * }
 */
export declare function NodeBuilderImpl_reuseName(receiver: GoPtr<NodeBuilderImpl>, node: GoPtr<Node>, isMethod: bool): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodecopy.go::method::NodeBuilderImpl.reuseTypeNode","kind":"method","status":"implemented","sigHash":"44f85ffcc5adf7a0b1f1fc08b424255efcd99f93c880403dcd085937da9f8304","bodyHash":"ca12a6192d27bb497b5a980118521793ffe640a48ffa3c70dd476c9a70cd7fe3"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) reuseTypeNode(node *ast.Node) *ast.Node {
 * 	if node == nil {
 * 		return node
 * 	}
 * 	r := b.reuseNode(node)
 * 	if r != nil {
 * 		// After successful reuse during hover, probe the reused AST for expandable
 * 		// type references so canIncreaseExpansionDepth is set even though
 * 		// typeToTypeNode (and shouldExpandType) were never called.
 * 		if b.ctx.maxExpansionDepth >= 0 && !b.ctx.canIncreaseExpansionDepth {
 * 			b.walkNodeForExpandability(node)
 * 		}
 * 		return r
 * 	}
 * 	b.ctx.tracker.ReportInferenceFallback(node)
 * 	t := b.getTypeFromTypeNode(node, false)
 * 	return b.typeToTypeNode(t)
 * }
 */
export declare function NodeBuilderImpl_reuseTypeNode(receiver: GoPtr<NodeBuilderImpl>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodecopy.go::method::NodeBuilderImpl.walkNodeForExpandability","kind":"method","status":"implemented","sigHash":"042f02ce100844abc395a5cd6c47c6f9cc17dd4ef114519542cd4f1a06c81080","bodyHash":"a432668379d9de14ca951ab367ce4571cd22ef36ce4a7e2c9c9d6801e7cb3a67"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) walkNodeForExpandability(node *ast.Node) {
 * 	if b.ctx.canIncreaseExpansionDepth || node == nil {
 * 		return
 * 	}
 * 	// Check these explicitly so we look into type arguments wehther or not they are in the tree or not.
 * 	if ast.IsTypeReferenceNode(node) || ast.IsExpressionWithTypeArguments(node) || ast.IsTypePredicateNode(node) || ast.IsImportTypeNode(node) {
 * 		t := b.getTypeFromTypeNode(node, false)
 * 		if t != nil {
 * 			b.checkTypeExpandability(t)
 * 			if b.ctx.canIncreaseExpansionDepth {
 * 				return
 * 			}
 * 		}
 * 	}
 * 	node.ForEachChild(func(child *ast.Node) bool {
 * 		b.walkNodeForExpandability(child)
 * 		return b.ctx.canIncreaseExpansionDepth
 * 	})
 * }
 */
export declare function NodeBuilderImpl_walkNodeForExpandability(receiver: GoPtr<NodeBuilderImpl>, node: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodecopy.go::type::recoveryBoundary","kind":"type","status":"implemented","sigHash":"aad68436aa790ac9d6f7b6f40b29f65ab8c7f5efdb07a00cc46305232db29361","bodyHash":"3c90613cf27f9ed5f28d731564e404c30b853c0f8f8f7f2d47190fec407997f4"}
 *
 * Go source:
 * recoveryBoundary struct {
 * 	ctx                  *NodeBuilderContext
 * 	hadError             bool
 * 	deferredReports      []func()
 * 	oldTracker           nodebuilder.SymbolTracker
 * 	oldTrackedSymbols    []*TrackedSymbolArgs
 * 	trackedSymbols       []*TrackedSymbolArgs
 * 	oldEncounteredError  bool
 * 	oldApproximateLength int
 * }
 */
export interface recoveryBoundary {
    ctx: GoPtr<NodeBuilderContext>;
    hadError: bool;
    deferredReports: GoSlice<() => void>;
    oldTracker: GoPtr<SymbolTracker>;
    oldTrackedSymbols: GoSlice<GoPtr<TrackedSymbolArgs>>;
    trackedSymbols: GoSlice<GoPtr<TrackedSymbolArgs>>;
    oldEncounteredError: bool;
    oldApproximateLength: int;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodecopy.go::method::recoveryBoundary.markError","kind":"method","status":"implemented","sigHash":"4c9a198de34bd44348be3bb07fc3d697d095f0c9b1fce5c552127dc32e237848","bodyHash":"77dbf371ea7a6e0356d780855557491acd55664485da71d1750338dc231da854"}
 *
 * Go source:
 * func (b *recoveryBoundary) markError(f func()) {
 * 	b.hadError = true
 * 	if f != nil {
 * 		b.deferredReports = append(b.deferredReports, f)
 * 	}
 * }
 */
export declare function recoveryBoundary_markError(receiver: GoPtr<recoveryBoundary>, f: GoPtr<() => void>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodecopy.go::type::originalRecoveryScopeState","kind":"type","status":"implemented","sigHash":"17868c9eb4bdb62f8e69dfcf2dc37e58285961730abbb71bb4a5d1dd30d369b1","bodyHash":"273bdf3eb30aa9915d831797147441a4da7a69505e0b8317f91473bd4cffe0e4"}
 *
 * Go source:
 * originalRecoveryScopeState struct {
 * 	trackedSymbolsTop   int
 * 	unreportedErrorsTop int
 * 	hadError            bool
 * }
 */
export interface originalRecoveryScopeState {
    trackedSymbolsTop: int;
    unreportedErrorsTop: int;
    hadError: bool;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodecopy.go::method::recoveryBoundary.startRecoveryScope","kind":"method","status":"implemented","sigHash":"20fa9da11af2b7708ed84fa9f2964ae123fd808730ac7d747f109f1653687e39","bodyHash":"1368c3701b269adcca8d9dde4a241473e8149ac021f32654e24fb2870cafc30b"}
 *
 * Go source:
 * func (b *recoveryBoundary) startRecoveryScope() originalRecoveryScopeState {
 * 	trackedSymbolsTop := len(b.ctx.trackedSymbols)
 * 	unreportedErrorsTop := len(b.deferredReports)
 * 	return originalRecoveryScopeState{trackedSymbolsTop: trackedSymbolsTop, unreportedErrorsTop: unreportedErrorsTop, hadError: b.hadError}
 * }
 */
export declare function recoveryBoundary_startRecoveryScope(receiver: GoPtr<recoveryBoundary>): originalRecoveryScopeState;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodecopy.go::method::recoveryBoundary.endRecoveryScope","kind":"method","status":"implemented","sigHash":"625e4568435e9578d735d3d9e631f1ea994c78b08a1025ce33320eed2fa52975","bodyHash":"48c89709cd5dcfca40aee56b8074102166909bd3b8be59e41f039a4327464b03"}
 *
 * Go source:
 * func (b *recoveryBoundary) endRecoveryScope(state originalRecoveryScopeState) {
 * 	b.hadError = state.hadError
 * 	b.ctx.trackedSymbols = b.ctx.trackedSymbols[0:state.trackedSymbolsTop]
 * 	b.deferredReports = b.deferredReports[0:state.unreportedErrorsTop]
 * }
 */
export declare function recoveryBoundary_endRecoveryScope(receiver: GoPtr<recoveryBoundary>, state: originalRecoveryScopeState): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodecopy.go::type::wrappingTracker","kind":"type","status":"implemented","sigHash":"7268cd1c8ec3e18435be81b0f2825958c81c7068e40c22ed602676f6fc9a2cfc","bodyHash":"f97b3c7689dd5f04f41b67a6aeacc15f845c3d3a7c4ad96bde331e9d17311dde"}
 *
 * Go source:
 * wrappingTracker struct {
 * 	wrapped nodebuilder.SymbolTracker
 * 	bound   *recoveryBoundary
 * }
 */
export interface wrappingTracker {
    wrapped: GoPtr<SymbolTracker>;
    bound: GoPtr<recoveryBoundary>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodecopy.go::method::wrappingTracker.PopErrorFallbackNode","kind":"method","status":"implemented","sigHash":"5e7c1a63d688b7eff38ed2753fdfc3cf334fe37f7077f3e63de47d7aa1f15ee2","bodyHash":"873e486c1fbd29e5a9406e2bb23eb9915a09dfac014ec065e16ffdaac447a177"}
 *
 * Go source:
 * func (w *wrappingTracker) PopErrorFallbackNode() {
 * 	w.wrapped.PopErrorFallbackNode()
 * }
 */
export declare function wrappingTracker_PopErrorFallbackNode(receiver: GoPtr<wrappingTracker>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodecopy.go::method::wrappingTracker.PushErrorFallbackNode","kind":"method","status":"implemented","sigHash":"dcd05322fb627e5669df47b7c7a1e8ec41842bdc031b73a0346e7699e6444f68","bodyHash":"b5e1208c3ea5466a49c6205a21e2739adb84f5d6091bae7fb354607dfb011683"}
 *
 * Go source:
 * func (w *wrappingTracker) PushErrorFallbackNode(node *ast.Node) {
 * 	w.wrapped.PushErrorFallbackNode(node)
 * }
 */
export declare function wrappingTracker_PushErrorFallbackNode(receiver: GoPtr<wrappingTracker>, node: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodecopy.go::method::wrappingTracker.ReportCyclicStructureError","kind":"method","status":"implemented","sigHash":"c939dc4cd31aec0ee6e62651c7b40fced64db490898538188c2d45ddc812c198","bodyHash":"efdbe89fbb30ab7d2dd478eaa2bdcd657771db9669683f0bafd4814571e9f24f"}
 *
 * Go source:
 * func (w *wrappingTracker) ReportCyclicStructureError() {
 * 	w.bound.markError(w.wrapped.ReportCyclicStructureError)
 * }
 */
export declare function wrappingTracker_ReportCyclicStructureError(receiver: GoPtr<wrappingTracker>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodecopy.go::method::wrappingTracker.ReportInaccessibleThisError","kind":"method","status":"implemented","sigHash":"e2a1dc7abc4900d5930f88d4de58738873d9048eaa1eadf20d488fe14336fa21","bodyHash":"23d25b00768b85bc3c4dfb042db3eb9d76c270a0bcbc25b82dcad794081faf60"}
 *
 * Go source:
 * func (w *wrappingTracker) ReportInaccessibleThisError() {
 * 	w.bound.markError(w.wrapped.ReportInaccessibleThisError)
 * }
 */
export declare function wrappingTracker_ReportInaccessibleThisError(receiver: GoPtr<wrappingTracker>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodecopy.go::method::wrappingTracker.ReportInaccessibleUniqueSymbolError","kind":"method","status":"implemented","sigHash":"6e016a418c496007a5fa4f87ad1eb32b4587eb96187ec8b4da7255a8badcf7ed","bodyHash":"927b98869011ca5d990f466f9d15545eb806830516418b04ae2008e909315888"}
 *
 * Go source:
 * func (w *wrappingTracker) ReportInaccessibleUniqueSymbolError() {
 * 	w.bound.markError(w.wrapped.ReportInaccessibleUniqueSymbolError)
 * }
 */
export declare function wrappingTracker_ReportInaccessibleUniqueSymbolError(receiver: GoPtr<wrappingTracker>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodecopy.go::method::wrappingTracker.ReportInferenceFallback","kind":"method","status":"implemented","sigHash":"ba8c035f8c55fc18ee868186175c510b2fb772ebdc999f4166d3e961cd1e006b","bodyHash":"afe668dddee1a790a5c6144e82081e00612bf73e8c5c65990bbaa6a92e9d7792"}
 *
 * Go source:
 * func (w *wrappingTracker) ReportInferenceFallback(node *ast.Node) {
 * 	w.wrapped.ReportInferenceFallback(node) // Should this also be deferred?
 * }
 */
export declare function wrappingTracker_ReportInferenceFallback(receiver: GoPtr<wrappingTracker>, node: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodecopy.go::method::wrappingTracker.ReportLikelyUnsafeImportRequiredError","kind":"method","status":"implemented","sigHash":"479ff9e60022779c1f666d6206e2af708e26e4b04ad274bf1e34854a22fc9bf5","bodyHash":"b18171fa49e0fd5c7db505db316a9ff2277f829297eda027ec34cff6f8ba47ac"}
 *
 * Go source:
 * func (w *wrappingTracker) ReportLikelyUnsafeImportRequiredError(specifier string, symbolName string) {
 * 	w.bound.markError(func() { w.wrapped.ReportLikelyUnsafeImportRequiredError(specifier, symbolName) })
 * }
 */
export declare function wrappingTracker_ReportLikelyUnsafeImportRequiredError(receiver: GoPtr<wrappingTracker>, specifier: string, symbolName: string): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodecopy.go::method::wrappingTracker.ReportNonSerializableProperty","kind":"method","status":"implemented","sigHash":"ab98c34f31a9627fccef9f5158dd6308b810faf398936deaa6d8301dbc717440","bodyHash":"48557e96652ae33408ce4ff815b960117f591106a55f954c052b5aaf3c66d48f"}
 *
 * Go source:
 * func (w *wrappingTracker) ReportNonSerializableProperty(propertyName string) {
 * 	w.bound.markError(func() { w.wrapped.ReportNonSerializableProperty(propertyName) })
 * }
 */
export declare function wrappingTracker_ReportNonSerializableProperty(receiver: GoPtr<wrappingTracker>, propertyName: string): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodecopy.go::method::wrappingTracker.ReportNonlocalAugmentation","kind":"method","status":"implemented","sigHash":"3c36c9997ce56aae033ef419bc89c44d5d1cb1ff941d8508ca59a445377bbcce","bodyHash":"b154c6b4e3f3edd823d8ee37c3e4665f597de504d1d7da67b2dde0e071883416"}
 *
 * Go source:
 * func (w *wrappingTracker) ReportNonlocalAugmentation(containingFile *ast.SourceFile, parentSymbol *ast.Symbol, augmentingSymbol *ast.Symbol) {
 * 	w.wrapped.ReportNonlocalAugmentation(containingFile, parentSymbol, augmentingSymbol) // Should this also be deferred?
 * }
 */
export declare function wrappingTracker_ReportNonlocalAugmentation(receiver: GoPtr<wrappingTracker>, containingFile: GoPtr<SourceFile>, parentSymbol: GoPtr<Symbol>, augmentingSymbol: GoPtr<Symbol>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodecopy.go::method::wrappingTracker.ReportPrivateInBaseOfClassExpression","kind":"method","status":"implemented","sigHash":"52c581a929ddabb52b8ad9563547bfbda5b1ae9385813417fbee180f4ea6e300","bodyHash":"18e3fa516de7e216f8bdcca641f44a0a61a816d6c0f2ab2b019e7493885c0ea0"}
 *
 * Go source:
 * func (w *wrappingTracker) ReportPrivateInBaseOfClassExpression(propertyName string) {
 * 	w.bound.markError(func() { w.wrapped.ReportPrivateInBaseOfClassExpression(propertyName) })
 * }
 */
export declare function wrappingTracker_ReportPrivateInBaseOfClassExpression(receiver: GoPtr<wrappingTracker>, propertyName: string): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodecopy.go::method::wrappingTracker.ReportTruncationError","kind":"method","status":"implemented","sigHash":"5263f962deeafc6217394bd5d99921949cb53a0ab97d83f4ce48bf5d55121188","bodyHash":"b7cbfab2a0ab25d4937ef7f1abe06c884474bf1791b34c2a3b28c1afa506e21f"}
 *
 * Go source:
 * func (w *wrappingTracker) ReportTruncationError() {
 * 	w.wrapped.ReportTruncationError() // Should this also be deferred?
 * }
 */
export declare function wrappingTracker_ReportTruncationError(receiver: GoPtr<wrappingTracker>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodecopy.go::method::wrappingTracker.TrackSymbol","kind":"method","status":"implemented","sigHash":"e40917de1e33ffea57dab2771576bc9f8bdc57e68c2073dc5e17dbfc11686e6f","bodyHash":"5190f71ddf93ee6975aea1f1a8ae28677d65f1f021735ea338e52ce048a22810"}
 *
 * Go source:
 * func (w *wrappingTracker) TrackSymbol(symbol *ast.Symbol, enclosingDeclaration *ast.Node, meaning ast.SymbolFlags) bool {
 * 	w.bound.trackedSymbols = append(w.bound.trackedSymbols, &TrackedSymbolArgs{symbol, enclosingDeclaration, meaning})
 * 	return false
 * }
 */
export declare function wrappingTracker_TrackSymbol(receiver: GoPtr<wrappingTracker>, symbol_: GoPtr<Symbol>, enclosingDeclaration: GoPtr<Node>, meaning: SymbolFlags): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodecopy.go::func::newWrappingTracker","kind":"func","status":"implemented","sigHash":"5261e4da67345757b09b70ed8e79495114ff491eaf63578f565f009ef93fcef7","bodyHash":"efddc49fe16e0513c1a73359e978d7e09b4ecded2535302df5d8a6fc8f9a12f8"}
 *
 * Go source:
 * func newWrappingTracker(inner nodebuilder.SymbolTracker, bound *recoveryBoundary) *wrappingTracker {
 * 	return &wrappingTracker{
 * 		wrapped: inner,
 * 		bound:   bound,
 * 	}
 * }
 */
export declare function newWrappingTracker(inner: GoPtr<SymbolTracker>, bound: GoPtr<recoveryBoundary>): GoPtr<wrappingTracker>;
export declare function wrappingTracker_as_SymbolTracker(receiver: GoPtr<wrappingTracker>): GoPtr<SymbolTracker>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodecopy.go::method::NodeBuilderImpl.createRecoveryBoundary","kind":"method","status":"implemented","sigHash":"865e5f4dfd3e740abccad8455472128a5898b6d6c04b1efc7da8802449f71575","bodyHash":"94d2d70a3dd769933524b1c1d6299e431f89850b0de1c1dbf385bce992fcc946"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) createRecoveryBoundary() *recoveryBoundary {
 * 	b.ch.checkNotCanceled()
 * 	bound := &recoveryBoundary{ctx: b.ctx, oldTracker: b.ctx.tracker, oldTrackedSymbols: b.ctx.trackedSymbols, oldEncounteredError: b.ctx.encounteredError, oldApproximateLength: b.ctx.approximateLength}
 * 	newTracker := NewSymbolTrackerImpl(b.ctx, newWrappingTracker(b.ctx.tracker, bound))
 * 	b.ctx.tracker = newTracker
 * 	b.ctx.trackedSymbols = nil
 * 	return bound
 * }
 */
export declare function NodeBuilderImpl_createRecoveryBoundary(receiver: GoPtr<NodeBuilderImpl>): GoPtr<recoveryBoundary>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodecopy.go::method::NodeBuilderImpl.finalizeBoundary","kind":"method","status":"implemented","sigHash":"57082edb608f416244cb4807c41e2abd1149a13d050daf652c582dc47823db94","bodyHash":"0600bc21675157f883744878bf11b1bc307bcdece83e85693b36718cbff51538"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) finalizeBoundary(bound *recoveryBoundary) bool {
 * 	b.ctx.tracker = bound.oldTracker
 * 	b.ctx.trackedSymbols = bound.oldTrackedSymbols
 * 	b.ctx.encounteredError = bound.oldEncounteredError
 * 	b.ctx.approximateLength = bound.oldApproximateLength
 *
 * 	for _, f := range bound.deferredReports {
 * 		f()
 * 	}
 * 	if bound.hadError {
 * 		return false
 * 	}
 * 	for _, a := range bound.trackedSymbols {
 * 		b.ctx.tracker.TrackSymbol(a.symbol, a.enclosingDeclaration, a.meaning)
 * 	}
 * 	return true
 * }
 */
export declare function NodeBuilderImpl_finalizeBoundary(receiver: GoPtr<NodeBuilderImpl>, bound: GoPtr<recoveryBoundary>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodecopy.go::method::NodeBuilderImpl.tryReuseExistingNodeHelper","kind":"method","status":"implemented","sigHash":"c0f3a922317b5f0fdf2262ed81a7c4e222651bd0007fb3912de401c9ed6b63e5","bodyHash":"0f45f4753b177d777fa107349d3b459581ef8114c42bf328bec5304fa5a35f55"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) tryReuseExistingNodeHelper(existing *ast.TypeNode) *ast.TypeNode {
 * 	bound := b.createRecoveryBoundary()
 * 	var transformed *ast.Node
 * 	v := getExistingNodeTreeVisitor(b, bound) // !!! TODO: Cache visitor and just reset bound+host builder? We try this for a *lot* of nodes.
 * 	transformed = v.VisitNode(existing)
 * 	if !b.finalizeBoundary(bound) {
 * 		return nil
 * 	}
 * 	b.ctx.approximateLength += existing.Loc.End() - existing.Loc.Pos()
 * 	return transformed
 * }
 */
export declare function NodeBuilderImpl_tryReuseExistingNodeHelper(receiver: GoPtr<NodeBuilderImpl>, existing: GoPtr<TypeNode>): GoPtr<TypeNode>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodecopy.go::method::NodeBuilderImpl.getModuleSpecifierOverride","kind":"method","status":"implemented","sigHash":"25bd0b1a05d2e56e9f22ed4747a0c00d98f5bb8e806aabb5463763d69859196c","bodyHash":"6334e83cf92fd30c36f63878569e8ec00f25c85cc8fe966ee1cf16e1b19e6e8a"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) getModuleSpecifierOverride(parent *ast.Node, lit *ast.Node) string {
 * 	if b.ctx.enclosingFile != ast.GetSourceFileOfNode(lit) {
 * 		mode := core.ResolutionModeNone
 * 		if parent.AsImportTypeNode().Attributes != nil {
 * 			mode = b.ch.getResolutionModeOverride(parent.AsImportTypeNode().Attributes.AsImportAttributes(), false)
 * 		}
 * 		name := lit.Text()
 * 		originalName := name
 * 		nodeSymbol := b.ch.symbolNodeLinks.Get(parent).resolvedSymbol
 * 		meaning := ast.SymbolFlagsType
 * 		if parent.AsImportTypeNode().IsTypeOf {
 * 			meaning = ast.SymbolFlagsValue
 * 		}
 * 		var parentSymbol *ast.Symbol
 * 		if nodeSymbol != nil && b.ch.IsSymbolAccessible(nodeSymbol, b.ctx.enclosingDeclaration, meaning, false).Accessibility == printer.SymbolAccessibilityAccessible {
 * 			parentSymbol = b.lookupSymbolChain(nodeSymbol, meaning, true)[0]
 * 		}
 * 		if parentSymbol != nil && IsExternalModuleSymbol(parentSymbol) {
 * 			name = b.getSpecifierForModuleSymbol(parentSymbol, mode)
 * 		} else {
 * 			targetFile := b.ch.getExternalModuleFileFromDeclaration(parent)
 * 			if targetFile != nil {
 * 				name = b.getSpecifierForModuleSymbol(targetFile.Symbol, mode)
 * 			}
 * 		}
 * 		if len(name) > 0 && strings.Contains(name, "/node_modules/") {
 * 			b.ctx.encounteredError = true
 * 			b.ctx.tracker.ReportLikelyUnsafeImportRequiredError(name, "")
 * 		}
 * 		if name != originalName {
 * 			return name
 * 		}
 * 	}
 * 	return ""
 * }
 */
export declare function NodeBuilderImpl_getModuleSpecifierOverride(receiver: GoPtr<NodeBuilderImpl>, parent: GoPtr<Node>, lit: GoPtr<Node>): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodecopy.go::method::NodeBuilderImpl.rewriteModuleSpecifier","kind":"method","status":"implemented","sigHash":"b5bed9b3055c1bdeb13e8f8c09d45d7edd0379e4597ad8f501fb542e6928e391","bodyHash":"13440531d128aae45cb860c35eee2cd527e60cbc6f9519c9c10bbc0847dce569"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) rewriteModuleSpecifier(parent *ast.Node, lit *ast.Node) *ast.Node {
 * 	newName := b.getModuleSpecifierOverride(parent, lit)
 * 	if len(newName) == 0 {
 * 		return lit
 * 	}
 * 	res := b.f.NewStringLiteral(newName, ast.TokenFlagsNone)
 * 	b.e.SetOriginal(res, lit)
 * 	return res
 * }
 */
export declare function NodeBuilderImpl_rewriteModuleSpecifier(receiver: GoPtr<NodeBuilderImpl>, parent: GoPtr<Node>, lit: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodecopy.go::method::NodeBuilderImpl.getEnclosingDeclarationIgnoringFakeScope","kind":"method","status":"implemented","sigHash":"a5b74c1a87faf0bd1db48a711a4c76532d774a889ffede1a60504d465b78594e","bodyHash":"c7f7ad9088c3d88a7ca1262708c6a9c4f8e72d534a35a965ee840a3cd55c8731"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) getEnclosingDeclarationIgnoringFakeScope() *ast.Node {
 * 	enc := b.ctx.enclosingDeclaration
 * 	for enc != nil && b.links.Get(enc).fakeScopeForSignatureDeclaration != nil {
 * 		enc = enc.Parent
 * 	}
 * 	return enc
 * }
 */
export declare function NodeBuilderImpl_getEnclosingDeclarationIgnoringFakeScope(receiver: GoPtr<NodeBuilderImpl>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodecopy.go::func::getExistingNodeTreeVisitor","kind":"func","status":"implemented","sigHash":"f23a46dc64b0d3a0dcb8be0adbb3b14920a0890683fe6d3ae276db72fa8babde","bodyHash":"9c2d206c056f5816846c7d8dcdd7a8730348bf9f355a348821f9811cc32b591a"}
 *
 * Go source:
 * func getExistingNodeTreeVisitor(b *NodeBuilderImpl, bound *recoveryBoundary) *ast.NodeVisitor {
 * 	// Blocked: depends on ast.NewNodeVisitor / ast.NodeVisitorHooks and the NodeVisitor
 * 	// VisitNode/VisitNodes/VisitEachChild/VisitModifiers methods, which are not yet landed
 * 	// (the hand-written internal/ast/visitor.go wave). It also pulls in a large unported
 * 	// checker surface (serializeTypeName, resolveEntityName, typeParameterToName, etc.).
 * 	// See the original scaffolded doc-comment / nodecopy.go for the full body.
 * }
 */
export declare function getExistingNodeTreeVisitor(b: GoPtr<NodeBuilderImpl>, bound: GoPtr<recoveryBoundary>): GoPtr<NodeVisitor>;
//# sourceMappingURL=nodecopy.d.ts.map