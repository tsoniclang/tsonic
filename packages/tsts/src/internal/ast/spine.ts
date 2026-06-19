import type { bool, int, short } from "../../go/scalars.js";
import type { GoPtr, GoSeq, GoSlice } from "../../go/compat.js";
import { Uint32, Uint64 } from "../../go/sync/atomic.js";
import { TextRange_End, TextRange_Pos, UndefinedTextRange } from "../core/text.js";
import type { TextRange } from "../core/text.js";
import type { Kind } from "./generated/kinds.js";
import { KindString as Kind_String } from "./generated/kinds.js";
import type { NodeFlags } from "./generated/flags.js";
import type { ModifierFlags } from "./modifierflags.js";
import { ModifiersToFlags } from "./modifierflags.js";
import type {
  BodyBase as BodyBaseType,
  ClassLikeBase as ClassLikeBaseType,
  DeclarationBase as DeclarationBaseType,
  ExportableBase as ExportableBaseType,
  FlowNodeBase as FlowNodeBaseType,
  FunctionLikeBase as FunctionLikeBaseType,
  FunctionLikeWithBodyBase as FunctionLikeWithBodyBaseType,
  LiteralLikeNodeBase as LiteralLikeNodeBaseType,
  LocalsContainerBase as LocalsContainerBaseType,
  ModifiersBase as ModifiersBaseType,
  NamedMemberBase as NamedMemberBaseType,
  TemplateLiteralLikeNodeBase as TemplateLiteralLikeNodeBaseType,
} from "./generated/node.js";
import type { CompositeBase as CompositeBaseType } from "./generated/node.js";
import type { NodeFactory } from "./generated/factory.js";
import type { DeclarationName } from "./generated/unions.js";
import type { SubtreeFacts } from "./subtreefacts.js";
import {
  SubtreeContainsTypeScript,
  SubtreeExclusionsNode,
  SubtreeFactsComputed,
  SubtreeFactsNone,
  propagateEraseableSyntaxListSubtreeFacts,
  propagateModifierListSubtreeFacts,
  propagateNodeListSubtreeFacts,
  propagateSubtreeFacts,
} from "./subtreefacts.js";
import { ModifierFlagsAmbient } from "./modifierflags.js";

// ──────────────────────────────────────────────────────────────────────
// Go interface value brand
//
// A Go interface value (`nodeData`) is represented as a method-bearing adapter
// object. To recover the concrete receiver behind an interface value (Go's
// `x, ok := v.(*Concrete)` / `v.(*Concrete)`), the generated `Concrete_as_nodeData`
// adapter attaches the concrete receiver under this brand. `casts.ts` reads it.
// ──────────────────────────────────────────────────────────────────────

// The brand key is a real runtime symbol whose `unique symbol` type is inferred
// directly from the `Symbol(...)` initializer (no cast needed). `GoInterfaceValue`
// keys an optional receiver slot by that symbol type so adapters can attach, and
// casts.ts can recover, the concrete receiver.
export const goReceiverKey: unique symbol = Symbol("goReceiver");
export type GoInterfaceValue<C> = { readonly [goReceiverKey]?: C };

// Re-export the @tsgo-unit spine units below.

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::type::Visitor","kind":"type","status":"implemented","sigHash":"dd7869ba97de380722453246fae6df0cc0fef854aefc29795374493d0e8ef23c","bodyHash":"34315412c563b2ca587e80bf5a4db9916d69e3fc67193ad8594828a91464a464"}
 *
 * Go source:
 * type Visitor func(*Node) bool
 */
export type Visitor = (node: GoPtr<Node>) => bool;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::func::visit","kind":"func","status":"implemented","sigHash":"bef78268f8a3a18b41ab5c60fb297d2a9369e5cdbf170f785c999f329d979b43","bodyHash":"aeee441d8fb9ff4e184d19a4b9b42d8c3571949c597297c9745d5f298f9496e9"}
 *
 * Go source:
 * func visit(v Visitor, node *Node) bool {
 * 	if node != nil {
 * 		return v(node)
 * 	}
 * 	return false
 * }
 */
export function visit(v: Visitor, node: GoPtr<Node>): bool {
  if (node !== undefined) {
    return v(node);
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::func::visitNodes","kind":"func","status":"implemented","sigHash":"318dd6aac412b7d70696ac774621b0b9bfee7c247a324ef2f5d4ca4369145ce0","bodyHash":"d837ebe0e8ffbcf5ce212c251c6e24175c399d6f1a77e7f0d709d986550ddcf3"}
 *
 * Go source:
 * func visitNodes(v Visitor, nodes []*Node) bool {
 * 	for _, node := range nodes {
 * 		if v(node) {
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export function visitNodes(v: Visitor, nodes: GoSlice<GoPtr<Node>>): bool {
  for (const node of nodes) {
    if (v(node)) {
      return true as bool;
    }
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::func::visitNodeList","kind":"func","status":"implemented","sigHash":"7854a853ac156c696afdac18226463dc9d92c6f97ac04091fe294a69626d7c89","bodyHash":"2eedc0842ebb08045558f9ae767f5222ad716c358326bcebff19138150f81864"}
 *
 * Go source:
 * func visitNodeList(v Visitor, nodeList *NodeList) bool {
 * 	if nodeList != nil {
 * 		return visitNodes(v, nodeList.Nodes)
 * 	}
 * 	return false
 * }
 */
export function visitNodeList(v: Visitor, nodeList: GoPtr<NodeList>): bool {
  if (nodeList !== undefined) {
    return visitNodes(v, nodeList.Nodes);
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::func::visitModifiers","kind":"func","status":"implemented","sigHash":"600bc6a9041816585deaaf81b40ab29ae46a46e1ef2edeb83671055e811f538c","bodyHash":"b40c43183f2efa245ed0965f3c61d011865e0e267c2a4abd82f442d9bd60c256"}
 *
 * Go source:
 * func visitModifiers(v Visitor, modifiers *ModifierList) bool {
 * 	if modifiers != nil {
 * 		return visitNodes(v, modifiers.Nodes)
 * 	}
 * 	return false
 * }
 */
export function visitModifiers(v: Visitor, modifiers: GoPtr<ModifierList>): bool {
  if (modifiers !== undefined) {
    return visitNodes(v, modifiers.Nodes);
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::type::NodeFactoryHooks","kind":"type","status":"implemented","sigHash":"c19e715861a55c48c6334471ef372544e01b33173c699f7d4c23340ef38721bf","bodyHash":"cf0ecdafbd06e0cb0dffa6e3f837220bb3cde3169037611ed215bab1f93a9763"}
 *
 * Go source:
 * NodeFactoryHooks struct {
 * 	OnCreate func(node *Node)                 // Hooks the creation of a node.
 * 	OnUpdate func(node *Node, original *Node) // Hooks the updating of a node.
 * 	OnClone  func(node *Node, original *Node) // Hooks the cloning of a node.
 * }
 */
export interface NodeFactoryHooks {
  OnCreate?: GoPtr<(node: GoPtr<Node>) => void>;
  OnUpdate?: GoPtr<(node: GoPtr<Node>, original: GoPtr<Node>) => void>;
  OnClone?: GoPtr<(node: GoPtr<Node>, original: GoPtr<Node>) => void>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::type::NodeFactoryCoercible","kind":"type","status":"implemented","sigHash":"d5f8fe061d97cfad5cd0687354c63df9205369b805dc72b8ba7151a98cb0f88e","bodyHash":"14aede23310cdca6524e47252acceb75dade09ff0fa179ab34eaa2f91c53ca4b"}
 *
 * Go source:
 * NodeFactoryCoercible interface {
 * 	AsNodeFactory() *NodeFactory
 * }
 */
export interface NodeFactoryCoercible {
  AsNodeFactory(): GoPtr<NodeFactory>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::type::NodeList","kind":"type","status":"implemented","sigHash":"95375bfc85379bc18d3fe518dc4aeaf4354df9f076b9ac02ab2d12f001888d64","bodyHash":"c8e49635f756c63779a06db63e3f0f54e80fd180acd91a2781abc4f267a193d2"}
 *
 * Go source:
 * NodeList struct {
 * 	Loc   core.TextRange
 * 	Nodes []*Node
 * }
 */
export interface NodeList {
  Loc: TextRange;
  Nodes: GoSlice<GoPtr<Node>>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::type::ModifierList","kind":"type","status":"implemented","sigHash":"80b250fc51b865f7edb37240022a8f9449ea9a772460fe5dde59c0046e578e80","bodyHash":"1615617419d57fd30e4d48c85a718e14c6f60fe1c19a66a9ddb54db179a28b2c"}
 *
 * Go source:
 * ModifierList struct {
 * 	NodeList
 * 	ModifierFlags ModifierFlags
 * }
 */
export interface ModifierList extends NodeList {
  ModifierFlags: ModifierFlags;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::type::Node","kind":"type","status":"implemented","sigHash":"28b387d29ec29d41da8f43c3390674924062653fc66f4da7a1b048db268c822c","bodyHash":"962cd77e438108cf12139aa50d5ba340f441310f29c98c75dcacba48acb4938e"}
 *
 * Go source:
 * Node struct {
 * 	Kind   Kind
 * 	Flags  NodeFlags
 * 	Loc    core.TextRange
 * 	id     atomic.Uint64
 * 	Parent *Node
 * 	data   nodeData
 * }
 */
export interface Node {
  Kind: Kind;
  Flags: NodeFlags;
  Loc: TextRange;
  id: Uint64;
  Parent: GoPtr<Node>;
  data: nodeData;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::type::nodeData","kind":"type","status":"implemented","sigHash":"917909b9dde382933bf1d3f2d7a85eaed5809b3c52e9e455d41c7f90de91fb0f","bodyHash":"69bea16559e2295ce35ca04e8d779ab24e8ef282ab94a47e5e94979cfd146b60"}
 *
 * Go source:
 * nodeData interface {
 * 	AsNode() *Node
 * 	ForEachChild(v Visitor) bool
 * 	IterChildren() iter.Seq[*Node]
 * 	VisitEachChild(v *NodeVisitor) *Node
 * 	Clone(v NodeFactoryCoercible) *Node
 * 	Name() *DeclarationName
 * 	Modifiers() *ModifierList
 * 	setModifiers(modifiers *ModifierList)
 * 	FlowNodeData() *FlowNodeBase
 * 	DeclarationData() *DeclarationBase
 * 	ExportableData() *ExportableBase
 * 	LocalsContainerData() *LocalsContainerBase
 * 	FunctionLikeData() *FunctionLikeBase
 * 	ClassLikeData() *ClassLikeBase
 * 	BodyData() *BodyBase
 * 	LiteralLikeData() *LiteralLikeNodeBase
 * 	TemplateLiteralLikeData() *TemplateLiteralLikeNodeBase
 * 	SubtreeFacts() SubtreeFacts
 * 	computeSubtreeFacts() SubtreeFacts
 * 	subtreeFactsWorker(self nodeData) SubtreeFacts
 * 	propagateSubtreeFacts() SubtreeFacts
 * }
 */
export interface nodeData extends GoInterfaceValue<unknown> {
  AsNode(): GoPtr<Node>;
  ForEachChild(v: Visitor): bool;
  IterChildren(): GoSeq<GoPtr<Node>>;
  VisitEachChild(v: GoPtr<NodeVisitor>): GoPtr<Node>;
  Clone(v: NodeFactoryCoercible): GoPtr<Node>;
  Name(): GoPtr<DeclarationName>;
  Modifiers(): GoPtr<ModifierList>;
  setModifiers(modifiers: GoPtr<ModifierList>): void;
  FlowNodeData(): GoPtr<FlowNodeBaseType>;
  DeclarationData(): GoPtr<DeclarationBaseType>;
  ExportableData(): GoPtr<ExportableBaseType>;
  LocalsContainerData(): GoPtr<LocalsContainerBaseType>;
  FunctionLikeData(): GoPtr<FunctionLikeBaseType>;
  ClassLikeData(): GoPtr<ClassLikeBaseType>;
  BodyData(): GoPtr<BodyBaseType>;
  LiteralLikeData(): GoPtr<LiteralLikeNodeBaseType>;
  TemplateLiteralLikeData(): GoPtr<TemplateLiteralLikeNodeBaseType>;
  SubtreeFacts(): SubtreeFacts;
  computeSubtreeFacts(): SubtreeFacts;
  subtreeFactsWorker(self: nodeData): SubtreeFacts;
  propagateSubtreeFacts(): SubtreeFacts;
}

// `iter.Seq[*Node]`: an iterator-yielding function. Modeled faithfully as a
// Go range-func (a function taking a `yield` callback returning bool).
export type NodeIter = GoSeq<GoPtr<Node>>;

// `*NodeVisitor` is owned by the hand-written `internal/ast/visitor.go` (a later,
// co-landing wave). The spine only needs its identity for the `nodeData`/Node
// `VisitEachChild` signatures; the concrete shape lands with that wave.
export interface NodeVisitor {
  readonly __nodeVisitorBrand?: never;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::type::NodeDefault","kind":"type","status":"implemented","sigHash":"98473325b5fb802ab1d83d800388f663291e457c1b9fb2fd0ef00e4092d4e71b","bodyHash":"d2c96dffc07b3667b5e93b90d403b6775b068015ee38e964384c74f8e7ff948e"}
 *
 * Go source:
 * NodeDefault struct {
 * 	Node
 * }
 */
export interface NodeDefault extends Node {
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::type::NodeBase","kind":"type","status":"implemented","sigHash":"fd0a1f2632da19f7e695534a077c4fd53616e79189f0fff8c044120d40b44ab2","bodyHash":"435e1110e9632116114ecc9aea6efa583d93407ecb6b824bf50134493352ce9f"}
 *
 * Go source:
 * NodeBase struct {
 * 	NodeDefault
 * }
 */
export interface NodeBase extends NodeDefault {
}

// ──────────────────────────────────────────────────────────────────────
// NodeFactory machinery (hand-written ast.go; operates on the GENERATED
// NodeFactory type via the type-only import above — generated→spine stays
// one-way at runtime).
// ──────────────────────────────────────────────────────────────────────

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::func::NewNodeFactory","kind":"func","status":"implemented","sigHash":"a574e7931e3c16c0f4d6fcca23971edba57c6fecaa7ea6b14e059f74ae061887","bodyHash":"0e7b236978bb314df0edcda5dbe7d849fc75c825cba38dedff63eaa04cf0fce0"}
 *
 * Go source:
 * func NewNodeFactory(hooks NodeFactoryHooks) *NodeFactory {
 * 	return &NodeFactory{hooks: hooks}
 * }
 */
export function NewNodeFactory(hooks: NodeFactoryHooks): GoPtr<NodeFactory> {
  return newNodeFactory(hooks);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::func::newNode","kind":"func","status":"implemented","sigHash":"bb953c30d0e9ac76f1e848d9d8cabe31f29a9b6949a596a03731e116758eace4","bodyHash":"bae5dcb6116c6bb4d2375fb334bb8f72bd3b110cc77f4b912ea0d3a52af69812"}
 *
 * Go source:
 * func newNode(kind Kind, data nodeData, hooks NodeFactoryHooks) *Node {
 * 	n := data.AsNode()
 * 	n.Loc = core.UndefinedTextRange()
 * 	n.Kind = kind
 * 	n.data = data
 * 	if hooks.OnCreate != nil {
 * 		hooks.OnCreate(n)
 * 	}
 * 	return n
 * }
 */
export function newNode(kind: Kind, data: nodeData, hooks: NodeFactoryHooks): GoPtr<Node> {
  const n = data.AsNode();
  n!.Loc = UndefinedTextRange();
  n!.Kind = kind;
  n!.data = data;
  if (hooks?.OnCreate !== undefined) {
    hooks.OnCreate(n);
  }
  return n;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::NodeFactory.newNode","kind":"method","status":"implemented","sigHash":"a12c4bbcd7f546cc63012d5ed723fc8695a45bf80f3cddb0c537c6759a9019c6","bodyHash":"49fa3a81c60da08d027c022144338af72ef288b21e17eea139869273a3a524fd"}
 *
 * Go source:
 * func (f *NodeFactory) newNode(kind Kind, data nodeData) *Node {
 * 	f.nodeCount++
 * 	return newNode(kind, data, f.hooks)
 * }
 */
export function NodeFactory_newNode(receiver: GoPtr<NodeFactory>, kind: Kind, data: nodeData): GoPtr<Node> {
  receiver!.nodeCount = (receiver!.nodeCount + 1) as int;
  return newNode(kind, data, receiver!.hooks);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::NodeFactory.NodeCount","kind":"method","status":"implemented","sigHash":"09f6230917099244a5315a0ec518387285d6039155be0fdad7f83c9c1c9c1c25","bodyHash":"c4e9ddd13757456ca1e15a722bd463400ffbd529167ccfa0d0d4ef10fdbaf6a9"}
 *
 * Go source:
 * func (f *NodeFactory) NodeCount() int {
 * 	return f.nodeCount
 * }
 */
export function NodeFactory_NodeCount(receiver: GoPtr<NodeFactory>): int {
  return receiver!.nodeCount;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::NodeFactory.TextCount","kind":"method","status":"implemented","sigHash":"80dda026eecd64edb5d57292f116acaca281f3e6a5462aa05cbadc1157d328d0","bodyHash":"d065b3f5214edc285e73c802309dedd5304a0c80436c0ad0a9d4ac67943ae494"}
 *
 * Go source:
 * func (f *NodeFactory) TextCount() int {
 * 	return f.textCount
 * }
 */
export function NodeFactory_TextCount(receiver: GoPtr<NodeFactory>): int {
  return receiver!.textCount;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::NodeFactory.AsNodeFactory","kind":"method","status":"implemented","sigHash":"f77989c483bec29486f18911309423a902e91dfbcb54291154df08a836101148","bodyHash":"414bc86cf8bee3a7611fa2327b358b032f9da0f3e08bc90bdfa0a5c146d326c9"}
 *
 * Go source:
 * func (f *NodeFactory) AsNodeFactory() *NodeFactory {
 * 	return f
 * }
 */
export function NodeFactory_AsNodeFactory(receiver: GoPtr<NodeFactory>): GoPtr<NodeFactory> {
  return receiver;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::func::updateNode","kind":"func","status":"implemented","sigHash":"11b94a7bead962fc9cf15a8f0276c63653306d31a0ede184d0d0473efb530397","bodyHash":"8c6b13bc9e233b9a29f9be686d8eb54a900556d8fa12cacc20caf1bdb4f85cf2"}
 *
 * Go source:
 * func updateNode(updated *Node, original *Node, hooks NodeFactoryHooks) *Node {
 * 	if updated != original {
 * 		updated.Flags = original.Flags
 * 		updated.Loc = original.Loc
 * 		if hooks.OnUpdate != nil {
 * 			hooks.OnUpdate(updated, original)
 * 		}
 * 	}
 * 	return updated
 * }
 */
export function updateNode(updated: GoPtr<Node>, original: GoPtr<Node>, hooks: NodeFactoryHooks): GoPtr<Node> {
  if (updated !== original) {
    updated!.Flags = original!.Flags;
    updated!.Loc = original!.Loc;
    if (hooks.OnUpdate !== undefined) {
      hooks.OnUpdate(updated, original);
    }
  }
  return updated;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::func::cloneNode","kind":"func","status":"implemented","sigHash":"6c5934fb9bdf1041aa42998ad7868e1fc063f6fe4b5c4f43bc003f0bdf25a22b","bodyHash":"4b6cee1dab9792510ed8accc612e5eb3db2586508fb1d0056c9849df389a881c"}
 *
 * Go source:
 * func cloneNode(updated *Node, original *Node, hooks NodeFactoryHooks) *Node {
 * 	updateNode(updated, original, hooks)
 * 	if updated != original && hooks.OnClone != nil {
 * 		hooks.OnClone(updated, original)
 * 	}
 * 	return updated
 * }
 */
export function cloneNode(updated: GoPtr<Node>, original: GoPtr<Node>, hooks: NodeFactoryHooks): GoPtr<Node> {
  updateNode(updated, original, hooks);
  if (updated !== original && hooks.OnClone !== undefined) {
    hooks.OnClone(updated, original);
  }
  return updated;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::NodeFactory.NewNodeList","kind":"method","status":"implemented","sigHash":"d0973f83680713f78dca1b1c637fb79cc9fa2d0486fd9579a615e64cc544ebf1","bodyHash":"31ca54a4fade1d75d92151e390530cbaec44d667148f860c02e16fd99566b042"}
 *
 * Go source:
 * func (f *NodeFactory) NewNodeList(nodes []*Node) *NodeList {
 * 	list := f.nodeListArena.New()
 * 	list.Loc = core.UndefinedTextRange()
 * 	list.Nodes = nodes
 * 	return list
 * }
 */
export function NodeFactory_NewNodeList(receiver: GoPtr<NodeFactory>, nodes: GoSlice<GoPtr<Node>>): GoPtr<NodeList> {
  const list: NodeList = { Loc: UndefinedTextRange(), Nodes: nodes ?? [] };
  return list;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::NodeList.Pos","kind":"method","status":"implemented","sigHash":"3fb40614b01738828aafc0d21834f00260d000a62579f92f3cf80cdcfad40e6d","bodyHash":"5b9f18ed977f5d03f7cdcd5cb5a4acf6226e00e7a19e7993ceeb0e5aa6449447"}
 *
 * Go source:
 * func (list *NodeList) Pos() int { return list.Loc.Pos() }
 */
export function NodeList_Pos(receiver: GoPtr<NodeList>): int {
  return TextRange_Pos(receiver!.Loc);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::NodeList.End","kind":"method","status":"implemented","sigHash":"83a90a061f068cbbf1c11a9b7e93cd61b8d6ec1986583f308b8a6a2f409d88e2","bodyHash":"75d404fea5f99f59037651d9eeeae4dc457c9c880565c5a6ad68d9c95e9f7a87"}
 *
 * Go source:
 * func (list *NodeList) End() int { return list.Loc.End() }
 */
export function NodeList_End(receiver: GoPtr<NodeList>): int {
  return TextRange_End(receiver!.Loc);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::NodeList.HasTrailingComma","kind":"method","status":"implemented","sigHash":"45758dabb9fd2a393df1d90d86e750fa7fccd83eb1d5d6b1cb5f0c7856b77554","bodyHash":"9410e874882432e8cf5218a8ee89dfa9b18e09d7c6817fe058bb0002fead1a90"}
 *
 * Go source:
 * func (list *NodeList) HasTrailingComma() bool {
 * 	if len(list.Nodes) == 0 {
 * 		return false
 * 	}
 * 	last := list.Nodes[len(list.Nodes)-1]
 * 	return last.End() < list.End()
 * }
 */
export function NodeList_HasTrailingComma(receiver: GoPtr<NodeList>): bool {
  if (receiver!.Nodes.length === 0) {
    return false as bool;
  }
  const last = receiver!.Nodes[receiver!.Nodes.length - 1];
  return (Node_End(last) < NodeList_End(receiver)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::NodeList.Clone","kind":"method","status":"implemented","sigHash":"cea278469658cabf3722aa3d035bb39e0d1e005eb2804b5eda8f9f6200cff653","bodyHash":"e647d3732cef4db7f75cd0006949412820ce9b437138417915961c57f54c1bf6"}
 *
 * Go source:
 * func (list *NodeList) Clone(f NodeFactoryCoercible) *NodeList {
 * 	result := f.AsNodeFactory().NewNodeList(list.Nodes)
 * 	result.Loc = list.Loc
 * 	return result
 * }
 */
export function NodeList_Clone(receiver: GoPtr<NodeList>, f: NodeFactoryCoercible): GoPtr<NodeList> {
  const result = NodeFactory_NewNodeList(f.AsNodeFactory(), receiver!.Nodes);
  result!.Loc = receiver!.Loc;
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::NodeFactory.NewModifierList","kind":"method","status":"implemented","sigHash":"2d151b40697b4ad4ee8d4d6aa2fb4370d9bfc1194eec409f292a4cda504cd6ec","bodyHash":"ec390041b92643092dd07c81af7e531c0edee4d4090dcc230e48a084e1fa7a11"}
 *
 * Go source:
 * func (f *NodeFactory) NewModifierList(nodes []*Node) *ModifierList {
 * 	list := f.modifierListArena.New()
 * 	list.Loc = core.UndefinedTextRange()
 * 	list.Nodes = nodes
 * 	list.ModifierFlags = ModifiersToFlags(nodes)
 * 	return list
 * }
 */
export function NodeFactory_NewModifierList(receiver: GoPtr<NodeFactory>, nodes: GoSlice<GoPtr<Node>>): GoPtr<ModifierList> {
  const list: ModifierList = { Loc: UndefinedTextRange(), Nodes: nodes, ModifierFlags: ModifiersToFlags(nodes) };
  return list;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::ModifierList.Clone","kind":"method","status":"implemented","sigHash":"df17562593e25c118ac2fef409aae013a3f395a08cf242cebf0642ca6a5e1b0a","bodyHash":"ccaa142ebbc3425f6eae8f6188d0f56303a5a05df7385aabb79e93de0d4f37a5"}
 *
 * Go source:
 * func (list *ModifierList) Clone(f *NodeFactory) *ModifierList {
 * 	res := f.modifierListArena.New()
 * 	res.Loc = list.Loc
 * 	res.Nodes = list.Nodes
 * 	res.ModifierFlags = list.ModifierFlags
 * 	return res
 * }
 */
export function ModifierList_Clone(receiver: GoPtr<ModifierList>, f: GoPtr<NodeFactory>): GoPtr<ModifierList> {
  const res: ModifierList = { Loc: receiver!.Loc, Nodes: receiver!.Nodes, ModifierFlags: receiver!.ModifierFlags };
  return res;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::func::invert","kind":"func","status":"implemented","sigHash":"f02064413d8da117e4423d366cdf5da0935a1b9b40b1743cf69630efd2b3414f","bodyHash":"c263539bd7a98261d0096bb89756f8f8eb15c2abfa4c1cff80821a5432e341bd"}
 *
 * Go source:
 * func invert(yield func(v *Node) bool) Visitor {
 * 	return func(n *Node) bool {
 * 		return !yield(n)
 * 	}
 * }
 */
export function invert(yield_: (v: GoPtr<Node>) => bool): Visitor {
  return (n: GoPtr<Node>): bool => {
    return (!yield_(n)) as bool;
  };
}

// `NewNodeFactory` allocates a fresh generated NodeFactory. The arena fields are
// lazily-initialized (single-threaded model), so a zero-valued factory is just
// the hooks plus zero counters.
function newNodeFactory(hooks: NodeFactoryHooks): GoPtr<NodeFactory> {
  const factory: NodeFactory = {
    hooks: hooks,
    nodeCount: 0 as int,
    textCount: 0 as int,
    AsNodeFactory: () => factory,
  };
  return factory;
}

// ──────────────────────────────────────────────────────────────────────
// NodeDefault — default nodeData method implementations (ast.go).
// In the runtime model the concrete node object IS the Node, so each receiver
// is Node-compatible (NodeDefault extends Node).
// ──────────────────────────────────────────────────────────────────────

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::NodeDefault.AsNode","kind":"method","status":"implemented","sigHash":"80ab0aa2d303a7931b4a9d9ecee873288e0b2846754e1c349ebab2f746ca7477","bodyHash":"f3623354642211db1b3d5c5d362b9333013dbe02df2004d7604b9b4cb760fa93"}
 *
 * Go source:
 * func (node *NodeDefault) AsNode() *Node               { return &node.Node }
 */
export function NodeDefault_AsNode(receiver: GoPtr<NodeDefault>): GoPtr<Node> {
  return receiver;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::NodeDefault.ForEachChild","kind":"method","status":"implemented","sigHash":"012ba3b3a7e5580a4e05f97fdd81cce31b431173e5fcbf964625848732eff257","bodyHash":"f4a6d823584f78c7991a635817d1bdbca6f63ac008b2173051a40cf5a46f8a33"}
 *
 * Go source:
 * func (node *NodeDefault) ForEachChild(v Visitor) bool { return false }
 */
export function NodeDefault_ForEachChild(receiver: GoPtr<NodeDefault>, v: Visitor): bool {
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::NodeDefault.forEachChildIter","kind":"method","status":"implemented","sigHash":"d3ba6855120ecdbbeb21d896c2e37ca92c9b0e9e1e59517a039ed51d00793fac","bodyHash":"2a86409cebcf57f9ed0e9405f0b7437cf640059e0c57aaae4940e259853bead4"}
 *
 * Go source:
 * func (node *NodeDefault) forEachChildIter(yield func(v *Node) bool) {
 * 	node.data.ForEachChild(invert(yield)) // `true` is return early for a ts visitor, `false` is return early for a go iterator yield function
 * }
 */
export function NodeDefault_forEachChildIter(receiver: GoPtr<NodeDefault>, yield_: (v: GoPtr<Node>) => bool): void {
  receiver!.data.ForEachChild(invert(yield_));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::NodeDefault.IterChildren","kind":"method","status":"implemented","sigHash":"2449a405e7364a9b682de3d9ebd8a5b5f7d91164495f95d67f9c55f78a087b44","bodyHash":"353a70ea2b94819855540f33723d38ea4656fffac0d7cbb39becfd85e523f0dc"}
 *
 * Go source:
 * func (node *NodeDefault) IterChildren() iter.Seq[*Node] {
 * 	return node.forEachChildIter
 * }
 */
export function NodeDefault_IterChildren(receiver: GoPtr<NodeDefault>): GoSeq<GoPtr<Node>> {
  return (yield_: (v: GoPtr<Node>) => bool): void => NodeDefault_forEachChildIter(receiver, yield_);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::NodeDefault.VisitEachChild","kind":"method","status":"implemented","sigHash":"4f6dd35d003d719a0379ebc943d88abf0324bbb43b3d737419aa0812c16cdb1e","bodyHash":"2a455d0a2af64fef550055d4a1e368c7b85c38c119d10b1e34efb70face57561"}
 *
 * Go source:
 * func (node *NodeDefault) VisitEachChild(v *NodeVisitor) *Node                   { return node.AsNode() }
 */
export function NodeDefault_VisitEachChild(receiver: GoPtr<NodeDefault>, v: GoPtr<NodeVisitor>): GoPtr<Node> {
  return NodeDefault_AsNode(receiver);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::NodeDefault.Clone","kind":"method","status":"implemented","sigHash":"42731d7d15f379433990b7da5138fb16e661e947c137b1f7af7459f7fc924624","bodyHash":"4641e2fdc7a981972eeb3fec33ba7550c812bc336e35916b6a64d53fbd18e808"}
 *
 * Go source:
 * func (node *NodeDefault) Clone(v NodeFactoryCoercible) *Node                    { return nil }
 */
export function NodeDefault_Clone(receiver: GoPtr<NodeDefault>, v: NodeFactoryCoercible): GoPtr<Node> {
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::NodeDefault.Name","kind":"method","status":"implemented","sigHash":"6a9851708a3b530b694b8660f40bd1370fa2bc37772816cb19b973f49e181ffa","bodyHash":"b001453f894e0e5817f92e69c238b7a068ec2862587a2c00a9e5c82a7592ca8b"}
 *
 * Go source:
 * func (node *NodeDefault) Name() *DeclarationName                                { return nil }
 */
export function NodeDefault_Name(receiver: GoPtr<NodeDefault>): GoPtr<DeclarationName> {
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::NodeDefault.Modifiers","kind":"method","status":"implemented","sigHash":"b8ec5f018436dc5760016b8be2e6758cbded6fd7a1f301a71a58e6c4abf0630f","bodyHash":"b0df9e511bf43ee669774f8b56a2de158c21fb5ccb8a594f575ec01b7237146d"}
 *
 * Go source:
 * func (node *NodeDefault) Modifiers() *ModifierList                              { return nil }
 */
export function NodeDefault_Modifiers(receiver: GoPtr<NodeDefault>): GoPtr<ModifierList> {
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::NodeDefault.setModifiers","kind":"method","status":"implemented","sigHash":"d24feff91f6b67ada900efa974285001bfa44ac89259e6cb3dd44708dc4c2770","bodyHash":"e8a09212df67b3307fe756f43f28410b511e59f29389e24b579e0aaa9a762140"}
 *
 * Go source:
 * func (node *NodeDefault) setModifiers(modifiers *ModifierList)                  {}
 */
export function NodeDefault_setModifiers(receiver: GoPtr<NodeDefault>, modifiers: GoPtr<ModifierList>): void {
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::NodeDefault.FlowNodeData","kind":"method","status":"implemented","sigHash":"c2665463a0eb6d8e080848873dec2f13da0bb6b40ad914bc9bcc7bb81a513565","bodyHash":"d6984d76f90bea0831d034663d91f6609ebf0fa513227db2e770257787c03393"}
 *
 * Go source:
 * func (node *NodeDefault) FlowNodeData() *FlowNodeBase                           { return nil }
 */
export function NodeDefault_FlowNodeData(receiver: GoPtr<NodeDefault>): GoPtr<FlowNodeBaseType> {
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::NodeDefault.DeclarationData","kind":"method","status":"implemented","sigHash":"2cdaa4ceb65c79542e968de2921686c04807c214a79757ad57521900c3332a94","bodyHash":"40aeb8de7f983d782662de394b1281fab9387f9b53c933489c75aa3140528d14"}
 *
 * Go source:
 * func (node *NodeDefault) DeclarationData() *DeclarationBase                     { return nil }
 */
export function NodeDefault_DeclarationData(receiver: GoPtr<NodeDefault>): GoPtr<DeclarationBaseType> {
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::NodeDefault.ExportableData","kind":"method","status":"implemented","sigHash":"99e44846cfc1dfd3f5683937ed88b5a7864611aa6841c25c0dac97c8355a6bde","bodyHash":"ca19989d53f8839af4462d861969da7608934c2f8ba099bc8212f514f69dd0c8"}
 *
 * Go source:
 * func (node *NodeDefault) ExportableData() *ExportableBase                       { return nil }
 */
export function NodeDefault_ExportableData(receiver: GoPtr<NodeDefault>): GoPtr<ExportableBaseType> {
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::NodeDefault.LocalsContainerData","kind":"method","status":"implemented","sigHash":"407cad252425a769fc69a921ee58dbaaf35644299c97d7494e099bb3379c8b65","bodyHash":"fcec5767c47d79cf7b423173428951ec90e05d2dde6bc696cf7ed652af397988"}
 *
 * Go source:
 * func (node *NodeDefault) LocalsContainerData() *LocalsContainerBase             { return nil }
 */
export function NodeDefault_LocalsContainerData(receiver: GoPtr<NodeDefault>): GoPtr<LocalsContainerBaseType> {
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::NodeDefault.FunctionLikeData","kind":"method","status":"implemented","sigHash":"9eb88705f77b44da0baac23058cfb35fd6a41fbfbb5318bff1f8962b7448d438","bodyHash":"ff0151842d9875146ced33a4d3fc9d71ac9c12dbca7dc86684b57de6a918a386"}
 *
 * Go source:
 * func (node *NodeDefault) FunctionLikeData() *FunctionLikeBase                   { return nil }
 */
export function NodeDefault_FunctionLikeData(receiver: GoPtr<NodeDefault>): GoPtr<FunctionLikeBaseType> {
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::NodeDefault.ClassLikeData","kind":"method","status":"implemented","sigHash":"ae904f424d9fac9dab8aa996a7d6ccf32ed84209245f5157cd6b4b8f71273991","bodyHash":"2732e690803112de0b631de7956dd71c93a2018adb3883c72c0f81b6035fc363"}
 *
 * Go source:
 * func (node *NodeDefault) ClassLikeData() *ClassLikeBase                         { return nil }
 */
export function NodeDefault_ClassLikeData(receiver: GoPtr<NodeDefault>): GoPtr<ClassLikeBaseType> {
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::NodeDefault.BodyData","kind":"method","status":"implemented","sigHash":"dc277d2690c10d6744a6935fa3bb57c2f2b3efb34eb2bef4f3d696996e12c4d2","bodyHash":"c18608af6e37b94578d5c3775a38398c2ae21024f0beea7ae6abd78d780b99fc"}
 *
 * Go source:
 * func (node *NodeDefault) BodyData() *BodyBase                                   { return nil }
 */
export function NodeDefault_BodyData(receiver: GoPtr<NodeDefault>): GoPtr<BodyBaseType> {
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::NodeDefault.LiteralLikeData","kind":"method","status":"implemented","sigHash":"4631a8ddf3f2b52a58e02b9d6e628fa4b5d3520991c7789bc2c38fcec7ab4264","bodyHash":"5f78735974262144bd815ce3dbebf56355d92abb20b2aaa9ba51a2b79615041a"}
 *
 * Go source:
 * func (node *NodeDefault) LiteralLikeData() *LiteralLikeNodeBase                 { return nil }
 */
export function NodeDefault_LiteralLikeData(receiver: GoPtr<NodeDefault>): GoPtr<LiteralLikeNodeBaseType> {
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::NodeDefault.TemplateLiteralLikeData","kind":"method","status":"implemented","sigHash":"fe7da5647342d60d893106639915031b0afa8286c76f96f9db6288bd83932a2f","bodyHash":"36b9078ef38a464fe909459a1cd8ff04d1086f0a2c40ba8ca7064cb027d5ba3d"}
 *
 * Go source:
 * func (node *NodeDefault) TemplateLiteralLikeData() *TemplateLiteralLikeNodeBase { return nil }
 */
export function NodeDefault_TemplateLiteralLikeData(receiver: GoPtr<NodeDefault>): GoPtr<TemplateLiteralLikeNodeBaseType> {
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::NodeDefault.SubtreeFacts","kind":"method","status":"implemented","sigHash":"28f0ebb0a2a6f7a96deceb41a0386a764fdf507b042304897d109957ac8ef290","bodyHash":"d371c114cf83721d040d7c3c06c30a020cdbfce48d39b1fb9cbcf426174049a9"}
 *
 * Go source:
 * func (node *NodeDefault) SubtreeFacts() SubtreeFacts {
 * 	return node.data.subtreeFactsWorker(node.data)
 * }
 */
export function NodeDefault_SubtreeFacts(receiver: GoPtr<NodeDefault>): SubtreeFacts {
  return receiver!.data.subtreeFactsWorker(receiver!.data);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::NodeDefault.subtreeFactsWorker","kind":"method","status":"implemented","sigHash":"2bd3c1d8d4e2a64fec433b1ce185fc2ea88febe74a5eca423abeb4feb6619e82","bodyHash":"34c24fe04beae6bdd3456fddb3bb0ac2e1a7fe86b2a57bb0257c275a5c0e21e1"}
 *
 * Go source:
 * func (node *NodeDefault) subtreeFactsWorker(self nodeData) SubtreeFacts {
 * 	return self.computeSubtreeFacts()
 * }
 */
export function NodeDefault_subtreeFactsWorker(receiver: GoPtr<NodeDefault>, self: nodeData): SubtreeFacts {
  return self.computeSubtreeFacts();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::NodeDefault.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"62d6b993551cd594311da08e38a57e5787e80ee8164d76b804eadc29e548d47f","bodyHash":"133456b1cbce38f28f6fb8e428e09de177abcc547cacb097dcc45236ad59b784"}
 *
 * Go source:
 * func (node *NodeDefault) computeSubtreeFacts() SubtreeFacts {
 * 	return SubtreeFactsNone
 * }
 */
export function NodeDefault_computeSubtreeFacts(receiver: GoPtr<NodeDefault>): SubtreeFacts {
  return SubtreeFactsNone;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::NodeDefault.propagateSubtreeFacts","kind":"method","status":"implemented","sigHash":"688db67db45f3c2528dd50df60307e9e9eb406727549b458adb5e64734314baa","bodyHash":"f79e54952c424b2c0c622df5a3062fb361476885d819ee4c296c879e3c1076f0"}
 *
 * Go source:
 * func (node *NodeDefault) propagateSubtreeFacts() SubtreeFacts {
 * 	return node.data.SubtreeFacts() & ^SubtreeExclusionsNode
 * }
 */
export function NodeDefault_propagateSubtreeFacts(receiver: GoPtr<NodeDefault>): SubtreeFacts {
  return (receiver!.data.SubtreeFacts() & ~SubtreeExclusionsNode) >>> 0;
}

// ──────────────────────────────────────────────────────────────────────
// Core Node accessors (ast.go). The ~50 semantic accessors (Symbol/Body/Text/
// Expression/...) belong to the later ast.ts wave and are intentionally absent.
// ──────────────────────────────────────────────────────────────────────

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.AsNode","kind":"method","status":"implemented","sigHash":"bb2a2d1acc66243e4cb185b7362cb3044a68d70cb707e84defa2a9694652e1e6","bodyHash":"6f8d90c2ec961445caf9509686e116c08b5ead7a69002d5591c1fe9ab15520f9"}
 *
 * Go source:
 * func (n *Node) AsNode() *Node                             { return n }
 */
export function Node_AsNode(receiver: GoPtr<Node>): GoPtr<Node> {
  return receiver;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.Pos","kind":"method","status":"implemented","sigHash":"357e8e6b94b0417abc7e87471b45a6cc8b3e46b3517528e08a1b4e2737ff1eb9","bodyHash":"7f0caa654d950f2b27b9d056777552339efed56b7c69fba41f99064728bce91e"}
 *
 * Go source:
 * func (n *Node) Pos() int                                  { return n.Loc.Pos() }
 */
export function Node_Pos(receiver: GoPtr<Node>): int {
  return TextRange_Pos(receiver!.Loc);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.End","kind":"method","status":"implemented","sigHash":"dc818bcdb0f075ea7a14f6e2d636b69a3e218997ea45552bc394db60a173c0fc","bodyHash":"cd002a1394984f988c22014e4ae358299f742822d789e38086552dbe81b037a3"}
 *
 * Go source:
 * func (n *Node) End() int                                  { return n.Loc.End() }
 */
export function Node_End(receiver: GoPtr<Node>): int {
  return TextRange_End(receiver!.Loc);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.ForEachChild","kind":"method","status":"implemented","sigHash":"e0380b6739279a3e7d7824ff6d8dec38951ac238fc98f709b2b3195c9ea429a9","bodyHash":"a843b34ccfb1d08a5b316d8180e3f862cd797b782aba9e76e44e2ad655ae417b"}
 *
 * Go source:
 * func (n *Node) ForEachChild(v Visitor) bool               { return n.data.ForEachChild(v) }
 */
export function Node_ForEachChild(receiver: GoPtr<Node>, v: Visitor): bool {
  return receiver!.data.ForEachChild(v);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.IterChildren","kind":"method","status":"implemented","sigHash":"0e3b7aae25c5f7fea1728f18835accba2c6f980ecc7dce130d93337cf7abe3da","bodyHash":"3915149c89be6fd80a29d3c9441f5045b8ef99b8e16199f00da810d5cc3644d0"}
 *
 * Go source:
 * func (n *Node) IterChildren() iter.Seq[*Node]             { return n.data.IterChildren() }
 */
export function Node_IterChildren(receiver: GoPtr<Node>): GoSeq<GoPtr<Node>> {
  return receiver!.data.IterChildren();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.Clone","kind":"method","status":"implemented","sigHash":"17c2f0521ebad829a240504f081afa03aa70685d65eeb9fa175d8e7989ec2cc6","bodyHash":"758adf90b8344ac086dde48fddecc93767cdcf8a0c04d7080b5b064a0f9cec5c"}
 *
 * Go source:
 * func (n *Node) Clone(f NodeFactoryCoercible) *Node        { return n.data.Clone(f) }
 */
export function Node_Clone(receiver: GoPtr<Node>, f: NodeFactoryCoercible): GoPtr<Node> {
  return receiver!.data.Clone(f);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.VisitEachChild","kind":"method","status":"implemented","sigHash":"c6c243e893a175a25a807432fbcd5a7bb2f56e3eb451a3a1522580291821d22e","bodyHash":"44306e2afab38aa2a8b24679e1d516b5aad8d2b2ee9e2bc1e63aee2a699aff05"}
 *
 * Go source:
 * func (n *Node) VisitEachChild(v *NodeVisitor) *Node       { return n.data.VisitEachChild(v) }
 */
export function Node_VisitEachChild(receiver: GoPtr<Node>, v: GoPtr<NodeVisitor>): GoPtr<Node> {
  return receiver!.data.VisitEachChild(v);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.Name","kind":"method","status":"implemented","sigHash":"74166cba68ac0a22427737f17668dbef7746def75d94aed1ff4487ea7f054116","bodyHash":"ea28d91d6048415eccdd10893a9cb8521c2c5052ef11ed160f8d69c429fff25b"}
 *
 * Go source:
 * func (n *Node) Name() *DeclarationName                    { return n.data.Name() }
 */
export function Node_Name(receiver: GoPtr<Node>): GoPtr<DeclarationName> {
  return receiver!.data.Name();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.Modifiers","kind":"method","status":"implemented","sigHash":"d2e545f456bcc6dadc4ed6a8a11fe99753202b57f7a1d26783a31abaee9ceec1","bodyHash":"a59ad76113171cd82e248faeceb002183c618226d399d473c6b4fcecc957a0ac"}
 *
 * Go source:
 * func (n *Node) Modifiers() *ModifierList                  { return n.data.Modifiers() }
 */
export function Node_Modifiers(receiver: GoPtr<Node>): GoPtr<ModifierList> {
  return receiver!.data.Modifiers();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.FlowNodeData","kind":"method","status":"implemented","sigHash":"3b7da8de4eff6ab3f317337be9b4aae5a5093da57c0f81caa8bcdca599b319a9","bodyHash":"6f9db4f9beed0c0ac09ce40a414ce6051eae09206909c9bd0377619ffafbb5c1"}
 *
 * Go source:
 * func (n *Node) FlowNodeData() *FlowNodeBase               { return n.data.FlowNodeData() }
 */
export function Node_FlowNodeData(receiver: GoPtr<Node>): GoPtr<FlowNodeBaseType> {
  return receiver!.data.FlowNodeData();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.DeclarationData","kind":"method","status":"implemented","sigHash":"98d46c0c5122b06777f1e08bbc9d9025bfe4c2a189e680b4693411361856b6b1","bodyHash":"4b06facee2de346502019071365737f5a8da5d310c1c72ca1c7e3d47495c0bd8"}
 *
 * Go source:
 * func (n *Node) DeclarationData() *DeclarationBase         { return n.data.DeclarationData() }
 */
export function Node_DeclarationData(receiver: GoPtr<Node>): GoPtr<DeclarationBaseType> {
  return receiver!.data.DeclarationData();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.ExportableData","kind":"method","status":"implemented","sigHash":"7f81c9509de2734af6e7e1fba176ef8170592e9814993deca8a23bec364dfb85","bodyHash":"e6913d1c85f3a48209043bf4957f9118adde5bd10628499205a08ec8652bc9c1"}
 *
 * Go source:
 * func (n *Node) ExportableData() *ExportableBase           { return n.data.ExportableData() }
 */
export function Node_ExportableData(receiver: GoPtr<Node>): GoPtr<ExportableBaseType> {
  return receiver!.data.ExportableData();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.LocalsContainerData","kind":"method","status":"implemented","sigHash":"bcc74fed438d7de39171e5081f2e7d0959a075b67bd8b547bafdffe942dea430","bodyHash":"9a61ca5a2141477c572ed66dddc3a600b76b5b35f37cfac2d4e1ecea3adea279"}
 *
 * Go source:
 * func (n *Node) LocalsContainerData() *LocalsContainerBase { return n.data.LocalsContainerData() }
 */
export function Node_LocalsContainerData(receiver: GoPtr<Node>): GoPtr<LocalsContainerBaseType> {
  return receiver!.data.LocalsContainerData();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.FunctionLikeData","kind":"method","status":"implemented","sigHash":"22248863a1b8d25e36d0acca3bb33ec4490d69115851fede10b8df16bec5b68c","bodyHash":"b22e9262d674cb5b16fb5fa90fa66aee64d646d9739449f3d9ab60e84c7bdadc"}
 *
 * Go source:
 * func (n *Node) FunctionLikeData() *FunctionLikeBase       { return n.data.FunctionLikeData() }
 */
export function Node_FunctionLikeData(receiver: GoPtr<Node>): GoPtr<FunctionLikeBaseType> {
  return receiver!.data.FunctionLikeData();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.ClassLikeData","kind":"method","status":"implemented","sigHash":"b9f5fa2cd31192236124fcfd1023e004a5b50f30280e5c4b20bb38c5ce7c0002","bodyHash":"8dd7a8b8749833ed37da35057747769c32e9bc0b02ad055e1820252a42977d0a"}
 *
 * Go source:
 * func (n *Node) ClassLikeData() *ClassLikeBase             { return n.data.ClassLikeData() }
 */
export function Node_ClassLikeData(receiver: GoPtr<Node>): GoPtr<ClassLikeBaseType> {
  return receiver!.data.ClassLikeData();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.BodyData","kind":"method","status":"implemented","sigHash":"3de488f480357f749d4bd63df7179d4e23885259f4d31c70a7bae6a6d72b9c07","bodyHash":"49db35b42228fc081668098e2265ed9efbc1b9aa4762cb7c0d6bc877052c2af2"}
 *
 * Go source:
 * func (n *Node) BodyData() *BodyBase                       { return n.data.BodyData() }
 */
export function Node_BodyData(receiver: GoPtr<Node>): GoPtr<BodyBaseType> {
  return receiver!.data.BodyData();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.SubtreeFacts","kind":"method","status":"implemented","sigHash":"967d1e0d8a3ecf9906566f34fce23d17221de25123de6e9e60d9eb50c193ae29","bodyHash":"dd13f2a3479fddeb9ac2da4ef670226828c8141dc2d957ecce44134559862232"}
 *
 * Go source:
 * func (n *Node) SubtreeFacts() SubtreeFacts                { return n.data.SubtreeFacts() }
 */
export function Node_SubtreeFacts(receiver: GoPtr<Node>): SubtreeFacts {
  return receiver!.data.SubtreeFacts();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.propagateSubtreeFacts","kind":"method","status":"implemented","sigHash":"a5d4815c672538d7d044b8d829785b2c171eb431f27597a7d9b65792f10d15f8","bodyHash":"b6a82fdd0ef5df5beed85ac10818c5577621e3ec5563aaeec7fcdeeeb2f5894a"}
 *
 * Go source:
 * func (n *Node) propagateSubtreeFacts() SubtreeFacts       { return n.data.propagateSubtreeFacts() }
 */
export function Node_propagateSubtreeFacts(receiver: GoPtr<Node>): SubtreeFacts {
  return receiver!.data.propagateSubtreeFacts();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.LiteralLikeData","kind":"method","status":"implemented","sigHash":"f03f4cc999b77c0feedf3ba9a8cf93d1ee46ad026dec171437f087d9c9a34fc3","bodyHash":"729300af37e88738476483f63a9e4ba217365fdc111b834ebdfd31329fd07ae4"}
 *
 * Go source:
 * func (n *Node) LiteralLikeData() *LiteralLikeNodeBase     { return n.data.LiteralLikeData() }
 */
export function Node_LiteralLikeData(receiver: GoPtr<Node>): GoPtr<LiteralLikeNodeBaseType> {
  return receiver!.data.LiteralLikeData();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.TemplateLiteralLikeData","kind":"method","status":"implemented","sigHash":"c25bfabe0979e7f24a385678d91cde2bb36e0810bc5c67634b23124dca356917","bodyHash":"3e0f98083561652661fb2020121f55aa3aaa889c5f6ae6f5f2c54187984a4d23"}
 *
 * Go source:
 * func (n *Node) TemplateLiteralLikeData() *TemplateLiteralLikeNodeBase {
 * 	return n.data.TemplateLiteralLikeData()
 * }
 */
export function Node_TemplateLiteralLikeData(receiver: GoPtr<Node>): GoPtr<TemplateLiteralLikeNodeBaseType> {
  return receiver!.data.TemplateLiteralLikeData();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.KindString","kind":"method","status":"implemented","sigHash":"ea91f1acdd78e2d21ee4c308d043a1470ec3bff20beb920f8c2e1ff45592b747","bodyHash":"a2daf50217255f7e002c16419feee9e1ac1b4e2f34c2fdda14971cc8ec30f4fe"}
 *
 * Go source:
 * func (n *Node) KindString() string { return n.Kind.String() }
 */
export function Node_KindString(receiver: GoPtr<Node>): string {
  return Kind_String(receiver!.Kind);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::Node.KindValue","kind":"method","status":"implemented","sigHash":"079c320fd5e1186a1e4838627aec1e15867f6ee81272749747e13c655da6444a","bodyHash":"acf598b87f88e695a3fce2decd85afe095bab2284ce7480dedbc084868c515e7"}
 *
 * Go source:
 * func (n *Node) KindValue() int16   { return int16(n.Kind) }
 */
export function Node_KindValue(receiver: GoPtr<Node>): short {
  return receiver!.Kind as short;
}

// ──────────────────────────────────────────────────────────────────────
// Base data-view methods (ast.go). Go method promotion lets a concrete node
// that embeds one of these bases resolve the corresponding nodeData method to
// the base's implementation (e.g. an Identifier embedding FlowNodeBase resolves
// FlowNodeData() here, not to NodeDefault). The generated adapters call these
// for the most-derived embedding base that provides the method.
// In the runtime model the node object IS each embedded base view, so each of
// these returns the receiver (or a receiver field) — Go's `&node.XxxBase`.
// ──────────────────────────────────────────────────────────────────────

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::DeclarationBase.DeclarationData","kind":"method","status":"implemented","sigHash":"9abdd02b76b83e230aafe4a1ad4e8e377b1214080acb7edd9a37d11d74654672","bodyHash":"2aa4e0991f5eeca9f800d97d2cbc3d23b797ee69377281474feee9d511a9e3ec"}
 *
 * Go source:
 * func (node *DeclarationBase) DeclarationData() *DeclarationBase { return node }
 */
export function DeclarationBase_DeclarationData(receiver: GoPtr<DeclarationBaseType>): GoPtr<DeclarationBaseType> {
  return receiver;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::ExportableBase.ExportableData","kind":"method","status":"implemented","sigHash":"f28cda5f067b1de2b3b097c8fef7f195bbecbd2fbd5f89e700edb2dabb9c4870","bodyHash":"480f7c7c0f42f4a73f55e6e6e899c0b9ecf4fb5e2e7a15801b7a939e9da0b05e"}
 *
 * Go source:
 * func (node *ExportableBase) ExportableData() *ExportableBase { return node }
 */
export function ExportableBase_ExportableData(receiver: GoPtr<ExportableBaseType>): GoPtr<ExportableBaseType> {
  return receiver;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::ModifiersBase.Modifiers","kind":"method","status":"implemented","sigHash":"adbe8074215f04f93013c578ed428d50414d2db510a8afff9c53504ed9bb242e","bodyHash":"ea1a9598725a01c91e66b03ca85c13675470aed5dfa6e10e236a7c300c1551cb"}
 *
 * Go source:
 * func (node *ModifiersBase) Modifiers() *ModifierList { return node.modifiers }
 */
export function ModifiersBase_Modifiers(receiver: GoPtr<ModifiersBaseType>): GoPtr<ModifierList> {
  return receiver!.modifiers;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::ModifiersBase.setModifiers","kind":"method","status":"implemented","sigHash":"70e84486508af2e059d5bc386a14f604fb32d6f38b697a857ca5b7a9ab3ae972","bodyHash":"84715edbf84f1652412c65498516cb39af8fcde4f09c49c4a3f03899a4f78cc6"}
 *
 * Go source:
 * func (node *ModifiersBase) setModifiers(modifiers *ModifierList) { node.modifiers = modifiers }
 */
export function ModifiersBase_setModifiers(receiver: GoPtr<ModifiersBaseType>, modifiers: GoPtr<ModifierList>): void {
  receiver!.modifiers = modifiers;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::LocalsContainerBase.LocalsContainerData","kind":"method","status":"implemented","sigHash":"13c121f80a7e981226a492d2f099e636c21bbe27c5e77fdec23aa6e0ccdf4903","bodyHash":"eec7743534a2fc315a54ce5ac26e1684193787c0e2bc86872ff86af0c16208b4"}
 *
 * Go source:
 * func (node *LocalsContainerBase) LocalsContainerData() *LocalsContainerBase { return node }
 */
export function LocalsContainerBase_LocalsContainerData(receiver: GoPtr<LocalsContainerBaseType>): GoPtr<LocalsContainerBaseType> {
  return receiver;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::FunctionLikeBase.LocalsContainerData","kind":"method","status":"implemented","sigHash":"68efd39bb704cd809a387337b78e9b29990043e100a30209594222bd81197246","bodyHash":"de9ce23915eac7bdb5f04595d5660cf8793e2b1e4f4c82f6cf9873bb327c6322"}
 *
 * Go source:
 * func (node *FunctionLikeBase) LocalsContainerData() *LocalsContainerBase {
 * 	return &node.LocalsContainerBase
 * }
 */
export function FunctionLikeBase_LocalsContainerData(receiver: GoPtr<FunctionLikeBaseType>): GoPtr<LocalsContainerBaseType> {
  return receiver;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::FunctionLikeBase.FunctionLikeData","kind":"method","status":"implemented","sigHash":"37c566db6fdc7f0f5d72117558ab34048e58d30a08a57da3d8ef116a88bddf24","bodyHash":"49dc25a88d0387bf963900d61ab8a89fe6d15965b8cc18c84bde8b4f70010655"}
 *
 * Go source:
 * func (node *FunctionLikeBase) FunctionLikeData() *FunctionLikeBase { return node }
 */
export function FunctionLikeBase_FunctionLikeData(receiver: GoPtr<FunctionLikeBaseType>): GoPtr<FunctionLikeBaseType> {
  return receiver;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::BodyBase.BodyData","kind":"method","status":"implemented","sigHash":"917e5f901c8ba27f4ab3f7eeb4f5e139527b908562fc3e7f59e4845dd4cc87f0","bodyHash":"1433181fc63ef1fe65c7c091f80f0f6143efeb5a30d10b69cd1e75229ac2dc34"}
 *
 * Go source:
 * func (node *BodyBase) BodyData() *BodyBase { return node }
 */
export function BodyBase_BodyData(receiver: GoPtr<BodyBaseType>): GoPtr<BodyBaseType> {
  return receiver;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::FunctionLikeWithBodyBase.LocalsContainerData","kind":"method","status":"implemented","sigHash":"0f6d2da452a656bde86ddbc9c575814b11996b721425065bcd5e978011349f11","bodyHash":"c7da10dbcef19c4e3643831751cda9ce6240fc5df8a8f8077f940b545f153402"}
 *
 * Go source:
 * func (node *FunctionLikeWithBodyBase) LocalsContainerData() *LocalsContainerBase {
 * 	return &node.LocalsContainerBase
 * }
 */
export function FunctionLikeWithBodyBase_LocalsContainerData(receiver: GoPtr<FunctionLikeWithBodyBaseType>): GoPtr<LocalsContainerBaseType> {
  return receiver;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::FunctionLikeWithBodyBase.FunctionLikeData","kind":"method","status":"implemented","sigHash":"b15e4d04fa7ec82f624557bafa519b72c78ec032d9949ac31f0143fd9a7349a4","bodyHash":"0d8cc720a14aff4098c147a583c224856c0b9eb59867815790cede94f1b0995e"}
 *
 * Go source:
 * func (node *FunctionLikeWithBodyBase) FunctionLikeData() *FunctionLikeBase {
 * 	return &node.FunctionLikeBase
 * }
 */
export function FunctionLikeWithBodyBase_FunctionLikeData(receiver: GoPtr<FunctionLikeWithBodyBaseType>): GoPtr<FunctionLikeBaseType> {
  return receiver;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::FunctionLikeWithBodyBase.BodyData","kind":"method","status":"implemented","sigHash":"c3aae0480f4d8f1fa88205c29ff584be18ef326bcebe8f4f831e3cdf9d9b0c51","bodyHash":"fb46e78ad4cd326dcf822074a2633e6309f0cb221227c9692d3b85eb61795274"}
 *
 * Go source:
 * func (node *FunctionLikeWithBodyBase) BodyData() *BodyBase { return &node.BodyBase }
 */
export function FunctionLikeWithBodyBase_BodyData(receiver: GoPtr<FunctionLikeWithBodyBaseType>): GoPtr<BodyBaseType> {
  return receiver;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::FlowNodeBase.FlowNodeData","kind":"method","status":"implemented","sigHash":"1c00be7803f50e873f9e86a81e791443aa24e979be742e3313ab6377d86e16d1","bodyHash":"db5879772943e77cb29d64f9d11b761f5d17a4097a952365fe3d70c3ddd9eba4"}
 *
 * Go source:
 * func (node *FlowNodeBase) FlowNodeData() *FlowNodeBase { return node }
 */
export function FlowNodeBase_FlowNodeData(receiver: GoPtr<FlowNodeBaseType>): GoPtr<FlowNodeBaseType> {
  return receiver;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::CompositeBase.subtreeFactsWorker","kind":"method","status":"implemented","sigHash":"972a15fd98644efdcdfbcf0696cad95eb8827bac73c165123dc1e3d7b491abc4","bodyHash":"629382f4939a66f6e860b1ef7488583cbae7cea6894e3f33311dbe0edf36ede2"}
 *
 * Go source:
 * func (node *CompositeBase) subtreeFactsWorker(self nodeData) SubtreeFacts {
 * 	facts := SubtreeFacts(node.facts.Load())
 * 	if facts&SubtreeFactsComputed == 0 {
 * 		facts |= self.computeSubtreeFacts() | SubtreeFactsComputed
 * 		node.facts.Store(uint32(facts))
 * 	}
 * 	return facts &^ SubtreeFactsComputed
 * }
 */
export function CompositeBase_subtreeFactsWorker(receiver: GoPtr<CompositeBaseType>, self: nodeData): SubtreeFacts {
  receiver!.facts ??= new Uint32();
  let facts: SubtreeFacts = receiver!.facts.Load();
  if ((facts & SubtreeFactsComputed) === 0) {
    facts = (facts | self.computeSubtreeFacts() | SubtreeFactsComputed) >>> 0;
    receiver!.facts.Store(facts >>> 0);
  }
  return (facts & ~SubtreeFactsComputed) >>> 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::CompositeBase.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"8b89d664fd9e8ee7a8431299a7d78b77769e23f049f5e4dba366c26dafefc0fd","bodyHash":"1e683ff49b21a154e253c719bfd1ebf1a19f7f24172a81fba0f8af6eb21d9fcd"}
 *
 * Go source:
 * func (node *CompositeBase) computeSubtreeFacts() SubtreeFacts {
 * 	panic("not implemented")
 * }
 */
export function CompositeBase_computeSubtreeFacts(receiver: GoPtr<CompositeBaseType>): SubtreeFacts {
  throw new globalThis.Error("not implemented");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::ClassLikeBase.Name","kind":"method","status":"implemented","sigHash":"9601fab16a17d99395d743375c8ce19289d34824469f2fb75b2eac38778c10b9","bodyHash":"558b8f433b3e5146b895d9d31f69c43102be0b38ff8b538912435e4dc0671bf7"}
 *
 * Go source:
 * func (node *ClassLikeBase) Name() *DeclarationName { return node.name }
 */
export function ClassLikeBase_Name(receiver: GoPtr<ClassLikeBaseType>): GoPtr<DeclarationName> {
  return receiver!.name;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::ClassLikeBase.ClassLikeData","kind":"method","status":"implemented","sigHash":"ffa1d657221fd4e3e40e92bd7d14bd4264eefb75e2b396ed125007ff5272d114","bodyHash":"9442331203503dec749598ca5be7723f3611e9ee1c927f3584ac545ab2f2ac66"}
 *
 * Go source:
 * func (node *ClassLikeBase) ClassLikeData() *ClassLikeBase { return node }
 */
export function ClassLikeBase_ClassLikeData(receiver: GoPtr<ClassLikeBaseType>): GoPtr<ClassLikeBaseType> {
  return receiver;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::ClassLikeBase.computeSubtreeFacts","kind":"method","status":"implemented","sigHash":"bad20ccbf4546b81effc744ba49e5e3152954481315f572cb8145b57aa04d661","bodyHash":"5be883034e6ac1d94f0bbecdcc03ff5a857f62347172acc1c8a61ac2439f4d97"}
 *
 * Go source:
 * func (node *ClassLikeBase) computeSubtreeFacts() SubtreeFacts {
 * 	if node.modifiers != nil && node.modifiers.ModifierFlags&ModifierFlagsAmbient != 0 {
 * 		return SubtreeContainsTypeScript
 * 	} else {
 * 		return propagateModifierListSubtreeFacts(node.modifiers) |
 * 			propagateSubtreeFacts(node.name) |
 * 			propagateEraseableSyntaxListSubtreeFacts(node.TypeParameters) |
 * 			propagateNodeListSubtreeFacts(node.HeritageClauses, propagateSubtreeFacts) |
 * 			propagateNodeListSubtreeFacts(node.Members, propagateSubtreeFacts)
 * 	}
 * }
 */
export function ClassLikeBase_computeSubtreeFacts(receiver: GoPtr<ClassLikeBaseType>): SubtreeFacts {
  if (receiver!.modifiers !== undefined && (receiver!.modifiers!.ModifierFlags & ModifierFlagsAmbient) !== 0) {
    return SubtreeContainsTypeScript;
  } else {
    return (propagateModifierListSubtreeFacts(receiver!.modifiers)
      | propagateSubtreeFacts(receiver!.name)
      | propagateEraseableSyntaxListSubtreeFacts(receiver!.TypeParameters)
      | propagateNodeListSubtreeFacts(receiver!.HeritageClauses, propagateSubtreeFacts)
      | propagateNodeListSubtreeFacts(receiver!.Members, propagateSubtreeFacts)) >>> 0;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::NamedMemberBase.DeclarationData","kind":"method","status":"implemented","sigHash":"95601f8b87878a5cd3e1e195305e62b6c60d39cfa47a4c85b5da90d555ffcc6d","bodyHash":"0cb098824058669d7b9968cd602e0a291c7b9b86137782e4936ad482315c6011"}
 *
 * Go source:
 * func (node *NamedMemberBase) DeclarationData() *DeclarationBase    { return &node.DeclarationBase }
 */
export function NamedMemberBase_DeclarationData(receiver: GoPtr<NamedMemberBaseType>): GoPtr<DeclarationBaseType> {
  return receiver;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::NamedMemberBase.Modifiers","kind":"method","status":"implemented","sigHash":"903ac87723aade4b26da18bede911c36c4a5bee10a3e6b31c7ddfba36a8b0018","bodyHash":"7c6f5d8bd7c234bdab3716d27a6b16b78d5127971ae84c9c0a4b4d667408d024"}
 *
 * Go source:
 * func (node *NamedMemberBase) Modifiers() *ModifierList             { return node.modifiers }
 */
export function NamedMemberBase_Modifiers(receiver: GoPtr<NamedMemberBaseType>): GoPtr<ModifierList> {
  return receiver!.modifiers;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::NamedMemberBase.setModifiers","kind":"method","status":"implemented","sigHash":"a7dc4a155181a705d6f8049765c5fb6f8dd04d720fd47e509093a10a4bb499ac","bodyHash":"da8af54bf18006fb7c63125f3be9ba0c9d30ca90900d7278527b9707d0e9a155"}
 *
 * Go source:
 * func (node *NamedMemberBase) setModifiers(modifiers *ModifierList) { node.modifiers = modifiers }
 */
export function NamedMemberBase_setModifiers(receiver: GoPtr<NamedMemberBaseType>, modifiers: GoPtr<ModifierList>): void {
  receiver!.modifiers = modifiers;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::NamedMemberBase.Name","kind":"method","status":"implemented","sigHash":"b5fc79186f7d94a24ba2a7049a63ba2ad86e452fbdfd04cdf5757cddeb957eeb","bodyHash":"12f93460b05d553bb3e844e4658272bab5adefc17c8d21dc363e6eb95a5e0bdf"}
 *
 * Go source:
 * func (node *NamedMemberBase) Name() *DeclarationName               { return node.name }
 */
export function NamedMemberBase_Name(receiver: GoPtr<NamedMemberBaseType>): GoPtr<DeclarationName> {
  return receiver!.name;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::LiteralLikeNodeBase.LiteralLikeData","kind":"method","status":"implemented","sigHash":"8de8a3a48e6bf2677efb0e3bf721e365e591e04bbe8d32fda28e0f0221a84de5","bodyHash":"5eb8b4b944fe7304aadd6a06537cdf8c43953f7914a83999ba53596d359ec47e"}
 *
 * Go source:
 * func (node *LiteralLikeNodeBase) LiteralLikeData() *LiteralLikeNodeBase { return node }
 */
export function LiteralLikeNodeBase_LiteralLikeData(receiver: GoPtr<LiteralLikeNodeBaseType>): GoPtr<LiteralLikeNodeBaseType> {
  return receiver;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::TemplateLiteralLikeNodeBase.LiteralLikeData","kind":"method","status":"implemented","sigHash":"4598ee4662bc881db8f7697bfbbdc484ff6cde57d6989fee38034163b9ba5828","bodyHash":"d9c72c9b93b4f703525fb59f461812e9d0292953acc27b65736b646c760ad1af"}
 *
 * Go source:
 * func (node *TemplateLiteralLikeNodeBase) LiteralLikeData() *LiteralLikeNodeBase {
 * 	return &node.LiteralLikeNodeBase
 * }
 */
export function TemplateLiteralLikeNodeBase_LiteralLikeData(receiver: GoPtr<TemplateLiteralLikeNodeBaseType>): GoPtr<LiteralLikeNodeBaseType> {
  return receiver;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/ast.go::method::TemplateLiteralLikeNodeBase.TemplateLiteralLikeData","kind":"method","status":"implemented","sigHash":"1a74dcde42a6bac4d0efb0d7171482ce4160de44b2f23f8557d771d8849be25c","bodyHash":"2abff1a5bbdf4bfd2908769170f77a21448e72d0c4d5748aa036767a0279ce77"}
 *
 * Go source:
 * func (node *TemplateLiteralLikeNodeBase) TemplateLiteralLikeData() *TemplateLiteralLikeNodeBase {
 * 	return node
 * }
 */
export function TemplateLiteralLikeNodeBase_TemplateLiteralLikeData(receiver: GoPtr<TemplateLiteralLikeNodeBaseType>): GoPtr<TemplateLiteralLikeNodeBaseType> {
  return receiver;
}
