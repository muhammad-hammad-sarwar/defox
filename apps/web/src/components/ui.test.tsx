import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "./ui";

describe("Button", () => {
  it("uses the accessible primary and hover colors from the shared variant", () => {
    render(<Button>Save changes</Button>);

    expect(screen.getByRole("button", { name: "Save changes" })).toHaveClass(
      "bg-primary-700",
      "hover:bg-primary-800",
    );
  });
});
