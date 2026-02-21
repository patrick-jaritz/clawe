"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/board");
  }, [router]);

  return (
    <div className="flex min-h-svh items-center justify-center">
      <div className="text-muted-foreground">Loading...</div>
    </div>
  );
}
