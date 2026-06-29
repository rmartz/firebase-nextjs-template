import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { ForgotPasswordFormView } from "./ForgotPasswordFormView";
import { FORGOT_PASSWORD_COPY } from "./copy";

const meta = {
  title: "Auth/ForgotPasswordForm",
  component: ForgotPasswordFormView,
  args: {
    email: "",
    onEmailChange: fn(),
    onSubmit: fn(),
  },
} satisfies Meta<typeof ForgotPasswordFormView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Filled: Story = {
  args: {
    email: "you@example.com",
  },
};

export const WithError: Story = {
  args: {
    email: "missing@example.com",
    error: FORGOT_PASSWORD_COPY.errors["auth/user-not-found"],
  },
};

export const Loading: Story = {
  args: {
    email: "you@example.com",
    loading: true,
  },
};

export const Submitted: Story = {
  args: {
    email: "you@example.com",
    submitted: true,
  },
};
