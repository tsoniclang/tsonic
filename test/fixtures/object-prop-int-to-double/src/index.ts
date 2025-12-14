// TSN5110: Object property with int literal where number (double) expected
// This should fail because 42 is an integer literal being assigned to
// a property typed as 'number' (double).

// Using interface to test referenceType.structuralMembers resolution
interface Config {
  x: number;
}

const config: Config = { x: 42 };

export function main(): number {
  return config.x;
}
