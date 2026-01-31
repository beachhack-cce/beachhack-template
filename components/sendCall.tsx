"use client";

import { trpc } from "@/trpc/client";
import { useState } from "react";

export default function CallUserButton() {
  const [loading, setLoading] = useState(false);

  const callUser = trpc.alert.callUser.useMutation({
    onSuccess() {
      alert("Call initiated");
    },
    onError(err) {
      alert(err.message);
    },
  });

  const handleCall = async () => {
    setLoading(true);

    await callUser.mutateAsync({
      phone: "+919961441244", // example format
    });

    setLoading(false);
  };

  return (
    <button
      onClick={handleCall}
      disabled={loading}
      className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-red-400 hover:bg-red-500/20 disabled:opacity-50"
    >
      {loading ? "Calling..." : "Trigger Call Alert"}
    </button>
  );
}
