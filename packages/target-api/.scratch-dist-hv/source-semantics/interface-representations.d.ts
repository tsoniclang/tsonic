import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceDeclaredHeritageEdge, SourceProgramNavigation } from "../source-navigation/index.js";
/**
 * The single base an interface is represented by: every merged declaration of the interface is an interface with no
 * own members (no properties, methods, signatures or index signatures), and all of them together name exactly one
 * `extends` heritage edge. Such an interface has exactly its base's structure, so it is represented by that base.
 * Decided from declarations and authored heritage only (I3: no checked type identity).
 */
export declare function sourceInterfaceRepresentationBase(declaration: Node, ast: AstReader, navigation: Pick<SourceProgramNavigation, "mergedDeclarations" | "declaredHeritage">): SourceDeclaredHeritageEdge | undefined;
//# sourceMappingURL=interface-representations.d.ts.map