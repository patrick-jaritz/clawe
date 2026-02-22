"use client";

import dynamic from "next/dynamic";

const SetupClient = dynamic(() => import("./setup-client"), { ssr: false });

export default function Page() {
  return <SetupClient />;
}
