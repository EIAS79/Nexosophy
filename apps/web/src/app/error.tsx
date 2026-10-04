"use client";

import { Button } from "@nexosophy/ui";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Nexosophy route error", {
      digest: error.digest,
      message: error.message,
    });
  }, [error]);

  return (
    <main className="route-state" id="main-content">
      <section className="route-state__card">
        <p className="eyebrow">Something went wrong</p>
        <h1>This view could not be loaded.</h1>
        <p>Retry the route. If the problem continues, the request can be correlated through server telemetry.</p>
        <Button onClick={reset}>Try again</Button>
      </section>
    </main>
  );
}
