import { describe, expect, it } from "vitest";

import { buildSandboxArgvCommand } from "./argv.js";

describe("buildSandboxArgvCommand", () => {
  it("quotes repository-derived values as individual arguments", () => {
    const command = buildSandboxArgvCommand({
      executable: "git",
      args: [
        "clone",
        "--",
        "https://github.com/example/repo; touch /tmp/pwned.git",
        "/workspace/repo $(whoami)",
      ],
    });

    expect(command).toBe(
      "'git' 'clone' '--' 'https://github.com/example/repo; touch /tmp/pwned.git' '/workspace/repo $(whoami)'",
    );
  });

  it("escapes embedded single quotes", () => {
    expect(
      buildSandboxArgvCommand({ executable: "printf", args: ["owner's repo"] }),
    ).toBe("'printf' 'owner'\\''s repo'");
  });

  it("rejects NUL bytes before reaching the sandbox", () => {
    expect(() =>
      buildSandboxArgvCommand({ executable: "git", args: ["clone\0--upload-pack"] }),
    ).toThrow("NUL");
  });
});
