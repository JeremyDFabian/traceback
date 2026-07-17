import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Page from "./page";

describe("home page", () => {
  it("shows that the Traceback workspace is ready", () => {
    render(<Page />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Traceback" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Project scaffold ready")).toBeInTheDocument();
  });
});
