"use client";

import Link from "next/link";
import { SIGN_IN_COPY } from "./copy";

export interface SignInFormViewProps {
  email: string;
  password: string;
  error?: string;
  loading?: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (e: React.SyntheticEvent) => void;
}

export function SignInFormView({
  email,
  password,
  error,
  loading = false,
  onEmailChange,
  onPasswordChange,
  onSubmit,
}: SignInFormViewProps) {
  return (
    <div className="w-full max-w-sm space-y-6">
      <h1 className="text-2xl font-semibold">{SIGN_IN_COPY.title}</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium">
            {SIGN_IN_COPY.emailLabel}
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => {
              onEmailChange(e.target.value);
            }}
            placeholder={SIGN_IN_COPY.emailPlaceholder}
            className="w-full rounded border px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="password" className="text-sm font-medium">
            {SIGN_IN_COPY.passwordLabel}
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => {
              onPasswordChange(e.target.value);
            }}
            className="w-full rounded border px-3 py-2 text-sm"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {SIGN_IN_COPY.submitButton}
        </button>
      </form>
      <div className="flex items-center justify-between text-sm">
        <Link href="/forgot-password" className="underline">
          {SIGN_IN_COPY.forgotPasswordLink}
        </Link>
        <span>
          {SIGN_IN_COPY.signUpPrompt}{" "}
          <Link href="/sign-up" className="underline">
            {SIGN_IN_COPY.signUpLink}
          </Link>
        </span>
      </div>
    </div>
  );
}
