import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { SignInFormView } from "./SignInFormView";
import { SIGN_IN_COPY } from "./copy";

const meta = {
  title: "Auth/SignInForm",
  component: SignInFormView,
  args: {
    email: "",
    password: "",
    onEmailChange: fn(),
    onPasswordChange: fn(),
    onSubmit: fn(),
  },
} satisfies Meta<typeof SignInFormView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Filled: Story = {
  args: {
    email: "you@example.com",
    password: "correct-horse-battery-staple",
  },
};

export const WithError: Story = {
  args: {
    email: "you@example.com",
    password: "wrong-password",
    error: SIGN_IN_COPY.errors["auth/invalid-credential"],
  },
};

export const Loading: Story = {
  args: {
    email: "you@example.com",
    password: "correct-horse-battery-staple",
    loading: true,
  },
};
