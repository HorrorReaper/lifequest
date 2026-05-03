"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Habit } from "@/lib/types";
import { fetchHabits, createHabit, updateHabit, deleteHabit } from "@/lib/habits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Archive, ArchiveRestore } from "lucide-react";

const EMOJI_OPTIONS = ["✅","💪","🧘","💧","📖","🏃","🥗","😴","🎯","🧠","🙏","🚭","☕","💻","🎵"];

interface HabitsManagerProps {
  userId: string;
}

export function HabitsManager({ userId }: HabitsManagerProps) {
  const supabase = createClient();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("✅");

  useEffect(() => { load(); }, [userId]);

  async function load() {
    setLoading(true);
    try {
      setHabits(await fetchHabits(supabase, userId, true));
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await createHabit(supabase, userId, { name, emoji });
    setName("");
    setEmoji("✅");
    load();
  }

  async function toggleArchive(h: Habit) {
    await updateHabit(supabase, h.id, { is_archived: !h.is_archived });
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this habit and all its logs?")) return;
    await deleteHabit(supabase, id);
    load();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Habits</CardTitle>
        <p className="text-sm text-muted-foreground">
          Define habits here, then add the Habit Tracker widget to any template.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleAdd} className="rounded-lg border p-3 bg-muted/30 space-y-2">
          <div className="flex gap-2">
            <select
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              className="h-9 w-16 rounded-md border border-input bg-background text-lg text-center"
            >
              {EMOJI_OPTIONS.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
            <Input
              placeholder="Habit name (e.g. Meditate 10 min)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Button type="submit" size="sm" disabled={!name.trim()}>
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
        </form>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : habits.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No habits yet. Add your first one above.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {habits.map((h) => (
              <li
                key={h.id}
                className={`group flex items-center gap-3 rounded-md border p-2.5 ${h.is_archived ? "opacity-50" : ""}`}
              >
                <span className="text-xl">{h.emoji}</span>
                <span className="flex-1 text-sm">{h.name}</span>
                {h.is_archived && <span className="text-xs text-muted-foreground">archived</span>}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => toggleArchive(h)}
                  className="opacity-0 group-hover:opacity-100 h-7 w-7 p-0"
                  title={h.is_archived ? "Restore" : "Archive"}
                >
                  {h.is_archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(h.id)}
                  className="opacity-0 group-hover:opacity-100 h-7 w-7 p-0 text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
