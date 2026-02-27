import { Console } from "@tsonic/dotnet/System.js";

const obj: any = { a: 1, b: 0 };
obj.b = 2;

const key = "b";
const sum = obj.a + obj[key];

Console.WriteLine(sum as number);
