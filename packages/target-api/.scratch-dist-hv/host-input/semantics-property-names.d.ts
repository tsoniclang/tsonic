import type { AstReader, SourceFile } from "@tsonic/tsts";
import type { SourceProgramNavigation } from "../source-navigation/types.js";
import type { SourceFileSemantics } from "./semantics-types.js";
import type { SourcePropertyNameIndex } from "../source-semantics/property-names-model.js";
import type { SourceEnumConstantIndex } from "../source-semantics/enum-model.js";
export declare function analyzeSourcePropertyNames(ast: AstReader, files: readonly {
    readonly sourceFile: SourceFile;
    readonly semantics: {
        readonly operations: Pick<SourceFileSemantics["operations"], "propertyName" | "objectLiteralElement" | "propertyAccess" | "elementAccess" | "wellKnownSymbol" | "call" | "callResult">;
        readonly types: Pick<SourceFileSemantics["types"], "selectIndexedAccess" | "isNumberLike" | "isIntersection" | "unionOrIntersectionTypes">;
        readonly declarations: Pick<SourceFileSemantics["declarations"], "typeSymbol" | "symbolDeclarations" | "primarySymbolDeclaration" | "signatureDeclaration">;
    };
}[], navigation: Pick<SourceProgramNavigation, "sourceReferenceFor">, enumConstants: SourceEnumConstantIndex): readonly {
    readonly sourceFile: SourceFile;
    readonly propertyNames: SourcePropertyNameIndex;
}[];
//# sourceMappingURL=semantics-property-names.d.ts.map