import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Page from "./page";

describe("home page", () => {
  it("starts a new study session with both required uploads", () => {
    render(<Page />);

    expect(
      screen.getByRole("heading", { level: 1, name: /make every margin/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /upload lecture slides/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /find connections/i }),
    ).toBeInTheDocument();
  });
});
