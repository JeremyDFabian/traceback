import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Page from "./page";

describe("home page", () => {
  it("starts an interactive PDF study session", () => {
    render(<Page />);

    expect(
      screen.getByText("Turn every study page into a smarter reference."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Choose a clear notebook photo"),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /run demo/i })).toHaveLength(2);
  });
});
