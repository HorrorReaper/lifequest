"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client"; // adjust path

const supabase = createClient();

type Props = {
  open: boolean;
  onClose: () => void;
  source?: string; // optional, to track where the signup came from
};

export default function WaitlistModal({ open, onClose, source = "marketing" }: Props) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState<number | null>(null);

  // Load current waitlist count when opened
  useEffect(() => {
    if (!open) return;
    setSuccess(false);
    setError(null);
    supabase.rpc("waitlist_count").then(({ data }) => {
      if (typeof data === "number") setCount(data);
    });
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Please enter a valid email address.");
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from("waitlist_signups").insert({
      email: trimmed,
      name: name.trim() || null,
      source,
    });
    setSubmitting(false);

    if (error) {
      if (error.code === "23505") {
        setError("You're already on the waitlist 🎉");
      } else {
        setError("Something went wrong. Please try again.");
      }
      return;
    }

    setSuccess(true);
    setEmail("");
    setName("");
    setCount((c) => (c == null ? c : c + 1));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-xl"
        >
          ×
        </button>

        {success ? (
          <div className="text-center space-y-3 py-4">
            <div className="text-4xl">🎉</div>
            <h2 className="text-xl font-semibold">You're on the list!</h2>
            <p className="text-gray-600 text-sm">
              We'll email you as soon as we launch.
            </p>
            <button
              onClick={onClose}
              className="mt-2 px-4 py-2 rounded bg-black text-white"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-semibold mb-1">Join the waitlist</h2>
            <p className="text-sm text-gray-600 mb-4">
              Be the first to know when we launch.
              {count != null && (
                <> {" "}<span className="font-medium">{count}</span> people already joined.</>
              )}
            </p>

            <form onSubmit={submit} className="space-y-3">
              <input
                className="border rounded-lg px-3 py-2 w-full"
                placeholder="Name (optional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <input
                className="border rounded-lg px-3 py-2 w-full"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full px-4 py-2 rounded-lg bg-black text-white disabled:opacity-50"
              >
                {submitting ? "Joining…" : "Join waitlist"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
