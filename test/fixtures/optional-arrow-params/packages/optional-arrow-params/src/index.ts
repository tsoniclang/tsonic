import { Console } from "@tsonic/dotnet/System.js";

const formatError = (
  code: string,
  message: string,
  details?: string
): string => {
  if (details === undefined) {
    return `${code}:${message}`;
  }
  return `${code}:${message}:${details}`;
};

export function main(): void {
  Console.WriteLine(formatError("bad_request", "Missing query"));
  Console.WriteLine(formatError("bad_request", "Missing query", "from"));
}
