import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { SignInFormView, type SignInFormViewProps } from "./SignInFormView";
import { SIGN_IN_COPY } from "./copy";

afterEach(cleanup);

function setup(overrides: Partial<SignInFormViewProps> = {}) {
  const props: SignInFormViewProps = {
    email: "",
    password: "",
    onEmailChange: vi.fn(),
    onPasswordChange: vi.fn(),
    onSubmit: vi.fn(),
    ...overrides,
  };
  const view = render(<SignInFormView {...props} />);
  return { props, ...view };
}

describe("SignInFormView", () => {
  it("renders the title heading", () => {
    setup();
    expect(
      screen.getByRole("heading", { name: SIGN_IN_COPY.title }),
    ).toBeDefined();
  });

  it("shows the error message when error is set", () => {
    const error = SIGN_IN_COPY.errors["auth/invalid-credential"];
    setup({ error });
    expect(screen.getByText(error)).toBeDefined();
  });

  it("disables the submit button when loading", () => {
    setup({ loading: true });
    const button = screen.getByRole("button", {
      name: SIGN_IN_COPY.submitButton,
    });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it("calls onEmailChange when the email input changes", () => {
    const { props } = setup();
    fireEvent.change(screen.getByLabelText(SIGN_IN_COPY.emailLabel), {
      target: { value: "you@example.com" },
    });
    expect(props.onEmailChange).toHaveBeenCalledWith("you@example.com");
  });

  it("calls onPasswordChange when the password input changes", () => {
    const { props } = setup();
    fireEvent.change(screen.getByLabelText(SIGN_IN_COPY.passwordLabel), {
      target: { value: "hunter2" },
    });
    expect(props.onPasswordChange).toHaveBeenCalledWith("hunter2");
  });

  it("calls onSubmit when the form is submitted", () => {
    const { props, container } = setup();
    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form!);
    expect(props.onSubmit).toHaveBeenCalled();
  });
});
