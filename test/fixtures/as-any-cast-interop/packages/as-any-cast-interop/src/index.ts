import { Console } from "@tsonic/dotnet/System.js";

const dyn = { left: 7, right: 8 } as any;

const total = dyn.left + dyn.right;

Console.WriteLine(total as number);
