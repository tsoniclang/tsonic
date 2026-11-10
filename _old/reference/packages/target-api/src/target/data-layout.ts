import type { ProviderDeclarationIdentity } from "@tsonic/tsts";

export type TsonicDataLayoutIdentity = Pick<
  ProviderDeclarationIdentity,
  "providerId" | "providerModuleId" | "moduleSpecifier"
> & {
  readonly providerVersion: string;
  readonly exportId: string;
};

export interface TsonicDataLayoutDescriptor {
  readonly fingerprint: string;
  readonly byteOrder: "little" | "big";
  readonly addressWidth: 32 | 64;
}

export interface TsonicDataLayoutRegistration {
  readonly providerDeclaration: TsonicDataLayoutIdentity;
  readonly descriptor: TsonicDataLayoutDescriptor;
}
