"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { FirebaseError } from "firebase/app";
import { createSession, signIn } from "@/services/auth";
import { SIGN_IN_COPY } from "./copy";
import { SignInFormView } from "./SignInFormView";

export default function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    setError(undefined);
    setLoading(true);
    try {
      const credential = await signIn(email, password);
      await createSession(await credential.user.getIdToken());
      const next = searchParams.get("next");
      const redirectTo =
        next?.startsWith("/") && !next.startsWith("//") ? next : "/";
      router.push(redirectTo);
    } catch (err) {
      const code = (err as FirebaseError).code;
      const messages = SIGN_IN_COPY.errors;
      setError((messages as Record<string, string>)[code] ?? messages.default);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SignInFormView
      email={email}
      password={password}
      error={error}
      loading={loading}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onSubmit={(e) => {
        void handleSubmit(e);
      }}
    />
  );
}
