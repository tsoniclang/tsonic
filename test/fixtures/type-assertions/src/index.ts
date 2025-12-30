import { int, byte, short, long, float } from "@tsonic/core/types.js";
import { Console } from "@tsonic/dotnet/System.js";

// Numeric type assertions
const intFromLiteral = 1000 as int;
const byteFromLiteral = 255 as byte;
const shortFromLiteral = 1000 as short;
const longFromLiteral = 1000000 as long;
const floatFromLiteral = 1.5 as float;

Console.writeLine(`int: ${intFromLiteral}`);
Console.writeLine(`byte: ${byteFromLiteral}`);
Console.writeLine(`short: ${shortFromLiteral}`);
Console.writeLine(`long: ${longFromLiteral}`);
Console.writeLine(`float: ${floatFromLiteral}`);

// Reference type assertions
class Animal {
  name!: string;
}

class Dog extends Animal {
  breed!: string;
}

function testDownCast(animal: Animal): Dog {
  const dog = animal as Dog;
  return dog;
}

const dog = new Dog();
dog.name = "Buddy";
dog.breed = "Golden";

const animal: Animal = dog;
const backToDog = testDownCast(animal);
Console.writeLine(`Dog name: ${backToDog.name}`);
Console.writeLine(`Dog breed: ${backToDog.breed}`);
