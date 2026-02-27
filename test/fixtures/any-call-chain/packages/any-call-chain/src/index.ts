import { Console } from "@tsonic/dotnet/System.js";

const add = (a: number, b: number): number => a + b;
const obj: any = { add };

const x = obj.add(2, 3);
const callable: any = obj.add;
const y = callable(4, 5);

Console.WriteLine((x as number) + (y as number));
