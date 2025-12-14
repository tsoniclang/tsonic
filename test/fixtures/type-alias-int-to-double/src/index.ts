// TSN5110: Type alias object property with int literal where number expected
// This should fail because 42 is an integer literal being assigned to
// a property typed as 'number' (double) via type alias.

// Using type alias (not interface) to test referenceType.structuralMembers resolution
type Config = { x: number };

const config: Config = { x: 42 };

export function main(): number {
  return config.x;
}
