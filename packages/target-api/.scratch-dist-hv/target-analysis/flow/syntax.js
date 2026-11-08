import { sourceTransparentExpressionOperand } from "../../source-model/ast.js";
export function sourceFlowUnwrap(build, node) {
    let selected = node;
    while (true) {
        build.step(selected);
        const inner = sourceTransparentExpressionOperand(build.source.ast, selected);
        if (inner === undefined)
            return selected;
        selected = inner;
    }
}
//# sourceMappingURL=syntax.js.map