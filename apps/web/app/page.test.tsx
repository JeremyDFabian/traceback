import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Page from "./page";

describe("home page", () => {
  it("reviews the demo batch and reports the completion result", () => {
    render(<Page />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Traceback" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Review flashcards" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm batch" }));

    expect(
      screen.getByText("Review complete: 0 approved · 2 rejected"),
    ).toBeInTheDocument();
  });
});
