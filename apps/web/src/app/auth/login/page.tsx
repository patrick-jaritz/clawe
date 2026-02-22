"use client";

import dynamic from "next/dynamic";

// Disable SSR — Convex hooks require client-side context only
const LoginClient = dynamic(() => import("./login-client"), { ssr: false });

export default function LoginPage() {
  return <LoginClient />;
}
