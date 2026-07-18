'use client'

import { useCallback, useDeferredValue, useEffect, useState } from 'react'
import { Check, Lightbulb, Pin, Plus, Search, Trash2, X } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { AdminNoteRow } from '@/lib/supabase/database.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AdminPageHeader } from './AdminPageHeader'
import { cn } from '@/lib/utils'

type NoteModule = AdminNoteRow['module']
type NoteStatus = AdminNoteRow['status']
type NoteDraft = Pick<AdminNoteRow, 'title' | 'body' | 'tags' | 'module' | 'status' | 'is_pinned'>

const modules: NoteModule[] = ['general', 'productivity', 'workouts', 'nutrition', 'challenges', 'tools']
const statuses: NoteStatus[] = ['idea', 'testing', 'validated', 'rejected']
const emptyDraft: NoteDraft = { title: '', body: '', tags: [], module: 'general', status: 'idea', is_pinned: false }

export function AdminNotesHub({ userId }: { userId: string }) {
  const [supabase] = useState(() => createClient() as unknown as SupabaseClient)
  const [notes, setNotes] = useState<AdminNoteRow[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<NoteDraft>(emptyDraft)
  const [tagInput, setTagInput] = useState('')
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query.trim().toLowerCase())
  const [moduleFilter, setModuleFilter] = useState<'all' | NoteModule>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | NoteStatus>('all')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error: loadError } = await supabase.from('admin_notes').select('*').eq('user_id', userId).order('is_pinned', { ascending: false }).order('updated_at', { ascending: false })
    setNotes((data ?? []) as AdminNoteRow[])
    setError(loadError?.message ?? null)
    setLoading(false)
  }, [supabase, userId])

  useEffect(() => { queueMicrotask(() => void load()) }, [load])

  const filtered = notes.filter((note) => {
    const matchesQuery = !deferredQuery || `${note.title} ${note.body} ${note.tags.join(' ')}`.toLowerCase().includes(deferredQuery)
    return matchesQuery && (moduleFilter === 'all' || note.module === moduleFilter) && (statusFilter === 'all' || note.status === statusFilter)
  })

  function edit(note: AdminNoteRow) {
    setEditingId(note.id)
    setDraft({ title: note.title, body: note.body, tags: note.tags, module: note.module, status: note.status, is_pinned: note.is_pinned })
    setTagInput('')
  }

  function reset() { setEditingId(null); setDraft(emptyDraft); setTagInput('') }

  function addTag() {
    const tag = tagInput.trim().toLowerCase().replace(/\s+/g, '-')
    if (tag && !draft.tags.includes(tag)) setDraft({ ...draft, tags: [...draft.tags, tag] })
    setTagInput('')
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!draft.title.trim()) return
    setSaving(true); setError(null)
    const payload = { ...draft, title: draft.title.trim(), body: draft.body.trim(), user_id: userId, updated_at: new Date().toISOString() }
    const result = editingId
      ? await supabase.from('admin_notes').update(payload).eq('id', editingId).eq('user_id', userId)
      : await supabase.from('admin_notes').insert(payload)
    if (result.error) setError(result.error.message)
    else { reset(); await load() }
    setSaving(false)
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this note?')) return
    const { error: deleteError } = await supabase.from('admin_notes').delete().eq('id', id).eq('user_id', userId)
    if (deleteError) setError(deleteError.message)
    else { if (editingId === id) reset(); await load() }
  }

  async function togglePin(note: AdminNoteRow) {
    const { error: pinError } = await supabase.from('admin_notes').update({ is_pinned: !note.is_pinned, updated_at: new Date().toISOString() }).eq('id', note.id).eq('user_id', userId)
    if (pinError) setError(pinError.message); else await load()
  }

  return <div className="mx-auto max-w-[92rem] space-y-7">
    <AdminPageHeader eyebrow="Experiment notebook" title="Notes lab" description="Capture product ideas, record what you are testing, and decide which experiments deserve a place in LifeQuest." />
    {error && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_26rem]">
      <section className="min-w-0 space-y-4">
        <div className="rounded-[2rem] bg-card p-4 ring-1 ring-border sm:p-5">
          <div className="grid gap-3 md:grid-cols-[1fr_11rem_11rem]"><div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search ideas, tests, or tags" /></div><select className="h-10 rounded-md border bg-background px-3 text-sm capitalize" value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value as typeof moduleFilter)}><option value="all">All modules</option>{modules.map((module) => <option key={module} value={module}>{module}</option>)}</select><select className="h-10 rounded-md border bg-background px-3 text-sm capitalize" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}><option value="all">All statuses</option>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></div>
        </div>

        {loading ? <div className="rounded-[2rem] bg-card p-12 text-center text-sm text-muted-foreground ring-1 ring-border">Loading notes...</div> : filtered.length === 0 ? <div className="rounded-[2rem] bg-card p-12 text-center ring-1 ring-border"><Lightbulb className="mx-auto size-7 text-muted-foreground" /><p className="mt-3 font-medium">No matching notes</p><p className="mt-1 text-sm text-muted-foreground">Capture the assumption behind your next experiment.</p></div> : <div className="grid gap-3 md:grid-cols-2">{filtered.map((note) => <article key={note.id} className={cn('group rounded-[1.5rem] bg-card p-5 ring-1 transition-colors', editingId === note.id ? 'ring-primary' : 'ring-border hover:ring-primary/30')}><div className="flex items-start gap-3"><button onClick={() => togglePin(note)} className={cn('grid size-9 shrink-0 place-items-center rounded-xl bg-muted transition-colors', note.is_pinned && 'bg-primary/10 text-primary')} aria-label={note.is_pinned ? 'Unpin note' : 'Pin note'}><Pin className="size-4" /></button><button className="min-w-0 flex-1 text-left" onClick={() => edit(note)}><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{note.title}</h2><span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">{note.status}</span></div><p className="mt-1 text-xs capitalize text-muted-foreground">{note.module} · Updated {new Date(note.updated_at).toLocaleDateString()}</p></button><Button size="icon" variant="ghost" className="text-muted-foreground opacity-100 sm:opacity-0 sm:group-hover:opacity-100" onClick={() => remove(note.id)} aria-label="Delete note"><Trash2 /></Button></div>{note.body && <p className="mt-4 line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{note.body}</p>}{note.tags.length > 0 && <div className="mt-4 flex flex-wrap gap-1.5">{note.tags.map((tag) => <span key={tag} className="rounded-full bg-muted px-2 py-1 text-[10px]">#{tag}</span>)}</div>}</article>)}</div>}
      </section>

      <form onSubmit={save} className="self-start rounded-[2rem] bg-card p-5 ring-1 ring-border xl:sticky xl:top-10 sm:p-6">
        <div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">{editingId ? 'Editing note' : 'Quick capture'}</p><h2 className="text-xl font-semibold">{editingId ? 'Refine the experiment' : 'New product note'}</h2></div>{editingId && <Button type="button" size="icon" variant="ghost" onClick={reset} aria-label="Close editor"><X /></Button>}</div>
        <div className="mt-5 space-y-2"><Label htmlFor="note-title">Title</Label><Input id="note-title" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="What should we test?" required /></div>
        <div className="mt-4 space-y-2"><Label htmlFor="note-body">Thinking</Label><Textarea id="note-body" className="min-h-56" value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} placeholder="Problem, assumption, test, result, next decision..." /></div>
        <div className="mt-4 grid grid-cols-2 gap-3"><div className="space-y-2"><Label htmlFor="note-module">Module</Label><select id="note-module" className="h-10 w-full rounded-md border bg-background px-3 text-sm capitalize" value={draft.module} onChange={(event) => setDraft({ ...draft, module: event.target.value as NoteModule })}>{modules.map((module) => <option key={module}>{module}</option>)}</select></div><div className="space-y-2"><Label htmlFor="note-status">Status</Label><select id="note-status" className="h-10 w-full rounded-md border bg-background px-3 text-sm capitalize" value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as NoteStatus })}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></div></div>
        <div className="mt-4 space-y-2"><Label htmlFor="note-tag">Tags</Label><div className="flex gap-2"><Input id="note-tag" value={tagInput} onChange={(event) => setTagInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addTag() } }} placeholder="mvp, onboarding..." /><Button type="button" size="icon" variant="outline" onClick={addTag} aria-label="Add tag"><Plus /></Button></div>{draft.tags.length > 0 && <div className="flex flex-wrap gap-1.5">{draft.tags.map((tag) => <button type="button" key={tag} onClick={() => setDraft({ ...draft, tags: draft.tags.filter((item) => item !== tag) })} className="rounded-full bg-muted px-2 py-1 text-xs">#{tag} ×</button>)}</div>}</div>
        <label className="mt-5 flex items-center gap-3 rounded-xl bg-muted/40 p-3 text-sm"><input type="checkbox" checked={draft.is_pinned} onChange={(event) => setDraft({ ...draft, is_pinned: event.target.checked })} /><Pin className="size-4" />Pin this note</label>
        <Button className="mt-5 w-full" type="submit" disabled={saving || !draft.title.trim()}><Check />{saving ? 'Saving...' : editingId ? 'Update note' : 'Save note'}</Button>
      </form>
    </div>
  </div>
}
