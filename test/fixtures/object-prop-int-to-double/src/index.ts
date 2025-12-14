// TSN5110: Object property with int literal where number (double) expected
// This should fail because 42 is an integer literal being assigned to
// a property typed as 'number' (double).

// Using inline object type (not type alias) to ensure structural validation
const config: { x: number } = { x: 42 };

export function main(): number {
  return config.x;
}
