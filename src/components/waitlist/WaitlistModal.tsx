"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, Check } from "lucide-react";
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
  const [interestedPro, setInterestedPro] = useState(false);
  const [earlyAccess, setEarlyAccess] = useState(false);
  const [newsletter, setNewsletter] = useState(false);
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
      interested_pro: interestedPro,
      early_access: earlyAccess,
      newsletter: newsletter,
    } as any)
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
    setInterestedPro(false);
    setEarlyAccess(false);
    setNewsletter(false);
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
          className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#0d1626] shadow-2xl overflow-hidden"
          >
            {/* Decorative gradient halo — matches the Nightfall City hero's palette */}
            <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-[rgba(247,185,85,0.18)] blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-[rgba(143,160,255,0.14)] blur-3xl pointer-events-none" />

            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute top-4 right-4 z-10 text-[#93a3c4] hover:text-[#f3f5fb] transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="relative p-8">
              {success ? (
                <div className="text-center space-y-4 py-4">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[linear-gradient(180deg,#ffc873,#f7b955)] text-[#1a1204]">
                    <Check className="h-7 w-7" />
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-[#f3f5fb] [font-family:var(--font-nightfall-display)]">
                    You're on the list!
                  </h2>
                  <p className="text-[#93a3c4]">
                    We'll email you the moment LifeQuest launches.
                  </p>
                  <button
                    onClick={onClose}
                    className="mt-2 rounded-xl bg-[linear-gradient(180deg,#ffc873,#f7b955)] px-6 py-3 font-bold text-[#1a1204] shadow-[0_8px_24px_rgba(247,185,85,0.25)]"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <>

                  <h2 className="text-2xl md:text-3xl font-bold tracking-tight leading-tight text-[#f3f5fb] [font-family:var(--font-nightfall-display)]">
                    Join the{" "}
                    <span className="bg-[linear-gradient(90deg,#f7b955,#ffdca0)] bg-clip-text text-transparent">
                      waitlist
                    </span>
                  </h2>
                  <p className="mt-2 text-sm text-[#93a3c4]">
                    Be the first to start your quest.
                    {count != null && (
                      <>
                        {" "}
                        <span className="font-semibold text-[#f3f5fb]">{count}</span>{" "}
                        {count === 1 ? "player" : "players"} already joined.
                      </>
                    )}
                  </p>

                  <form onSubmit={submit} className="mt-6 space-y-3">
                    <input
                      className="w-full rounded-lg border border-white/[0.08] bg-[#111d33] px-4 py-3 text-sm text-[#f3f5fb] placeholder:text-[#93a3c4] focus:outline-none focus:ring-2 focus:ring-[rgba(247,185,85,0.4)] focus:border-[#f7b955] transition"
                      placeholder="Your name (optional)"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                    <input
                      className="w-full rounded-lg border border-white/[0.08] bg-[#111d33] px-4 py-3 text-sm text-[#f3f5fb] placeholder:text-[#93a3c4] focus:outline-none focus:ring-2 focus:ring-[rgba(247,185,85,0.4)] focus:border-[#f7b955] transition"
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
                        id="interested_pro"
                        className="rounded border-white/[0.15] bg-[#111d33] text-[#f7b955] focus:ring-[#f7b955]"
                        checked={interestedPro}
                        onChange={(e) => setInterestedPro(e.target.checked)}
                      />
                      <label htmlFor="interested_pro" className="text-sm text-[#93a3c4]">
                        I'm interested in the Pro version (advanced features).
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="early_access"
                        className="rounded border-white/[0.15] bg-[#111d33] text-[#f7b955] focus:ring-[#f7b955]"
                        checked={earlyAccess}
                        onChange={(e) => setEarlyAccess(e.target.checked)}
                      />
                      <label htmlFor="early_access" className="text-sm text-[#93a3c4]">
                        I'd like to receive early access / beta invites.
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="newsletter"
                        className="rounded border-white/[0.15] bg-[#111d33] text-[#f7b955] focus:ring-[#f7b955]"
                        checked={newsletter}
                        onChange={(e) => setNewsletter(e.target.checked)}
                      />
                      <label htmlFor="newsletter" className="text-sm text-[#93a3c4]">
                        Sign me up for the newsletter.
                      </label>
                    </div>
                    {error && (
                      <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                        {error}
                      </p>
                    )}

                    <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full group rounded-xl bg-[linear-gradient(180deg,#ffc873,#f7b955)] px-6 py-3 font-bold text-[#1a1204] shadow-[0_8px_24px_rgba(247,185,85,0.25)] disabled:opacity-60 disabled:pointer-events-none"
                      >
                        {submitting ? (
                          "Joining…"
                        ) : (
                          <span className="inline-flex items-center justify-center">
                            Join the waitlist
                            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                          </span>
                        )}
                      </button>
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
