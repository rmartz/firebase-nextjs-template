// Public interface of the `auth` vertical. Import auth from "@/auth", never
// reach into its internals (e.g. ./AuthProvider) from outside — by convention
// (eslint-plugin-boundaries enforcement is a planned follow-up; see #169).
// useAuthContext stays private to the vertical; useAuth is the ergonomic
// consumer hook.
export { AuthProvider } from "./AuthProvider";
export { useAuth } from "./use-auth";
export {
  createSession,
  deleteSession,
  sendPasswordReset,
  signIn,
  signOut,
  signUp,
} from "./service";
