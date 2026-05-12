import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ArrowRight } from 'lucide-react'

export const metadata = {
  title: 'Dashboard — Council',
}

const quickActions = [
  {
    title: 'New Strategic Decision',
    description: 'Get diverse perspectives on business strategy',
    href: '/dashboard/new-council?template=strategic-decision',
  },
  {
    title: 'New Contract Review',
    description: 'Have lawyers and advisors review agreements',
    href: '/dashboard/new-council?template=contract-review',
  },
  {
    title: 'New Custom Decision',
    description: 'Ask your council anything',
    href: '/dashboard/new-council?template=custom',
  },
]

export default async function DashboardHome() {
  const supabase = await createClient()

  // Get authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user profile for name and credits
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, credits_remaining')
    .eq('id', user.id)
    .single()

  // Get councils for stats and recent decisions
  const { data: councilsData } = await supabase
    .from('councils')
    .select('id, title, status, created_at, template_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  const councils = councilsData || []

  const { data: templatesData } = await supabase
    .from('templates')
    .select('id, name')

  const templates = templatesData || []

  // Create a map of template IDs to names for quick lookup
  const templateMap = templates.reduce(
    (acc, t) => {
      acc[t.id] = t.name
      return acc
    },
    {} as Record<string, string>
  )

  // Calculate stats
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const councilsThisMonth = councils.filter((c) => {
    const createdAt = new Date(c.created_at)
    return createdAt >= monthStart
  }).length

  const completedCouncils = councils.filter(
    (c) => c.status === 'complete'
  ).length

  const recentDecisions = councils.slice(0, 5)

  return (
    <div className="p-8">
      {/* Welcome section */}
      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-2">
          Welcome back,{' '}
          <span className="bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">
            {profile?.full_name?.split(' ')[0] || 'there'}
          </span>
        </h1>
        <p className="text-slate-400">
          Your AI advisory board is ready. What decision do you need clarity on?
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <p className="text-slate-400 text-sm mb-2">Councils This Month</p>
          <p className="text-3xl font-bold">{councilsThisMonth}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <p className="text-slate-400 text-sm mb-2">Credits Remaining</p>
          <p className="text-3xl font-bold">{profile?.credits_remaining ?? 0}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <p className="text-slate-400 text-sm mb-2">Decisions Archived</p>
          <p className="text-3xl font-bold">{completedCouncils}</p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold mb-6">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="group bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-lg p-6 hover:border-purple-500/50 hover:from-slate-800/80 hover:to-slate-900/80 transition-all"
            >
              <h3 className="font-semibold mb-2 group-hover:text-purple-400 transition-colors">
                {action.title}
              </h3>
              <p className="text-slate-400 text-sm mb-4">{action.description}</p>
              <div className="flex items-center gap-2 text-purple-400 text-sm">
                Start <ArrowRight size={16} />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent decisions */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Recent Decisions</h2>
          {councils.length > 0 && (
            <Link
              href="/dashboard/decisions"
              className="text-purple-400 hover:text-purple-300 text-sm font-medium"
            >
              View all
            </Link>
          )}
        </div>

        {recentDecisions.length === 0 ? (
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-12 text-center">
            <p className="text-slate-400 mb-4">
              No decisions yet. Create your first council to get started!
            </p>
            <Link
              href="/dashboard/new-council"
              className="inline-flex items-center gap-2 px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors"
            >
              Create Your First Council
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {recentDecisions.map((decision) => (
              <Link
                key={decision.id}
                href={`/dashboard/decisions/${decision.id}`}
                className="block bg-slate-800/50 border border-slate-700 rounded-lg p-4 hover:border-purple-500/50 hover:bg-slate-800/80 transition-all group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium group-hover:text-purple-400 transition-colors truncate">
                      {decision.title || 'Untitled Decision'}
                    </h3>
                    <p className="text-sm text-slate-400 mt-1">
                      {decision.template_id
                        ? templateMap[decision.template_id] || 'Custom'
                        : 'Custom'}{' '}
                      •{' '}
                      {new Date(decision.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <div className="ml-4">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                        decision.status === 'complete'
                          ? 'bg-green-600/20 text-green-400'
                          : decision.status === 'running' || decision.status === 'pending'
                            ? 'bg-blue-600/20 text-blue-400'
                            : decision.status === 'failed'
                              ? 'bg-red-600/20 text-red-400'
                              : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      {decision.status.charAt(0).toUpperCase() +
                        decision.status.slice(1)}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
