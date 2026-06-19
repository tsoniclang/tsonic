import type { bool, int } from "../../go/scalars.js";
import type { GoMap, GoPtr } from "../../go/compat.js";
import { Builder } from "../../go/strings.js";
import { goReceiverKey } from "../ast/spine.js";
import type { GoInterfaceValue, ModifierList, Node, NodeList, NodeFactoryCoercible } from "../ast/spine.js";
import { Node_Clone, Node_End, Node_ForEachChild, Node_Pos, Node_VisitEachChild, NodeFactory_NewModifierList, NodeFactory_NewNodeList, NodeList_Clone, NodeList_End, NodeList_Pos } from "../ast/spine.js";
import type { NodeFactory } from "../ast/generated/factory.js";
import type { NodeVisitor } from "../ast/visitor.js";
import { NewNodeVisitor, NodeVisitor_VisitNodes } from "../ast/visitor.js";
import { NodeIsSynthesized } from "../ast/utilities.js";
import { NewTextRange } from "../core/text.js";
import type { Symbol } from "../ast/symbol.js";
import type { UTF16Offset } from "../core/core.js";
import { SkipTrivia } from "../scanner/scanner.js";
import { IsWhiteSpaceLike } from "../stringutil/util.js";
import { defaultIndentSize } from "./textwriter.js";
import type { textWriter } from "./textwriter.js";
import {
  textWriter_Clear,
  textWriter_DecreaseIndent,
  textWriter_GetColumn,
  textWriter_GetIndent,
  textWriter_GetLine,
  textWriter_GetTextPos,
  textWriter_HasTrailingComment,
  textWriter_HasTrailingWhitespace,
  textWriter_IncreaseIndent,
  textWriter_IsAtStartOfLine,
  textWriter_RawWrite,
  textWriter_String,
  textWriter_Write,
  textWriter_WriteComment,
  textWriter_WriteKeyword,
  textWriter_WriteLine,
  textWriter_WriteLineForce,
  textWriter_WriteLiteral,
  textWriter_WriteOperator,
  textWriter_WriteParameter,
  textWriter_WriteProperty,
  textWriter_WritePunctuation,
  textWriter_WriteSpace,
  textWriter_WriteStringLiteral,
  textWriter_WriteSymbol,
  textWriter_WriteTrailingSemicolon,
} from "./textwriter.js";
import type { PrintHandlers } from "./printer/state.js";

// Go strings are byte sequences. `len(s)` is the UTF-8 byte length and `s[i]`
// indexes a byte, so position math (matching textWriter.GetTextPos, which returns
// a byte offset) is performed over the UTF-8 encoding of the string.
const utf8Encoder: TextEncoder = new globalThis.TextEncoder();
const byteLen = (s: string): int => utf8Encoder.encode(s).length as int;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/changetrackerwriter.go::type::ChangeTrackerWriter","kind":"type","status":"implemented","sigHash":"c477609e074153925420febf51c26d161099f83952e89bbfdcbdcf2a14ab09c9","bodyHash":"8bab6fe1bad3277c97e81df28135897fde2a2931cc3c47eb1027f931ed59f99f"}
 *
 * Go source:
 * ChangeTrackerWriter struct {
 * 	textWriter
 * 	lastNonTriviaPosition int
 * 	pos                   map[triviaPositionKey]int
 * 	end                   map[triviaPositionKey]int
 * }
 */
export interface ChangeTrackerWriter {
  readonly __tsgoEmbedded0?: textWriter;
  lastNonTriviaPosition: int;
  pos: GoMap<triviaPositionKey, int>;
  end: GoMap<triviaPositionKey, int>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/changetrackerwriter.go::type::triviaPositionKey","kind":"type","status":"implemented","sigHash":"8afcfd37e24226d32c0303750c14c2560398126a4865a619dad6f8bad086e352","bodyHash":"7fadf2a8a236bf530cd0ad38006657bb857a7f146c44fed3879f059326d39288"}
 *
 * Go source:
 * triviaPositionKey interface { // *astNode | *ast.NodeList
 * 	Pos() int
 * 	End() int
 * }
 */
export interface triviaPositionKey extends GoInterfaceValue<GoPtr<Node> | GoPtr<NodeList>> {
  Pos(): int;
  End(): int;
}

// `*ast.Node` satisfies `triviaPositionKey` (it has Pos()/End()). The method-bearing
// adapter carries the underlying receiver via the goReceiver brand so the change
// tracker's maps can key on pointer identity.
const nodeTriviaPositionKeys = new WeakMap<Node, triviaPositionKey>();
const nodeListTriviaPositionKeys = new WeakMap<NodeList, triviaPositionKey>();

function Node_as_triviaPositionKey(receiver: GoPtr<Node>): triviaPositionKey {
  let value = nodeTriviaPositionKeys.get(receiver!);
  if (value !== undefined) return value;
  value = {
    [goReceiverKey]: receiver,
    Pos: (): int => Node_Pos(receiver),
    End: (): int => Node_End(receiver),
  };
  nodeTriviaPositionKeys.set(receiver!, value);
  return value;
}

// `*ast.NodeList` satisfies `triviaPositionKey` as well.
function NodeList_as_triviaPositionKey(receiver: GoPtr<NodeList>): triviaPositionKey {
  let value = nodeListTriviaPositionKeys.get(receiver!);
  if (value !== undefined) return value;
  value = {
    [goReceiverKey]: receiver,
    Pos: (): int => NodeList_Pos(receiver),
    End: (): int => NodeList_End(receiver),
  };
  nodeListTriviaPositionKeys.set(receiver!, value);
  return value;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/changetrackerwriter.go::func::NewChangeTrackerWriter","kind":"func","status":"implemented","sigHash":"aa31b7ff3ae3773c8684e84ad8228c22d7ec6b96e924725f6040855fe8e203fa","bodyHash":"43ed8db8d50be303f7abaa22872136abf14db29957d64cc770677c34fe0a94a1"}
 *
 * Go source:
 * func NewChangeTrackerWriter(newline string, indentSize int) *ChangeTrackerWriter {
 * 	// TODO: Callers passing -1 should pass actual indent options once indent-related formatting is ported.
 * 	if indentSize < 0 {
 * 		indentSize = defaultIndentSize
 * 	}
 * 	ctw := &ChangeTrackerWriter{
 * 		textWriter:            textWriter{newLine: newline, indentSize: indentSize},
 * 		lastNonTriviaPosition: 0,
 * 		pos:                   map[triviaPositionKey]int{},
 * 		end:                   map[triviaPositionKey]int{},
 * 	}
 * 	ctw.textWriter.Clear()
 * 	return ctw
 * }
 */
export function NewChangeTrackerWriter(newline: string, indentSize: int): GoPtr<ChangeTrackerWriter> {
  // TODO: Callers passing -1 should pass actual indent options once indent-related formatting is ported.
  const resolvedIndentSize: int = indentSize < 0 ? defaultIndentSize : indentSize;
  // textWriter{newLine, indentSize}: the remaining fields take their Go zero values;
  // ctw.textWriter.Clear() below resets the mutable ones.
  const embedded: textWriter = {
    newLine: newline,
    indentSize: resolvedIndentSize,
    builder: new Builder(),
    lastWritten: "",
    indent: 0 as int,
    lineStart: false as bool,
    lineCount: 0 as int,
    linePos: 0 as int,
    hasTrailingCommentState: false as bool,
  };
  const ctw: ChangeTrackerWriter = {
    __tsgoEmbedded0: embedded,
    lastNonTriviaPosition: 0 as int,
    pos: new globalThis.Map<triviaPositionKey, int>(),
    end: new globalThis.Map<triviaPositionKey, int>(),
  };
  textWriter_Clear(ctw.__tsgoEmbedded0);
  return ctw;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/changetrackerwriter.go::method::ChangeTrackerWriter.GetPrintHandlers","kind":"method","status":"implemented","sigHash":"e05edf69eb861f9658617c9916c3c7d410673f180ae3286d814613e3c8d7c0a4","bodyHash":"9bc147b8bf8dcb487062f14297919b48be7f159d5fc102986146908171f59bca"}
 *
 * Go source:
 * func (ct *ChangeTrackerWriter) GetPrintHandlers() PrintHandlers {
 * 	return PrintHandlers{
 * 		OnBeforeEmitNode: func(nodeOpt *ast.Node) {
 * 			if nodeOpt != nil {
 * 				ct.setPos(nodeOpt)
 * 			}
 * 		},
 * 		OnAfterEmitNode: func(nodeOpt *ast.Node) {
 * 			if nodeOpt != nil {
 * 				ct.setEnd(nodeOpt)
 * 			}
 * 		},
 * 		OnBeforeEmitNodeList: func(nodesOpt *ast.NodeList) {
 * 			if nodesOpt != nil {
 * 				ct.setPos(nodesOpt)
 * 			}
 * 		},
 * 		OnAfterEmitNodeList: func(nodesOpt *ast.NodeList) {
 * 			if nodesOpt != nil {
 * 				ct.setEnd(nodesOpt)
 * 			}
 * 		},
 * 		OnBeforeEmitToken: func(nodeOpt *ast.TokenNode) {
 * 			if nodeOpt != nil {
 * 				ct.setPos(nodeOpt)
 * 			}
 * 		},
 * 		OnAfterEmitToken: func(nodeOpt *ast.TokenNode) {
 * 			if nodeOpt != nil {
 * 				ct.setEnd(nodeOpt)
 * 			}
 * 		},
 * 	}
 * }
 */
export function ChangeTrackerWriter_GetPrintHandlers(receiver: GoPtr<ChangeTrackerWriter>): PrintHandlers {
  return {
    HasGlobalName: (_name: string): bool => false as bool,
    OnBeforeEmitNode: (nodeOpt: GoPtr<Node>): void => {
      if (nodeOpt !== undefined) {
        ChangeTrackerWriter_setPos(receiver, Node_as_triviaPositionKey(nodeOpt));
      }
    },
    OnAfterEmitNode: (nodeOpt: GoPtr<Node>): void => {
      if (nodeOpt !== undefined) {
        ChangeTrackerWriter_setEnd(receiver, Node_as_triviaPositionKey(nodeOpt));
      }
    },
    OnBeforeEmitNodeList: (nodesOpt: GoPtr<NodeList>): void => {
      if (nodesOpt !== undefined) {
        ChangeTrackerWriter_setPos(receiver, NodeList_as_triviaPositionKey(nodesOpt));
      }
    },
    OnAfterEmitNodeList: (nodesOpt: GoPtr<NodeList>): void => {
      if (nodesOpt !== undefined) {
        ChangeTrackerWriter_setEnd(receiver, NodeList_as_triviaPositionKey(nodesOpt));
      }
    },
    OnBeforeEmitToken: (nodeOpt: GoPtr<Node>): void => {
      if (nodeOpt !== undefined) {
        ChangeTrackerWriter_setPos(receiver, Node_as_triviaPositionKey(nodeOpt));
      }
    },
    OnAfterEmitToken: (nodeOpt: GoPtr<Node>): void => {
      if (nodeOpt !== undefined) {
        ChangeTrackerWriter_setEnd(receiver, Node_as_triviaPositionKey(nodeOpt));
      }
    },
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/changetrackerwriter.go::method::ChangeTrackerWriter.setPos","kind":"method","status":"implemented","sigHash":"f21f82d2c8337afd1b8c2029c3ed5c9adb7cb27870abe2b20f46c043023bcda9","bodyHash":"b90a8b3445b0810154f9f791dbeabdf55948ac5249f931e244f1fc2dbebb5e51"}
 *
 * Go source:
 * func (ct *ChangeTrackerWriter) setPos(node triviaPositionKey) {
 * 	ct.pos[node] = ct.lastNonTriviaPosition
 * }
 */
export function ChangeTrackerWriter_setPos(receiver: GoPtr<ChangeTrackerWriter>, node: triviaPositionKey): void {
  receiver!.pos.set(node, receiver!.lastNonTriviaPosition);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/changetrackerwriter.go::method::ChangeTrackerWriter.setEnd","kind":"method","status":"implemented","sigHash":"f601f20196a2e4286335b0f5b3c0bee9d784997792d8b9171368a9dfe2940c8a","bodyHash":"11a3c9205bd1b4fca87b095ec7f2005854120b262aa094a450f6e910552866a1"}
 *
 * Go source:
 * func (ct *ChangeTrackerWriter) setEnd(node triviaPositionKey) {
 * 	ct.end[node] = ct.lastNonTriviaPosition
 * }
 */
export function ChangeTrackerWriter_setEnd(receiver: GoPtr<ChangeTrackerWriter>, node: triviaPositionKey): void {
  receiver!.end.set(node, receiver!.lastNonTriviaPosition);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/changetrackerwriter.go::method::ChangeTrackerWriter.getPos","kind":"method","status":"implemented","sigHash":"cf5df1fd9d0ebe9ca81c49c8ab2ffa1240f5dfcf1362fdeb6fd674782cadde36","bodyHash":"4aa282904429278925a21894f4456319d19d2ae0786e3379ca821e1d29446151"}
 *
 * Go source:
 * func (ct *ChangeTrackerWriter) getPos(node triviaPositionKey) int {
 * 	return ct.pos[node]
 * }
 */
export function ChangeTrackerWriter_getPos(receiver: GoPtr<ChangeTrackerWriter>, node: triviaPositionKey): int {
  // Go's map read of a missing key yields the int zero value.
  const value = receiver!.pos.get(node);
  return value !== undefined ? value : (0 as int);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/changetrackerwriter.go::method::ChangeTrackerWriter.getEnd","kind":"method","status":"implemented","sigHash":"41dc188edcc40927a8c14f1a35cfedd6a7e08ad920381f497b1f868fceb866f4","bodyHash":"1619cf6468873b65cdca817f475dc08409802919c5fc30c4797a8fae97999635"}
 *
 * Go source:
 * func (ct *ChangeTrackerWriter) getEnd(node triviaPositionKey) int {
 * 	return ct.end[node]
 * }
 */
export function ChangeTrackerWriter_getEnd(receiver: GoPtr<ChangeTrackerWriter>, node: triviaPositionKey): int {
  // Go's map read of a missing key yields the int zero value.
  const value = receiver!.end.get(node);
  return value !== undefined ? value : (0 as int);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/changetrackerwriter.go::method::ChangeTrackerWriter.setLastNonTriviaPosition","kind":"method","status":"implemented","sigHash":"f0504bc73374f407635e845c2cb871b9b2d0d37fe33b9def0654cc11171acb70","bodyHash":"7f51cd89bb7d3298d5202991b76d5c8b867fcdd6691a47a7fc5674f4f8dfb698"}
 *
 * Go source:
 * func (ct *ChangeTrackerWriter) setLastNonTriviaPosition(s string, force bool) {
 * 	if force || scanner.SkipTrivia(s, 0) != len(s) {
 * 		ct.lastNonTriviaPosition = ct.textWriter.GetTextPos()
 * 		i := 0
 * 		for stringutil.IsWhiteSpaceLike(rune(s[len(s)-i-1])) {
 * 			i++
 * 		}
 * 		// trim trailing whitespaces
 * 		ct.lastNonTriviaPosition -= i
 * 	}
 * }
 */
export function ChangeTrackerWriter_setLastNonTriviaPosition(receiver: GoPtr<ChangeTrackerWriter>, s: string, force: bool): void {
  const bytes = utf8Encoder.encode(s);
  if (force || SkipTrivia(s, 0 as int) !== byteLen(s)) {
    receiver!.lastNonTriviaPosition = textWriter_GetTextPos(receiver!.__tsgoEmbedded0);
    const trailing = ((): int => {
      const loop = (i: int): int => {
        if (IsWhiteSpaceLike(bytes[bytes.length - i - 1]! as int)) {
          return loop((i + 1) as int);
        }
        return i;
      };
      return loop(0 as int);
    })();
    // trim trailing whitespaces
    receiver!.lastNonTriviaPosition = (receiver!.lastNonTriviaPosition - trailing) as int;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/changetrackerwriter.go::method::ChangeTrackerWriter.AssignPositionsToNode","kind":"method","status":"implemented","sigHash":"df34348c3dd44caab84789b23b73690d07ccdde8841999b024a7189f23bf877b","bodyHash":"8c19cbcbc62c4402da514357707006cecd8863d80a404dfa347b2468aac57b0c"}
 *
 * Go source:
 * func (ct *ChangeTrackerWriter) AssignPositionsToNode(node *ast.Node, factory *ast.NodeFactory) *ast.Node {
 * 	var visitor *ast.NodeVisitor
 * 	visitor = &ast.NodeVisitor{
 * 		Visit:   func(n *ast.Node) *ast.Node { return ct.assignPositionsToNodeWorker(n, visitor) },
 * 		Factory: factory,
 * 		Hooks: ast.NodeVisitorHooks{
 * 			VisitNode:  ct.assignPositionsToNodeWorker,
 * 			VisitNodes: ct.assignPositionsToNodeArray,
 * 			VisitToken: ct.assignPositionsToNodeWorker,
 * 			VisitModifiers: func(modifiers *ast.ModifierList, v *ast.NodeVisitor) *ast.ModifierList {
 * 				if modifiers != nil {
 * 					newNodeList := ct.assignPositionsToNodeArray(&modifiers.NodeList, v)
 * 					// Return a new ModifierList so that VisitEachChild/Update detects the
 * 					// change and creates a new node with reassigned child positions.
 * 					return factory.NewModifierList(newNodeList.Nodes)
 * 				}
 * 				return modifiers
 * 			},
 * 		},
 * 	}
 * 	return ct.assignPositionsToNodeWorker(node, visitor)
 * }
 */
export function ChangeTrackerWriter_AssignPositionsToNode(receiver: GoPtr<ChangeTrackerWriter>, node: GoPtr<Node>, factory: GoPtr<NodeFactory>): GoPtr<Node> {
  // visitor is assigned first; the Visit closure captures the variable binding so
  // the self-referential call to assignPositionsToNodeWorker sees the final value.
  let visitor: GoPtr<NodeVisitor> = undefined;
  visitor = NewNodeVisitor(
    (n: GoPtr<Node>): GoPtr<Node> => ChangeTrackerWriter_assignPositionsToNodeWorker(receiver, n, visitor),
    factory,
    {
      VisitNode: (n: GoPtr<Node>, v: GoPtr<NodeVisitor>): GoPtr<Node> => ChangeTrackerWriter_assignPositionsToNodeWorker(receiver, n, v),
      VisitNodes: (nodes: GoPtr<NodeList>, v: GoPtr<NodeVisitor>): GoPtr<NodeList> => ChangeTrackerWriter_assignPositionsToNodeArray(receiver, nodes, v),
      VisitToken: (n: GoPtr<Node>, v: GoPtr<NodeVisitor>): GoPtr<Node> => ChangeTrackerWriter_assignPositionsToNodeWorker(receiver, n, v),
      VisitModifiers: (modifiers: GoPtr<ModifierList>, v: GoPtr<NodeVisitor>): GoPtr<ModifierList> => {
        if (modifiers !== undefined) {
          const newNodeList = ChangeTrackerWriter_assignPositionsToNodeArray(receiver, modifiers as unknown as GoPtr<NodeList>, v);
          // Return a new ModifierList so that VisitEachChild/Update detects the
          // change and creates a new node with reassigned child positions.
          return NodeFactory_NewModifierList(factory, newNodeList!.Nodes);
        }
        return modifiers;
      },
      VisitEmbeddedStatement: undefined as never,
      VisitIterationBody: undefined as never,
      VisitParameters: undefined as never,
      VisitFunctionBody: undefined as never,
      VisitTopLevelStatements: undefined as never,
    },
  );
  return ChangeTrackerWriter_assignPositionsToNodeWorker(receiver, node, visitor);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/changetrackerwriter.go::method::ChangeTrackerWriter.assignPositionsToNodeWorker","kind":"method","status":"implemented","sigHash":"9cc5507d01f59b2b6e64c8a3925c7261c6c108047a0411390dbc7f631153f2ec","bodyHash":"789286ea093358936d511ab9919a9ee3b7c13de40fb7b8c84c961fa4e9856a45"}
 *
 * Go source:
 * func (ct *ChangeTrackerWriter) assignPositionsToNodeWorker(
 * 	node *ast.Node,
 * 	v *ast.NodeVisitor,
 * ) *ast.Node {
 * 	if node == nil {
 * 		return node
 * 	}
 * 	visited := node.VisitEachChild(v)
 * 	// create proxy node for non synthesized nodes
 * 	newNode := visited
 * 	if !ast.NodeIsSynthesized(visited) {
 * 		newNode = visited.Clone(v.Factory)
 * 	}
 * 	newNode.ForEachChild(func(child *ast.Node) bool {
 * 		child.Parent = newNode
 * 		return true
 * 	})
 * 	newNode.Loc = core.NewTextRange(ct.getPos(node), ct.getEnd(node))
 * 	return newNode
 * }
 */
export function ChangeTrackerWriter_assignPositionsToNodeWorker(receiver: GoPtr<ChangeTrackerWriter>, node: GoPtr<Node>, v: GoPtr<NodeVisitor>): GoPtr<Node> {
  if (node === undefined) {
    return node;
  }
  const visited = Node_VisitEachChild(node, v);
  // create proxy node for non synthesized nodes
  let newNode = visited;
  if (!NodeIsSynthesized(visited)) {
    newNode = Node_Clone(visited, v!.Factory as unknown as NodeFactoryCoercible);
  }
  Node_ForEachChild(newNode, (child: GoPtr<Node>): bool => {
    child!.Parent = newNode;
    return true as bool;
  });
  newNode!.Loc = NewTextRange(ChangeTrackerWriter_getPos(receiver, Node_as_triviaPositionKey(node)), ChangeTrackerWriter_getEnd(receiver, Node_as_triviaPositionKey(node)));
  return newNode;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/changetrackerwriter.go::method::ChangeTrackerWriter.assignPositionsToNodeArray","kind":"method","status":"implemented","sigHash":"e141fab8e838cd07ea02c114a13763488cc71168b0a02955627e74f63795d7d7","bodyHash":"b9938904d74975a2f4f9d9a97dbe03f90796ca47b6ffdbdaa71d868007a3e795"}
 *
 * Go source:
 * func (ct *ChangeTrackerWriter) assignPositionsToNodeArray(
 * 	nodes *ast.NodeList,
 * 	v *ast.NodeVisitor,
 * ) *ast.NodeList {
 * 	visited := v.VisitNodes(nodes)
 * 	if visited == nil {
 * 		return visited
 * 	}
 * 	if nodes == nil {
 * 		// Debug.assert(nodes);
 * 		panic("if nodes is nil, visited should not be nil")
 * 	}
 * 	// clone nodearray if necessary
 * 	nodeArray := visited
 * 	if visited == nodes {
 * 		nodeArray = visited.Clone(v.Factory)
 * 	}
 *
 * 	nodeArray.Loc = core.NewTextRange(ct.getPos(nodes), ct.getEnd(nodes))
 * 	return nodeArray
 * }
 */
export function ChangeTrackerWriter_assignPositionsToNodeArray(receiver: GoPtr<ChangeTrackerWriter>, nodes: GoPtr<NodeList>, v: GoPtr<NodeVisitor>): GoPtr<NodeList> {
  const visited = NodeVisitor_VisitNodes(v, nodes);
  if (visited === undefined) {
    return visited;
  }
  if (nodes === undefined) {
    // Debug.assert(nodes);
    throw new globalThis.Error("if nodes is nil, visited should not be nil");
  }
  // clone nodearray if necessary
  let nodeArray: GoPtr<NodeList> = visited;
  if (visited === nodes) {
    nodeArray = NodeList_Clone(visited, v!.Factory as unknown as NodeFactoryCoercible);
  }
  nodeArray!.Loc = NewTextRange(ChangeTrackerWriter_getPos(receiver, NodeList_as_triviaPositionKey(nodes)), ChangeTrackerWriter_getEnd(receiver, NodeList_as_triviaPositionKey(nodes)));
  return nodeArray;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/changetrackerwriter.go::method::ChangeTrackerWriter.Write","kind":"method","status":"implemented","sigHash":"be52f41210e5467498b31fc4660b3e646a2bae51a1b329244ff596a2fdfc9d97","bodyHash":"41f41d07fec6557c2bbfe6d5b3269994e9c1c9424a51c00338b4da4c51fcd914"}
 *
 * Go source:
 * func (ct *ChangeTrackerWriter) Write(text string) {
 * 	ct.textWriter.Write(text)
 * 	ct.setLastNonTriviaPosition(text, false)
 * }
 */
export function ChangeTrackerWriter_Write(receiver: GoPtr<ChangeTrackerWriter>, text: string): void {
  textWriter_Write(receiver!.__tsgoEmbedded0, text);
  ChangeTrackerWriter_setLastNonTriviaPosition(receiver, text, false as bool);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/changetrackerwriter.go::method::ChangeTrackerWriter.WriteTrailingSemicolon","kind":"method","status":"implemented","sigHash":"c2e4a0a1ffc7ababbbdc9e5efc92691c8022ce103afe32e8018dd1966809915e","bodyHash":"c6cb9ad1135bcdbd37c5ef270ab621486f8b202fa090796a089ff253070c5088"}
 *
 * Go source:
 * func (ct *ChangeTrackerWriter) WriteTrailingSemicolon(text string) {
 * 	ct.textWriter.WriteTrailingSemicolon(text)
 * 	ct.setLastNonTriviaPosition(text, false)
 * }
 */
export function ChangeTrackerWriter_WriteTrailingSemicolon(receiver: GoPtr<ChangeTrackerWriter>, text: string): void {
  textWriter_WriteTrailingSemicolon(receiver!.__tsgoEmbedded0, text);
  ChangeTrackerWriter_setLastNonTriviaPosition(receiver, text, false as bool);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/changetrackerwriter.go::method::ChangeTrackerWriter.WriteComment","kind":"method","status":"implemented","sigHash":"8ebf3f422a918d769ac2e086008726fed54045fae0d466fe498b25d9f38fd29f","bodyHash":"888346974c47b2496432e367b239329ca5104747f2dd513d248d31e9b349a530"}
 *
 * Go source:
 * func (ct *ChangeTrackerWriter) WriteComment(text string) { ct.textWriter.WriteComment(text) }
 */
export function ChangeTrackerWriter_WriteComment(receiver: GoPtr<ChangeTrackerWriter>, text: string): void {
  textWriter_WriteComment(receiver!.__tsgoEmbedded0, text);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/changetrackerwriter.go::method::ChangeTrackerWriter.WriteKeyword","kind":"method","status":"implemented","sigHash":"3792eb24e56e72a31c4da9d21038e537ce5010a559f0c266a79765b5e19af3c4","bodyHash":"b713f36b06ebe94f7188ac214557aca1748e2cb0fe0f39fb8b47648963052833"}
 *
 * Go source:
 * func (ct *ChangeTrackerWriter) WriteKeyword(text string) {
 * 	ct.textWriter.WriteKeyword(text)
 * 	ct.setLastNonTriviaPosition(text, false)
 * }
 */
export function ChangeTrackerWriter_WriteKeyword(receiver: GoPtr<ChangeTrackerWriter>, text: string): void {
  textWriter_WriteKeyword(receiver!.__tsgoEmbedded0, text);
  ChangeTrackerWriter_setLastNonTriviaPosition(receiver, text, false as bool);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/changetrackerwriter.go::method::ChangeTrackerWriter.WriteOperator","kind":"method","status":"implemented","sigHash":"2b80d4372ab12ef9a4ba4141969d0aab7eeaaeb748dc1880425b4fc3898007c0","bodyHash":"bdb3c6984b462d74add987b36c544cac3f7f48b2dd859137b6e093fc4d7cd91d"}
 *
 * Go source:
 * func (ct *ChangeTrackerWriter) WriteOperator(text string) {
 * 	ct.textWriter.WriteOperator(text)
 * 	ct.setLastNonTriviaPosition(text, false)
 * }
 */
export function ChangeTrackerWriter_WriteOperator(receiver: GoPtr<ChangeTrackerWriter>, text: string): void {
  textWriter_WriteOperator(receiver!.__tsgoEmbedded0, text);
  ChangeTrackerWriter_setLastNonTriviaPosition(receiver, text, false as bool);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/changetrackerwriter.go::method::ChangeTrackerWriter.WritePunctuation","kind":"method","status":"implemented","sigHash":"e4df1ad1ef3fd172015402a7a1c944f79ef68f28526ce891b8d36c4c9e0cc1ce","bodyHash":"92001b4c79d51f98771276304bdb7ae36afee65084a2a43384032f9ee4340432"}
 *
 * Go source:
 * func (ct *ChangeTrackerWriter) WritePunctuation(text string) {
 * 	ct.textWriter.WritePunctuation(text)
 * 	ct.setLastNonTriviaPosition(text, false)
 * }
 */
export function ChangeTrackerWriter_WritePunctuation(receiver: GoPtr<ChangeTrackerWriter>, text: string): void {
  textWriter_WritePunctuation(receiver!.__tsgoEmbedded0, text);
  ChangeTrackerWriter_setLastNonTriviaPosition(receiver, text, false as bool);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/changetrackerwriter.go::method::ChangeTrackerWriter.WriteSpace","kind":"method","status":"implemented","sigHash":"9130cdd9a127b113bea05af5c0c876f419a185a50198c2a73b0108105458db6e","bodyHash":"cba1ec315905cdda5e556564844c8973de23a3e0690470e1a75472e608d2d00c"}
 *
 * Go source:
 * func (ct *ChangeTrackerWriter) WriteSpace(text string) {
 * 	ct.textWriter.WriteSpace(text)
 * 	ct.setLastNonTriviaPosition(text, false)
 * }
 */
export function ChangeTrackerWriter_WriteSpace(receiver: GoPtr<ChangeTrackerWriter>, text: string): void {
  textWriter_WriteSpace(receiver!.__tsgoEmbedded0, text);
  ChangeTrackerWriter_setLastNonTriviaPosition(receiver, text, false as bool);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/changetrackerwriter.go::method::ChangeTrackerWriter.WriteStringLiteral","kind":"method","status":"implemented","sigHash":"7514c16d7b50bc145bfd7304568b4deb0949c11ec023ce8c17dec1e166fe0932","bodyHash":"7ac437518cde6f033b94bab3f13395d4cc9429454d84bd7b406bd3753cf25dea"}
 *
 * Go source:
 * func (ct *ChangeTrackerWriter) WriteStringLiteral(text string) {
 * 	ct.textWriter.WriteStringLiteral(text)
 * 	ct.setLastNonTriviaPosition(text, false)
 * }
 */
export function ChangeTrackerWriter_WriteStringLiteral(receiver: GoPtr<ChangeTrackerWriter>, text: string): void {
  textWriter_WriteStringLiteral(receiver!.__tsgoEmbedded0, text);
  ChangeTrackerWriter_setLastNonTriviaPosition(receiver, text, false as bool);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/changetrackerwriter.go::method::ChangeTrackerWriter.WriteParameter","kind":"method","status":"implemented","sigHash":"1d5c4f841e52014ce798965d872b0daec3d3d443eed2136aa87974a1aaeb4919","bodyHash":"aa6ee68a5a8ae378dd94ed0573a834d66ba52a2ad43a33e9bb436aac00b8e0eb"}
 *
 * Go source:
 * func (ct *ChangeTrackerWriter) WriteParameter(text string) {
 * 	ct.textWriter.WriteParameter(text)
 * 	ct.setLastNonTriviaPosition(text, false)
 * }
 */
export function ChangeTrackerWriter_WriteParameter(receiver: GoPtr<ChangeTrackerWriter>, text: string): void {
  textWriter_WriteParameter(receiver!.__tsgoEmbedded0, text);
  ChangeTrackerWriter_setLastNonTriviaPosition(receiver, text, false as bool);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/changetrackerwriter.go::method::ChangeTrackerWriter.WriteProperty","kind":"method","status":"implemented","sigHash":"289209c1919cbaa21ca97a2f49b6a00ba64e601529224fa80d79e668081909f1","bodyHash":"70a91e166ec5b1992eff3ad0358b7b514ad55736ab0b82f339f43ba5c8e22637"}
 *
 * Go source:
 * func (ct *ChangeTrackerWriter) WriteProperty(text string) {
 * 	ct.textWriter.WriteProperty(text)
 * 	ct.setLastNonTriviaPosition(text, false)
 * }
 */
export function ChangeTrackerWriter_WriteProperty(receiver: GoPtr<ChangeTrackerWriter>, text: string): void {
  textWriter_WriteProperty(receiver!.__tsgoEmbedded0, text);
  ChangeTrackerWriter_setLastNonTriviaPosition(receiver, text, false as bool);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/changetrackerwriter.go::method::ChangeTrackerWriter.WriteSymbol","kind":"method","status":"implemented","sigHash":"4f13d013803d2b39afe053f7e59783455e3d623f1276a46a1e230e2c4c81ae24","bodyHash":"661b47d93cef7485209211b14b6d54cde42a1ae38e7d5114da4223b093849d49"}
 *
 * Go source:
 * func (ct *ChangeTrackerWriter) WriteSymbol(text string, symbol *ast.Symbol) {
 * 	ct.textWriter.WriteSymbol(text, symbol)
 * 	ct.setLastNonTriviaPosition(text, false)
 * }
 */
export function ChangeTrackerWriter_WriteSymbol(receiver: GoPtr<ChangeTrackerWriter>, text: string, symbol_: GoPtr<Symbol>): void {
  textWriter_WriteSymbol(receiver!.__tsgoEmbedded0, text, symbol_);
  ChangeTrackerWriter_setLastNonTriviaPosition(receiver, text, false as bool);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/changetrackerwriter.go::method::ChangeTrackerWriter.WriteLine","kind":"method","status":"implemented","sigHash":"e3e7d2946c90cb9b7503568f7d82c699ad7aa15a4f975d9e92a6853a3bf4b8e7","bodyHash":"97759734fe9a14373a791e71dcf450f703a874bf1b8dc503e1cf482a37d5ac74"}
 *
 * Go source:
 * func (ct *ChangeTrackerWriter) WriteLine()                { ct.textWriter.WriteLine() }
 */
export function ChangeTrackerWriter_WriteLine(receiver: GoPtr<ChangeTrackerWriter>): void {
  textWriter_WriteLine(receiver!.__tsgoEmbedded0);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/changetrackerwriter.go::method::ChangeTrackerWriter.WriteLineForce","kind":"method","status":"implemented","sigHash":"9a05b3b945029bfd04ffce2acceee343ce430544f287e7e757f5a67b6ccf3de3","bodyHash":"0752a58350eef309e3818cf1e4de5613dad18f70c64bbc98e14e5e3197ceb801"}
 *
 * Go source:
 * func (ct *ChangeTrackerWriter) WriteLineForce(force bool) { ct.textWriter.WriteLineForce(force) }
 */
export function ChangeTrackerWriter_WriteLineForce(receiver: GoPtr<ChangeTrackerWriter>, force: bool): void {
  textWriter_WriteLineForce(receiver!.__tsgoEmbedded0, force);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/changetrackerwriter.go::method::ChangeTrackerWriter.IncreaseIndent","kind":"method","status":"implemented","sigHash":"278ad53cbbe4875cf69851d5ff60310601cc4bd6cb59acd317270c3315fab23a","bodyHash":"cd8c4eb975686b134ec5e90e90b13851d95e3b9c2a81fd5a1721601b69a4e7e4"}
 *
 * Go source:
 * func (ct *ChangeTrackerWriter) IncreaseIndent()           { ct.textWriter.IncreaseIndent() }
 */
export function ChangeTrackerWriter_IncreaseIndent(receiver: GoPtr<ChangeTrackerWriter>): void {
  textWriter_IncreaseIndent(receiver!.__tsgoEmbedded0);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/changetrackerwriter.go::method::ChangeTrackerWriter.DecreaseIndent","kind":"method","status":"implemented","sigHash":"c8943603cd8db3d8e3f01a186c75e25e4c316d058fd506b216b10b92c4b7433c","bodyHash":"5ec216d8beb720625e953503a27ac8d6598fa71d9b0dc6881b9090bd20b27c3e"}
 *
 * Go source:
 * func (ct *ChangeTrackerWriter) DecreaseIndent()           { ct.textWriter.DecreaseIndent() }
 */
export function ChangeTrackerWriter_DecreaseIndent(receiver: GoPtr<ChangeTrackerWriter>): void {
  textWriter_DecreaseIndent(receiver!.__tsgoEmbedded0);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/changetrackerwriter.go::method::ChangeTrackerWriter.Clear","kind":"method","status":"implemented","sigHash":"8fab5a2514664004bcfc8f3ee0300c3a7e05ff104a20819461670751892814f6","bodyHash":"0d5ecdd6ae08ac8755c679d56df6b3978122d81f01d9252008d2c1aa7e439d41"}
 *
 * Go source:
 * func (ct *ChangeTrackerWriter) Clear()                    { ct.textWriter.Clear(); ct.lastNonTriviaPosition = 0 }
 */
export function ChangeTrackerWriter_Clear(receiver: GoPtr<ChangeTrackerWriter>): void {
  textWriter_Clear(receiver!.__tsgoEmbedded0);
  receiver!.lastNonTriviaPosition = 0 as int;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/changetrackerwriter.go::method::ChangeTrackerWriter.String","kind":"method","status":"implemented","sigHash":"c6571688b2613fdec97b8f1b72d287e54e5ea849e1003a9c28a02ff6f2c93a38","bodyHash":"d4d1112adc5bf7f57df407655794b9683c3cb1388f9e6699e1112526fa991aed"}
 *
 * Go source:
 * func (ct *ChangeTrackerWriter) String() string            { return ct.textWriter.String() }
 */
export function ChangeTrackerWriter_String(receiver: GoPtr<ChangeTrackerWriter>): string {
  return textWriter_String(receiver!.__tsgoEmbedded0);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/changetrackerwriter.go::method::ChangeTrackerWriter.RawWrite","kind":"method","status":"implemented","sigHash":"dbcabfd2431250e93a4f6b17766242b4469eccad0e8f142504a8c696d0f9804d","bodyHash":"cb013ce7ac3a4342f5e7f033fa97d2b532616ca384a0cd2a9e555433fef59dff"}
 *
 * Go source:
 * func (ct *ChangeTrackerWriter) RawWrite(s string) {
 * 	ct.textWriter.RawWrite(s)
 * 	ct.setLastNonTriviaPosition(s, false)
 * }
 */
export function ChangeTrackerWriter_RawWrite(receiver: GoPtr<ChangeTrackerWriter>, s: string): void {
  textWriter_RawWrite(receiver!.__tsgoEmbedded0, s);
  ChangeTrackerWriter_setLastNonTriviaPosition(receiver, s, false as bool);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/changetrackerwriter.go::method::ChangeTrackerWriter.WriteLiteral","kind":"method","status":"implemented","sigHash":"0e45f1473ce6338dde6a4d1d6a45f1f52fc82bf149cf63154744759d5d7a89f9","bodyHash":"b4cfc26ad40a033594368641fe27e387b935aa40ed5a126c28f5206e5ed6531c"}
 *
 * Go source:
 * func (ct *ChangeTrackerWriter) WriteLiteral(s string) {
 * 	ct.textWriter.WriteLiteral(s)
 * 	ct.setLastNonTriviaPosition(s, true)
 * }
 */
export function ChangeTrackerWriter_WriteLiteral(receiver: GoPtr<ChangeTrackerWriter>, s: string): void {
  textWriter_WriteLiteral(receiver!.__tsgoEmbedded0, s);
  ChangeTrackerWriter_setLastNonTriviaPosition(receiver, s, true as bool);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/changetrackerwriter.go::method::ChangeTrackerWriter.GetTextPos","kind":"method","status":"implemented","sigHash":"4be9630143c1fc3c512143d3ee34f73624aa35c16c879d5220d976ab50ea50a1","bodyHash":"cacada1fa698dd9f3b862c585b14e7240c7ffdf01c99bc1a22d0009791b76907"}
 *
 * Go source:
 * func (ct *ChangeTrackerWriter) GetTextPos() int             { return ct.textWriter.GetTextPos() }
 */
export function ChangeTrackerWriter_GetTextPos(receiver: GoPtr<ChangeTrackerWriter>): int {
  return textWriter_GetTextPos(receiver!.__tsgoEmbedded0);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/changetrackerwriter.go::method::ChangeTrackerWriter.GetLine","kind":"method","status":"implemented","sigHash":"ad1acf6e04112609fc420bf666a26176be2d903561436a5ba6d0468e05b554d6","bodyHash":"35db5a4ad70113b55afd811a6ec3e4e4f6f679176aaab74d40c8120ca505b55b"}
 *
 * Go source:
 * func (ct *ChangeTrackerWriter) GetLine() int                { return ct.textWriter.GetLine() }
 */
export function ChangeTrackerWriter_GetLine(receiver: GoPtr<ChangeTrackerWriter>): int {
  return textWriter_GetLine(receiver!.__tsgoEmbedded0);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/changetrackerwriter.go::method::ChangeTrackerWriter.GetColumn","kind":"method","status":"implemented","sigHash":"3aebfbeb103ee99a4eead48760355a67ee94e7b6a055283c7924a570745864ab","bodyHash":"d2de397b4b08e0f7e89badd9fe15e52731be04dbe78f347d63c6f79845bc113b"}
 *
 * Go source:
 * func (ct *ChangeTrackerWriter) GetColumn() core.UTF16Offset { return ct.textWriter.GetColumn() }
 */
export function ChangeTrackerWriter_GetColumn(receiver: GoPtr<ChangeTrackerWriter>): UTF16Offset {
  return textWriter_GetColumn(receiver!.__tsgoEmbedded0);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/changetrackerwriter.go::method::ChangeTrackerWriter.GetIndent","kind":"method","status":"implemented","sigHash":"47af60ebd5adf84b927adf570a63f2bce37587e3485f4765f7e16be2574e5501","bodyHash":"cf9813f80ea65939fde1c51a4566206670c26ef1748edcf9b7bb1e86822116d7"}
 *
 * Go source:
 * func (ct *ChangeTrackerWriter) GetIndent() int              { return ct.textWriter.GetIndent() }
 */
export function ChangeTrackerWriter_GetIndent(receiver: GoPtr<ChangeTrackerWriter>): int {
  return textWriter_GetIndent(receiver!.__tsgoEmbedded0);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/changetrackerwriter.go::method::ChangeTrackerWriter.IsAtStartOfLine","kind":"method","status":"implemented","sigHash":"0c1a1ae2db7e23e60e19250881560ff37052104c629f832839448be53991f0e7","bodyHash":"f43ac4590728bb5c244e5a1f76997637c40cdb0b371b095c3d70b70bc574655c"}
 *
 * Go source:
 * func (ct *ChangeTrackerWriter) IsAtStartOfLine() bool       { return ct.textWriter.IsAtStartOfLine() }
 */
export function ChangeTrackerWriter_IsAtStartOfLine(receiver: GoPtr<ChangeTrackerWriter>): bool {
  return textWriter_IsAtStartOfLine(receiver!.__tsgoEmbedded0);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/changetrackerwriter.go::method::ChangeTrackerWriter.HasTrailingComment","kind":"method","status":"implemented","sigHash":"34db950a0fe5318dcab045ee015a9d2d2c5481c3168df3cb5b613e7c5a238757","bodyHash":"2b73d2695d5e93d20a17a2cd71d91cb618c1ba0c4e4f4b5f9dcd6c939510e0fc"}
 *
 * Go source:
 * func (ct *ChangeTrackerWriter) HasTrailingComment() bool    { return ct.textWriter.HasTrailingComment() }
 */
export function ChangeTrackerWriter_HasTrailingComment(receiver: GoPtr<ChangeTrackerWriter>): bool {
  return textWriter_HasTrailingComment(receiver!.__tsgoEmbedded0!);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/changetrackerwriter.go::method::ChangeTrackerWriter.HasTrailingWhitespace","kind":"method","status":"implemented","sigHash":"71a2e4cb1282e6b7cf16b4fe8e135a4b172437ed2461753efe13ee982e40537f","bodyHash":"f57a9a62e3da478d234c620f2751b0b27938384843cd238698cc3c78ce199543"}
 *
 * Go source:
 * func (ct *ChangeTrackerWriter) HasTrailingWhitespace() bool {
 * 	return ct.textWriter.HasTrailingWhitespace()
 * }
 */
export function ChangeTrackerWriter_HasTrailingWhitespace(receiver: GoPtr<ChangeTrackerWriter>): bool {
  return textWriter_HasTrailingWhitespace(receiver!.__tsgoEmbedded0);
}
