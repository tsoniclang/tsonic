import { sourceTypeDescriptorPresentArms } from "../../../source-semantics/descriptor-arms.js";
import { Node_Expression } from "../../../source-navigation/index.js";
import { sourceAnalysisCallSignatures, sourceAnalysisConstructSignatures } from "../../analysis-program.js";
import { sourceTypeDescriptorStructure } from "../../../source-semantics/descriptor-model.js";
import { sourceTypeDescriptorOpenness } from "../../../source-semantics/local-type-flow/uses.js";
/** A generator callable: the published Host generator selection (facts.selections.generator), the one generator predicate (R4). */
export function sourceStorageIsGenerator(source, callable) {
    return source.facts.selections.generator(callable) !== undefined;
}
/** The member access a call selects its callee through (`r.m()`, `r[k]()`, parentheses skipped); undefined otherwise. */
export function sourceStorageCalleeAccess(source, invocation) {
    const { ast } = source;
    let callee = source.navigation.call(invocation)?.callee;
    while (callee !== undefined && ast.is.IsParenthesizedExpression(callee))
        callee = Node_Expression(ast, callee);
    return callee !== undefined && (ast.is.IsPropertyAccessExpression(callee) || ast.is.IsElementAccessExpression(callee))
        ? callee : undefined;
}
/** The receiver expression of a member call (`o.m()` → `o`), from the callee's member witness. */
export function sourceStorageCallReceiver(source, selected) {
    let callee = selected.callee;
    while (source.ast.is.IsParenthesizedExpression(callee)) {
        const inner = source.ast.as.AsParenthesizedExpression(callee)?.Expression;
        if (inner === undefined)
            return undefined;
        callee = inner;
    }
    return source.ast.is.IsPropertyAccessExpression(callee) || source.ast.is.IsElementAccessExpression(callee)
        ? source.navigation.memberAccess(callee)?.receiver : undefined;
}
/** The receiver expression of a member call at an invocation node (sourceStorageCallReceiver over its call witness). */
export function sourceStorageInvocationReceiver(source, invocation) {
    const call = source.navigation.call(invocation);
    return call === undefined ? undefined : sourceStorageCallReceiver(source, call);
}
/**
 * The pointer operation of a marker call, operands by role (the record's operand order is the marker parameter order).
 * undefined: the node is no pointer marker call, or the Host refused it (the refusal is in facts.refusals()).
 */
export function sourceStoragePointerOperation(source, call) {
    if (call === undefined)
        return undefined;
    const record = source.facts.selections.pointerOperation(call);
    if (record === undefined || "kind" in record)
        return undefined;
    const operand = (index) => {
        const selected = record.operands[index];
        if (selected === undefined)
            throw new Error(`Source storage: the ${record.operation} pointer record has no operand ${index}.`);
        return selected;
    };
    const base = { call: record.call, pointee: record.pointee, result: record.result,
        ...(record.location === undefined ? {} : { location: record.location }) };
    switch (record.operation) {
        case "address-of": return Object.freeze({ ...base, operation: record.operation, storageExpression: operand(0),
            ...(record.storageDeclaration === undefined ? {} : { storageDeclaration: record.storageDeclaration }) });
        case "allocate": return Object.freeze({ ...base, operation: record.operation, initialExpression: operand(0) });
        case "load":
        case "hash-pointer": return Object.freeze({ ...base, operation: record.operation, pointerExpression: operand(0) });
        case "store": return Object.freeze({ ...base, operation: record.operation, pointerExpression: operand(0), valueExpression: operand(1) });
        case "equal-pointer": return Object.freeze({ ...base, operation: record.operation, leftExpression: operand(0), rightExpression: operand(1) });
        case "bind-pointer": return Object.freeze({ ...base, operation: record.operation, identityExpression: operand(0),
            readExpression: operand(1), writeExpression: operand(2) });
        case "project-pointer": return Object.freeze({ ...base, operation: record.operation, pointerExpression: operand(0),
            fromSourceExpression: operand(1), toSourceExpression: operand(2) });
    }
}
/** The source pointee of a `project-pointer` call: the first selected method type argument. */
export function sourceStorageProjectedSourcePointee(source, call) {
    const instantiation = source.facts.instantiations.at(call);
    return instantiation === undefined || instantiation.kind === "refused" ? undefined : instantiation.method[0]?.type;
}
/** Whether a callable body can complete normally (fall off its end): the Host completion selection (R-B4-9). */
export function sourceStorageCompletionFallsThrough(completion) {
    return completion.canFallThrough;
}
/**
 * The indexed element slots of every present arm of a storage type, as their read-only flags: the element index of an
 * array or tuple arm (checker number index) and the index signatures of a shape arm (facts.objects.indexes).
 */
export function sourceStorageIndexes(source, type) {
    return sourceTypeDescriptorPresentArms(type).filter(arm => sourceTypeDescriptorOpenness(source.ast, arm) !== "top").flatMap(arm => {
        const structure = sourceTypeDescriptorStructure(arm);
        return structure.kind === "array" || structure.kind === "tuple" ? [{ readonly: structure.readonly }]
            : source.facts.objects.indexes(arm).map(index => ({ readonly: index.readonly }));
    });
}
/** The call and construct signature declarations of every present arm of a storage type (descriptor signatures). */
export function sourceStorageSignatureDeclarations(type) {
    return sourceTypeDescriptorPresentArms(type).flatMap(arm => [...sourceAnalysisCallSignatures(arm), ...sourceAnalysisConstructSignatures(arm)])
        .flatMap(signature => signature.declaration === undefined ? [] : [signature.declaration]);
}
/** Whether a storage type has a call or construct signature in some present arm. */
export function sourceStorageHasSignatures(type) {
    return sourceTypeDescriptorPresentArms(type).some(arm => sourceAnalysisCallSignatures(arm).length !== 0 || sourceAnalysisConstructSignatures(arm).length !== 0);
}
//# sourceMappingURL=host-reads.js.map