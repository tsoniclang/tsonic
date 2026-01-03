import { Console } from "@tsonic/dotnet/System.js";

// Module-level constants without explicit type annotations
const PI = 3.14159;
const MESSAGE = "Hello, World!";
const COUNT = 42;
const IS_ENABLED = true;

Console.writeLine(`PI: ${PI}`);
Console.writeLine(`MESSAGE: ${MESSAGE}`);
Console.writeLine(`COUNT: ${COUNT}`);
Console.writeLine(`IS_ENABLED: ${IS_ENABLED}`);
