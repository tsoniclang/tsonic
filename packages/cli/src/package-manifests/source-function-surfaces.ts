export type SourceFunctionParameterSurface = {
  readonly prefixText: string;
  readonly typeText: string;
};

export type SourceFunctionSignatureSurface = {
  readonly typeParametersText: string;
  readonly typeParameterCount: number;
  readonly parameters: readonly SourceFunctionParameterSurface[];
  readonly returnTypeText: string;
};

export const appendSourceFunctionSignature = (
  signaturesByName: Map<string, SourceFunctionSignatureSurface[]>,
  name: string,
  signature: SourceFunctionSignatureSurface
): void => {
  const signatures = signaturesByName.get(name) ?? [];
  signatures.push(signature);
  signaturesByName.set(name, signatures);
};

export const renderSourceFunctionParametersText = (
  signature: Pick<SourceFunctionSignatureSurface, "parameters">
): string =>
  signature.parameters
    .map((parameter) => `${parameter.prefixText}${parameter.typeText}`)
    .join(", ");

export const selectPreferredSourceFunctionSignature = (opts: {
  readonly targetParameterCount: number;
  readonly targetTypeParameterCount: number;
  readonly sourceSignatures: readonly SourceFunctionSignatureSurface[];
}): SourceFunctionSignatureSurface | undefined => {
  const exact = opts.sourceSignatures.find((signature) => {
    return (
      signature.parameters.length === opts.targetParameterCount &&
      signature.typeParameterCount === opts.targetTypeParameterCount
    );
  });
  return exact ?? opts.sourceSignatures[0];
};
