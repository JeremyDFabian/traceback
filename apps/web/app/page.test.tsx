import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Page from "./page";

describe("home page", () => {
  it("starts an interactive PDF study session", () => {
    render(<Page />);

    expect(
      screen.getByText("Your pages, all in one place."),
    ).toBeInTheDocument();
    expect(screen.getByText("Choose notebook photos")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /run demo/i }),
    ).toBeInTheDocument();
  });
});
