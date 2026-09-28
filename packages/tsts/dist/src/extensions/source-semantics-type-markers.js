import { Node_Elements, Node_TypeArguments } from "../internal/ast/ast.js";
import { KindTupleType } from "../internal/ast/generated/kinds.js";
export function createSourceTypeMarkerReferenceFact(typeReference, marker) {
    const arguments_ = Node_TypeArguments(typeReference) ?? [];
    switch (marker) {
        case "raw-pointer":
            return arguments_.length === 0
                ? { kind: "raw-pointer", value: { representation: "opaque-identity" } }
                : undefined;
        case "pointer": {
            const pointee = arguments_[0];
            return arguments_.length === 1 && pointee !== undefined
                ? { kind: "pointer", value: { pointee, mutability: "readwrite" } }
                : undefined;
        }
        case "fixed-array":
            return { kind: "marker", value: { kind: "type-marker", marker } };
        case "js-string":
            return arguments_.length === 0
                ? { kind: "marker", value: { kind: "type-marker", marker } }
                : undefined;
        case "function-pointer": {
            const parameterList = arguments_[0];
            const result = arguments_[1];
            if (arguments_.length !== 2 || parameterList === undefined || result === undefined)
                return undefined;
            const parameters = parameterList.Kind === KindTupleType
                ? (Node_Elements(parameterList) ?? []).filter((node) => node !== undefined)
                : [parameterList];
            return { kind: "function-pointer", value: { parameters, result, abi: ["target-default"] } };
        }
    }
}
//# sourceMappingURL=source-semantics-type-markers.js.map