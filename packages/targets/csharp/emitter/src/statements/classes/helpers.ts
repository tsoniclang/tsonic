/**
 * Class-related helper functions
 */

/**
 * Capitalize first letter of a string (for generating class names from property names)
 */
export const capitalize = (str: string): string =>
  str.charAt(0).toUpperCase() + str.slice(1);
