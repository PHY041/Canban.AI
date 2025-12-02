import { Sparkles, AlertTriangle, CheckCircle2, Lightbulb } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { DailyBriefing as DailyBriefingType } from '@/types'

interface DailyBriefingProps {
  briefing: DailyBriefingType | null
  isLoading: boolean
  onRefresh: () => void
}

export function DailyBriefing({ briefing, isLoading, onRefresh }: DailyBriefingProps) {
  if (!briefing && !isLoading) {
    return (
      <div className="bg-card border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Daily Briefing
          </h2>
          <Button variant="outline" size="sm" onClick={onRefresh}>
            Generate
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Click generate to get your AI-powered daily briefing.
        </p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="bg-card border rounded-lg p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary animate-pulse" />
          <span className="text-sm">Generating your daily briefing...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Daily Briefing - {briefing?.date}
        </h2>
        <Button variant="ghost" size="sm" onClick={onRefresh}>
          Refresh
        </Button>
      </div>

      <p className="text-sm mb-4">{briefing?.summary}</p>

      <div className="grid gap-4 md:grid-cols-3">
        {/* High Priority */}
        <div>
          <h3 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-orange-400" />
            HIGH PRIORITY
          </h3>
          {briefing?.high_priority_tasks.length ? (
            <ul className="space-y-1">
              {briefing.high_priority_tasks.map((task) => (
                <li key={task.id} className="text-sm flex items-center gap-2">
                  <span className="w-5 h-5 rounded bg-red-500/20 text-red-400 text-xs flex items-center justify-center">
                    {task.priority}
                  </span>
                  <span className="truncate">{task.title}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No high priority tasks</p>
          )}
        </div>

        {/* Overdue */}
        <div>
          <h3 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-red-400" />
            OVERDUE
          </h3>
          {briefing?.overdue_tasks.length ? (
            <ul className="space-y-1">
              {briefing.overdue_tasks.map((task) => (
                <li key={task.id} className="text-sm text-red-400 truncate">
                  {task.title}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-green-400">All caught up!</p>
          )}
        </div>

        {/* Suggestions */}
        <div>
          <h3 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <Lightbulb className="h-3 w-3 text-yellow-400" />
            SUGGESTIONS
          </h3>
          <ul className="space-y-1">
            {briefing?.suggestions.map((suggestion, i) => (
              <li key={i} className="text-sm text-muted-foreground">
                • {suggestion}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
