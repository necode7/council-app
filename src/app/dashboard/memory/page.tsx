'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Archive, Loader2, Plus, Trash2 } from 'lucide-react'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'

type MemoryType = 'project' | 'goal' | 'preference'

interface MemoryItem {
  id: string
  user_id: string
  memory_type: MemoryType
  title: string
  content: string
  metadata: Record<string, unknown> | null
  is_active: boolean
  created_at: string
}

interface ProfileContext {
  domain: string | null
  bio: string | null
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function readTargetDate(item: MemoryItem) {
  const value = item.metadata?.target_date
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null
  }
  return value
}

function MemoryItemCard({
  item,
  onToggle,
  onDelete,
  typeLabel,
  subtitle,
}: {
  item: MemoryItem
  onToggle: (item: MemoryItem) => void
  onDelete: (item: MemoryItem) => void
  typeLabel: string
  subtitle?: string
}) {
  return (
    <div
      className={clsx(
        'rounded-lg border bg-slate-800/50 p-4 transition-colors',
        item.is_active
          ? 'border-slate-700'
          : 'border-slate-700/70 opacity-70'
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <h4 className="truncate text-base font-semibold text-white">{item.title}</h4>
            <span
              className={clsx(
                'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                item.is_active
                  ? 'bg-emerald-500/15 text-emerald-200'
                  : 'bg-slate-700 text-slate-300'
              )}
            >
              {item.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
          <p className="text-sm text-slate-300">{item.content}</p>
          <p className="mt-2 text-xs text-slate-500">
            {typeLabel} created {formatDate(item.created_at)}
            {subtitle ? ` • ${subtitle}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onToggle(item)}
            className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:border-purple-500 hover:text-white"
          >
            {item.is_active ? 'Set Inactive' : 'Set Active'}
          </button>
          <button
            type="button"
            onClick={() => onDelete(item)}
            className="rounded-md border border-red-500/50 px-3 py-1.5 text-xs font-semibold text-red-200 transition-colors hover:bg-red-500/15"
          >
            <span className="inline-flex items-center gap-1">
              <Trash2 size={13} />
              Delete
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default function MemoryPage() {
  const supabase = useMemo(() => createClient(), [])
  const [userId, setUserId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isClearingDecisionMemory, setIsClearingDecisionMemory] = useState(false)
  const [profile, setProfile] = useState<ProfileContext>({ domain: null, bio: null })
  const [memoryItems, setMemoryItems] = useState<MemoryItem[]>([])
  const [decisionMemoryCount, setDecisionMemoryCount] = useState(0)
  const [clearDecisionMemoryConfirmed, setClearDecisionMemoryConfirmed] =
    useState(false)

  const [showProjectForm, setShowProjectForm] = useState(false)
  const [projectTitle, setProjectTitle] = useState('')
  const [projectDescription, setProjectDescription] = useState('')

  const [showGoalForm, setShowGoalForm] = useState(false)
  const [goalTitle, setGoalTitle] = useState('')
  const [goalDescription, setGoalDescription] = useState('')
  const [goalTargetDate, setGoalTargetDate] = useState('')

  const [showPreferenceForm, setShowPreferenceForm] = useState(false)
  const [preferenceKey, setPreferenceKey] = useState('')
  const [preferenceValue, setPreferenceValue] = useState('')

  useEffect(() => {
    const loadMemoryData = async () => {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser()

        if (authError || !user) {
          throw new Error('You need to be signed in to view memory settings')
        }

        setUserId(user.id)

        const [profileResult, memoryResult, memoryCountResult] = await Promise.all([
          supabase
            .from('profiles')
            .select('domain, bio')
            .eq('id', user.id)
            .single(),
          supabase
            .from('user_memory')
            .select(
              'id, user_id, memory_type, title, content, metadata, is_active, created_at'
            )
            .eq('user_id', user.id)
            .in('memory_type', ['project', 'goal', 'preference'])
            .order('created_at', { ascending: false }),
          supabase
            .from('decision_embeddings')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id),
        ])

        if (profileResult.error || !profileResult.data) {
          throw new Error('Failed to load profile context')
        }
        if (memoryResult.error) {
          throw new Error('Failed to load memory items')
        }
        if (memoryCountResult.error) {
          throw new Error('Failed to load decision memory count')
        }

        setProfile({
          domain: profileResult.data.domain,
          bio: profileResult.data.bio,
        })
        setMemoryItems((memoryResult.data || []) as MemoryItem[])
        setDecisionMemoryCount(memoryCountResult.count || 0)
      } catch (loadError) {
        toast.error(
          loadError instanceof Error ? loadError.message : 'Failed to load memory'
        )
      } finally {
        setIsLoading(false)
      }
    }

    void loadMemoryData()
  }, [supabase])

  const projects = useMemo(
    () => memoryItems.filter((item) => item.memory_type === 'project'),
    [memoryItems]
  )
  const goals = useMemo(
    () => memoryItems.filter((item) => item.memory_type === 'goal'),
    [memoryItems]
  )
  const preferences = useMemo(
    () => memoryItems.filter((item) => item.memory_type === 'preference'),
    [memoryItems]
  )

  const insertMemoryItem = async (
    memoryType: MemoryType,
    title: string,
    content: string,
    metadata?: Record<string, unknown>
  ) => {
    if (!userId) {
      toast.error('Please sign in again')
      return null
    }

    const { data, error } = await supabase
      .from('user_memory')
      .insert({
        user_id: userId,
        memory_type: memoryType,
        title,
        content,
        metadata: metadata || {},
      })
      .select(
        'id, user_id, memory_type, title, content, metadata, is_active, created_at'
      )
      .single()

    if (error || !data) {
      throw error || new Error('Failed to insert memory item')
    }

    setMemoryItems((current) => [data as MemoryItem, ...current])
    return data as MemoryItem
  }

  const handleAddProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const title = projectTitle.trim()
    const description = projectDescription.trim()
    if (!title || !description) {
      toast.error('Project title and description are required')
      return
    }

    setIsSaving(true)
    try {
      await insertMemoryItem('project', title, description)
      setProjectTitle('')
      setProjectDescription('')
      setShowProjectForm(false)
      toast.success('Project added')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add project')
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddGoal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const title = goalTitle.trim()
    const description = goalDescription.trim()
    if (!title || !description) {
      toast.error('Goal title and description are required')
      return
    }

    setIsSaving(true)
    try {
      const metadata = goalTargetDate ? { target_date: goalTargetDate } : {}
      await insertMemoryItem('goal', title, description, metadata)
      setGoalTitle('')
      setGoalDescription('')
      setGoalTargetDate('')
      setShowGoalForm(false)
      toast.success('Goal added')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add goal')
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddPreference = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const key = preferenceKey.trim()
    const value = preferenceValue.trim()
    if (!key || !value) {
      toast.error('Preference key and value are required')
      return
    }

    setIsSaving(true)
    try {
      await insertMemoryItem('preference', key, value, { key, value })
      setPreferenceKey('')
      setPreferenceValue('')
      setShowPreferenceForm(false)
      toast.success('Preference added')
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to add preference'
      )
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleMemory = async (item: MemoryItem) => {
    const nextActive = !item.is_active

    try {
      const { data, error } = await supabase
        .from('user_memory')
        .update({ is_active: nextActive })
        .eq('id', item.id)
        .eq('user_id', item.user_id)
        .select(
          'id, user_id, memory_type, title, content, metadata, is_active, created_at'
        )
        .single()

      if (error || !data) {
        throw error || new Error('Failed to update memory item')
      }

      setMemoryItems((current) =>
        current.map((entry) =>
          entry.id === item.id ? (data as MemoryItem) : entry
        )
      )
      toast.success(nextActive ? 'Set active' : 'Set inactive')
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to update memory item'
      )
    }
  }

  const handleDeleteMemory = async (item: MemoryItem) => {
    const confirmed = window.confirm(`Delete "${item.title}"?`)
    if (!confirmed) {
      return
    }

    try {
      const { error } = await supabase
        .from('user_memory')
        .delete()
        .eq('id', item.id)
        .eq('user_id', item.user_id)

      if (error) {
        throw error
      }

      setMemoryItems((current) => current.filter((entry) => entry.id !== item.id))
      toast.success('Memory item deleted')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete item')
    }
  }

  const handleClearDecisionMemory = async () => {
    if (!userId || !clearDecisionMemoryConfirmed) {
      return
    }

    setIsClearingDecisionMemory(true)
    try {
      const { error } = await supabase
        .from('decision_embeddings')
        .delete()
        .eq('user_id', userId)

      if (error) {
        throw error
      }

      setDecisionMemoryCount(0)
      setClearDecisionMemoryConfirmed(false)
      toast.success('Decision memory cleared')
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to clear decision memory'
      )
    } finally {
      setIsClearingDecisionMemory(false)
    }
  }

  return (
    <div className="min-h-full bg-slate-900 px-5 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <header>
          <h1 className="text-3xl font-bold text-white sm:text-4xl">
            Memory Settings
          </h1>
          <p className="mt-2 text-slate-400">
            Manage the persistent context Council uses across sessions.
          </p>
        </header>

        {isLoading ? (
          <div className="rounded-lg border border-slate-700 bg-slate-800/45 px-6 py-14 text-center">
            <Loader2 size={28} className="mx-auto animate-spin text-slate-300" />
            <p className="mt-4 text-slate-400">Loading memory...</p>
          </div>
        ) : (
          <>
            <section className="rounded-lg border border-slate-700 bg-slate-800/45 p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-bold text-white">Profile Context</h2>
                <Link
                  href="/dashboard/settings"
                  className="text-sm font-semibold text-purple-300 transition-colors hover:text-purple-200"
                >
                  Edit in Settings
                </Link>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-700 bg-slate-900/55 p-4">
                  <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">
                    Domain
                  </p>
                  <p className="font-medium text-slate-100">
                    {profile.domain || 'Not set yet'}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-700 bg-slate-900/55 p-4">
                  <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">
                    Bio
                  </p>
                  <p className="text-sm text-slate-200">
                    {profile.bio || 'Add a short bio in Settings to enrich context.'}
                  </p>
                </div>
              </div>

              <p className="mt-4 text-sm text-slate-400">
                This context is shared with advisors in every council.
              </p>
            </section>

            <section className="rounded-lg border border-slate-700 bg-slate-800/45 p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-bold text-white">Active Projects</h2>
                <button
                  type="button"
                  onClick={() => setShowProjectForm((open) => !open)}
                  className="inline-flex items-center gap-2 rounded-md bg-purple-600 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-500"
                >
                  <Plus size={14} />
                  Add Project
                </button>
              </div>

              {showProjectForm && (
                <form
                  onSubmit={handleAddProject}
                  className="mb-5 space-y-3 rounded-lg border border-slate-700 bg-slate-900/60 p-4"
                >
                  <input
                    value={projectTitle}
                    onChange={(event) => setProjectTitle(event.target.value)}
                    type="text"
                    placeholder="Project title"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-slate-100 outline-none transition-colors placeholder:text-slate-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30"
                  />
                  <textarea
                    value={projectDescription}
                    onChange={(event) => setProjectDescription(event.target.value)}
                    rows={3}
                    placeholder="Project description"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-slate-100 outline-none transition-colors placeholder:text-slate-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="rounded-md bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-500 disabled:cursor-not-allowed disabled:bg-slate-700"
                    >
                      {isSaving ? 'Saving...' : 'Save Project'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowProjectForm(false)
                        setProjectTitle('')
                        setProjectDescription('')
                      }}
                      className="rounded-md border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-400"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {projects.length === 0 ? (
                <p className="text-sm text-slate-400">No projects yet.</p>
              ) : (
                <div className="space-y-3">
                  {projects.map((item) => (
                    <MemoryItemCard
                      key={item.id}
                      item={item}
                      typeLabel="Project"
                      onToggle={handleToggleMemory}
                      onDelete={handleDeleteMemory}
                    />
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-lg border border-slate-700 bg-slate-800/45 p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-bold text-white">Goals</h2>
                <button
                  type="button"
                  onClick={() => setShowGoalForm((open) => !open)}
                  className="inline-flex items-center gap-2 rounded-md bg-purple-600 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-500"
                >
                  <Plus size={14} />
                  Add Goal
                </button>
              </div>

              {showGoalForm && (
                <form
                  onSubmit={handleAddGoal}
                  className="mb-5 space-y-3 rounded-lg border border-slate-700 bg-slate-900/60 p-4"
                >
                  <input
                    value={goalTitle}
                    onChange={(event) => setGoalTitle(event.target.value)}
                    type="text"
                    placeholder="Goal title"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-slate-100 outline-none transition-colors placeholder:text-slate-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30"
                  />
                  <textarea
                    value={goalDescription}
                    onChange={(event) => setGoalDescription(event.target.value)}
                    rows={3}
                    placeholder="Goal description"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-slate-100 outline-none transition-colors placeholder:text-slate-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30"
                  />
                  <input
                    value={goalTargetDate}
                    onChange={(event) => setGoalTargetDate(event.target.value)}
                    type="date"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-slate-100 outline-none transition-colors focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="rounded-md bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-500 disabled:cursor-not-allowed disabled:bg-slate-700"
                    >
                      {isSaving ? 'Saving...' : 'Save Goal'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowGoalForm(false)
                        setGoalTitle('')
                        setGoalDescription('')
                        setGoalTargetDate('')
                      }}
                      className="rounded-md border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-400"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {goals.length === 0 ? (
                <p className="text-sm text-slate-400">No goals yet.</p>
              ) : (
                <div className="space-y-3">
                  {goals.map((item) => {
                    const targetDate = readTargetDate(item)
                    return (
                      <MemoryItemCard
                        key={item.id}
                        item={item}
                        typeLabel="Goal"
                        subtitle={targetDate ? `Target ${formatDate(targetDate)}` : undefined}
                        onToggle={handleToggleMemory}
                        onDelete={handleDeleteMemory}
                      />
                    )
                  })}
                </div>
              )}
            </section>

            <section className="rounded-lg border border-slate-700 bg-slate-800/45 p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-bold text-white">Preferences</h2>
                <button
                  type="button"
                  onClick={() => setShowPreferenceForm((open) => !open)}
                  className="inline-flex items-center gap-2 rounded-md bg-purple-600 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-500"
                >
                  <Plus size={14} />
                  Add Preference
                </button>
              </div>

              {showPreferenceForm && (
                <form
                  onSubmit={handleAddPreference}
                  className="mb-5 grid gap-3 rounded-lg border border-slate-700 bg-slate-900/60 p-4 sm:grid-cols-2"
                >
                  <input
                    value={preferenceKey}
                    onChange={(event) => setPreferenceKey(event.target.value)}
                    type="text"
                    placeholder="Preference key (e.g. Risk Tolerance)"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-slate-100 outline-none transition-colors placeholder:text-slate-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30"
                  />
                  <input
                    value={preferenceValue}
                    onChange={(event) => setPreferenceValue(event.target.value)}
                    type="text"
                    placeholder="Preference value (e.g. Conservative)"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-slate-100 outline-none transition-colors placeholder:text-slate-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30"
                  />
                  <div className="sm:col-span-2 flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="rounded-md bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-500 disabled:cursor-not-allowed disabled:bg-slate-700"
                    >
                      {isSaving ? 'Saving...' : 'Save Preference'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPreferenceForm(false)
                        setPreferenceKey('')
                        setPreferenceValue('')
                      }}
                      className="rounded-md border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-400"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {preferences.length === 0 ? (
                <p className="text-sm text-slate-400">No preferences yet.</p>
              ) : (
                <div className="space-y-3">
                  {preferences.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-800/50 p-4"
                    >
                      <div>
                        <p className="font-semibold text-slate-100">{item.title}</p>
                        <p className="text-sm text-slate-300">{item.content}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteMemory(item)}
                        className="rounded-md border border-red-500/50 px-3 py-1.5 text-xs font-semibold text-red-200 transition-colors hover:bg-red-500/15"
                      >
                        <span className="inline-flex items-center gap-1">
                          <Trash2 size={13} />
                          Delete
                        </span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-lg border border-slate-700 bg-slate-800/45 p-6">
              <h2 className="text-xl font-bold text-white">Past Decision Memory</h2>
              <div className="mt-4 rounded-lg border border-slate-700 bg-slate-900/55 p-4">
                <div className="flex items-center gap-3">
                  <Archive size={20} className="text-slate-300" />
                  <p className="text-slate-200">
                    Council remembers{' '}
                    <span className="font-semibold text-purple-300">
                      {decisionMemoryCount}
                    </span>{' '}
                    past decisions
                  </p>
                </div>
                <p className="mt-2 text-sm text-slate-400">
                  Relevant past decisions are automatically retrieved when you run a
                  new council.
                </p>
              </div>

              <div className="mt-5 rounded-lg border border-red-500/35 bg-red-950/20 p-4">
                <p className="font-semibold text-red-100">Danger Zone</p>
                <p className="mt-1 text-sm text-red-200/80">
                  Clear all stored decision memory embeddings for this account.
                </p>
                <label className="mt-3 flex items-center gap-2 text-sm text-red-200">
                  <input
                    type="checkbox"
                    checked={clearDecisionMemoryConfirmed}
                    onChange={(event) =>
                      setClearDecisionMemoryConfirmed(event.target.checked)
                    }
                    className="h-4 w-4 accent-red-500"
                  />
                  I understand this cannot be undone.
                </label>
                <button
                  type="button"
                  onClick={handleClearDecisionMemory}
                  disabled={!clearDecisionMemoryConfirmed || isClearingDecisionMemory}
                  className="mt-3 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-red-900/50"
                >
                  {isClearingDecisionMemory
                    ? 'Clearing...'
                    : 'Clear all decision memory'}
                </button>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
