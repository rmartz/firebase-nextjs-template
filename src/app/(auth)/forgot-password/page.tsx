"use client";

import { useState } from "react";
import type { FirebaseError } from "firebase/app";
import { sendPasswordReset } from "@/auth";
import { FORGOT_PASSWORD_COPY } from "./copy";
import { ForgotPasswordFormView } from "./ForgotPasswordFormView";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    setError(undefined);
    setLoading(true);
    try {
      await sendPasswordReset(email);
      setSubmitted(true);
    } catch (err) {
      const code = (err as FirebaseError).code;
      const messages = FORGOT_PASSWORD_COPY.errors;
      setError((messages as Record<string, string>)[code] ?? messages.default);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ForgotPasswordFormView
      email={email}
      error={error}
      loading={loading}
      submitted={submitted}
      onEmailChange={setEmail}
      onSubmit={(e) => {
        void handleSubmit(e);
      }}
    />
  );
}
