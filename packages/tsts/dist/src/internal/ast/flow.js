import { KindUnknown } from "./generated/kinds.js";
import { goReceiverKey, newNode, NodeDefault_AsNode, NodeDefault_BodyData, NodeDefault_ClassLikeData, NodeDefault_Clone, NodeDefault_DeclarationData, NodeDefault_ExportableData, NodeDefault_FlowNodeData, NodeDefault_ForEachChild, NodeDefault_FunctionLikeData, NodeDefault_IterChildren, NodeDefault_LiteralLikeData, NodeDefault_LocalsContainerData, NodeDefault_Modifiers, NodeDefault_Name, NodeDefault_SubtreeFacts, NodeDefault_TemplateLiteralLikeData, NodeDefault_VisitEachChild, NodeDefault_computeSubtreeFacts, NodeDefault_propagateSubtreeFacts, NodeDefault_setModifiers, NodeDefault_subtreeFactsWorker, } from "./spine.js";
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
export const FlowFlagsUnreachable = (1 << 0); // Unreachable code
export const FlowFlagsStart = (1 << 1); // Start of flow graph
export const FlowFlagsBranchLabel = (1 << 2); // Non-looping junction
export const FlowFlagsLoopLabel = (1 << 3); // Looping junction
export const FlowFlagsAssignment = (1 << 4); // Assignment
export const FlowFlagsTrueCondition = (1 << 5); // Condition known to be true
export const FlowFlagsFalseCondition = (1 << 6); // Condition known to be false
export const FlowFlagsSwitchClause = (1 << 7); // Switch statement clause
export const FlowFlagsArrayMutation = (1 << 8); // Potential array mutation
export const FlowFlagsCall = (1 << 9); // Potential assertion call
export const FlowFlagsReduceLabel = (1 << 10); // Temporarily reduce antecedents of label
export const FlowFlagsReferenced = (1 << 11); // Referenced as antecedent once
export const FlowFlagsShared = (1 << 12); // Referenced as antecedent more than once
export const FlowFlagsLabel = (FlowFlagsBranchLabel | FlowFlagsLoopLabel);
export const FlowFlagsCondition = (FlowFlagsTrueCondition | FlowFlagsFalseCondition);
// `*FlowSwitchClauseData` satisfies the `nodeData` interface in Go via its
// embedded `NodeBase`. The method-bearing adapter forwards each `nodeData`
// method to the inherited `NodeDefault` implementation (FlowSwitchClauseData
// adds no overrides), and attaches the concrete receiver under `goReceiverKey`
// so `casts.ts` can recover it.
export function FlowSwitchClauseData_as_nodeData(receiver) {
    return {
        [goReceiverKey]: receiver,
        AsNode: () => NodeDefault_AsNode(receiver),
        ForEachChild: (v) => NodeDefault_ForEachChild(receiver, v),
        IterChildren: () => NodeDefault_IterChildren(receiver),
        VisitEachChild: (v) => NodeDefault_VisitEachChild(receiver, v),
        Clone: (f) => NodeDefault_Clone(receiver, f),
        Name: () => NodeDefault_Name(receiver),
        Modifiers: () => NodeDefault_Modifiers(receiver),
        setModifiers: (modifiers) => NodeDefault_setModifiers(receiver, modifiers),
        FlowNodeData: () => NodeDefault_FlowNodeData(receiver),
        DeclarationData: () => NodeDefault_DeclarationData(receiver),
        ExportableData: () => NodeDefault_ExportableData(receiver),
        LocalsContainerData: () => NodeDefault_LocalsContainerData(receiver),
        FunctionLikeData: () => NodeDefault_FunctionLikeData(receiver),
        ClassLikeData: () => NodeDefault_ClassLikeData(receiver),
        BodyData: () => NodeDefault_BodyData(receiver),
        LiteralLikeData: () => NodeDefault_LiteralLikeData(receiver),
        TemplateLiteralLikeData: () => NodeDefault_TemplateLiteralLikeData(receiver),
        SubtreeFacts: () => NodeDefault_SubtreeFacts(receiver),
        computeSubtreeFacts: () => NodeDefault_computeSubtreeFacts(receiver),
        subtreeFactsWorker: (self) => NodeDefault_subtreeFactsWorker(receiver, self),
        propagateSubtreeFacts: () => NodeDefault_propagateSubtreeFacts(receiver),
    };
}
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
export function NewFlowSwitchClauseData(switchStatement, clauseStart, clauseEnd) {
    const node = {};
    node.SwitchStatement = switchStatement;
    node.ClauseStart = clauseStart;
    node.ClauseEnd = clauseEnd;
    return newNode(KindUnknown, FlowSwitchClauseData_as_nodeData(node), {});
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/flow.go::method::FlowSwitchClauseData.IsEmpty","kind":"method","status":"implemented","sigHash":"a525426173fb32762fc971507ec8632bfc25dc3f4624ff51819b37f9b1c26ab4","bodyHash":"82770f4ffd1830b10b5adb2fac1c9f5bf7c4ef5ddc0335dbcbc443c0a67384b6"}
 *
 * Go source:
 * func (node *FlowSwitchClauseData) IsEmpty() bool {
 * 	return node.ClauseStart == node.ClauseEnd
 * }
 */
export function FlowSwitchClauseData_IsEmpty(receiver) {
    return (receiver.ClauseStart === receiver.ClauseEnd);
}
// `*FlowReduceLabelData` satisfies the `nodeData` interface in Go via its
// embedded `NodeBase`; see `FlowSwitchClauseData_as_nodeData` above.
export function FlowReduceLabelData_as_nodeData(receiver) {
    return {
        [goReceiverKey]: receiver,
        AsNode: () => NodeDefault_AsNode(receiver),
        ForEachChild: (v) => NodeDefault_ForEachChild(receiver, v),
        IterChildren: () => NodeDefault_IterChildren(receiver),
        VisitEachChild: (v) => NodeDefault_VisitEachChild(receiver, v),
        Clone: (f) => NodeDefault_Clone(receiver, f),
        Name: () => NodeDefault_Name(receiver),
        Modifiers: () => NodeDefault_Modifiers(receiver),
        setModifiers: (modifiers) => NodeDefault_setModifiers(receiver, modifiers),
        FlowNodeData: () => NodeDefault_FlowNodeData(receiver),
        DeclarationData: () => NodeDefault_DeclarationData(receiver),
        ExportableData: () => NodeDefault_ExportableData(receiver),
        LocalsContainerData: () => NodeDefault_LocalsContainerData(receiver),
        FunctionLikeData: () => NodeDefault_FunctionLikeData(receiver),
        ClassLikeData: () => NodeDefault_ClassLikeData(receiver),
        BodyData: () => NodeDefault_BodyData(receiver),
        LiteralLikeData: () => NodeDefault_LiteralLikeData(receiver),
        TemplateLiteralLikeData: () => NodeDefault_TemplateLiteralLikeData(receiver),
        SubtreeFacts: () => NodeDefault_SubtreeFacts(receiver),
        computeSubtreeFacts: () => NodeDefault_computeSubtreeFacts(receiver),
        subtreeFactsWorker: (self) => NodeDefault_subtreeFactsWorker(receiver, self),
        propagateSubtreeFacts: () => NodeDefault_propagateSubtreeFacts(receiver),
    };
}
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
export function NewFlowReduceLabelData(target, antecedents) {
    const node = {};
    node.Target = target;
    node.Antecedents = antecedents;
    return newNode(KindUnknown, FlowReduceLabelData_as_nodeData(node), {});
}
//# sourceMappingURL=flow.js.map