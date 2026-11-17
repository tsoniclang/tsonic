import type { Node } from "@tsonic/tsts";
import type { SourcePresence } from "../public/source/contracts.js";
import type { SourceNodeNavigationFacts, SourceNodeReference } from "../source-model/navigation.js";
import type { SourceInputComponent, SourceInputSignature } from "./identities.js";

export interface SourceInputHeritageEdge {
  readonly kind: "extends" | "implements";
  readonly sourceDeclaration: Node;
  readonly heritage: Node;
  readonly target: SourceNodeReference;
  readonly typeArguments: readonly Node[];
  readonly selected: SourceInputComponent;
  readonly arguments: readonly SourceInputComponent[];
}

export type SourceInputHeritage = { readonly kind: "resolved"; readonly edges: readonly SourceInputHeritageEdge[] }
  | { readonly kind: "unresolved"; readonly heritage: Node; readonly reason: string };

export interface SourceInputConstructorSignature {
  readonly identity: SourceInputSignature;
  readonly base: SourcePresence<{ readonly declaration: Node; readonly identity: SourceInputSignature }>;
  readonly parameters: readonly {
    readonly parameterIndex: number;
    readonly parameterName: string;
    readonly parameterDeclaration: Node | undefined;
    readonly authoredTypeNode: Node | undefined;
    readonly value: SourceInputComponent;
    readonly acceptsOmission: boolean;
    readonly rest: boolean;
  }[];
}

export type SourceInputConstructors = { readonly kind: "resolved"; readonly declaration: Node;
  readonly witness: "implicit" | "declared"; readonly signatures: readonly SourceInputConstructorSignature[] }
  | { readonly kind: "unresolved"; readonly declaration: Node; readonly reason: string };

export interface SourceInputNodeNavigationQueries extends Omit<SourceNodeNavigationFacts,
  "classConstructors" | "declaredHeritage" | "declaredHeritagePath" | "profileDeclaration" | "callableRoles" | "enclosing"> {
  classConstructors(declaration: Node): SourceInputConstructors;
  declaredHeritage(declaration: Node): SourceInputHeritage;
  declaredHeritagePath(source: Node, target: Node): SourceInputHeritage | { readonly kind: "unrelated" };
}
