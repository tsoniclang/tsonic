import { Console } from "@tsonic/dotnet/System.js";
import {
  DefaultHttpContext,
  PathString,
  QueryString,
} from "@tsonic/aspnetcore/Microsoft.AspNetCore.Http.js";

export function main(): void {
  Console.writeLine("=== ASP.NET Core E2E ===");

  const ctx = new DefaultHttpContext();
  ctx.request.method = "GET";
  ctx.request.path = new PathString("/hello");
  ctx.request.queryString = new QueryString("?x=1&y=2");

  ctx.response.statusCode = 204;

  Console.writeLine(
    `${ctx.request.method} ${ctx.request.path.toString()} ${ctx.request.queryString.toString()}`
  );
  Console.writeLine(`Status: ${ctx.response.statusCode}`);
}
