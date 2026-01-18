import { struct } from "@tsonic/core/types.js";
import { Console, Math } from "@tsonic/dotnet/System.js";

interface Point extends struct {
  x: number;
  y: number;
}

function createPoint(x: number, y: number): Point {
  return { x, y };
}

function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.Sqrt(dx * dx + dy * dy);
}

const p1 = createPoint(0, 0);
const p2 = createPoint(3, 4);

Console.WriteLine(`P1: (${p1.x}, ${p1.y})`);
Console.WriteLine(`P2: (${p2.x}, ${p2.y})`);
Console.WriteLine(`Distance: ${distance(p1, p2)}`);
