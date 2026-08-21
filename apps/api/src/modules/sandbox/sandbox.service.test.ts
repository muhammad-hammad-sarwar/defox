import { describe, expect, it, vi } from "vitest";

import { cloneRepository } from "./sandbox.service.js";

type CommandCall = { command: string; options?: { cwd?: string; envs?: Record<string, string> } };

function createSandboxFake(exitCodes: number[] = [0, 0]) {
  const calls: CommandCall[] = [];
  const makeDir = vi.fn().mockResolvedValue(true);
  const write = vi.fn().mockResolvedValue({});
  const remove = vi.fn().mockResolvedValue(undefined);
  const run = vi.fn(async (command: string, options?: CommandCall["options"]) => {
    calls.push({ command, options });
    return { stdout: "", stderr: "", exitCode: exitCodes.shift() ?? 0 };
  });

  return {
    sandbox: {
      sandboxId: "sandbox-test",
      commands: { run },
      files: { makeDir, write, remove },
    } as Parameters<typeof cloneRepository>[0],
    calls,
    makeDir,
    write,
    remove,
  };
}

describe("cloneRepository", () => {
  it("creates and scrubs a temporary askpass script around a quoted clone command", async () => {
    const fake = createSandboxFake();
    const token = "test-installation-token-canary";

    const result = await cloneRepository(
      fake.sandbox,
      {
        fullName: "octo-org/repo;$(not-a-command)",
        cloneUrl: "https://github.com/octo-org/repo;$(not-a-command).git",
        defaultBranch: "feature/quoted value",
      },
      { token, tokenUsername: "x-access-token" },
    );

    expect(result.success).toBe(true);
    expect(fake.makeDir).toHaveBeenCalledWith("/workspace");
    expect(fake.write).toHaveBeenCalledTimes(1);
    expect(fake.write.mock.calls[0]?.[0]).toMatch(/^\/workspace\/\.defox-git-askpass-/);
    expect(fake.write.mock.calls[0]?.[1]).toContain("DEFOX_GIT_ASKPASS_PASSWORD");
    expect(fake.calls).toHaveLength(2);
    expect(fake.calls[0]?.command).toMatch(/^'chmod' '700' '\/workspace\/\.defox-git-askpass-/);
    expect(fake.calls[1]?.command).toContain(
      "'https://github.com/octo-org/repo;$(not-a-command).git'",
    );
    expect(fake.calls[1]?.command).toContain("'feature/quoted value'");
    expect(fake.calls[1]?.options?.envs).toMatchObject({
      GIT_ASKPASS_REQUIRE: "force",
      GIT_TERMINAL_PROMPT: "0",
      DEFOX_GIT_ASKPASS_USERNAME: "x-access-token",
      DEFOX_GIT_ASKPASS_PASSWORD: token,
    });
    expect(fake.calls[1]?.options?.envs).not.toHaveProperty("GIT_USERNAME");
    expect(fake.calls[1]?.options?.envs).not.toHaveProperty("GIT_PASSWORD");
    expect(fake.remove).toHaveBeenCalledWith(fake.write.mock.calls[0]?.[0]);
  });

  it("scrubs the askpass file after a clone command failure", async () => {
    const fake = createSandboxFake([0, 1]);

    const result = await cloneRepository(
      fake.sandbox,
      {
        fullName: "octo-org/repo",
        cloneUrl: "https://github.com/octo-org/repo.git",
        defaultBranch: "main",
      },
      { token: "test-token", tokenUsername: "x-access-token" },
    );

    expect(result.success).toBe(false);
    expect(fake.remove).toHaveBeenCalledWith(fake.write.mock.calls[0]?.[0]);
  });
});
