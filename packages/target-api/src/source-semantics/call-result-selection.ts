import type {
  AstReader,
  Node,
  Type,
  TypeCheckerQueries,
} from "@tsonic/tsts";

export type ResolvedSourceCallInfo = NonNullable<
  ReturnType<TypeCheckerQueries["getResolvedCallInfo"]>
>;

export interface SourceCallResultSelection {
  readonly authoredTypeNode?: Node;
  readonly selectedReturnType: Type;
  readonly resultType: Type;
}

export function selectSourceCallResult(
  ast: AstReader,
  checker: TypeCheckerQueries,
  source: ResolvedSourceCallInfo,
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
  return Object.freeze({
    ...(authoredTypeNode === undefined ? {} : { authoredTypeNode }),
    selectedReturnType,
    resultType: source.sourceResultType,
  });
}
