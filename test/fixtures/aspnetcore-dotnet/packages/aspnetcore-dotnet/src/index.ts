import { Console } from "@tsonic/dotnet/System.js";
import {
  DefaultHttpContext,
  PathString,
  QueryString,
} from "@tsonic/aspnetcore/Microsoft.AspNetCore.Http.js";

export function main(): void {
  Console.WriteLine("=== ASP.NET Core E2E ===");

  const ctx = new DefaultHttpContext();
  ctx.Request.Method = "GET";
  ctx.Request.Path = new PathString("/hello");
  ctx.Request.QueryString = new QueryString("?x=1&y=2");

  ctx.Response.StatusCode = 204;

  Console.WriteLine(
    `${ctx.Request.Method} ${ctx.Request.Path.ToString()} ${ctx.Request.QueryString.ToString()}`
  );
  Console.WriteLine(`Status: ${ctx.Response.StatusCode}`);
}
