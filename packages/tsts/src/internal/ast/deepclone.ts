import type { bool, int } from "@tsonic/core/types.js";
import type { GoPtr } from "../../go/compat.js";
import { NewTextRange } from "../core/text.js";
import { NodeFlagsReparsed } from "./generated/flags.js";
import type { ModifierList, Node } from "./spine.js";
import type { NodeFactory } from "./generated/factory.js";
import { ModifierList_Clone, NodeList_Clone, NodeList_HasTrailingComma, Node_Clone, Node_VisitEachChild } from "./spine.js";
import { SetParentInChildren } from "./utilities.js";
import type { NodeVisitor } from "./visitor.js";
import { NewNodeVisitor, NodeVisitor_VisitModifiers, NodeVisitor_VisitNode, NodeVisitor_VisitNodes } from "./visitor.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/deepclone.go::func::getDeepCloneVisitor","kind":"func","status":"implemented","sigHash":"4bb96716323ea0bc24d6348cead293a463b42b52fd3a7bbfe9dd14416f7a0f52","bodyHash":"b4f577e5430740724ada7d9937b4c032f4fd4fb86c6f0f59e7c90854aff34088"}
 *
 * Go source:
 * func getDeepCloneVisitor(f *NodeFactory, syntheticLocation bool) *NodeVisitor {
 * 	var visitor *NodeVisitor
 * 	visitor = NewNodeVisitor(
 * 		func(node *Node) *Node {
 * 			visited := visitor.VisitEachChild(node)
 * 			if visited != node {
 * 				if syntheticLocation {
 * 					visited.Loc = core.NewTextRange(-1, -1)
 * 				}
 * 				return visited
 * 			}
 * 			c := node.Clone(f) // forcibly clone leaf nodes, which will then cascade new nodes/arrays upwards via `update` calls
 * 			// In strada, `factory.cloneNode` was dynamic and did _not_ clone positions for any "special cases", meanwhile
 * 			// Node.Clone in corsa reliably uses `Update` calls for all nodes and so copies locations by default.
 * 			// Deep clones are done to copy a node across files, so here, we explicitly make the location range synthetic on all cloned nodes
 * 			if syntheticLocation {
 * 				c.Loc = core.NewTextRange(-1, -1)
 * 			}
 * 			return c
 * 		},
 * 		f,
 * 		NodeVisitorHooks{
 * 			VisitNodes: func(nodes *NodeList, v *NodeVisitor) *NodeList {
 * 				if nodes == nil {
 * 					return nil
 * 				}
 * 				visited := v.VisitNodes(nodes)
 * 				var newList *NodeList
 * 				if visited != nodes {
 * 					newList = visited
 * 				} else {
 * 					newList = nodes.Clone(v.Factory)
 * 				}
 * 				if syntheticLocation {
 * 					newList.Loc = core.NewTextRange(-1, -1)
 * 					if nodes.HasTrailingComma() {
 * 						newList.Nodes[len(newList.Nodes)-1].Loc = core.NewTextRange(-2, -2)
 * 					}
 * 				}
 * 				return newList
 * 			},
 * 			VisitModifiers: func(nodes *ModifierList, v *NodeVisitor) *ModifierList {
 * 				if nodes == nil {
 * 					return nil
 * 				}
 * 				visited := v.VisitModifiers(nodes)
 * 				var newList *ModifierList
 * 				if visited != nodes {
 * 					newList = visited
 * 				} else {
 * 					newList = nodes.Clone(v.Factory)
 * 				}
 * 				if syntheticLocation {
 * 					newList.Loc = core.NewTextRange(-1, -1)
 * 					if nodes.HasTrailingComma() {
 * 						newList.Nodes[len(newList.Nodes)-1].Loc = core.NewTextRange(-2, -2)
 * 					}
 * 				}
 * 				return newList
 * 			},
 * 		},
 * 	)
 * 	return visitor
 * }
 */
export function getDeepCloneVisitor(f: GoPtr<NodeFactory>, syntheticLocation: bool): GoPtr<NodeVisitor> {
  let visitor: GoPtr<NodeVisitor>;
  const syntheticNodeLocation = () => NewTextRange(-1 as int, -1 as int);
  const trailingCommaLocation = () => NewTextRange(-2 as int, -2 as int);
  visitor = NewNodeVisitor(
    (node: GoPtr<Node>): GoPtr<Node> => {
      const visited = Node_VisitEachChild(node, visitor);
      if (visited !== node) {
        if (syntheticLocation) {
          visited!.Loc = syntheticNodeLocation();
        }
        return visited;
      }
      const cloned = Node_Clone(node, f!);
      if (syntheticLocation) {
        cloned!.Loc = syntheticNodeLocation();
      }
      return cloned;
    },
    f,
    {
      VisitNodes: (nodes, nodeVisitor) => {
        if (nodes === undefined) {
          return undefined;
        }
        const visited = NodeVisitor_VisitNodes(nodeVisitor, nodes);
        const newList = visited !== nodes ? visited : NodeList_Clone(nodes, nodeVisitor!.Factory!);
        if (syntheticLocation) {
          newList!.Loc = syntheticNodeLocation();
          if (NodeList_HasTrailingComma(nodes)) {
            newList!.Nodes[newList!.Nodes.length - 1]!.Loc = trailingCommaLocation();
          }
        }
        return newList;
      },
      VisitModifiers: (nodes, nodeVisitor) => {
        if (nodes === undefined) {
          return undefined;
        }
        const visited = NodeVisitor_VisitModifiers(nodeVisitor, nodes);
        const newList: GoPtr<ModifierList> = visited !== nodes ? visited : ModifierList_Clone(nodes, nodeVisitor!.Factory);
        if (syntheticLocation) {
          newList!.Loc = syntheticNodeLocation();
          if (NodeList_HasTrailingComma(nodes)) {
            newList!.Nodes[newList!.Nodes.length - 1]!.Loc = trailingCommaLocation();
          }
        }
        return newList;
      },
    },
  );
  return visitor;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/deepclone.go::method::NodeFactory.DeepCloneNode","kind":"method","status":"implemented","sigHash":"f27b342dc9969b51172b5787c46b5bbce493d3f306d8b598fed5462f00eb3960","bodyHash":"98bcca0a62ab9d9b4cc7df812845a9b3c7473fa1e0d4bee40a92a2cf24e843dd"}
 *
 * Go source:
 * func (f *NodeFactory) DeepCloneNode(node *Node) *Node {
 * 	return getDeepCloneVisitor(f, true /*syntheticLocation* /).VisitNode(node)
 * }
 */
export function NodeFactory_DeepCloneNode(receiver: GoPtr<NodeFactory>, node: GoPtr<Node>): GoPtr<Node> {
  return NodeVisitor_VisitNode(getDeepCloneVisitor(receiver, true as bool), node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/deepclone.go::method::NodeFactory.DeepCloneReparse","kind":"method","status":"implemented","sigHash":"9b37b6765ae6f5366968cb83a31bbc977ad47c3bb9b58eb82fb928421046d6e3","bodyHash":"70b0f1c43a8a4406fe346cfe39002b08624280971251e85ab9d840a065d86c93"}
 *
 * Go source:
 * func (f *NodeFactory) DeepCloneReparse(node *Node) *Node {
 * 	if node != nil {
 * 		node = getDeepCloneVisitor(f, false /*syntheticLocation* /).VisitNode(node)
 * 		SetParentInChildren(node)
 * 		node.Flags |= NodeFlagsReparsed
 * 	}
 * 	return node
 * }
 */
export function NodeFactory_DeepCloneReparse(receiver: GoPtr<NodeFactory>, node: GoPtr<Node>): GoPtr<Node> {
  if (node !== undefined) {
    const reparsed = NodeVisitor_VisitNode(getDeepCloneVisitor(receiver, false as bool), node);
    SetParentInChildren(reparsed);
    reparsed!.Flags = (reparsed!.Flags | NodeFlagsReparsed) >>> 0;
    return reparsed;
  }
  return node;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/deepclone.go::method::NodeFactory.DeepCloneReparseModifiers","kind":"method","status":"implemented","sigHash":"8165a43916c5da5b416b3f9534854b9347ba66c4fe258f14077688d2b55ed582","bodyHash":"ec4572c52419123ff9a53016d2982b3cefb4272793288c761534b2974844d908"}
 *
 * Go source:
 * func (f *NodeFactory) DeepCloneReparseModifiers(modifiers *ModifierList) *ModifierList {
 * 	return getDeepCloneVisitor(f, false /*syntheticLocation* /).VisitModifiers(modifiers)
 * }
 */
export function NodeFactory_DeepCloneReparseModifiers(receiver: GoPtr<NodeFactory>, modifiers: GoPtr<ModifierList>): GoPtr<ModifierList> {
  return NodeVisitor_VisitModifiers(getDeepCloneVisitor(receiver, false as bool), modifiers);
}
