import { JsonSerializer } from "@tsonic/dotnet/System.Text.Json.js";

export function parse<T>(text: string): T {
  return JsonSerializer.Deserialize<T>(text)!;
}
