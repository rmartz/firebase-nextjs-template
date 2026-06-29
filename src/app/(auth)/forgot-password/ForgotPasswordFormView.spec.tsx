import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import {
  ForgotPasswordFormView,
  type ForgotPasswordFormViewProps,
} from "./ForgotPasswordFormView";
import { FORGOT_PASSWORD_COPY } from "./copy";

afterEach(cleanup);

function setup(overrides: Partial<ForgotPasswordFormViewProps> = {}) {
  const props: ForgotPasswordFormViewProps = {
    email: "",
    onEmailChange: vi.fn(),
    onSubmit: vi.fn(),
    ...overrides,
  };
  const view = render(<ForgotPasswordFormView {...props} />);
  return { props, ...view };
}

describe("ForgotPasswordFormView", () => {
  it("renders the title heading", () => {
    setup();
    expect(
      screen.getByRole("heading", { name: FORGOT_PASSWORD_COPY.title }),
    ).toBeDefined();
  });

  it("renders the description in the default (form) state", () => {
    setup();
    expect(screen.getByText(FORGOT_PASSWORD_COPY.description)).toBeDefined();
  });

  it("renders the success message when submitted", () => {
    setup({ submitted: true });
    expect(screen.getByText(FORGOT_PASSWORD_COPY.successMessage)).toBeDefined();
  });

  it("hides the form when submitted", () => {
    const { container } = setup({ submitted: true });
    expect(container.querySelector("form")).toBeNull();
  });

  it("shows the error message when error is set", () => {
    const error = FORGOT_PASSWORD_COPY.errors["auth/user-not-found"];
    setup({ error });
    expect(screen.getByText(error)).toBeDefined();
  });

  it("disables the submit button when loading", () => {
    setup({ loading: true });
    const button = screen.getByRole("button", {
      name: FORGOT_PASSWORD_COPY.submitButton,
    });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it("calls onEmailChange when the email input changes", () => {
    const { props } = setup();
    fireEvent.change(screen.getByLabelText(FORGOT_PASSWORD_COPY.emailLabel), {
      target: { value: "you@example.com" },
    });
    expect(props.onEmailChange).toHaveBeenCalledWith("you@example.com");
  });

  it("calls onSubmit when the form is submitted", () => {
    const { props, container } = setup();
    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form!);
    expect(props.onSubmit).toHaveBeenCalled();
  });
});
