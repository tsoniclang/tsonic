import { Console } from "@tsonic/dotnet/System.js";

declare global {
  interface ImportMeta {
    readonly url: string;
    readonly filename: string;
    readonly dirname: string;
  }
}

const url = import.meta.url;
const filename = import.meta.filename;
const dirname = import.meta.dirname;

Console.WriteLine(url);
Console.WriteLine(filename);
Console.WriteLine(dirname);
