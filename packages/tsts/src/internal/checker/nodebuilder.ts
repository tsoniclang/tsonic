import type { bool, int } from "@tsonic/core/types.js";
import type { GoMap, GoPtr, GoSlice } from "../../go/compat.js";
import type { Node } from "../ast/spine.js";
import type { Kind } from "../ast/generated/kinds.js";
import { KindClassDeclaration, KindEnumDeclaration, KindInterfaceDeclaration, KindModuleDeclaration } from "../ast/generated/kinds.js";
import type { SymbolFlags } from "../ast/generated/flags.js";
import type { IdentifierNode } from "../ast/generated/unions.js";
import type { NodeFactory } from "../ast/generated/factory.js";
import type { Symbol } from "../ast/symbol.js";
import {
  FlagsNoTruncation,
  type Flags,
  type InternalFlags,
  type SymbolTracker,
} from "../nodebuilder/types.js";
import { GetSourceFileOfNode } from "../ast/utilities.js";
import { NewEmitContext } from "../printer/emitcontext.js";
import type { EmitContext as EmitContext_3f6f588c } from "../printer/emitcontext.js";
import type { Checker, Host } from "./checker/state.js";
import { Checker_getSignatureFromDeclaration } from "./checker/signatures.js";
import { Checker_getDeclaredTypeOfSymbol, Checker_getSymbolOfDeclaration } from "./checker/symbols.js";
import { NewSymbolTrackerImpl, SymbolTrackerImpl_as_SymbolTracker } from "./symboltracker.js";
import { newNodeBuilderImpl } from "./nodebuilderimpl.js";
import type { NodeBuilderContext, NodeBuilderImpl } from "./nodebuilderimpl.js";
import {
  NodeBuilderImpl_indexInfoToIndexSignatureDeclarationHelper,
  NodeBuilderImpl_serializeReturnTypeForSignature,
  NodeBuilderImpl_serializeTypeForDeclaration,
  NodeBuilderImpl_serializeTypeForExpression,
  NodeBuilderImpl_signatureToSignatureDeclarationHelper,
  NodeBuilderImpl_symbolToExpression,
  NodeBuilderImpl_symbolToName,
  NodeBuilderImpl_symbolToNode,
  NodeBuilderImpl_symbolToParameterDeclaration,
  NodeBuilderImpl_symbolToTypeParameterDeclarations,
  NodeBuilderImpl_typeParameterToDeclaration,
  NodeBuilderImpl_typePredicateToTypePredicateNode,
  NodeBuilderImpl_typeToTypeNode,
} from "./nodebuilderimpl.js";
import { NodeBuilderImpl_expandSymbolForHover } from "./nodebuilder_hover.js";
import { NodeBuilderImpl_tryJSTypeNodeToTypeNode } from "./nodecopy.js";
import { Node_ModifierFlags, NodeFactory_NewModifier, NodeFactory_UpdateClassDeclaration } from "../ast/ast.js";
import { AsClassDeclaration } from "../ast/generated/casts.js";
import { IsClassExpression, IsEnumDeclaration, IsInterfaceDeclaration, IsModuleDeclaration } from "../ast/generated/predicates.js";
import { NodeFactory_NewModifierList, Node_Modifiers } from "../ast/spine.js";
import { CreateModifiersFromModifierFlags, IsClassLike, ReplaceModifiers } from "../ast/utilities.js";
import { ModifierFlagsAmbient, ModifierFlagsExport } from "../ast/modifierflags.js";
import { Filter } from "../core/core.js";
import {
  FlagsIgnoreErrors,
  FlagsMultilineObjectLiterals,
  FlagsUseAliasDefinedOutsideCurrentScope,
} from "../nodebuilder/types.js";
import { SymbolFlagsInterface } from "../ast/generated/flags.js";
import type { IndexInfo, Signature, Type, TypePredicate } from "./types.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilder.go::type::NodeBuilder","kind":"type","status":"implemented","sigHash":"76a4249a51e647678e92bd7c18d47a4d92028cf7abbb788a146426ab06fb85df","bodyHash":"6fcf1319a4842fb1bcb0a230468ec341db26d90927a86af02e647e4defeb93a8"}
 *
 * Go source:
 * NodeBuilder struct {
 * 	ctxStack  []*NodeBuilderContext
 * 	host      Host
 * 	impl      *NodeBuilderImpl
 * 	verbosity *VerbosityContext // nil for non-hover callers
 * }
 */
export interface NodeBuilder {
  ctxStack: GoSlice<GoPtr<NodeBuilderContext>>;
  host: Host;
  impl: GoPtr<NodeBuilderImpl>;
  verbosity: GoPtr<VerbosityContext>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilder.go::type::VerbosityContext","kind":"type","status":"implemented","sigHash":"768294ed85e1b6ff242af3a1a28d7e00e5f4e4afd1646c5e2daba03846a5a482","bodyHash":"305b03e108baa26a0dd7287062e8806242ad19bc5e67ca2a7b0ebe9c87cf3fb9"}
 *
 * Go source:
 * VerbosityContext struct {
 * 	Level                int  // 0 = default (no expansion), 1+ = expansion depth
 * 	MaxTruncationLength  int  // 0 = use default
 * 	CanIncreaseVerbosity bool // output: whether increasing Level would reveal more
 * 	Truncated            bool // output: whether output was truncated
 * }
 */
export interface VerbosityContext {
  Level: int;
  MaxTruncationLength: int;
  CanIncreaseVerbosity: bool;
  Truncated: bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilder.go::method::NodeBuilder.EmitContext","kind":"method","status":"implemented","sigHash":"1ff78c0bddbb4e896fdbd7a13ee0d0b77a9dec7ba7c4960411e7095f9a909493","bodyHash":"ae4eeaf92647528a5e7c22200be44ae49f7d220781ee62996ad47d09edfb6adb"}
 *
 * Go source:
 * func (b *NodeBuilder) EmitContext() *printer.EmitContext {
 * 	return b.impl.e
 * }
 */
export function NodeBuilder_EmitContext(receiver: GoPtr<NodeBuilder>): GoPtr<EmitContext_3f6f588c> {
  const b = receiver!;
  return b.impl!.e;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilder.go::method::NodeBuilder.enterContext","kind":"method","status":"implemented","sigHash":"64391abd43035e3d56369aa2be5cd3a5b0d856ba60201b426689fd138cd0a1cf","bodyHash":"8ac731636d3aeac06c3de1474c868fbb53143a4fa5392f192e17f6e0fa1ad8c8"}
 *
 * Go source:
 * func (b *NodeBuilder) enterContext(enclosingDeclaration *ast.Node, flags nodebuilder.Flags, internalFlags nodebuilder.InternalFlags, tracker nodebuilder.SymbolTracker) {
 * 	verbosityLevel := -1
 * 	maxTruncationLength := 0
 * 	if b.verbosity != nil {
 * 		verbosityLevel = b.verbosity.Level
 * 		maxTruncationLength = b.verbosity.MaxTruncationLength
 * 	}
 * 	b.ctxStack = append(b.ctxStack, b.impl.ctx)
 * 	b.impl.ctx = &NodeBuilderContext{
 * 		host:                     b.host,
 * 		tracker:                  tracker,
 * 		flags:                    flags,
 * 		internalFlags:            internalFlags,
 * 		maxExpansionDepth:        verbosityLevel,
 * 		maxTruncationLength:      maxTruncationLength,
 * 		enclosingDeclaration:     enclosingDeclaration,
 * 		enclosingFile:            ast.GetSourceFileOfNode(enclosingDeclaration),
 * 		inferTypeParameters:      make([]*Type, 0),
 * 		symbolDepth:              make(map[CompositeSymbolIdentity]int),
 * 		trackedSymbols:           make([]*TrackedSymbolArgs, 0),
 * 		reverseMappedStack:       make([]*ast.Symbol, 0),
 * 		enclosingSymbolTypes:     make(map[ast.SymbolId]*Type),
 * 		remappedSymbolReferences: make(map[ast.SymbolId]*ast.Symbol),
 * 	}
 * 	tracker = NewSymbolTrackerImpl(b.impl.ctx, tracker)
 * 	b.impl.ctx.tracker = tracker
 * }
 */
export function NodeBuilder_enterContext(receiver: GoPtr<NodeBuilder>, enclosingDeclaration: GoPtr<Node>, flags: Flags, internalFlags: InternalFlags, tracker: GoPtr<SymbolTracker>): void {
  const b = receiver!;
  let verbosityLevel = -1;
  let maxTruncationLength = 0;
  if (b.verbosity !== undefined) {
    verbosityLevel = b.verbosity.Level;
    maxTruncationLength = b.verbosity.MaxTruncationLength;
  }
  b.ctxStack = [...b.ctxStack, b.impl!.ctx];
  b.impl!.ctx = {
    host: b.host,
    tracker: tracker,
    approximateLength: 0,
    maxTruncationLength: maxTruncationLength,
    encounteredError: false as bool,
    truncating: false as bool,
    reportedDiagnostic: false as bool,
    flags: flags,
    internalFlags: internalFlags,
    depth: 0,
    maxExpansionDepth: verbosityLevel,
    typeStack: [],
    canIncreaseExpansionDepth: false as bool,
    expansionTruncated: false as bool,
    enclosingDeclaration: enclosingDeclaration,
    enclosingFile: GetSourceFileOfNode(enclosingDeclaration),
    inferTypeParameters: [],
    visitedTypes: { M: new globalThis.Map() },
    symbolDepth: new globalThis.Map(),
    trackedSymbols: [],
    mapper: undefined,
    reverseMappedStack: [],
    enclosingSymbolTypes: new globalThis.Map(),
    suppressReportInferenceFallback: false as bool,
    remappedSymbolReferences: new globalThis.Map(),
    hasCreatedTypeParameterSymbolList: false as bool,
    hasCreatedTypeParametersNamesLookups: false as bool,
    typeParameterNames: new globalThis.Map(),
    typeParameterNamesByText: new globalThis.Map(),
    typeParameterNamesByTextNextNameCount: new globalThis.Map(),
    typeParameterSymbolList: new globalThis.Map(),
  };
  const newTracker = NewSymbolTrackerImpl(b.impl!.ctx, tracker);
  b.impl!.ctx.tracker = SymbolTrackerImpl_as_SymbolTracker(newTracker);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilder.go::method::NodeBuilder.propagateVerbosityOut","kind":"method","status":"implemented","sigHash":"f8e35b80a31c5801fc9836e183e5b64d15df9d8e8e273f86b74c0652ff6da479","bodyHash":"d1130585f7ec258679e7ea2cce38af83916d81c8da4052ee1d3f20bddd5d7274"}
 *
 * Go source:
 * func (b *NodeBuilder) propagateVerbosityOut() {
 * 	if b.verbosity != nil {
 * 		// Only set to true, never clear — multiple calls share the same VerbosityContext
 * 		if b.impl.ctx.canIncreaseExpansionDepth {
 * 			b.verbosity.CanIncreaseVerbosity = true
 * 		}
 * 		if b.impl.ctx.expansionTruncated {
 * 			b.verbosity.Truncated = true
 * 		}
 * 	}
 * }
 */
export function NodeBuilder_propagateVerbosityOut(receiver: GoPtr<NodeBuilder>): void {
  const b = receiver!;
  if (b.verbosity !== undefined) {
    // Only set to true, never clear — multiple calls share the same VerbosityContext
    if (b.impl!.ctx!.canIncreaseExpansionDepth) {
      b.verbosity.CanIncreaseVerbosity = true;
    }
    if (b.impl!.ctx!.expansionTruncated) {
      b.verbosity.Truncated = true;
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilder.go::method::NodeBuilder.popContext","kind":"method","status":"implemented","sigHash":"dbeeac6da32b15dabda40999da44174dd713394667de6af076af7e2aca991376","bodyHash":"725f682404304e970772aad644a745ac48c1e6b0723295572ceee1216f4ea7e9"}
 *
 * Go source:
 * func (b *NodeBuilder) popContext() {
 * 	stackSize := len(b.ctxStack)
 * 	if stackSize == 0 {
 * 		b.impl.ctx = nil
 * 	} else {
 * 		b.impl.ctx = b.ctxStack[stackSize-1]
 * 		b.ctxStack = b.ctxStack[:stackSize-1]
 * 	}
 * }
 */
export function NodeBuilder_popContext(receiver: GoPtr<NodeBuilder>): void {
  const b = receiver!;
  const stackSize = b.ctxStack.length;
  if (stackSize === 0) {
    b.impl!.ctx = undefined;
  } else {
    b.impl!.ctx = b.ctxStack[stackSize - 1];
    b.ctxStack = b.ctxStack.slice(0, stackSize - 1);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilder.go::method::NodeBuilder.exitContext","kind":"method","status":"implemented","sigHash":"1c6e2b513829dfb9d095c46904312bd19dfcd887813883bf8ce59a662f50de02","bodyHash":"d2595749e6e7601709be50558398e702c70be6db10b9d91f4edcbe3228f02ee3"}
 *
 * Go source:
 * func (b *NodeBuilder) exitContext(result *ast.Node) *ast.Node {
 * 	b.propagateVerbosityOut()
 * 	b.exitContextCheck()
 * 	defer b.popContext()
 * 	if b.impl.ctx.encounteredError {
 * 		return nil
 * 	}
 * 	return result
 * }
 */
export function NodeBuilder_exitContext(receiver: GoPtr<NodeBuilder>, result: GoPtr<Node>): GoPtr<Node> {
  const b = receiver!;
  NodeBuilder_propagateVerbosityOut(b);
  NodeBuilder_exitContextCheck(b);
  try {
    if (b.impl!.ctx!.encounteredError) {
      return undefined;
    }
    return result;
  } finally {
    NodeBuilder_popContext(b);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilder.go::method::NodeBuilder.exitContextSlice","kind":"method","status":"implemented","sigHash":"5f687e71539c989d757d6146e94b1af9cd2109b12be9fb84d8d62763bce6966e","bodyHash":"3aa8b76718ac9ca70286c64d812ddcc6e809b64bc12788345464f47319ed3026"}
 *
 * Go source:
 * func (b *NodeBuilder) exitContextSlice(result []*ast.Node) []*ast.Node {
 * 	b.propagateVerbosityOut()
 * 	b.exitContextCheck()
 * 	defer b.popContext()
 * 	if b.impl.ctx.encounteredError {
 * 		return nil
 * 	}
 * 	return result
 * }
 */
export function NodeBuilder_exitContextSlice(receiver: GoPtr<NodeBuilder>, result: GoSlice<GoPtr<Node>>): GoSlice<GoPtr<Node>> {
  const b = receiver!;
  NodeBuilder_propagateVerbosityOut(b);
  NodeBuilder_exitContextCheck(b);
  try {
    if (b.impl!.ctx!.encounteredError) {
      return [];
    }
    return result;
  } finally {
    NodeBuilder_popContext(b);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilder.go::method::NodeBuilder.exitContextCheck","kind":"method","status":"implemented","sigHash":"62c8da6a257100a367ebb4c22486f10e136b3539723503ab78c567fb0ebdba94","bodyHash":"25ddd02df561c709e8eaf5c2cb0b7e19fc65d1aa9ce87e8a28d9772c0690604a"}
 *
 * Go source:
 * func (b *NodeBuilder) exitContextCheck() {
 * 	if b.impl.ctx.truncating && b.impl.ctx.flags&nodebuilder.FlagsNoTruncation != 0 {
 * 		b.impl.ctx.tracker.ReportTruncationError()
 * 	}
 * }
 */
export function NodeBuilder_exitContextCheck(receiver: GoPtr<NodeBuilder>): void {
  const b = receiver!;
  if (b.impl!.ctx!.truncating && (b.impl!.ctx!.flags & FlagsNoTruncation) !== 0) {
    b.impl!.ctx!.tracker!.ReportTruncationError();
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilder.go::method::NodeBuilder.IndexInfoToIndexSignatureDeclaration","kind":"method","status":"implemented","sigHash":"39389f93d15a3f17627fd2af630ad37d7cd132583ab50e6c85b2dd19d48ae37a","bodyHash":"bb0467ba4ceed911280814934b571185ee19d35ec513abf56fb61f8480803a75"}
 *
 * Go source:
 * func (b *NodeBuilder) IndexInfoToIndexSignatureDeclaration(info *IndexInfo, enclosingDeclaration *ast.Node, flags nodebuilder.Flags, internalFlags nodebuilder.InternalFlags, tracker nodebuilder.SymbolTracker) *ast.Node {
 * 	b.enterContext(enclosingDeclaration, flags, internalFlags, tracker)
 * 	return b.exitContext(b.impl.indexInfoToIndexSignatureDeclarationHelper(info, nil))
 * }
 */
export function NodeBuilder_IndexInfoToIndexSignatureDeclaration(receiver: GoPtr<NodeBuilder>, info: GoPtr<IndexInfo>, enclosingDeclaration: GoPtr<Node>, flags: Flags, internalFlags: InternalFlags, tracker: GoPtr<SymbolTracker>): GoPtr<Node> {
  const b = receiver!;
  NodeBuilder_enterContext(b, enclosingDeclaration, flags, internalFlags, tracker);
  return NodeBuilder_exitContext(b, NodeBuilderImpl_indexInfoToIndexSignatureDeclarationHelper(b.impl, info, undefined));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilder.go::method::NodeBuilder.SerializeReturnTypeForSignature","kind":"method","status":"implemented","sigHash":"dc877bc065bd8890f1e87d7e4c4564e09187eb849ed01bb3e5993e90ca1bd754","bodyHash":"122ee788bcc2b4fb2c66f2a283f3eb4fffdfa2a929b17df797a22b8b17035cad"}
 *
 * Go source:
 * func (b *NodeBuilder) SerializeReturnTypeForSignature(signatureDeclaration *ast.Node, enclosingDeclaration *ast.Node, flags nodebuilder.Flags, internalFlags nodebuilder.InternalFlags, tracker nodebuilder.SymbolTracker) *ast.Node {
 * 	b.enterContext(enclosingDeclaration, flags, internalFlags, tracker)
 * 	signature := b.impl.ch.getSignatureFromDeclaration(signatureDeclaration)
 * 	return b.exitContext(b.impl.serializeReturnTypeForSignature(signature, true))
 * }
 */
export function NodeBuilder_SerializeReturnTypeForSignature(receiver: GoPtr<NodeBuilder>, signatureDeclaration: GoPtr<Node>, enclosingDeclaration: GoPtr<Node>, flags: Flags, internalFlags: InternalFlags, tracker: GoPtr<SymbolTracker>): GoPtr<Node> {
  const b = receiver!;
  NodeBuilder_enterContext(b, enclosingDeclaration, flags, internalFlags, tracker);
  const signature = Checker_getSignatureFromDeclaration(b.impl!.ch, signatureDeclaration);
  return NodeBuilder_exitContext(b, NodeBuilderImpl_serializeReturnTypeForSignature(b.impl, signature, true));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilder.go::method::NodeBuilder.SerializeTypeParametersForSignature","kind":"method","status":"implemented","sigHash":"27fc3405a9e0e7cc1de5afb5278e12eaec19a8d07a216d584b4979bd8e12896b","bodyHash":"36a8af50cb89a3f36c76eb511b602d7b7998e132175dc9c4ea0048480db58ae3"}
 *
 * Go source:
 * func (b *NodeBuilder) SerializeTypeParametersForSignature(signatureDeclaration *ast.Node, enclosingDeclaration *ast.Node, flags nodebuilder.Flags, internalFlags nodebuilder.InternalFlags, tracker nodebuilder.SymbolTracker) []*ast.Node {
 * 	b.enterContext(enclosingDeclaration, flags, internalFlags, tracker)
 * 	symbol := b.impl.ch.getSymbolOfDeclaration(signatureDeclaration)
 * 	typeParams := b.SymbolToTypeParameterDeclarations(symbol, enclosingDeclaration, flags, internalFlags, tracker)
 * 	return b.exitContextSlice(typeParams)
 * }
 */
export function NodeBuilder_SerializeTypeParametersForSignature(receiver: GoPtr<NodeBuilder>, signatureDeclaration: GoPtr<Node>, enclosingDeclaration: GoPtr<Node>, flags: Flags, internalFlags: InternalFlags, tracker: GoPtr<SymbolTracker>): GoSlice<GoPtr<Node>> {
  const b = receiver!;
  NodeBuilder_enterContext(b, enclosingDeclaration, flags, internalFlags, tracker);
  const symbol_ = Checker_getSymbolOfDeclaration(b.impl!.ch, signatureDeclaration);
  const typeParams = NodeBuilder_SymbolToTypeParameterDeclarations(b, symbol_, enclosingDeclaration, flags, internalFlags, tracker);
  return NodeBuilder_exitContextSlice(b, typeParams);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilder.go::method::NodeBuilder.SerializeTypeForDeclaration","kind":"method","status":"implemented","sigHash":"db539f313fb9cdb1c9006ba9b5856e74e8cf84e5ad49a18a8e7f03f2a5133aea","bodyHash":"eb863fbdc279dbebbf6d09112ffedbe9dc48ad94dd7eddcda72bee9a9d74a33d"}
 *
 * Go source:
 * func (b *NodeBuilder) SerializeTypeForDeclaration(declaration *ast.Node, symbol *ast.Symbol, enclosingDeclaration *ast.Node, flags nodebuilder.Flags, internalFlags nodebuilder.InternalFlags, tracker nodebuilder.SymbolTracker) *ast.Node {
 * 	b.enterContext(enclosingDeclaration, flags, internalFlags, tracker)
 * 	return b.exitContext(b.impl.serializeTypeForDeclaration(declaration, nil, symbol, true))
 * }
 */
export function NodeBuilder_SerializeTypeForDeclaration(receiver: GoPtr<NodeBuilder>, declaration: GoPtr<Node>, symbol_: GoPtr<Symbol>, enclosingDeclaration: GoPtr<Node>, flags: Flags, internalFlags: InternalFlags, tracker: GoPtr<SymbolTracker>): GoPtr<Node> {
  const b = receiver!;
  NodeBuilder_enterContext(b, enclosingDeclaration, flags, internalFlags, tracker);
  return NodeBuilder_exitContext(b, NodeBuilderImpl_serializeTypeForDeclaration(b.impl, declaration, undefined, symbol_, true as bool));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilder.go::method::NodeBuilder.SerializeTypeForExpression","kind":"method","status":"implemented","sigHash":"b42a0228efc62205f9134231e3e6faf8b5373614b8682bde0ae0c95cd3d30f73","bodyHash":"b7399961ff473908ffffb01e20f34acfcf17b2d63371fda75ff84944839962c5"}
 *
 * Go source:
 * func (b *NodeBuilder) SerializeTypeForExpression(expr *ast.Node, enclosingDeclaration *ast.Node, flags nodebuilder.Flags, internalFlags nodebuilder.InternalFlags, tracker nodebuilder.SymbolTracker) *ast.Node {
 * 	b.enterContext(enclosingDeclaration, flags, internalFlags, tracker)
 * 	return b.exitContext(b.impl.serializeTypeForExpression(expr))
 * }
 */
export function NodeBuilder_SerializeTypeForExpression(receiver: GoPtr<NodeBuilder>, expr: GoPtr<Node>, enclosingDeclaration: GoPtr<Node>, flags: Flags, internalFlags: InternalFlags, tracker: GoPtr<SymbolTracker>): GoPtr<Node> {
  const b = receiver!;
  NodeBuilder_enterContext(b, enclosingDeclaration, flags, internalFlags, tracker);
  return NodeBuilder_exitContext(b, NodeBuilderImpl_serializeTypeForExpression(b.impl, expr));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilder.go::method::NodeBuilder.SignatureToSignatureDeclaration","kind":"method","status":"implemented","sigHash":"d877a315dba25a0bb6536f726a3e87eeaac43265cad67ff28217e25fb156c4c2","bodyHash":"d23bb9bcc5746baab16ffed68773e01edf438c24ad07be9030a5d3e0b978e297"}
 *
 * Go source:
 * func (b *NodeBuilder) SignatureToSignatureDeclaration(signature *Signature, kind ast.Kind, enclosingDeclaration *ast.Node, flags nodebuilder.Flags, internalFlags nodebuilder.InternalFlags, tracker nodebuilder.SymbolTracker) *ast.Node {
 * 	b.enterContext(enclosingDeclaration, flags, internalFlags, tracker)
 * 	return b.exitContext(b.impl.signatureToSignatureDeclarationHelper(signature, kind, nil))
 * }
 */
export function NodeBuilder_SignatureToSignatureDeclaration(receiver: GoPtr<NodeBuilder>, signature: GoPtr<Signature>, kind: Kind, enclosingDeclaration: GoPtr<Node>, flags: Flags, internalFlags: InternalFlags, tracker: GoPtr<SymbolTracker>): GoPtr<Node> {
  const b = receiver!;
  NodeBuilder_enterContext(b, enclosingDeclaration, flags, internalFlags, tracker);
  return NodeBuilder_exitContext(b, NodeBuilderImpl_signatureToSignatureDeclarationHelper(b.impl, signature, kind, undefined));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilder.go::method::NodeBuilder.ExpandSymbolForHover","kind":"method","status":"implemented","sigHash":"299d247699cd16119b504c97a121df69e1e68386d3c8923750aa31aaba141a62","bodyHash":"d640931b39a98ef8eaa129251bdeabd767dedac623f4d7cb5d88e82edfb3f170"}
 *
 * Go source:
 * func (b *NodeBuilder) ExpandSymbolForHover(symbol *ast.Symbol, meaning ast.SymbolFlags) []*ast.Node {
 * 	b.enterContext(nil, nodebuilder.FlagsIgnoreErrors|nodebuilder.FlagsMultilineObjectLiterals|nodebuilder.FlagsUseAliasDefinedOutsideCurrentScope, nodebuilder.InternalFlagsNone, nil)
 *
 * 	// Push the declared type onto the type stack to prevent re-expansion.
 * 	// We push a nil sentinel after the real type so that isTypeOnStack
 * 	// (which skips the last element) still checks declaredType.
 * 	declaredType := b.impl.ch.getDeclaredTypeOfSymbol(symbol)
 * 	b.impl.ctx.typeStack = append(b.impl.ctx.typeStack, declaredType)
 * 	b.impl.ctx.typeStack = append(b.impl.ctx.typeStack, nil)
 *
 * 	nodes := b.impl.expandSymbolForHover(symbol)
 *
 * 	b.impl.ctx.typeStack = b.impl.ctx.typeStack[:len(b.impl.ctx.typeStack)-2]
 *
 * 	b.propagateVerbosityOut()
 *
 * 	// Simplify declarations by applying original modifiers
 * 	result := make([]*ast.Node, 0, len(nodes))
 * 	for _, node := range nodes {
 * 		switch node.Kind {
 * 		case ast.KindClassDeclaration:
 * 			result = append(result, simplifyClassDeclaration(b.impl.f, node, symbol))
 * 		case ast.KindEnumDeclaration:
 * 			result = append(result, simplifyModifiers(b.impl.f, node, ast.IsEnumDeclaration, symbol))
 * 		case ast.KindInterfaceDeclaration:
 * 			if meaning&ast.SymbolFlagsInterface != 0 {
 * 				result = append(result, simplifyModifiers(b.impl.f, node, ast.IsInterfaceDeclaration, symbol))
 * 			}
 * 		case ast.KindModuleDeclaration:
 * 			result = append(result, simplifyModifiers(b.impl.f, node, ast.IsModuleDeclaration, symbol))
 * 		}
 * 	}
 *
 * 	return b.exitContextSlice(result)
 * }
 */
export function NodeBuilder_ExpandSymbolForHover(receiver: GoPtr<NodeBuilder>, symbol_: GoPtr<Symbol>, meaning: SymbolFlags): GoSlice<GoPtr<Node>> {
  const b = receiver!;
  NodeBuilder_enterContext(b, undefined, (FlagsIgnoreErrors | FlagsMultilineObjectLiterals | FlagsUseAliasDefinedOutsideCurrentScope) as Flags, 0 as InternalFlags, undefined as unknown as SymbolTracker);
  const declaredType = Checker_getDeclaredTypeOfSymbol(b.impl!.ch, symbol_);
  b.impl!.ctx!.typeStack = [...b.impl!.ctx!.typeStack, declaredType];
  b.impl!.ctx!.typeStack = [...b.impl!.ctx!.typeStack, undefined];
  const nodes = NodeBuilderImpl_expandSymbolForHover(b.impl, symbol_);
  b.impl!.ctx!.typeStack = b.impl!.ctx!.typeStack.slice(0, b.impl!.ctx!.typeStack.length - 2);
  NodeBuilder_propagateVerbosityOut(b);
  let result: GoSlice<GoPtr<Node>> = [];
  for (const node of nodes) {
    switch (node!.Kind) {
      case KindClassDeclaration:
        result = [...result, simplifyClassDeclaration(b.impl!.f, node, symbol_)];
        break;
      case KindEnumDeclaration:
        result = [...result, simplifyModifiers(b.impl!.f, node, IsEnumDeclaration, symbol_)];
        break;
      case KindInterfaceDeclaration:
        if ((meaning & SymbolFlagsInterface) !== 0) {
          result = [...result, simplifyModifiers(b.impl!.f, node, IsInterfaceDeclaration, symbol_)];
        }
        break;
      case KindModuleDeclaration:
        result = [...result, simplifyModifiers(b.impl!.f, node, IsModuleDeclaration, symbol_)];
        break;
    }
  }
  return NodeBuilder_exitContextSlice(b, result);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilder.go::func::simplifyClassDeclaration","kind":"func","status":"implemented","sigHash":"7c62def0ba136852000b19a2e3ff5f59dc78a370af8fbbe9ca73fad6c3d4d6fe","bodyHash":"8def4b051ca2d82eaf54d12e3cbcdc3dca3d6c9501d3af699f3475018a6e019f"}
 *
 * Go source:
 * func simplifyClassDeclaration(f *ast.NodeFactory, classDecl *ast.Node, symbol *ast.Symbol) *ast.Node {
 * 	classDeclarations := core.Filter(symbol.Declarations, ast.IsClassLike)
 * 	var originalClassDecl *ast.Node
 * 	if len(classDeclarations) > 0 {
 * 		originalClassDecl = classDeclarations[0]
 * 	} else {
 * 		originalClassDecl = classDecl
 * 	}
 * 	modifiers := originalClassDecl.ModifierFlags() & ^(ast.ModifierFlagsExport | ast.ModifierFlagsAmbient)
 * 	isAnonymous := ast.IsClassExpression(originalClassDecl)
 * 	if isAnonymous {
 * 		cd := classDecl.AsClassDeclaration()
 * 		classDecl = f.UpdateClassDeclaration(
 * 			cd,
 * 			classDecl.Modifiers(),
 * 			nil,
 * 			cd.TypeParameters,
 * 			cd.HeritageClauses,
 * 			cd.Members,
 * 		)
 * 	}
 * 	return ast.ReplaceModifiers(f, classDecl, f.NewModifierList(ast.CreateModifiersFromModifierFlags(modifiers, f.NewModifier)))
 * }
 */
export function simplifyClassDeclaration(f: GoPtr<NodeFactory>, classDecl: GoPtr<Node>, symbol_: GoPtr<Symbol>): GoPtr<Node> {
  const classDeclarations = Filter(symbol_!.Declarations ?? [], IsClassLike);
  let originalClassDecl: GoPtr<Node>;
  if (classDeclarations.length > 0) {
    originalClassDecl = classDeclarations[0];
  } else {
    originalClassDecl = classDecl;
  }
  const modifiers = Node_ModifierFlags(originalClassDecl) & ~(ModifierFlagsExport | ModifierFlagsAmbient);
  const isAnonymous = IsClassExpression(originalClassDecl);
  if (isAnonymous) {
    const cd = AsClassDeclaration(classDecl);
    classDecl = NodeFactory_UpdateClassDeclaration(
      f,
      cd,
      Node_Modifiers(classDecl),
      undefined,
      cd!.TypeParameters,
      cd!.HeritageClauses,
      cd!.Members,
    );
  }
  return ReplaceModifiers(f, classDecl, NodeFactory_NewModifierList(f, CreateModifiersFromModifierFlags(modifiers, (kind: Kind) => NodeFactory_NewModifier(f, kind))));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilder.go::func::simplifyModifiers","kind":"func","status":"implemented","sigHash":"57fd2fe02d634d4c88ecfa02cccbcb771ce7e1d0af3a25a1f83ac71e0dc1aeb5","bodyHash":"9a13b69547141efe6b92c4e0d4d0f24aebb33f828ade2d76c5f65c6490e51808"}
 *
 * Go source:
 * func simplifyModifiers(f *ast.NodeFactory, newDecl *ast.Node, isDeclKind func(*ast.Node) bool, symbol *ast.Symbol) *ast.Node {
 * 	decls := core.Filter(symbol.Declarations, isDeclKind)
 * 	var declWithModifiers *ast.Node
 * 	if len(decls) > 0 {
 * 		declWithModifiers = decls[0]
 * 	} else {
 * 		declWithModifiers = newDecl
 * 	}
 * 	modifiers := declWithModifiers.ModifierFlags() & ^(ast.ModifierFlagsExport | ast.ModifierFlagsAmbient)
 * 	return ast.ReplaceModifiers(f, newDecl, f.NewModifierList(ast.CreateModifiersFromModifierFlags(modifiers, f.NewModifier)))
 * }
 */
export function simplifyModifiers(f: GoPtr<NodeFactory>, newDecl: GoPtr<Node>, isDeclKind: (arg0: GoPtr<Node>) => bool, symbol_: GoPtr<Symbol>): GoPtr<Node> {
  const decls = Filter(symbol_!.Declarations ?? [], isDeclKind);
  let declWithModifiers: GoPtr<Node>;
  if (decls.length > 0) {
    declWithModifiers = decls[0];
  } else {
    declWithModifiers = newDecl;
  }
  const modifiers = Node_ModifierFlags(declWithModifiers) & ~(ModifierFlagsExport | ModifierFlagsAmbient);
  return ReplaceModifiers(f, newDecl, NodeFactory_NewModifierList(f, CreateModifiersFromModifierFlags(modifiers, (kind: Kind) => NodeFactory_NewModifier(f, kind))));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilder.go::method::NodeBuilder.SymbolToEntityName","kind":"method","status":"implemented","sigHash":"3522797e85ee5406618392a7084109fdc2c3728b114b6ee764ae76bb3bea8458","bodyHash":"bef579ad93c6d2865aef5ebc7fd6b3fc340fbe98c2e48fcb656987277ba3c383"}
 *
 * Go source:
 * func (b *NodeBuilder) SymbolToEntityName(symbol *ast.Symbol, meaning ast.SymbolFlags, enclosingDeclaration *ast.Node, flags nodebuilder.Flags, internalFlags nodebuilder.InternalFlags, tracker nodebuilder.SymbolTracker) *ast.Node {
 * 	b.enterContext(enclosingDeclaration, flags, internalFlags, tracker)
 * 	return b.exitContext(b.impl.symbolToName(symbol, meaning, false))
 * }
 */
export function NodeBuilder_SymbolToEntityName(receiver: GoPtr<NodeBuilder>, symbol_: GoPtr<Symbol>, meaning: SymbolFlags, enclosingDeclaration: GoPtr<Node>, flags: Flags, internalFlags: InternalFlags, tracker: GoPtr<SymbolTracker>): GoPtr<Node> {
  const b = receiver!;
  NodeBuilder_enterContext(b, enclosingDeclaration, flags, internalFlags, tracker);
  return NodeBuilder_exitContext(b, NodeBuilderImpl_symbolToName(b.impl, symbol_, meaning, false as bool));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilder.go::method::NodeBuilder.SymbolToExpression","kind":"method","status":"implemented","sigHash":"7211804fa867213dafbacc0cd1756bd0ad8b2183c81fe8f48332399a6062ce53","bodyHash":"929fcf3525ab5b414d6fe85ea946912fff9f7c87b848f12bf4795a621bcc5995"}
 *
 * Go source:
 * func (b *NodeBuilder) SymbolToExpression(symbol *ast.Symbol, meaning ast.SymbolFlags, enclosingDeclaration *ast.Node, flags nodebuilder.Flags, internalFlags nodebuilder.InternalFlags, tracker nodebuilder.SymbolTracker) *ast.Node {
 * 	b.enterContext(enclosingDeclaration, flags, internalFlags, tracker)
 * 	return b.exitContext(b.impl.symbolToExpression(symbol, meaning))
 * }
 */
export function NodeBuilder_SymbolToExpression(receiver: GoPtr<NodeBuilder>, symbol_: GoPtr<Symbol>, meaning: SymbolFlags, enclosingDeclaration: GoPtr<Node>, flags: Flags, internalFlags: InternalFlags, tracker: GoPtr<SymbolTracker>): GoPtr<Node> {
  const b = receiver!;
  NodeBuilder_enterContext(b, enclosingDeclaration, flags, internalFlags, tracker);
  return NodeBuilder_exitContext(b, NodeBuilderImpl_symbolToExpression(b.impl, symbol_, meaning));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilder.go::method::NodeBuilder.SymbolToNode","kind":"method","status":"implemented","sigHash":"e8460c19552e798ecdcc955b0d3b6a1cdf2ff338b4dc982f925b48fa9f1dbc4b","bodyHash":"be8660e35db96f205d21c0bbe5546b62d383503c1f77722c1d4f7973ae10837e"}
 *
 * Go source:
 * func (b *NodeBuilder) SymbolToNode(symbol *ast.Symbol, meaning ast.SymbolFlags, enclosingDeclaration *ast.Node, flags nodebuilder.Flags, internalFlags nodebuilder.InternalFlags, tracker nodebuilder.SymbolTracker) *ast.Node {
 * 	b.enterContext(enclosingDeclaration, flags, internalFlags, tracker)
 * 	return b.exitContext(b.impl.symbolToNode(symbol, meaning))
 * }
 */
export function NodeBuilder_SymbolToNode(receiver: GoPtr<NodeBuilder>, symbol_: GoPtr<Symbol>, meaning: SymbolFlags, enclosingDeclaration: GoPtr<Node>, flags: Flags, internalFlags: InternalFlags, tracker: GoPtr<SymbolTracker>): GoPtr<Node> {
  const b = receiver!;
  NodeBuilder_enterContext(b, enclosingDeclaration, flags, internalFlags, tracker);
  return NodeBuilder_exitContext(b, NodeBuilderImpl_symbolToNode(b.impl, symbol_, meaning));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilder.go::method::NodeBuilder.SymbolToParameterDeclaration","kind":"method","status":"implemented","sigHash":"e3763b8a0a68163645ef731b8982395db4a522fd52d86becd8840d047abb23f8","bodyHash":"2f379a0031b780a2a350ee4b4d6d375820871033ec12f63ce73ff33f881c035a"}
 *
 * Go source:
 * func (b NodeBuilder) SymbolToParameterDeclaration(symbol *ast.Symbol, enclosingDeclaration *ast.Node, flags nodebuilder.Flags, internalFlags nodebuilder.InternalFlags, tracker nodebuilder.SymbolTracker) *ast.Node {
 * 	b.enterContext(enclosingDeclaration, flags, internalFlags, tracker)
 * 	return b.exitContext(b.impl.symbolToParameterDeclaration(symbol, false))
 * }
 */
export function NodeBuilder_SymbolToParameterDeclaration(receiver: NodeBuilder, symbol_: GoPtr<Symbol>, enclosingDeclaration: GoPtr<Node>, flags: Flags, internalFlags: InternalFlags, tracker: GoPtr<SymbolTracker>): GoPtr<Node> {
  const b = receiver;
  NodeBuilder_enterContext(b, enclosingDeclaration, flags, internalFlags, tracker);
  return NodeBuilder_exitContext(b, NodeBuilderImpl_symbolToParameterDeclaration(b.impl, symbol_, false as bool));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilder.go::method::NodeBuilder.SymbolToTypeParameterDeclarations","kind":"method","status":"implemented","sigHash":"fdec68156ada3a287eb6281f926566ce7d868cfc029609125c1a52bcc79e0122","bodyHash":"2acbbb860093b219b3f8b8707e1feb82bf8a49aaf5855c9e42524a5bb2445d7c"}
 *
 * Go source:
 * func (b *NodeBuilder) SymbolToTypeParameterDeclarations(symbol *ast.Symbol, enclosingDeclaration *ast.Node, flags nodebuilder.Flags, internalFlags nodebuilder.InternalFlags, tracker nodebuilder.SymbolTracker) []*ast.Node {
 * 	b.enterContext(enclosingDeclaration, flags, internalFlags, tracker)
 * 	return b.exitContextSlice(b.impl.symbolToTypeParameterDeclarations(symbol))
 * }
 */
export function NodeBuilder_SymbolToTypeParameterDeclarations(receiver: GoPtr<NodeBuilder>, symbol_: GoPtr<Symbol>, enclosingDeclaration: GoPtr<Node>, flags: Flags, internalFlags: InternalFlags, tracker: GoPtr<SymbolTracker>): GoSlice<GoPtr<Node>> {
  const b = receiver!;
  NodeBuilder_enterContext(b, enclosingDeclaration, flags, internalFlags, tracker);
  return NodeBuilder_exitContextSlice(b, NodeBuilderImpl_symbolToTypeParameterDeclarations(b.impl, symbol_));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilder.go::method::NodeBuilder.TypeParameterToDeclaration","kind":"method","status":"implemented","sigHash":"887c1a98669dc43b6a6a3ebc929c86464abde42532cb5d4c5a31b2efe554aa18","bodyHash":"136d71fcd2e3afee83eeba42a0ffbca86aa9aaa627449348bf05ef11e717751f"}
 *
 * Go source:
 * func (b *NodeBuilder) TypeParameterToDeclaration(parameter *Type, enclosingDeclaration *ast.Node, flags nodebuilder.Flags, internalFlags nodebuilder.InternalFlags, tracker nodebuilder.SymbolTracker) *ast.Node {
 * 	b.enterContext(enclosingDeclaration, flags, internalFlags, tracker)
 * 	return b.exitContext(b.impl.typeParameterToDeclaration(parameter))
 * }
 */
export function NodeBuilder_TypeParameterToDeclaration(receiver: GoPtr<NodeBuilder>, parameter: GoPtr<Type>, enclosingDeclaration: GoPtr<Node>, flags: Flags, internalFlags: InternalFlags, tracker: GoPtr<SymbolTracker>): GoPtr<Node> {
  const b = receiver!;
  NodeBuilder_enterContext(b, enclosingDeclaration, flags, internalFlags, tracker);
  return NodeBuilder_exitContext(b, NodeBuilderImpl_typeParameterToDeclaration(b.impl, parameter));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilder.go::method::NodeBuilder.TypePredicateToTypePredicateNode","kind":"method","status":"implemented","sigHash":"e538c39c3c9ca6a0af1e55552a1736d012822ca7a5333755c22707c0a26cf1ef","bodyHash":"0b760d0e3cdc3cb7b7629ee89b88c6af944b43300375b2c04be567a40b6a500a"}
 *
 * Go source:
 * func (b *NodeBuilder) TypePredicateToTypePredicateNode(predicate *TypePredicate, enclosingDeclaration *ast.Node, flags nodebuilder.Flags, internalFlags nodebuilder.InternalFlags, tracker nodebuilder.SymbolTracker) *ast.Node {
 * 	b.enterContext(enclosingDeclaration, flags, internalFlags, tracker)
 * 	return b.exitContext(b.impl.typePredicateToTypePredicateNode(predicate))
 * }
 */
export function NodeBuilder_TypePredicateToTypePredicateNode(receiver: GoPtr<NodeBuilder>, predicate: GoPtr<TypePredicate>, enclosingDeclaration: GoPtr<Node>, flags: Flags, internalFlags: InternalFlags, tracker: GoPtr<SymbolTracker>): GoPtr<Node> {
  const b = receiver!;
  NodeBuilder_enterContext(b, enclosingDeclaration, flags, internalFlags, tracker);
  return NodeBuilder_exitContext(b, NodeBuilderImpl_typePredicateToTypePredicateNode(b.impl, predicate));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilder.go::method::NodeBuilder.TypeToTypeNode","kind":"method","status":"implemented","sigHash":"2e85aaa331e9855bd57b73fffecba12b40d76ecd64b799680fa4a2cec193ef2f","bodyHash":"b6a111a38f34876e0646ccac0d94e73b6d038766c8d1c6226f748e28f0493413"}
 *
 * Go source:
 * func (b *NodeBuilder) TypeToTypeNode(typ *Type, enclosingDeclaration *ast.Node, flags nodebuilder.Flags, internalFlags nodebuilder.InternalFlags, tracker nodebuilder.SymbolTracker) *ast.Node {
 * 	b.enterContext(enclosingDeclaration, flags, internalFlags, tracker)
 * 	return b.exitContext(b.impl.typeToTypeNode(typ))
 * }
 */
export function NodeBuilder_TypeToTypeNode(receiver: GoPtr<NodeBuilder>, typ: GoPtr<Type>, enclosingDeclaration: GoPtr<Node>, flags: Flags, internalFlags: InternalFlags, tracker: GoPtr<SymbolTracker>): GoPtr<Node> {
  const b = receiver!;
  NodeBuilder_enterContext(b, enclosingDeclaration, flags, internalFlags, tracker);
  return NodeBuilder_exitContext(b, NodeBuilderImpl_typeToTypeNode(b.impl, typ));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilder.go::method::NodeBuilder.TryJSTypeNodeToTypeNode","kind":"method","status":"implemented","sigHash":"b6c74298c4ec35ba01ad8fc5982cd44f81a46c0df07497338d0dc9557b3dd57c","bodyHash":"2ffebcb7eb1e599e9076aecc3ec526bce513527c1373bfc428505d41ad0f6cd7"}
 *
 * Go source:
 * func (b *NodeBuilder) TryJSTypeNodeToTypeNode(node *ast.Node, enclosingDeclaration *ast.Node, flags nodebuilder.Flags, internalFlags nodebuilder.InternalFlags, tracker nodebuilder.SymbolTracker) *ast.Node {
 * 	b.enterContext(enclosingDeclaration, flags, internalFlags, tracker)
 * 	return b.exitContext(b.impl.tryJSTypeNodeToTypeNode(node))
 * }
 */
export function NodeBuilder_TryJSTypeNodeToTypeNode(receiver: GoPtr<NodeBuilder>, node: GoPtr<Node>, enclosingDeclaration: GoPtr<Node>, flags: Flags, internalFlags: InternalFlags, tracker: GoPtr<SymbolTracker>): GoPtr<Node> {
  const b = receiver!;
  NodeBuilder_enterContext(b, enclosingDeclaration, flags, internalFlags, tracker);
  return NodeBuilder_exitContext(b, NodeBuilderImpl_tryJSTypeNodeToTypeNode(b.impl, node));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilder.go::func::NewNodeBuilder","kind":"func","status":"implemented","sigHash":"908a7a8953123cd4e81890e895b7e1c396a78e64c6db6dc1bb9ade29abb84392","bodyHash":"a298cc7f244ad0ddad0e13c95ab725dcfebbdf5f80ac1d2ecf7694b334ee9594"}
 *
 * Go source:
 * func NewNodeBuilder(ch *Checker, e *printer.EmitContext) *NodeBuilder {
 * 	return NewNodeBuilderEx(ch, e, nil /*idToSymbol* /)
 * }
 */
export function NewNodeBuilder(ch: GoPtr<Checker>, e: GoPtr<EmitContext_3f6f588c>): GoPtr<NodeBuilder> {
  return NewNodeBuilderEx(ch, e, new globalThis.Map() as GoMap<GoPtr<IdentifierNode>, GoPtr<Symbol>>);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilder.go::func::NewNodeBuilderEx","kind":"func","status":"implemented","sigHash":"7b8388ef9588371c534fbbd7c9bc213ccc724cb54237fe8b75685ebdf5f49d95","bodyHash":"49d91539e342c32a3f4475d286d5df4c788a6926b20f2939f6f1cb7b3bdc7554"}
 *
 * Go source:
 * func NewNodeBuilderEx(ch *Checker, e *printer.EmitContext, idToSymbol map[*ast.IdentifierNode]*ast.Symbol) *NodeBuilder {
 * 	impl := newNodeBuilderImpl(ch, e, idToSymbol)
 * 	return &NodeBuilder{impl: impl, ctxStack: make([]*NodeBuilderContext, 0, 1), host: ch.program}
 * }
 */
export function NewNodeBuilderEx(ch: GoPtr<Checker>, e: GoPtr<EmitContext_3f6f588c>, idToSymbol: GoMap<GoPtr<IdentifierNode>, GoPtr<Symbol>>): GoPtr<NodeBuilder> {
  const impl = newNodeBuilderImpl(ch, e, idToSymbol);
  return { impl: impl, ctxStack: [], host: ch!.program as unknown as Host, verbosity: undefined };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilder.go::method::Checker.getNodeBuilder","kind":"method","status":"implemented","sigHash":"edda71033b2e42b9e4df5df19ec4868057afacb05bdfa47dcd6124225000a4f9","bodyHash":"3907fd354632cf5b05aacd5bc7172046670b2762c2dceb3a6835082396877676"}
 *
 * Go source:
 * func (c *Checker) getNodeBuilder() *NodeBuilder {
 * 	return c.getNodeBuilderEx(nil /*idToSymbol* /)
 * }
 */
export function Checker_getNodeBuilder(receiver: GoPtr<Checker>): GoPtr<NodeBuilder> {
  return Checker_getNodeBuilderEx(receiver, new globalThis.Map() as GoMap<GoPtr<IdentifierNode>, GoPtr<Symbol>>);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilder.go::method::Checker.getNodeBuilderEx","kind":"method","status":"implemented","sigHash":"87077f83bd4df6f01f810b78e4f0c9d739a8c2f80668e06b95e988c30c88f5cb","bodyHash":"bfbf5509f27815b4c24932e17d3b7b48480b54a71fd3271af1a62dddae2b616d"}
 *
 * Go source:
 * func (c *Checker) getNodeBuilderEx(idToSymbol map[*ast.IdentifierNode]*ast.Symbol) *NodeBuilder {
 * 	b := NewNodeBuilderEx(c, printer.NewEmitContext(), idToSymbol)
 * 	return b
 * }
 */
export function Checker_getNodeBuilderEx(receiver: GoPtr<Checker>, idToSymbol: GoMap<GoPtr<IdentifierNode>, GoPtr<Symbol>>): GoPtr<NodeBuilder> {
  return NewNodeBuilderEx(receiver, NewEmitContext(), idToSymbol);
}
