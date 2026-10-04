import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkspaceFormDialog } from "./WorkspaceFormDialog";

afterEach(cleanup);
describe("project form dialogs", () => {
  it("preserves the draft after a failed save and allows a successful retry", async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(undefined);
    render(
      <WorkspaceFormDialog
        title="New project"
        initial={{ name: "" }}
        fields={[{ key: "name", label: "Name", required: true }]}
        onClose={close}
        onSave={save}
      />,
    );
    await user.type(screen.getByLabelText("Name"), "My project");
    await user.click(screen.getByRole("button", { name: /^Save$/ }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe("offline"),
    );
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe(
      "My project",
    );
    expect(close).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Retry save" }));
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
  });
  it("confirms closing an unsaved draft without discarding it immediately", async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    render(
      <WorkspaceFormDialog
        title="Edit project"
        initial={{ name: "Old" }}
        fields={[{ key: "name", label: "Name" }]}
        onClose={close}
        onSave={vi.fn()}
      />,
    );
    await user.type(screen.getByLabelText("Name"), " draft");
    await user.click(screen.getByRole("button", { name: /^Cancel$/ }));
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByText("Discard unsaved changes?")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
  });
});
