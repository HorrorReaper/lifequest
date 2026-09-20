"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

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
  // Left empty by people, filled in by bots. The route drops anything that
  // arrives with it set.
  const [hp, setHp] = useState("");
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
    // Posted at our own route rather than at the table: it is the only side
    // that can hold the rate limit, read the honeypot, and send the
    // confirmation mail.
    let ok = false;
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmed,
          name: name.trim() || null,
          source,
          interested_pro: interestedPro,
          early_access: earlyAccess,
          newsletter,
          hp,
        }),
      });
      const data = await response.json().catch(() => null);
      ok = response.ok && data?.ok === true;
      if (!ok) setError(data?.error ?? "Something went wrong. Please try again.");
    } catch {
      setError("Network error. Please try again.");
    }
    setSubmitting(false);

    if (!ok) return;

    setSuccess(true);
    setEmail("");
    setName("");
    setInterestedPro(false);
    setEarlyAccess(false);
    setNewsletter(false);
    setHp("");
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
          className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-[#1b1a17]/40 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md rounded-2xl border border-[#eae5da] bg-white shadow-xl overflow-hidden"
          >
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute top-4 right-4 z-10 text-[#6f6b63] hover:text-[#1b1a17] transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="relative p-8">
              {success ? (
                <div className="text-center space-y-4 py-4">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#d1870b] text-[#1b1a17]">
                    <Check className="h-7 w-7" />
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-[#1b1a17] [font-family:var(--font-nightfall-display)]">
                    You're on the list!
                  </h2>
                  <p className="text-[#6f6b63]">
                    We'll email you the moment LifeQuest launches.
                  </p>
                  <button
                    onClick={onClose}
                    className="mt-2 rounded-xl bg-[#d1870b] px-6 py-3 font-bold text-[#1b1a17] transition-colors hover:bg-[#c07b08]"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <>

                  <h2 className="text-2xl md:text-3xl font-bold tracking-tight leading-tight text-[#1b1a17] [font-family:var(--font-nightfall-display)]">
                    Join the{" "}
                    <span className="text-[#d1870b]">waitlist</span>
                  </h2>
                  <p className="mt-2 text-sm text-[#6f6b63]">
                    Be the first to start your quest.
                    {count != null && (
                      <>
                        {" "}
                        <span className="font-semibold text-[#1b1a17]">{count}</span>{" "}
                        {count === 1 ? "player" : "players"} already joined.
                      </>
                    )}
                  </p>

                  <form onSubmit={submit} className="mt-6 space-y-3">
                    {/* Out of the layout, out of the tab order and hidden from
                        screen readers, so only something filling the form in
                        blind ever puts anything in it. */}
                    <input
                      type="text"
                      name="company"
                      tabIndex={-1}
                      autoComplete="off"
                      aria-hidden="true"
                      value={hp}
                      onChange={(e) => setHp(e.target.value)}
                      className="pointer-events-none absolute h-0 w-0 opacity-0"
                    />
                    <input
                      className="w-full rounded-lg border border-[#eae5da] bg-[#fdfcf9] px-4 py-3 text-sm text-[#1b1a17] placeholder:text-[#8d887f] focus:outline-none focus:ring-2 focus:ring-[#d1870b]/35 focus:border-[#d1870b] transition"
                      placeholder="Your name (optional)"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                    <input
                      className="w-full rounded-lg border border-[#eae5da] bg-[#fdfcf9] px-4 py-3 text-sm text-[#1b1a17] placeholder:text-[#8d887f] focus:outline-none focus:ring-2 focus:ring-[#d1870b]/35 focus:border-[#d1870b] transition"
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
                        className="rounded border-[#d9d2c4] bg-white text-[#d1870b] focus:ring-[#d1870b]"
                        checked={interestedPro}
                        onChange={(e) => setInterestedPro(e.target.checked)}
                      />
                      <label htmlFor="interested_pro" className="text-sm text-[#6f6b63]">
                        I'm interested in the Pro version (advanced features).
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="early_access"
                        className="rounded border-[#d9d2c4] bg-white text-[#d1870b] focus:ring-[#d1870b]"
                        checked={earlyAccess}
                        onChange={(e) => setEarlyAccess(e.target.checked)}
                      />
                      <label htmlFor="early_access" className="text-sm text-[#6f6b63]">
                        I'd like to receive early access / beta invites.
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="newsletter"
                        className="rounded border-[#d9d2c4] bg-white text-[#d1870b] focus:ring-[#d1870b]"
                        checked={newsletter}
                        onChange={(e) => setNewsletter(e.target.checked)}
                      />
                      <label htmlFor="newsletter" className="text-sm text-[#6f6b63]">
                        Sign me up for the newsletter.
                      </label>
                    </div>
                    {error && (
                      <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        {error}
                      </p>
                    )}

                    <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full group rounded-xl bg-[#d1870b] px-6 py-3 font-bold text-[#1b1a17] transition-colors hover:bg-[#c07b08] disabled:opacity-60 disabled:pointer-events-none"
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
