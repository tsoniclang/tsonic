import { sourceCallArgumentCorrespondences } from "../../source-navigation/callable-arguments.js";
/** Argument-to-parameter rows of the navigation call witness at `call`, memoized per query (keyed by the call Node). */
export function createSourceCallArgumentCorrespondenceQuery(source) {
    const correspondences = new Map();
    return (call) => {
        if (!correspondences.has(call))
            correspondences.set(call, sourceCallArgumentCorrespondences({ ast: source.ast, navigation: source.navigation }, call));
        return correspondences.get(call);
    };
}
//# sourceMappingURL=call-arguments.js.map