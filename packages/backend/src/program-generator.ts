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

  return `using System;
using System.Threading.Tasks;
using Tsonic.Runtime;
using ${entryInfo.namespace};

public static class Program
{
    public static ${returnType} Main(string[] args)
    {
        ${awaitKeyword}${entryInfo.className}.${entryInfo.methodName}();
    }
}
`;
};
