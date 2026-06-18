import type { bool, int, uint } from "@tsonic/core/types.js";
import type { GoPtr } from "../../go/compat.js";
import type { Node, NodeBase, nodeData } from "./spine.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/flow.go::type::FlowFlags","kind":"type","status":"implemented","sigHash":"d09a53f6cfcd44e95af32ba2d5205770f993a6e18482a7f7070e2b9ad420f988","bodyHash":"bb5236c2a3e5e355ea76c5384c325fa4ff9f69b62fea58ef671b4acb32db59d8"}
 *
 * Go source:
 * FlowFlags uint32
 */
export type FlowFlags = uint;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/flow.go::constGroup::FlowFlagsUnreachable+FlowFlagsStart+FlowFlagsBranchLabel+FlowFlagsLoopLabel+FlowFlagsAssignment+FlowFlagsTrueCondition+FlowFlagsFalseCondition+FlowFlagsSwitchClause+FlowFlagsArrayMutation+FlowFlagsCall+FlowFlagsReduceLabel+FlowFlagsReferenced+FlowFlagsShared+FlowFlagsLabel+FlowFlagsCondition","kind":"constGroup","status":"implemented","sigHash":"4527033a929b1a7f493119369ab9d9020b3f24f3b6add22e704cd478857602b3","bodyHash":"67f67dfaff69d9c081b7ff96ae0a0b777c9540ad7d6a46e21ccf5422c3310fe2"}
 *
 * Go source:
 * const (
 * 	FlowFlagsUnreachable    FlowFlags = 1 << 0  // Unreachable code
 * 	FlowFlagsStart          FlowFlags = 1 << 1  // Start of flow graph
 * 	FlowFlagsBranchLabel    FlowFlags = 1 << 2  // Non-looping junction
 * 	FlowFlagsLoopLabel      FlowFlags = 1 << 3  // Looping junction
 * 	FlowFlagsAssignment     FlowFlags = 1 << 4  // Assignment
 * 	FlowFlagsTrueCondition  FlowFlags = 1 << 5  // Condition known to be true
 * 	FlowFlagsFalseCondition FlowFlags = 1 << 6  // Condition known to be false
 * 	FlowFlagsSwitchClause   FlowFlags = 1 << 7  // Switch statement clause
 * 	FlowFlagsArrayMutation  FlowFlags = 1 << 8  // Potential array mutation
 * 	FlowFlagsCall           FlowFlags = 1 << 9  // Potential assertion call
 * 	FlowFlagsReduceLabel    FlowFlags = 1 << 10 // Temporarily reduce antecedents of label
 * 	FlowFlagsReferenced     FlowFlags = 1 << 11 // Referenced as antecedent once
 * 	FlowFlagsShared         FlowFlags = 1 << 12 // Referenced as antecedent more than once
 * 	FlowFlagsLabel                    = FlowFlagsBranchLabel | FlowFlagsLoopLabel
 * 	FlowFlagsCondition                = FlowFlagsTrueCondition | FlowFlagsFalseCondition
 * )
 */
export declare const FlowFlagsUnreachable: FlowFlags;
export declare const FlowFlagsStart: FlowFlags;
export declare const FlowFlagsBranchLabel: FlowFlags;
export declare const FlowFlagsLoopLabel: FlowFlags;
export declare const FlowFlagsAssignment: FlowFlags;
export declare const FlowFlagsTrueCondition: FlowFlags;
export declare const FlowFlagsFalseCondition: FlowFlags;
export declare const FlowFlagsSwitchClause: FlowFlags;
export declare const FlowFlagsArrayMutation: FlowFlags;
export declare const FlowFlagsCall: FlowFlags;
export declare const FlowFlagsReduceLabel: FlowFlags;
export declare const FlowFlagsReferenced: FlowFlags;
export declare const FlowFlagsShared: FlowFlags;
export declare const FlowFlagsLabel: FlowFlags;
export declare const FlowFlagsCondition: FlowFlags;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/flow.go::type::FlowNode","kind":"type","status":"implemented","sigHash":"1020774d078a17b20d58203b3bbda4393da72f30962bf89c05b6de2b6fb87bc1","bodyHash":"478bcc21d24466c3b43e5938a49ecaa568b4b21313135454d6f7e8171b906e72"}
 *
 * Go source:
 * FlowNode struct {
 * 	Flags       FlowFlags
 * 	Node        *Node     // Associated AST node
 * 	Antecedent  *FlowNode // Antecedent for all but FlowLabel
 * 	Antecedents *FlowList // Linked list of antecedents for FlowLabel
 * }
 */
export interface FlowNode {
    Flags: FlowFlags;
    Node: GoPtr<Node>;
    Antecedent: GoPtr<FlowNode>;
    Antecedents: GoPtr<FlowList>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/flow.go::type::FlowList","kind":"type","status":"implemented","sigHash":"7cce7740307e71d2b15035221079c8b11d4708ad269e085d57c504b719b700a4","bodyHash":"b9d7ff8ac7acbdb16a894e114682f05a27d3dca3b1fe3af67215f359266bb9c7"}
 *
 * Go source:
 * FlowList struct {
 * 	Flow *FlowNode
 * 	Next *FlowList
 * }
 */
export interface FlowList {
    Flow: GoPtr<FlowNode>;
    Next: GoPtr<FlowList>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/flow.go::type::FlowLabel","kind":"type","status":"implemented","sigHash":"084d06c33b0e2642ffd5fba9798d4ea2858d4364899db76eb87682c3f5d3985c","bodyHash":"0a64c4f310f3b04df0074d053a744813f08c0bf70465619256b3a0e3633a892d"}
 *
 * Go source:
 * FlowLabel = FlowNode
 */
export type FlowLabel = FlowNode;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/flow.go::type::FlowSwitchClauseData","kind":"type","status":"implemented","sigHash":"752719aacafe9f4e1a95d1c94780bf847c0764fed0c856e5cc5e5f5c493004e5","bodyHash":"6e4dc265a8026e8f0c1f2740a75f06d6436e09aa0de5f25c452d77c9ba6b008e"}
 *
 * Go source:
 * FlowSwitchClauseData struct {
 * 	NodeBase
 * 	SwitchStatement *Node
 * 	ClauseStart     int32 // Start index of case/default clause range
 * 	ClauseEnd       int32 // End index of case/default clause range
 * }
 */
export interface FlowSwitchClauseData extends NodeBase {
    SwitchStatement: GoPtr<Node>;
    ClauseStart: int;
    ClauseEnd: int;
}
export declare function FlowSwitchClauseData_as_nodeData(receiver: GoPtr<FlowSwitchClauseData>): nodeData;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/flow.go::func::NewFlowSwitchClauseData","kind":"func","status":"implemented","sigHash":"e15e8d97d005dedd66460b3ad33dedd7e31ff2cb70f2f88e558b073fdfe0c506","bodyHash":"38cc6c79f6363d9a057716fbf7cf94d49dbebac7025e38092a50e48874f5f9bf"}
 *
 * Go source:
 * func NewFlowSwitchClauseData(switchStatement *Node, clauseStart int, clauseEnd int) *Node {
 * 	node := &FlowSwitchClauseData{}
 * 	node.SwitchStatement = switchStatement
 * 	node.ClauseStart = int32(clauseStart)
 * 	node.ClauseEnd = int32(clauseEnd)
 * 	return newNode(KindUnknown, node, NodeFactoryHooks{})
 * }
 */
export declare function NewFlowSwitchClauseData(switchStatement: GoPtr<Node>, clauseStart: int, clauseEnd: int): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/flow.go::method::FlowSwitchClauseData.IsEmpty","kind":"method","status":"implemented","sigHash":"a525426173fb32762fc971507ec8632bfc25dc3f4624ff51819b37f9b1c26ab4","bodyHash":"82770f4ffd1830b10b5adb2fac1c9f5bf7c4ef5ddc0335dbcbc443c0a67384b6"}
 *
 * Go source:
 * func (node *FlowSwitchClauseData) IsEmpty() bool {
 * 	return node.ClauseStart == node.ClauseEnd
 * }
 */
export declare function FlowSwitchClauseData_IsEmpty(receiver: GoPtr<FlowSwitchClauseData>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/flow.go::type::FlowReduceLabelData","kind":"type","status":"implemented","sigHash":"c8600db3a6774589ea77d8cf9cadb98ea46d6a725ba6b6e5bd55bf3957c16231","bodyHash":"205195fa2e10565fb72b5449cd03b651c20f6a2fc716395519c57055a4075bf4"}
 *
 * Go source:
 * FlowReduceLabelData struct {
 * 	NodeBase
 * 	Target      *FlowLabel // Target label
 * 	Antecedents *FlowList  // Temporary antecedent list
 * }
 */
export interface FlowReduceLabelData extends NodeBase {
    Target: GoPtr<FlowLabel>;
    Antecedents: GoPtr<FlowList>;
}
export declare function FlowReduceLabelData_as_nodeData(receiver: GoPtr<FlowReduceLabelData>): nodeData;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/flow.go::func::NewFlowReduceLabelData","kind":"func","status":"implemented","sigHash":"2435e71bf8dd8bd481053d2bf8c1647fc24926929894825be450304fcf0bd28d","bodyHash":"31ebda0c1374d118cbe6a1a346972745e5483093f81931c644c81829fca5e2c8"}
 *
 * Go source:
 * func NewFlowReduceLabelData(target *FlowLabel, antecedents *FlowList) *Node {
 * 	node := &FlowReduceLabelData{}
 * 	node.Target = target
 * 	node.Antecedents = antecedents
 * 	return newNode(KindUnknown, node, NodeFactoryHooks{})
 * }
 */
export declare function NewFlowReduceLabelData(target: GoPtr<FlowLabel>, antecedents: GoPtr<FlowList>): GoPtr<Node>;
//# sourceMappingURL=flow.d.ts.map