import { useState, useRef, useEffect } from 'react'
import { Sparkles, AlertTriangle, CheckCircle2, Lightbulb, ChevronDown, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { DailyBriefing as DailyBriefingType } from '@/types'

interface DailyBriefingProps {
  briefing: DailyBriefingType | null
  isLoading: boolean
  onRefresh: () => void
  compact?: boolean
}

export function DailyBriefing({ briefing, isLoading, onRefresh, compact = false }: DailyBriefingProps) {
  const [isOpen, setIsOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  const overdueCount = briefing?.overdue_tasks.length || 0
  const highPriorityCount = briefing?.high_priority_tasks.length || 0

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Compact mode - button with popover
  if (compact) {
    return (
      <div className="relative" ref={popoverRef}>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (!briefing && !isLoading) {
              onRefresh()
            }
            setIsOpen(!isOpen)
          }}
          className="gap-2"
        >
          <Sparkles className={`h-4 w-4 text-primary ${isLoading ? 'animate-pulse' : ''}`} />
          {isLoading ? (
            'Generating...'
          ) : briefing ? (
            <>
              Briefing
              {(overdueCount > 0 || highPriorityCount > 0) && (
                <span className="flex items-center gap-1">
                  {overdueCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs">
                      {overdueCount}
                    </span>
                  )}
                  {highPriorityCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 text-xs">
                      {highPriorityCount}
                    </span>
                  )}
                </span>
              )}
            </>
          ) : (
            'Generate Briefing'
          )}
          <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </Button>

        {/* Popover Content */}
        {isOpen && (
          <div className="absolute right-0 top-full mt-2 w-[480px] bg-card border rounded-lg shadow-xl z-50">
            <div className="flex items-center justify-between p-3 border-b">
              <h3 className="font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Daily Briefing {briefing?.date && `- ${briefing.date}`}
              </h3>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={onRefresh} disabled={isLoading}>
                  {isLoading ? 'Refreshing...' : 'Refresh'}
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {!briefing ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {isLoading ? 'Generating your daily briefing...' : 'Click "Refresh" to generate your briefing.'}
              </div>
            ) : (
              <div className="p-3 max-h-[400px] overflow-y-auto">
                <p className="text-sm mb-3">{briefing.summary}</p>

                <div className="grid gap-3 md:grid-cols-3">
                  {/* High Priority */}
                  <div className="bg-secondary/30 rounded-lg p-2">
                    <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 text-orange-400" />
                      HIGH PRIORITY
                    </h4>
                    {briefing.high_priority_tasks.length ? (
                      <ul className="space-y-1">
                        {briefing.high_priority_tasks.slice(0, 5).map((task) => (
                          <li key={task.id} className="text-xs flex items-center gap-1.5">
                            <span className="w-4 h-4 rounded bg-red-500/20 text-red-400 text-[10px] flex items-center justify-center shrink-0">
                              {task.priority}
                            </span>
                            <span className="truncate">{task.title}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground">None</p>
                    )}
                  </div>

                  {/* Overdue */}
                  <div className="bg-secondary/30 rounded-lg p-2">
                    <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-red-400" />
                      OVERDUE
                    </h4>
                    {briefing.overdue_tasks.length ? (
                      <ul className="space-y-1">
                        {briefing.overdue_tasks.slice(0, 5).map((task) => (
                          <li key={task.id} className="text-xs text-red-400 truncate">
                            {task.title}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-green-400">All caught up!</p>
                    )}
                  </div>

                  {/* Suggestions */}
                  <div className="bg-secondary/30 rounded-lg p-2">
                    <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                      <Lightbulb className="h-3 w-3 text-yellow-400" />
                      SUGGESTIONS
                    </h4>
                    <ul className="space-y-1">
                      {briefing.suggestions.slice(0, 3).map((suggestion, i) => (
                        <li key={i} className="text-xs text-muted-foreground">
                          {suggestion}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // Original full-size mode (fallback, not used in new layout)
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
                {suggestion}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
