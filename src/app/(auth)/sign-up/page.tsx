"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FirebaseError } from "firebase/app";
import { createSession, signUp } from "@/auth";
import { SIGN_UP_COPY } from "./copy";
import { SignUpFormView } from "./SignUpFormView";

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    setError(undefined);
    setLoading(true);
    try {
      const credential = await signUp(email, password);
      await createSession(await credential.user.getIdToken());
      router.push("/");
    } catch (err) {
      const code = (err as FirebaseError).code;
      const messages = SIGN_UP_COPY.errors;
      setError((messages as Record<string, string>)[code] ?? messages.default);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SignUpFormView
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
