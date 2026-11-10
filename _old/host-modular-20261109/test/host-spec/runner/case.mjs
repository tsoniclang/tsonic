/**
 * @template Input
 * @template {import("./contracts.d.mts").ClosableProgram} Program
 * @param {(input: Input) => Program | Promise<Program>} normalEntry
 * @param {Input} input
 * @param {(program: Program) => void | Promise<void>} verify
 * @returns {Promise<void>}
 */
export async function runHostCase(normalEntry, input, verify) {
  const program = await normalEntry(input);
  /** @type {{error: unknown} | undefined} */
  let verificationFailure;
  try {
    await verify(program);
  } catch (error) {
    verificationFailure = { error };
    throw error;
  } finally {
    try {
      program.close();
    } catch (cleanupError) {
      if (verificationFailure !== undefined) {
        throw new AggregateError([verificationFailure.error, cleanupError],
          "Host case verification and close both failed");
      }
      throw cleanupError;
    }
  }
}
