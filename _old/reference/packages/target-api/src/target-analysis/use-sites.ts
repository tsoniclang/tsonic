export interface TargetUseSiteRef {
  readonly subject: object;
  readonly role: string;
  readonly enclosingContract: string;
  readonly specialization?: string;
}

export function targetUseSiteRef(
  subject: object,
  role: string,
  enclosingContract: string,
  specialization?: string,
): TargetUseSiteRef {
  if (role.length === 0 || enclosingContract.length === 0) {
    throw new Error(
      "A target use site requires non-empty role and enclosing-contract identities.",
    );
  }
  return Object.freeze({
    subject,
    role,
    enclosingContract,
    ...(specialization === undefined ? {} : { specialization }),
  });
}

export function targetUseSiteIdentity(
  use: Omit<TargetUseSiteRef, "subject">,
): string {
  return encodeIdentityParts([
    use.enclosingContract,
    use.specialization ?? "",
    use.role,
  ]);
}

function encodeIdentityParts(parts: readonly string[]): string {
  return parts.map((part) => `${part.length}:${part}`).join("|");
}
