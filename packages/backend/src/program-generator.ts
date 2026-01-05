/**
 * Program.cs generation for entry point wrapper
 */

import { EntryInfo } from "./types.js";

/**
 * Generate Program.cs content with Main method
 */
export const generateProgramCs = (entryInfo: EntryInfo): string => {
  const returnType = entryInfo.isAsync ? "async Task" : "void";
  const awaitKeyword = entryInfo.isAsync ? "await " : "";

  const usings = ["using System;", "using System.Threading.Tasks;"];

  return `${usings.join("\n")}

public static class Program
{
    public static ${returnType} Main(string[] args)
    {
        ${awaitKeyword}global::${entryInfo.namespace}.${entryInfo.className}.${entryInfo.methodName}();
    }
}
`;
};
