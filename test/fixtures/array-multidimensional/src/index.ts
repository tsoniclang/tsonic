import { Console } from "@tsonic/dotnet/System.js";

function getElement(matrix: number[][]): number {
  return matrix[0][1];
}

function createMatrix(): number[][] {
  return [
    [1, 2],
    [3, 4],
  ];
}

const matrix = createMatrix();
Console.writeLine(`Matrix[0][0]: ${matrix[0][0]}`);
Console.writeLine(`Matrix[0][1]: ${getElement(matrix)}`);
Console.writeLine(`Matrix[1][0]: ${matrix[1][0]}`);
Console.writeLine(`Matrix[1][1]: ${matrix[1][1]}`);
