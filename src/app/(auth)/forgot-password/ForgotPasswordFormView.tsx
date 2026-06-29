"use client";

import Link from "next/link";
import { FORGOT_PASSWORD_COPY } from "./copy";

export interface ForgotPasswordFormViewProps {
  email: string;
  error?: string;
  loading?: boolean;
  submitted?: boolean;
  onEmailChange: (value: string) => void;
  onSubmit: (e: React.SyntheticEvent) => void;
}

export function ForgotPasswordFormView({
  email,
  error,
  loading = false,
  submitted = false,
  onEmailChange,
  onSubmit,
}: ForgotPasswordFormViewProps) {
  return (
    <div className="w-full max-w-sm space-y-6">
      <h1 className="text-2xl font-semibold">{FORGOT_PASSWORD_COPY.title}</h1>
      {submitted ? (
        <p className="text-sm">{FORGOT_PASSWORD_COPY.successMessage}</p>
      ) : (
        <>
          <p className="text-sm text-gray-600">
            {FORGOT_PASSWORD_COPY.description}
          </p>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="email" className="text-sm font-medium">
                {FORGOT_PASSWORD_COPY.emailLabel}
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
                placeholder={FORGOT_PASSWORD_COPY.emailPlaceholder}
                className="w-full rounded border px-3 py-2 text-sm"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {FORGOT_PASSWORD_COPY.submitButton}
            </button>
          </form>
        </>
      )}
      <Link href="/sign-in" className="text-sm underline">
        {FORGOT_PASSWORD_COPY.signInLink}
      </Link>
    </div>
  );
}
