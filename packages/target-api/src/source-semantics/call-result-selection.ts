import type {
  AstReader,
  Node,
  Type,
  TypeCheckerQueries,
} from "@tsonic/tsts";
import type { SourceProviderSignatureSelection } from "./provider-signature.js";

export type ResolvedSourceCallInfo = NonNullable<
  ReturnType<TypeCheckerQueries["getResolvedCallInfo"]>
>;

export interface SourceCallResultSelection {
  readonly authoredTypeNode?: Node;
  readonly selectedReturnType: Type;
  readonly resultType: Type;
  readonly providerSignature?: SourceProviderSignatureSelection;
}

export function selectSourceCallResult(
  ast: AstReader,
  checker: TypeCheckerQueries,
  source: ResolvedSourceCallInfo,
  providerSignature: (declaration: Node | undefined) => SourceProviderSignatureSelection | undefined,
): SourceCallResultSelection | undefined {
  if (source.sourceSelectedSignatureKind !== "resolved") {
    return undefined;
  }
  const selectedReturnType = checker.getReturnTypeOfSignature(
    source.selectedSignature,
  );
  if (selectedReturnType === undefined) {
    return undefined;
  }
  const declaration = checker.getSignatureDeclaration(source.selectedSignature);
  const authoredTypeNode = ast.typeNode(declaration);
  const provider = providerSignature(declaration);
  return Object.freeze({
    ...(provider === undefined ? {} : { providerSignature: provider }),
    ...(authoredTypeNode === undefined ? {} : { authoredTypeNode }),
    selectedReturnType,
    resultType: source.sourceResultType,
  });
}
