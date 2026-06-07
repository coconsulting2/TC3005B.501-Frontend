import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InfoTooltip from "@components/InfoTooltip";

describe("InfoTooltip", () => {
  it("muestra el texto al hacer clic", async () => {
    const user = userEvent.setup();
    render(<InfoTooltip text="Ayuda de prueba" label="Info test" />);

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /info test/i }));
    expect(screen.getByRole("tooltip")).toHaveTextContent("Ayuda de prueba");
  });
});
