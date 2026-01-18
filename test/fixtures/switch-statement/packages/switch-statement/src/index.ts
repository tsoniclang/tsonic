import { Console } from "@tsonic/dotnet/System.js";

function getDayType(day: number): string {
  switch (day) {
    case 0:
    case 6:
      return "weekend";
    case 1:
    case 2:
    case 3:
    case 4:
    case 5:
      return "weekday";
    default:
      return "invalid";
  }
}

Console.WriteLine(`Day 0: ${getDayType(0)}`);
Console.WriteLine(`Day 3: ${getDayType(3)}`);
Console.WriteLine(`Day 6: ${getDayType(6)}`);
Console.WriteLine(`Day 7: ${getDayType(7)}`);
