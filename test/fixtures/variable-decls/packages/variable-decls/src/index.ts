import { int, byte, short, long, float } from "@tsonic/core/types.js";
import { Console } from "@tsonic/dotnet/System.js";

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

Console.WriteLine(`Inferred double: ${inferredDouble}`);
Console.WriteLine(`Inferred string: ${inferredString}`);
Console.WriteLine(`Inferred bool: ${inferredBool}`);
Console.WriteLine(`Explicit int: ${explicitInt}`);
Console.WriteLine(`Explicit byte: ${explicitByte}`);
Console.WriteLine(`Explicit long: ${explicitLong}`);
Console.WriteLine(`Explicit float: ${explicitFloat}`);
Console.WriteLine(`Explicit string: ${explicitString}`);
Console.WriteLine(`Mutable int: ${mutableInt}`);
Console.WriteLine(`Mutable string: ${mutableString}`);
