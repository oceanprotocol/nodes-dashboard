/**
 * Quotes a value for a POSIX shell. Single quotes because inside them the shell expands nothing, so
 * `$(…)`, backticks and `;` stay literal; double quotes would still run `$(…)`. A `'` can't be escaped
 * inside single quotes, so it closes the quote, adds an escaped `'`, and reopens.
 */
export const shellQuote = (value: string): string => `'${value.replace(/'/g, `'\\''`)}'`;
