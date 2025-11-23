// Test BCL imports - File I/O operations
import { File } from "System.IO";
import { Path } from "System.IO";

export function main(): void {
  const testFile = Path.Combine(".", "test.txt");

  // Write to file
  File.WriteAllText(testFile, "Hello from Tsonic with BCL!");

  // Read from file
  const content = File.ReadAllText(testFile);
  console.log(`File content: ${content}`);

  // Check if file exists
  const exists = File.Exists(testFile);
  console.log(`File exists: ${exists}`);

  // Clean up
  File.Delete(testFile);
  console.log("File deleted");
}