'use client'

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  AlertTriangle,
  Archive,
  BookOpen,
  Check,
  CheckSquare2,
  ChevronRight,
  Cloud,
  CloudOff,
  Columns2,
  Download,
  FileClock,
  FilePlus2,
  FileText,
  Folder,
  FolderPlus,
  Link2,
  ListFilter,
  LoaderCircle,
  PanelRight,
  Pin,
  Plus,
  RefreshCw,
  Save,
  Search,
  Tag,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type {
  Json,
  KnowledgeFolderRow,
  KnowledgeNoteLinkRow,
  KnowledgeNoteRow,
  KnowledgeNoteType,
  KnowledgeNoteVersionRow,
  ProjectRow,
} from '@/lib/supabase/database.types'
import type { Task } from '@/lib/types'
import {
  normalizeKnowledgeTag,
  wikiLinksForSave,
} from '@/lib/knowledge/wiki-links'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AdminPageHeader } from './AdminPageHeader'
import { MarkdownPreview } from './knowledge/MarkdownPreview'
import { cn } from '@/lib/utils'

type EditorMode = 'edit' | 'preview' | 'split'
type SaveState = 'saved' | 'dirty' | 'saving' | 'offline' | 'error' | 'conflict'
type ContextTab = 'details' | 'backlinks' | 'history'

type NoteDraft = {
  id: string | null
  expectedVersion: number
  title: string
  content: string
  folderId: string | null
  noteType: KnowledgeNoteType
  properties: Record<string, Json | undefined>
  tags: string[]
  aliases: string[]
  isPinned: boolean
}

const blankDraft: NoteDraft = {
  id: null,
  expectedVersion: 0,
  title: '',
  content: '',
  folderId: null,
  noteType: 'note',
  properties: {},
  tags: [],
  aliases: [],
  isPinned: false,
}

const noteTypes: KnowledgeNoteType[] = ['note', 'experiment', 'meeting', 'reference', 'project']

function asProperties(value: Json): Record<string, Json | undefined> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {}
}

function noteToDraft(note: KnowledgeNoteRow): NoteDraft {
  return {
    id: note.id,
    expectedVersion: note.version,
    title: note.title,
    content: note.content,
    folderId: note.folder_id,
    noteType: note.note_type,
    properties: asProperties(note.properties),
    tags: note.tags,
    aliases: note.aliases,
    isPinned: note.is_pinned,
  }
}

function draftStorageKey(id: string | null) {
  return `lifequest:knowledge-draft:${id ?? 'new'}`
}

function checkpointLabel(date: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date))
}

export function AdminNotesHub({ userId, initialNoteId }: { userId: string; initialNoteId?: string }) {
  const [supabase] = useState(() => createClient() as unknown as SupabaseClient)
  const [notes, setNotes] = useState<KnowledgeNoteRow[]>([])
  const [folders, setFolders] = useState<KnowledgeFolderRow[]>([])
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [draft, setDraft] = useState<NoteDraft>(blankDraft)
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase())
  const [folderFilter, setFolderFilter] = useState<string>('all')
  const [editorMode, setEditorMode] = useState<EditorMode>('edit')
  const [contextTab, setContextTab] = useState<ContextTab>('details')
  const [backlinks, setBacklinks] = useState<KnowledgeNoteLinkRow[]>([])
  const [versions, setVersions] = useState<KnowledgeNoteVersionRow[]>([])
  const [linkedProjectIds, setLinkedProjectIds] = useState<string[]>([])
  const [linkedTasks, setLinkedTasks] = useState<Task[]>([])
  const [tagInput, setTagInput] = useState('')
  const [aliasInput, setAliasInput] = useState('')
  const [propertyName, setPropertyName] = useState('')
  const [linkProjectId, setLinkProjectId] = useState('')
  const [wikiQuery, setWikiQuery] = useState<string | null>(null)
  const [wikiStart, setWikiStart] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const savingRef = useRef(false)
  const editRevisionRef = useRef(0)
  const lastSavedNoteIdRef = useRef<string | null>(null)

  const loadContext = useCallback(async (noteId: string | null) => {
    if (!noteId) {
      setBacklinks([])
      setVersions([])
      setLinkedProjectIds([])
      setLinkedTasks([])
      return
    }

    const [backlinkResult, versionResult, projectResult, taskLinkResult] = await Promise.all([
      supabase
        .from('knowledge_note_links')
        .select('*')
        .eq('user_id', userId)
        .eq('target_note_id', noteId)
        .order('created_at', { ascending: false }),
      supabase
        .from('knowledge_note_versions')
        .select('*')
        .eq('user_id', userId)
        .eq('note_id', noteId)
        .order('version', { ascending: false })
        .limit(30),
      supabase
        .from('knowledge_note_projects')
        .select('project_id')
        .eq('user_id', userId)
        .eq('note_id', noteId),
      supabase
        .from('knowledge_note_tasks')
        .select('task_id')
        .eq('user_id', userId)
        .eq('note_id', noteId),
    ])

    setBacklinks((backlinkResult.data ?? []) as KnowledgeNoteLinkRow[])
    setVersions((versionResult.data ?? []) as KnowledgeNoteVersionRow[])
    setLinkedProjectIds((projectResult.data ?? []).map((row) => row.project_id))

    const taskIds = (taskLinkResult.data ?? []).map((row) => row.task_id)
    if (taskIds.length === 0) {
      setLinkedTasks([])
    } else {
      const { data } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .in('id', taskIds)
        .order('is_completed')
        .order('created_at', { ascending: false })
      setLinkedTasks((data ?? []) as Task[])
    }
  }, [supabase, userId])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [noteResult, folderResult, projectResult] = await Promise.all([
      supabase
        .from('knowledge_notes')
        .select('*')
        .eq('user_id', userId)
        .eq('is_archived', false)
        .order('is_pinned', { ascending: false })
        .order('updated_at', { ascending: false })
        .limit(500),
      supabase
        .from('knowledge_folders')
        .select('*')
        .eq('user_id', userId)
        .order('sort_order')
        .order('name'),
      supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .neq('status', 'archived')
        .order('sort_order')
        .order('updated_at', { ascending: false }),
    ])

    const firstError = noteResult.error ?? folderResult.error ?? projectResult.error
    if (firstError) {
      setError(firstError.message)
      setLoading(false)
      return
    }

    const loadedNotes = (noteResult.data ?? []) as KnowledgeNoteRow[]
    setNotes(loadedNotes)
    setFolders((folderResult.data ?? []) as KnowledgeFolderRow[])
    setProjects((projectResult.data ?? []) as ProjectRow[])
    setDraft((current) => {
      if (current.id) {
        const currentNote = loadedNotes.find((note) => note.id === current.id)
        if (currentNote) return noteToDraft(currentNote)
      }
      const requested = initialNoteId
        ? loadedNotes.find((note) => note.id === initialNoteId)
        : null
      return requested
        ? noteToDraft(requested)
        : loadedNotes[0]
          ? noteToDraft(loadedNotes[0])
          : blankDraft
    })
    setDirty(false)
    setSaveState('saved')
    setLoading(false)
  }, [initialNoteId, supabase, userId])

  useEffect(() => {
    queueMicrotask(() => void load())
  }, [load])

  useEffect(() => {
    queueMicrotask(() => void loadContext(draft.id))
  }, [draft.id, loadContext])

  useEffect(() => {
    const onOnline = () => {
      if (dirty) setSaveState('dirty')
    }
    const onOffline = () => {
      if (dirty) setSaveState('offline')
    }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [dirty])

  useEffect(() => {
    if (!dirty) return
    try {
      localStorage.setItem(
        draftStorageKey(draft.id),
        JSON.stringify({ ...draft, localSavedAt: new Date().toISOString() })
      )
    } catch {
      // Local draft recovery is best effort; database saving remains authoritative.
    }
  }, [dirty, draft])

  const updateDraft = useCallback((patch: Partial<NoteDraft>) => {
    editRevisionRef.current += 1
    setDraft((current) => ({ ...current, ...patch }))
    setDirty(true)
    setSaveState(navigator.onLine ? 'dirty' : 'offline')
  }, [])

  const persist = useCallback(async (checkpoint = false) => {
    if (!draft.title.trim() || savingRef.current) return false
    if (!navigator.onLine) {
      setSaveState('offline')
      return false
    }

    const revision = editRevisionRef.current
    const previousId = draft.id
    savingRef.current = true
    setSaveState('saving')
    setError(null)

    const { data, error: saveError } = await supabase.rpc('save_knowledge_note', {
      p_note_id: draft.id,
      p_expected_version: draft.expectedVersion,
      p_title: draft.title.trim(),
      p_content: draft.content,
      p_folder_id: draft.folderId,
      p_note_type: draft.noteType,
      p_properties: draft.properties,
      p_tags: draft.tags,
      p_aliases: draft.aliases,
      p_is_pinned: draft.isPinned,
      p_links: wikiLinksForSave(draft.content),
      p_checkpoint: checkpoint,
    })

    savingRef.current = false
    if (saveError) {
      const conflict = saveError.message.includes('NOTE_CONFLICT')
      setSaveState(conflict ? 'conflict' : 'error')
      setError(conflict
        ? 'This note changed elsewhere. Reload it before saving to avoid overwriting newer work.'
        : saveError.message)
      return false
    }

    const saved = (data as {
      saved_note_id: string
      saved_version: number
      saved_updated_at: string
    }[] | null)?.[0]
    if (!saved) {
      setSaveState('error')
      setError('The note save returned no result.')
      return false
    }

    const nextId = saved.saved_note_id
    lastSavedNoteIdRef.current = nextId
    setDraft((current) => ({
      ...current,
      id: nextId,
      expectedVersion: saved.saved_version,
    }))

    if (previousId) {
      setNotes((current) => current
        .map((note) => note.id === previousId ? {
          ...note,
          folder_id: draft.folderId,
          title: draft.title.trim(),
          content: draft.content,
          note_type: draft.noteType,
          properties: draft.properties,
          tags: draft.tags,
          aliases: draft.aliases,
          is_pinned: draft.isPinned,
          version: saved.saved_version,
          updated_at: saved.saved_updated_at,
        } : note)
        .sort((a, b) =>
          Number(b.is_pinned) - Number(a.is_pinned) ||
          b.updated_at.localeCompare(a.updated_at)
        ))
    } else {
      const { data: created } = await supabase
        .from('knowledge_notes')
        .select('*')
        .eq('id', nextId)
        .eq('user_id', userId)
        .single()
      if (created) setNotes((current) => [created as KnowledgeNoteRow, ...current])
    }

    if (editRevisionRef.current === revision) {
      setDirty(false)
      setSaveState('saved')
      try {
        localStorage.removeItem(draftStorageKey(previousId))
        localStorage.removeItem(draftStorageKey(nextId))
      } catch {
        // Ignore unavailable browser storage.
      }
    } else {
      setDirty(true)
      setSaveState('dirty')
    }

    await loadContext(nextId)
    return true
  }, [draft, loadContext, supabase, userId])

  useEffect(() => {
    if (!dirty || !draft.title.trim() || saveState === 'conflict') return
    const timer = window.setTimeout(() => void persist(false), 1100)
    return () => window.clearTimeout(timer)
  }, [dirty, draft.title, persist, saveState])

  const filteredNotes = useMemo(() => notes.filter((note) => {
    const inFolder = folderFilter === 'all'
      || (folderFilter === 'unfiled' ? !note.folder_id : note.folder_id === folderFilter)
    if (!inFolder) return false
    if (!deferredQuery) return true
    return `${note.title} ${note.content} ${note.tags.join(' ')} ${note.aliases.join(' ')}`
      .toLocaleLowerCase()
      .includes(deferredQuery)
  }), [deferredQuery, folderFilter, notes])

  const wikiSuggestions = useMemo(() => {
    if (wikiQuery === null) return []
    const normalized = wikiQuery.toLocaleLowerCase()
    return notes
      .filter((note) =>
        note.id !== draft.id
        && (
          note.title.toLocaleLowerCase().includes(normalized)
          || note.aliases.some((alias) => alias.toLocaleLowerCase().includes(normalized))
        )
      )
      .slice(0, 6)
  }, [draft.id, notes, wikiQuery])

  function draftWithRecovery(note: KnowledgeNoteRow) {
    const serverDraft = noteToDraft(note)
    try {
      const raw = localStorage.getItem(draftStorageKey(note.id))
      if (!raw) return serverDraft
      const local = JSON.parse(raw) as NoteDraft
      if (local.expectedVersion === note.version) {
        setDirty(true)
        setSaveState(navigator.onLine ? 'dirty' : 'offline')
        return local
      }
    } catch {
      // Ignore malformed drafts.
    }
    return serverDraft
  }

  async function selectNote(note: KnowledgeNoteRow) {
    if (note.id === draft.id) return
    if (dirty && !(await persist(false))) return
    setDirty(false)
    setSaveState('saved')
    setDraft(draftWithRecovery(note))
    setWikiQuery(null)
  }

  async function createNote(title = '') {
    if (dirty && !(await persist(false))) return
    const recovered = (() => {
      try {
        const raw = localStorage.getItem(draftStorageKey(null))
        return raw ? JSON.parse(raw) as NoteDraft : null
      } catch {
        return null
      }
    })()
    setDraft(recovered ?? { ...blankDraft, title })
    setDirty(Boolean(recovered || title))
    setSaveState(recovered || title ? 'dirty' : 'saved')
    setEditorMode('edit')
    setWikiQuery(null)
    requestAnimationFrame(() => textareaRef.current?.focus())
  }

  async function archiveNote() {
    if (!draft.id || !window.confirm(`Archive “${draft.title}”?`)) return
    const { error: archiveError } = await supabase
      .from('knowledge_notes')
      .update({ is_archived: true, updated_at: new Date().toISOString() })
      .eq('id', draft.id)
      .eq('user_id', userId)
    if (archiveError) {
      setError(archiveError.message)
      return
    }
    const remaining = notes.filter((note) => note.id !== draft.id)
    setNotes(remaining)
    setDraft(remaining[0] ? noteToDraft(remaining[0]) : blankDraft)
    setDirty(false)
    setSaveState('saved')
  }

  async function createFolder() {
    const name = window.prompt('Folder name')?.trim()
    if (!name) return
    const { data, error: folderError } = await supabase
      .from('knowledge_folders')
      .insert({ user_id: userId, name })
      .select('*')
      .single()
    if (folderError) setError(folderError.message)
    else setFolders((current) => [...current, data as KnowledgeFolderRow].sort((a, b) => a.name.localeCompare(b.name)))
  }

  function addTag() {
    const value = normalizeKnowledgeTag(tagInput)
    if (value && !draft.tags.includes(value)) updateDraft({ tags: [...draft.tags, value] })
    setTagInput('')
  }

  function addAlias() {
    const value = aliasInput.trim()
    if (value && !draft.aliases.includes(value)) updateDraft({ aliases: [...draft.aliases, value] })
    setAliasInput('')
  }

  function addProperty() {
    const key = propertyName.trim().replace(/\s+/g, '_').toLocaleLowerCase()
    if (!key || key in draft.properties) return
    updateDraft({ properties: { ...draft.properties, [key]: '' } })
    setPropertyName('')
  }

  function insertMarkdown(before: string, after = before, fallback = 'text') {
    const textarea = textareaRef.current
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selected = draft.content.slice(start, end) || fallback
    const next = `${draft.content.slice(0, start)}${before}${selected}${after}${draft.content.slice(end)}`
    updateDraft({ content: next })
    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(start + before.length, start + before.length + selected.length)
    })
  }

  function handleContentChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    const content = event.target.value
    const cursor = event.target.selectionStart
    const match = content.slice(0, cursor).match(/\[\[([^\]\n|#]*)$/)
    setWikiQuery(match ? match[1] : null)
    setWikiStart(match ? cursor - match[0].length : null)
    updateDraft({ content })
  }

  function insertWikiLink(note: KnowledgeNoteRow) {
    const textarea = textareaRef.current
    if (!textarea || wikiStart === null) return
    const cursor = textarea.selectionStart
    const insertion = `[[${note.title}]]`
    const content = `${draft.content.slice(0, wikiStart)}${insertion}${draft.content.slice(cursor)}`
    updateDraft({ content })
    setWikiQuery(null)
    setWikiStart(null)
    requestAnimationFrame(() => {
      const nextCursor = wikiStart + insertion.length
      textarea.focus()
      textarea.setSelectionRange(nextCursor, nextCursor)
    })
  }

  async function openWikiReference(reference: string) {
    if (reference.startsWith('new:')) {
      await createNote(reference.slice(4))
      return
    }
    const note = notes.find((item) => item.id === reference)
    if (note) await selectNote(note)
  }

  async function linkProject() {
    if (!draft.id || !linkProjectId || linkedProjectIds.includes(linkProjectId)) return
    const { error: linkError } = await supabase
      .from('knowledge_note_projects')
      .insert({ user_id: userId, note_id: draft.id, project_id: linkProjectId })
    if (linkError) setError(linkError.message)
    else {
      setLinkedProjectIds((current) => [...current, linkProjectId])
      setLinkProjectId('')
    }
  }

  async function unlinkProject(projectId: string) {
    if (!draft.id) return
    const { error: unlinkError } = await supabase
      .from('knowledge_note_projects')
      .delete()
      .eq('user_id', userId)
      .eq('note_id', draft.id)
      .eq('project_id', projectId)
    if (unlinkError) setError(unlinkError.message)
    else setLinkedProjectIds((current) => current.filter((id) => id !== projectId))
  }

  async function createTaskFromSelection() {
    if (!draft.id && !(await persist(false))) return
    const noteId = draft.id ?? lastSavedNoteIdRef.current
    if (!noteId) return
    const textarea = textareaRef.current
    const selected = textarea
      ? draft.content.slice(textarea.selectionStart, textarea.selectionEnd).trim()
      : ''
    const title = selected || window.prompt('Task title')?.trim()
    if (!title) return
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .insert({
        user_id: userId,
        title: title.slice(0, 240),
        priority: 'medium',
        status: 'todo',
        project_id: linkedProjectIds[0] ?? null,
      })
      .select('*')
      .single()
    if (taskError) {
      setError(taskError.message)
      return
    }
    const { error: linkError } = await supabase
      .from('knowledge_note_tasks')
      .insert({ user_id: userId, note_id: noteId, task_id: task.id })
    if (linkError) setError(linkError.message)
    else setLinkedTasks((current) => [task as Task, ...current])
  }

  async function toggleLinkedTask(task: Task) {
    const { data, error: taskError } = await supabase
      .from('tasks')
      .update({
        is_completed: !task.is_completed,
        completed_at: task.is_completed ? null : new Date().toISOString(),
      })
      .eq('id', task.id)
      .eq('user_id', userId)
      .select('*')
      .single()
    if (taskError) setError(taskError.message)
    else setLinkedTasks((current) => current.map((item) => item.id === task.id ? data as Task : item))
  }

  async function restoreVersion(version: KnowledgeNoteVersionRow) {
    if (!window.confirm(`Restore checkpoint ${version.version}? A new checkpoint of the current note will be kept.`)) return
    if (!(await persist(true))) return
    updateDraft({
      title: version.title,
      content: version.content,
      properties: asProperties(version.properties),
      tags: version.tags,
      aliases: version.aliases,
    })
  }

  function exportMarkdown() {
    const frontmatter = [
      '---',
      `title: ${JSON.stringify(draft.title)}`,
      `type: ${draft.noteType}`,
      `tags: [${draft.tags.map((tag) => JSON.stringify(tag)).join(', ')}]`,
      `aliases: [${draft.aliases.map((alias) => JSON.stringify(alias)).join(', ')}]`,
      '---',
      '',
    ].join('\n')
    const blob = new Blob([frontmatter + draft.content], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${draft.title.trim().replace(/[^a-z0-9-_]+/gi, '-').replace(/^-|-$/g, '') || 'note'}.md`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const statusView = {
    saved: { icon: Check, label: 'Saved', className: 'text-emerald-600' },
    dirty: { icon: Cloud, label: 'Unsaved changes', className: 'text-amber-600' },
    saving: { icon: LoaderCircle, label: 'Saving…', className: 'text-muted-foreground' },
    offline: { icon: CloudOff, label: 'Saved locally', className: 'text-amber-600' },
    error: { icon: AlertTriangle, label: 'Save failed', className: 'text-destructive' },
    conflict: { icon: AlertTriangle, label: 'Conflict', className: 'text-destructive' },
  }[saveState]
  const StatusIcon = statusView.icon

  return (
    <div className="mx-auto max-w-[110rem] space-y-5">
      <AdminPageHeader
        eyebrow="Knowledge workspace"
        title="Notes"
        description="Think in Markdown, connect ideas with wikilinks, and turn useful context into project work."
      />

      {(error || saveState === 'conflict') && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="size-4" />
          <span className="min-w-0 flex-1">{error}</span>
          {saveState === 'conflict' && (
            <Button size="sm" variant="outline" onClick={() => void load()}>
              <RefreshCw /> Reload
            </Button>
          )}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[17rem_minmax(0,1fr)_19rem]">
        <aside className="min-w-0 space-y-3 xl:sticky xl:top-8 xl:max-h-[calc(100dvh-4rem)]">
          <div className="rounded-[1.5rem] bg-card p-3 ring-1 ring-border">
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => void createNote()}>
                <FilePlus2 /> New note
              </Button>
              <Button size="icon" variant="outline" onClick={() => void createFolder()} aria-label="Create folder">
                <FolderPlus />
              </Button>
            </div>
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search notes"
              />
            </div>
          </div>

          <div className="rounded-[1.5rem] bg-card p-2 ring-1 ring-border">
            <button
              type="button"
              onClick={() => setFolderFilter('all')}
              className={cn('flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm', folderFilter === 'all' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
            >
              <FileText className="size-4" /> All notes
              <span className="ml-auto font-mono text-xs">{notes.length}</span>
            </button>
            <button
              type="button"
              onClick={() => setFolderFilter('unfiled')}
              className={cn('flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm', folderFilter === 'unfiled' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
            >
              <ListFilter className="size-4" /> Unfiled
            </button>
            {folders.map((folder) => (
              <button
                type="button"
                key={folder.id}
                onClick={() => setFolderFilter(folder.id)}
                className={cn('flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm', folderFilter === folder.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
              >
                <Folder className="size-4" />
                <span className="min-w-0 flex-1 truncate">{folder.name}</span>
              </button>
            ))}
          </div>

          <div className="max-h-[28rem] space-y-1 overflow-y-auto rounded-[1.5rem] bg-card p-2 ring-1 ring-border xl:max-h-[calc(100dvh-22rem)]">
            {loading ? (
              <p className="p-6 text-center text-sm text-muted-foreground">Loading notes…</p>
            ) : filteredNotes.length === 0 ? (
              <div className="p-6 text-center">
                <FileText className="mx-auto size-6 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium">No notes found</p>
              </div>
            ) : filteredNotes.map((note) => (
              <button
                type="button"
                key={note.id}
                onClick={() => void selectNote(note)}
                className={cn(
                  'w-full rounded-xl px-3 py-3 text-left transition-colors',
                  draft.id === note.id ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-muted'
                )}
              >
                <div className="flex items-center gap-2">
                  {note.is_pinned && <Pin className="size-3.5 shrink-0 text-primary" />}
                  <p className="min-w-0 flex-1 truncate text-sm font-medium">{note.title}</p>
                  <ChevronRight className="size-3.5 text-muted-foreground" />
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                  {note.content.replace(/[#>*_`\[\]]/g, '').trim() || 'Empty note'}
                </p>
              </button>
            ))}
          </div>
        </aside>

        <main className="min-w-0 overflow-hidden rounded-[1.75rem] bg-card ring-1 ring-border">
          <div className="flex flex-wrap items-center gap-2 border-b px-3 py-3 sm:px-5">
            <div className="flex rounded-xl bg-muted p-1">
              {([
                ['edit', FileText, 'Edit'],
                ['preview', BookOpen, 'Read'],
                ['split', Columns2, 'Split'],
              ] as const).map(([mode, Icon, label]) => (
                <button
                  type="button"
                  key={mode}
                  onClick={() => setEditorMode(mode)}
                  className={cn('flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-medium', editorMode === mode ? 'bg-background shadow-sm' : 'text-muted-foreground')}
                >
                  <Icon className="size-3.5" /> {label}
                </button>
              ))}
            </div>
            <div className={cn('ml-auto flex items-center gap-1.5 text-xs', statusView.className)}>
              <StatusIcon className={cn('size-3.5', saveState === 'saving' && 'animate-spin')} />
              {statusView.label}
            </div>
            <Button size="sm" variant="outline" onClick={() => void persist(true)} disabled={!draft.title.trim() || saveState === 'saving'}>
              <Save /> Checkpoint
            </Button>
            <Button size="icon-sm" variant="ghost" onClick={exportMarkdown} disabled={!draft.title.trim()} aria-label="Export Markdown">
              <Download />
            </Button>
            <Button size="icon-sm" variant="ghost" onClick={() => void archiveNote()} disabled={!draft.id} aria-label="Archive note">
              <Archive />
            </Button>
          </div>

          <div className="border-b px-4 py-4 sm:px-7">
            <Input
              className="h-auto border-0 bg-transparent px-0 py-0 text-2xl font-semibold tracking-tight shadow-none focus-visible:ring-0 sm:text-3xl dark:bg-transparent"
              value={draft.title}
              onChange={(event) => updateDraft({ title: event.target.value })}
              placeholder="Untitled note"
              aria-label="Note title"
            />
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <select
                className="h-8 rounded-lg border bg-background px-2 capitalize"
                value={draft.noteType}
                onChange={(event) => updateDraft({ noteType: event.target.value as KnowledgeNoteType })}
              >
                {noteTypes.map((type) => <option key={type}>{type}</option>)}
              </select>
              <select
                className="h-8 rounded-lg border bg-background px-2"
                value={draft.folderId ?? ''}
                onChange={(event) => updateDraft({ folderId: event.target.value || null })}
              >
                <option value="">No folder</option>
                {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
              </select>
              {draft.id && <span>v{draft.expectedVersion}</span>}
            </div>
          </div>

          {(editorMode === 'edit' || editorMode === 'split') && (
            <div className="border-b px-3 py-2 sm:px-5">
              <div className="flex flex-wrap gap-1">
                <Button size="xs" variant="ghost" onClick={() => insertMarkdown('**')}>Bold</Button>
                <Button size="xs" variant="ghost" onClick={() => insertMarkdown('_')}>Italic</Button>
                <Button size="xs" variant="ghost" onClick={() => insertMarkdown('[[', ']]', 'Note')}>Link</Button>
                <Button size="xs" variant="ghost" onClick={() => insertMarkdown('- [ ] ', '', 'Task')}>Checkbox</Button>
                <Button size="xs" variant="ghost" onClick={() => insertMarkdown('> ', '', 'Quote')}>Quote</Button>
                <Button size="xs" variant="ghost" onClick={() => void createTaskFromSelection()}>
                  <CheckSquare2 /> Create task
                </Button>
              </div>
            </div>
          )}

          <div className={cn('grid min-h-[38rem]', editorMode === 'split' && 'lg:grid-cols-2')}>
            {(editorMode === 'edit' || editorMode === 'split') && (
              <div className="relative min-w-0 border-r">
                <Textarea
                  ref={textareaRef}
                  className="min-h-[38rem] resize-none rounded-none border-0 bg-transparent p-5 font-mono text-[15px] leading-7 focus-visible:ring-0 sm:p-7 dark:bg-transparent"
                  value={draft.content}
                  onChange={handleContentChange}
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 's') {
                      event.preventDefault()
                      void persist(true)
                    }
                    if (event.key === 'Escape') setWikiQuery(null)
                  }}
                  placeholder="Start writing in Markdown. Type [[ to link another note…"
                  spellCheck
                />
                {wikiQuery !== null && wikiSuggestions.length > 0 && (
                  <div className="absolute left-6 top-16 z-20 w-[min(22rem,calc(100%-3rem))] rounded-xl border bg-popover p-1 shadow-xl">
                    <p className="px-3 py-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Link a note</p>
                    {wikiSuggestions.map((note) => (
                      <button
                        type="button"
                        key={note.id}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => insertWikiLink(note)}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                      >
                        <Link2 className="size-3.5 text-primary" />
                        <span className="truncate">{note.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {(editorMode === 'preview' || editorMode === 'split') && (
              <div className="min-w-0 overflow-y-auto p-5 sm:p-7">
                <MarkdownPreview content={draft.content} notes={notes} onOpenNote={(reference) => void openWikiReference(reference)} />
              </div>
            )}
          </div>
        </main>

        <aside className="min-w-0 rounded-[1.5rem] bg-card ring-1 ring-border xl:sticky xl:top-8 xl:max-h-[calc(100dvh-4rem)] xl:overflow-y-auto">
          <div className="sticky top-0 z-10 flex border-b bg-card p-2">
            {([
              ['details', PanelRight, 'Details'],
              ['backlinks', Link2, 'Links'],
              ['history', FileClock, 'History'],
            ] as const).map(([tab, Icon, label]) => (
              <button
                type="button"
                key={tab}
                onClick={() => setContextTab(tab)}
                className={cn('flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs', contextTab === tab ? 'bg-muted font-medium' : 'text-muted-foreground')}
              >
                <Icon className="size-3.5" /> {label}
              </button>
            ))}
          </div>

          {contextTab === 'details' && (
            <div className="space-y-6 p-4">
              <section>
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Tags</h2>
                  <Tag className="size-4 text-muted-foreground" />
                </div>
                <div className="mt-3 flex gap-2">
                  <Input
                    value={tagInput}
                    onChange={(event) => setTagInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        addTag()
                      }
                    }}
                    placeholder="Add tag"
                  />
                  <Button size="icon" variant="outline" onClick={addTag} aria-label="Add tag"><Plus /></Button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {draft.tags.map((tag) => (
                    <button
                      type="button"
                      key={tag}
                      onClick={() => updateDraft({ tags: draft.tags.filter((item) => item !== tag) })}
                      className="rounded-full bg-muted px-2 py-1 text-xs"
                    >
                      #{tag} ×
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <h2 className="text-sm font-semibold">Aliases</h2>
                <div className="mt-3 flex gap-2">
                  <Input
                    value={aliasInput}
                    onChange={(event) => setAliasInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        addAlias()
                      }
                    }}
                    placeholder="Alternate title"
                  />
                  <Button size="icon" variant="outline" onClick={addAlias} aria-label="Add alias"><Plus /></Button>
                </div>
                <div className="mt-2 space-y-1">
                  {draft.aliases.map((alias) => (
                    <button
                      type="button"
                      key={alias}
                      onClick={() => updateDraft({ aliases: draft.aliases.filter((item) => item !== alias) })}
                      className="flex w-full items-center justify-between rounded-lg bg-muted/60 px-2 py-1.5 text-left text-xs"
                    >
                      {alias}<X className="size-3" />
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <h2 className="text-sm font-semibold">Properties</h2>
                <div className="mt-3 space-y-2">
                  {Object.entries(draft.properties).map(([key, value]) => (
                    <div key={key} className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-1">
                      <Label className="truncate text-xs text-muted-foreground">{key}</Label>
                      <Input
                        value={typeof value === 'string' || typeof value === 'number' ? String(value) : JSON.stringify(value)}
                        onChange={(event) => updateDraft({
                          properties: { ...draft.properties, [key]: event.target.value },
                        })}
                      />
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        onClick={() => {
                          const next = { ...draft.properties }
                          delete next[key]
                          updateDraft({ properties: next })
                        }}
                        aria-label={`Remove ${key}`}
                      >
                        <X />
                      </Button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Input value={propertyName} onChange={(event) => setPropertyName(event.target.value)} placeholder="Property name" />
                    <Button size="icon" variant="outline" onClick={addProperty} aria-label="Add property"><Plus /></Button>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-sm font-semibold">Projects</h2>
                <div className="mt-3 space-y-2">
                  {linkedProjectIds.map((projectId) => {
                    const project = projects.find((item) => item.id === projectId)
                    return project ? (
                      <div key={project.id} className="flex items-center gap-2 rounded-xl bg-muted/60 p-2 text-xs">
                        <span className="size-2 rounded-full" style={{ backgroundColor: project.color }} />
                        <span className="min-w-0 flex-1 truncate">{project.name}</span>
                        <button type="button" onClick={() => void unlinkProject(project.id)} aria-label={`Unlink ${project.name}`}><X className="size-3" /></button>
                      </div>
                    ) : null
                  })}
                  {draft.id && (
                    <div className="flex gap-2">
                      <select className="h-9 min-w-0 flex-1 rounded-lg border bg-background px-2 text-xs" value={linkProjectId} onChange={(event) => setLinkProjectId(event.target.value)}>
                        <option value="">Link project…</option>
                        {projects.filter((project) => !linkedProjectIds.includes(project.id)).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                      </select>
                      <Button size="icon" variant="outline" onClick={() => void linkProject()} disabled={!linkProjectId} aria-label="Link project"><Link2 /></Button>
                    </div>
                  )}
                </div>
              </section>

              <section>
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Linked tasks</h2>
                  <Button size="icon-xs" variant="ghost" onClick={() => void createTaskFromSelection()} disabled={!draft.id} aria-label="Create linked task"><Plus /></Button>
                </div>
                <div className="mt-3 space-y-2">
                  {linkedTasks.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Select text in the editor and create a task.</p>
                  ) : linkedTasks.map((task) => (
                    <button
                      type="button"
                      key={task.id}
                      onClick={() => void toggleLinkedTask(task)}
                      className="flex w-full items-start gap-2 rounded-xl bg-muted/60 p-2 text-left text-xs"
                    >
                      <span className={cn('mt-0.5 grid size-4 shrink-0 place-items-center rounded border', task.is_completed && 'bg-primary text-primary-foreground')}>
                        {task.is_completed && <Check className="size-3" />}
                      </span>
                      <span className={cn('leading-relaxed', task.is_completed && 'line-through text-muted-foreground')}>{task.title}</span>
                    </button>
                  ))}
                </div>
              </section>

              <label className="flex items-center gap-3 rounded-xl bg-muted/50 p-3 text-sm">
                <input type="checkbox" checked={draft.isPinned} onChange={(event) => updateDraft({ isPinned: event.target.checked })} />
                <Pin className="size-4" /> Pin note
              </label>
            </div>
          )}

          {contextTab === 'backlinks' && (
            <div className="space-y-2 p-4">
              {backlinks.length === 0 ? (
                <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No notes link here yet.
                </div>
              ) : backlinks.map((link) => {
                const source = notes.find((note) => note.id === link.source_note_id)
                return source ? (
                  <button
                    type="button"
                    key={link.id}
                    onClick={() => void selectNote(source)}
                    className="w-full rounded-xl bg-muted/50 p-3 text-left hover:bg-muted"
                  >
                    <p className="text-sm font-medium">{source.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{source.content}</p>
                  </button>
                ) : null
              })}
            </div>
          )}

          {contextTab === 'history' && (
            <div className="space-y-2 p-4">
              <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
                Checkpoints are created manually, keeping database usage small.
              </p>
              {versions.length === 0 ? (
                <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No checkpoints yet.
                </div>
              ) : versions.map((version) => (
                <div key={version.id} className="rounded-xl bg-muted/50 p-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs">v{version.version}</span>
                    <span className="ml-auto text-[10px] text-muted-foreground">{checkpointLabel(version.created_at)}</span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{version.content || 'Empty note'}</p>
                  <Button className="mt-2 w-full" size="xs" variant="outline" onClick={() => void restoreVersion(version)}>
                    <RefreshCw /> Restore
                  </Button>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
