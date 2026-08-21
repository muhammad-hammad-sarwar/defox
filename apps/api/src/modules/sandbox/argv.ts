/**
 * E2B's current SDK accepts a shell command string. Keep that shell boundary in
 * one place and quote every argv element before handing it to the SDK. The
 * planned E2B template will provide a `run-argv` executable with the same
 * contract; callers already construct an executable plus argv rather than a
 * shell program.
 */
export interface SandboxArgvCommand {
  executable: string;
  args?: readonly string[];
}

function quotePosixShell(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function assertArgvValue(value: string, label: string): void {
  if (value.length === 0) throw new Error(`${label} must not be empty`);
  if (value.includes("\0")) throw new Error(`${label} must not contain a NUL byte`);
}

/**
 * Serializes a fixed executable and argv list for E2B's string-only command
 * API. Every value is single-quoted, so repository metadata remains data even
 * when it contains whitespace, shell metacharacters, or command substitutions.
 */
export function buildSandboxArgvCommand({
  executable,
  args = [],
}: SandboxArgvCommand): string {
  assertArgvValue(executable, "executable");
  for (const arg of args) assertArgvValue(arg, "argument");
  return [executable, ...args].map(quotePosixShell).join(" ");
}
