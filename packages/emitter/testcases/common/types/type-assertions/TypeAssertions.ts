import { int, byte, short, long, float } from "@tsonic/core/types.js";

// =============================================================================
// Module-level numeric assertions (Bug 1: should emit correct CLR type)
// =============================================================================

export const intFromLiteral = 1000 as int;
export const byteFromLiteral = 255 as byte;
export const shortFromLiteral = 1000 as short;
export const longFromLiteral = 1000000 as long;
export const floatFromLiteral = 1.5 as float;
export const doubleFromLiteral = 1.5 as number;

// =============================================================================
// Reference type assertions (Bug 2: should emit C# cast)
// =============================================================================

class Animal {
  name!: string;
}

class Dog extends Animal {
  breed!: string;
}

// Module-level reference type cast
export const someObject: object = new Dog();
export const asAnimal = someObject as Animal;

// =============================================================================
// Function with reference type casts
// =============================================================================

export function testReferenceCasts(obj: object): Animal {
  const animal = obj as Animal;
  return animal;
}

export function testDownCast(animal: Animal): Dog {
  const dog = animal as Dog;
  return dog;
}
