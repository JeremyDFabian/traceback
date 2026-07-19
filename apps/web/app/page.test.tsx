import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Page from "./page";

describe("home page", () => {
  it("starts an interactive PDF study session", () => {
    render(<Page />);

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: /upload a notebook photo/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/choose a clear notebook photo/i),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /run demo/i })).toHaveLength(
      2,
    );
  });
});
