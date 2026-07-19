import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Page from "./page";

describe("home page", () => {
  it("starts an interactive PDF study session", () => {
    render(<Page />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /turn handwritten notes into ideas you can explore/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /choose a clear notebook photo/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /run demo/i }),
    ).toBeInTheDocument();
  });
});
