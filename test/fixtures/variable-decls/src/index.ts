import { int, byte, short, long, float } from "@tsonic/core/types.js";
import { Console } from "@tsonic/dotnet/System";

// Inferred types (module level)
const inferredDouble = 42.5;
const inferredInt = 42;
const inferredString = "hello";
const inferredBool = true;

// Explicit type annotations (module level)
const explicitInt: int = 42;
const explicitByte: byte = 255;
const explicitShort: short = 1000;
const explicitLong: long = 1000000;
const explicitFloat: float = 1.5;
const explicitDouble: number = 1.5;
const explicitString: string = "world";
const explicitBool: boolean = false;

// Mutable variables
let mutableInt: int = 0;
let mutableString: string = "";

mutableInt = 100;
mutableString = "updated";

Console.writeLine(`Inferred double: ${inferredDouble}`);
Console.writeLine(`Inferred string: ${inferredString}`);
Console.writeLine(`Inferred bool: ${inferredBool}`);
Console.writeLine(`Explicit int: ${explicitInt}`);
Console.writeLine(`Explicit byte: ${explicitByte}`);
Console.writeLine(`Explicit long: ${explicitLong}`);
Console.writeLine(`Explicit float: ${explicitFloat}`);
Console.writeLine(`Explicit string: ${explicitString}`);
Console.writeLine(`Mutable int: ${mutableInt}`);
Console.writeLine(`Mutable string: ${mutableString}`);
