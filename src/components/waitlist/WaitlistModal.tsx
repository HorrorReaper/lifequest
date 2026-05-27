"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client"; // adjust if your path differs
import type { Database } from '@/lib/supabase/database.types'
import { supabaseInsert } from '@/lib/supabase/helpers'

type Props = {
  open: boolean;
  onClose: () => void;
  source?: string;
};

export default function WaitlistModal({ open, onClose, source = "marketing" }: Props) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const supabase = createClient();

  useEffect(() => {
    if (!open) return;
    setSuccess(false);
    setError(null);
    supabase.rpc("waitlist_count").then(({ data }) => {
      if (typeof data === "number") setCount(data);
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Please enter a valid email address.");
      return;
    }

    setSubmitting(true);
    const { error } = await supabaseInsert(supabase, 'waitlist_signups', {
      email: trimmed,
      name: name.trim() || null,
      source,
    })
    setSubmitting(false);

    if (error) {
      setError(
        error.code === "23505"
          ? "You're already on the waitlist 🎉"
          : "Something went wrong. Please try again."
      );
      return;
    }

    setSuccess(true);
    setEmail("");
    setName("");
    setCount((c) => (c == null ? c : c + 1));
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/70 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md rounded-2xl border-2 border-primary/20 bg-card shadow-2xl overflow-hidden"
          >
            {/* Decorative gradient halo — matches hero gradient */}
            <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-gradient-to-br from-primary/30 to-purple-500/30 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-gradient-to-tr from-purple-500/20 to-primary/20 blur-3xl pointer-events-none" />

            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute top-4 right-4 z-10 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="relative p-8">
              {success ? (
                <div className="text-center space-y-4 py-4">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-purple-500 text-primary-foreground">
                    <Check className="h-7 w-7" />
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                    You're on the list!
                  </h2>
                  <p className="text-muted-foreground">
                    We'll email you the moment LifeQuest launches.
                  </p>
                  <Button onClick={onClose} className="mt-2" size="lg">
                    Close
                  </Button>
                </div>
              ) : (
                <>

                  <h2 className="text-2xl md:text-3xl font-bold tracking-tight leading-tight">
                    Join the{" "}
                    <span className="bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
                      waitlist
                    </span>
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Be the first to start your quest.
                    {count != null && (
                      <>
                        {" "}
                        <span className="font-semibold text-foreground">{count}</span>{" "}
                        {count === 1 ? "player" : "players"} already joined.
                      </>
                    )}
                  </p>

                  <form onSubmit={submit} className="mt-6 space-y-3">
                    <input
                      className="w-full rounded-lg border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
                      placeholder="Your name (optional)"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                    <input
                      className="w-full rounded-lg border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoFocus
                    />
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="terms"
                        className="rounded border-gray-300 text-primary focus:ring-primary"
                        required
                      />
                      <label htmlFor="terms" className="text-sm text-muted-foreground">
                        I would also be interested in the ProVersion with advanced features and early access.
                      </label>
                    </div>
                    {error && (
                      <p className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                        {error}
                      </p>
                    )}

                    <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                      <Button
                        type="submit"
                        size="lg"
                        disabled={submitting}
                        className="w-full group"
                      >
                        {submitting ? (
                          "Joining…"
                        ) : (
                          <>
                            Join the waitlist
                            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                          </>
                        )}
                      </Button>
                    </motion.div>
                  </form>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
