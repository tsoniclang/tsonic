// Test BCL imports - File I/O operations
import { Console } from "@tsonic/dotnet/System.js";
import { File, Path } from "@tsonic/dotnet/System.IO.js";

export function main(): void {
  const testFile = Path.combine(".", "test.txt");

  // Write to file
  File.writeAllText(testFile, "Hello from Tsonic with BCL!");

  // Read from file
  const content = File.readAllText(testFile);
  Console.writeLine(`File content: ${content}`);

  // Check if file exists
  const exists = File.exists(testFile);
  Console.writeLine(`File exists: ${exists}`);

  // Clean up
  File.delete(testFile);
  Console.writeLine("File deleted");
}
