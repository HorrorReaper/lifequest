"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface RecentEntryItem {
  id: string;
  templateName: string;
  templateIcon: string;
  entryDate: string;
  xpEarned: number;
}

interface RecentEntriesListProps {
  entries: RecentEntryItem[];
}

export function RecentEntriesList({ entries }: RecentEntriesListProps) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Recent Entries
      </h2>
      {entries.length === 0 ? (
        <Link href="/journal">
          <div className="rounded-xl bg-card p-6 text-center ring-1 ring-foreground/10 transition-colors hover:bg-muted/40">
            <p className="text-sm text-muted-foreground">
              No entries yet — start your first quest!
            </p>
          </div>
        </Link>
      ) : (
        entries.map((entry, index) => (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08, duration: 0.35 }}
            whileHover={{ scale: 1.01 }}
          >
            <Link href={`/journal/${entry.id}`}>
              <div className="flex items-center gap-3 rounded-xl bg-card p-3 ring-1 ring-foreground/10 transition-colors hover:bg-muted/40">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg">
                  {entry.templateIcon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{entry.templateName}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(entry.entryDate).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <Badge variant="secondary" className="gap-1 text-primary">
                  <Zap className="size-3" />+{entry.xpEarned}
                </Badge>
              </div>
            </Link>
          </motion.div>
        ))
      )}
    </section>
  );
}
