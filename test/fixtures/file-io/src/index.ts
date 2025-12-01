// Test BCL imports - File I/O operations
import { Console } from "@tsonic/dotnet/System";
import { File, Path } from "@tsonic/dotnet/System.IO";

export function main(): void {
  const testFile = Path.Combine(".", "test.txt");

  // Write to file
  File.WriteAllText(testFile, "Hello from Tsonic with BCL!");

  // Read from file
  const content = File.ReadAllText(testFile);
  Console.WriteLine(`File content: ${content}`);

  // Check if file exists
  const exists = File.Exists(testFile);
  Console.WriteLine(`File exists: ${exists}`);

  // Clean up
  File.Delete(testFile);
  Console.WriteLine("File deleted");
}
