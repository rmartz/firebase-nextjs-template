---
type: Subsystem
title: Firebase
description: How the template wires the Firebase client and Admin SDKs — choosing RTDB or Firestore, lazy initialization, real-time subscription hooks, schema and serialization patterns, the local emulator, and environment variables.
resource: src/lib/firebase/
tags: [firebase, rtdb, firestore, data-access]
---

# Firebase

The data layer behind the template. For where it sits in the overall stack, see
[ARCHITECTURE.md](../../ARCHITECTURE.md).

## Packages

- `firebase` (client SDK) — browser-side Firebase access
- `firebase-admin` (server SDK) — server-side Firebase access via API routes

## Choosing a Data Store

Projects built from this template should choose the data store that fits their needs. Both **Realtime Database (RTDB)** and **Firestore** are scaffolded with security rules, SDK accessors, and real-time subscription hooks. Pick one (or neither) and remove the scaffold for the other:

|                   | Realtime Database             | Firestore              |
| ----------------- | ----------------------------- | ---------------------- |
| Data model        | JSON tree                     | Document/collection    |
| Queries           | Path-based; limited filtering | Rich query support     |
| Real-time         | `onValue` push                | `onSnapshot` push      |
| Rules file        | `database.rules.json`         | `firestore.rules`      |
| Client accessor   | `getClientDatabase()`         | `getClientFirestore()` |
| Server accessor   | `getAdminDatabase()`          | `getAdminFirestore()`  |
| Subscription hook | `useRealtimeValue`            | `useFirestoreDocument` |

Remove `FIREBASE_DATABASE_URL` / `NEXT_PUBLIC_FIREBASE_DATABASE_URL` from env and config if not using RTDB.

## Initialization

Both SDKs are lazily initialized to avoid errors during static builds (CI has no env vars). `src/lib/firebase/client.ts` and `src/lib/firebase/admin.ts` expose product-specific accessors — call the one for your chosen data store:

```typescript
// Realtime Database
import { getClientDatabase } from "@/lib/firebase/client";
import { ref } from "firebase/database";
const userRef = ref(getClientDatabase(), `users/${uid}`);

// Firestore
import { getClientFirestore } from "@/lib/firebase/client";
import { doc } from "firebase/firestore";
const userDoc = doc(getClientFirestore(), "users", uid);
```

Product instances should be accessed via function calls, never module-level constants.

## Real-Time Subscription Hooks

Use the scaffolded hooks to subscribe to data and keep TanStack Query's cache in sync:

```typescript
// Realtime Database
import { useRealtimeValue } from "@/hooks";
import { ref } from "firebase/database";
import { getClientDatabase } from "@/lib/firebase/client";

const userRef = useMemo(() => ref(getClientDatabase(), `users/${uid}`), [uid]);
const { data, isLoading } = useRealtimeValue(userRef, (s) => s.val() as User, [
  "users",
  uid,
]);

// Firestore
import { useFirestoreDocument } from "@/hooks";
import { doc } from "firebase/firestore";
import { getClientFirestore } from "@/lib/firebase/client";

const userDoc = useMemo(() => doc(getClientFirestore(), "users", uid), [uid]);
const { data, isLoading } = useFirestoreDocument(
  userDoc,
  (s) => s.data() as User | undefined,
  ["users", uid],
);
```

Pass a memoised ref and a stable `queryKey` to avoid redundant re-subscriptions. Mutations go through API routes (Admin SDK write) → Firebase push → hook updates cache automatically.

## RTDB Schema Pattern

When using Realtime Database, separate public and private data at the path level:

```
/{collection}/{id}/public    # World-readable data (client SDK subscribes here)
/{collection}/{id}/private   # Server-only data (Admin SDK only)
```

See `database.rules.json` for the corresponding default security rules.

## Firestore Schema Pattern

Firestore organises data as collections of documents. Use uid-scoped paths for per-user data:

```
/users/{uid}/          # User profile and settings
/{collection}/{id}/    # Domain data — define access rules per collection
```

See `firestore.rules` for the default deny-all scaffold with a uid-scoped example.

## Serialization Layer

- TypeScript types define the domain model
- `{domain}ToFirebase()` converts domain objects to Firebase-safe format (no `undefined` values)
- `firebaseTo{Domain}()` converts Firebase snapshots back to domain objects with defaults
- Boolean settings are always written explicitly (not sparse) and deserialized with `?? false`

## Firebase Emulator

`firebase.json` configures local emulators for Auth, RTDB, and Firestore. Run them during development and testing to avoid touching production data:

```bash
pnpm emulator
```

Point tests at the emulator by setting environment variables before running Vitest:

```bash
FIREBASE_DATABASE_EMULATOR_HOST=localhost:9000 \
FIRESTORE_EMULATOR_HOST=localhost:8080 \
pnpm test
```

## Environment Variables

| Variable                 | Side   | Description                                    |
| ------------------------ | ------ | ---------------------------------------------- |
| `FIREBASE_PROJECT_ID`    | Server | Firebase project ID                            |
| `FIREBASE_CLIENT_EMAIL`  | Server | Service account email                          |
| `FIREBASE_PRIVATE_KEY`   | Server | Service account key (literal `\n`)             |
| `FIREBASE_DATABASE_URL`  | Server | RTDB URL (omit if using Firestore only)        |
| `NEXT_PUBLIC_FIREBASE_*` | Client | Client SDK config (API key, auth domain, etc.) |

`NEXT_PUBLIC_` variables are bundled into client JavaScript — this is by design. Access control is enforced by Firebase security rules, not by hiding these keys.
