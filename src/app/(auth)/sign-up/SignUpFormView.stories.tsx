import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { SignUpFormView } from "./SignUpFormView";
import { SIGN_UP_COPY } from "./copy";

const meta = {
  title: "Auth/SignUpForm",
  component: SignUpFormView,
  args: {
    email: "",
    password: "",
    onEmailChange: fn(),
    onPasswordChange: fn(),
    onSubmit: fn(),
  },
} satisfies Meta<typeof SignUpFormView>;

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
    email: "taken@example.com",
    password: "correct-horse-battery-staple",
    error: SIGN_UP_COPY.errors["auth/email-already-in-use"],
  },
};

export const Loading: Story = {
  args: {
    email: "you@example.com",
    password: "correct-horse-battery-staple",
    loading: true,
  },
};
