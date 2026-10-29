"use client";

import { useState } from "react";
import {
  ArrowRight,
  MessageCircle,
  MessagesSquare,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  nextConversationNudge,
  type ConversationNudgeKind,
} from "@/lib/contacts/conversation-nudges";

interface NudgeState {
  kind: ConversationNudgeKind;
  question: string | null;
  seen: Record<ConversationNudgeKind, string[]>;
}

export function ConversationNudge({ contactName }: { contactName?: string }) {
  const [open, setOpen] = useState(false);
  const [nudge, setNudge] = useState<NudgeState>({
    kind: "starter",
    question: null,
    seen: { starter: [], deep: [] },
  });

  function draw(kind: ConversationNudgeKind) {
    setNudge((current) => {
      const next = nextConversationNudge(kind, current.seen[kind]);
      return {
        kind,
        question: next.question,
        seen: { ...current.seen, [kind]: next.seen },
      };
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (value && !nudge.question) draw(nudge.kind);
        setOpen(value);
      }}
    >
      <DialogTrigger
        render={<Button variant="outline" />}
        aria-label="Gesprächs-Nudge öffnen"
      >
        <Sparkles />
        Nudge
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <p className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-primary">
            <Sparkles className="size-3.5" />
            Ein kleiner Gesprächsimpuls
          </p>
          <DialogTitle>Ins Gespräch kommen</DialogTitle>
          <DialogDescription>
            {contactName
              ? `Eine Frage für dein Gespräch mit ${contactName}.`
              : "Eine gute Frage kann der Anfang eines schönen Gesprächs sein."}
          </DialogDescription>
        </DialogHeader>
        <div
          role="group"
          aria-label="Art des Gesprächs"
          className="grid grid-cols-1 gap-2 sm:grid-cols-2"
        >
          <Button
            variant={nudge.kind === "starter" ? "default" : "outline"}
            className="min-h-11"
            aria-pressed={nudge.kind === "starter"}
            onClick={() => {
              if (nudge.kind !== "starter") draw("starter");
            }}
          >
            <MessageCircle />
            Gesprächseinstieg
          </Button>
          <Button
            variant={nudge.kind === "deep" ? "default" : "outline"}
            className="min-h-11"
            aria-pressed={nudge.kind === "deep"}
            onClick={() => {
              if (nudge.kind !== "deep") draw("deep");
            }}
          >
            <MessagesSquare />
            Tiefes Gespräch
          </Button>
        </div>
        <div
          className="rounded-xl border bg-muted/40 p-5 sm:p-6"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <p className="mb-3 text-xs font-medium text-muted-foreground">
            {nudge.kind === "starter"
              ? "Leicht anfangen"
              : "Ein bisschen tiefer gehen"}
          </p>
          <p className="text-lg font-medium leading-relaxed [overflow-wrap:anywhere]">
            {nudge.question}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-64 text-xs leading-relaxed text-muted-foreground">
            {nudge.kind === "starter"
              ? "Für ein lockeres Kennenlernen oder einen neuen Gesprächsfaden."
              : "Wenn ihr Zeit und Lust habt, etwas persönlicher zu werden."}
          </p>
          <Button variant="outline" onClick={() => draw(nudge.kind)}>
            <RefreshCw />
            Andere Frage
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
