import { useMemo } from 'react'
import { Calendar, CalendarDays, CalendarClock, Clock, CheckCircle2, Trash2, HelpCircle, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Card, Board } from '@/types'

interface TimelineViewProps {
  cards: Card[]
  boards: Board[]
  showBoardName: boolean
  onEditCard: (card: Card) => void
  onDeleteCard: (id: string) => void
  onMarkDone: (id: string) => void
}

type TimelineSection = {
  id: string
  title: string
  subtitle?: string
  icon: React.ReactNode
  color: string
  bgColor?: string
  cards: Card[]
  isHighlight?: boolean
}

const priorityVariants: Record<number, 'priority1' | 'priority2' | 'priority3' | 'priority4' | 'priority5'> = {
  1: 'priority1',
  2: 'priority2',
  3: 'priority3',
  4: 'priority4',
  5: 'priority5',
}

export function TimelineView({ cards, boards, showBoardName, onEditCard, onDeleteCard, onMarkDone }: TimelineViewProps) {
  const boardsMap = useMemo(() =>
    Object.fromEntries(boards.map(b => [b.id, b])),
    [boards]
  )

  const sections = useMemo(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const endOfWeek = new Date(today)
    endOfWeek.setDate(endOfWeek.getDate() + 7)

    const overdue: Card[] = []
    const todayTasks: Card[] = []
    const tomorrowTasks: Card[] = []
    const thisWeek: Card[] = []
    const later: Card[] = []
    const noDate: Card[] = []

    // Only show non-done tasks
    const activeTasks = cards.filter(c => c.status !== 'done')

    activeTasks.forEach(card => {
      if (!card.deadline) {
        noDate.push(card)
        return
      }

      const deadline = new Date(card.deadline)
      const deadlineDate = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate())

      if (deadlineDate < today) {
        overdue.push(card)
      } else if (deadlineDate.getTime() === today.getTime()) {
        todayTasks.push(card)
      } else if (deadlineDate.getTime() === tomorrow.getTime()) {
        tomorrowTasks.push(card)
      } else if (deadlineDate < endOfWeek) {
        thisWeek.push(card)
      } else {
        later.push(card)
      }
    })

    // Sort each section by priority
    const sortByPriority = (a: Card, b: Card) => a.priority - b.priority

    // Build "Today's Focus" - overdue + today + high priority (P1-P2) from other sections
    const highPriorityOther = [...tomorrowTasks, ...thisWeek, ...later, ...noDate]
      .filter(c => c.priority <= 2)
    const todaysFocus = [...overdue, ...todayTasks, ...highPriorityOther]
      .sort(sortByPriority)

    // Remove duplicates by id (cards that appear in Today's Focus shouldn't appear again)
    const todaysFocusIds = new Set(todaysFocus.map(c => c.id))

    const result: TimelineSection[] = []

    // Always show Today's Focus section (even if empty - gives user a target)
    const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
    result.push({
      id: 'todays-focus',
      title: "Today's Focus",
      subtitle: dateStr,
      icon: <Zap className="h-4 w-4" />,
      color: 'text-amber-500',
      bgColor: 'bg-gradient-to-r from-amber-500/10 to-orange-500/10',
      cards: todaysFocus,
      isHighlight: true,
    })

    // Show remaining sections (excluding cards already in Today's Focus)
    const remainingTomorrow = tomorrowTasks.filter(c => !todaysFocusIds.has(c.id))
    const remainingThisWeek = thisWeek.filter(c => !todaysFocusIds.has(c.id))
    const remainingLater = later.filter(c => !todaysFocusIds.has(c.id))
    const remainingNoDate = noDate.filter(c => !todaysFocusIds.has(c.id))

    if (remainingTomorrow.length > 0) {
      result.push({
        id: 'tomorrow',
        title: 'Tomorrow',
        icon: <CalendarDays className="h-4 w-4" />,
        color: 'text-purple-500',
        cards: remainingTomorrow.sort(sortByPriority),
      })
    }

    if (remainingThisWeek.length > 0) {
      result.push({
        id: 'this-week',
        title: 'This Week',
        icon: <CalendarClock className="h-4 w-4" />,
        color: 'text-orange-500',
        cards: remainingThisWeek.sort(sortByPriority),
      })
    }

    if (remainingLater.length > 0) {
      result.push({
        id: 'later',
        title: 'Later',
        icon: <Clock className="h-4 w-4" />,
        color: 'text-muted-foreground',
        cards: remainingLater.sort(sortByPriority),
      })
    }

    if (remainingNoDate.length > 0) {
      result.push({
        id: 'no-date',
        title: 'No Date',
        icon: <HelpCircle className="h-4 w-4" />,
        color: 'text-muted-foreground',
        cards: remainingNoDate.sort(sortByPriority),
      })
    }

    return result
  }, [cards])

  const formatDeadline = (deadline: string) => {
    const date = new Date(deadline)
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  }

  if (sections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <CheckCircle2 className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-lg font-medium">All caught up!</p>
        <p className="text-sm">No tasks to show in timeline view</p>
      </div>
    )
  }

  // Check if a card is overdue for highlighting
  const isOverdue = (card: Card) => {
    if (!card.deadline) return false
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const deadline = new Date(card.deadline)
    const deadlineDate = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate())
    return deadlineDate < today
  }

  return (
    <div className="space-y-6 pb-4">
      {sections.map((section) => (
        <div
          key={section.id}
          className={cn(
            "bg-card border rounded-lg overflow-hidden",
            section.isHighlight && "border-amber-500/30 shadow-lg shadow-amber-500/5"
          )}
        >
          {/* Section Header */}
          <div className={cn(
            "flex items-center gap-2 px-4 py-3 border-b",
            section.bgColor || "bg-secondary/30",
            section.color
          )}>
            {section.icon}
            <div className="flex-1">
              <h3 className="font-semibold">{section.title}</h3>
              {section.subtitle && (
                <p className="text-xs text-muted-foreground">{section.subtitle}</p>
              )}
            </div>
            <span className={cn(
              "text-xs px-2 py-0.5 rounded-full",
              section.isHighlight ? "bg-amber-500/20 text-amber-500" : "bg-secondary text-muted-foreground"
            )}>
              {section.cards.length}
            </span>
          </div>

          {/* Cards or Empty State */}
          {section.cards.length === 0 ? (
            <div className="px-4 py-8 text-center">
              {section.isHighlight ? (
                <>
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500/50" />
                  <p className="text-sm text-muted-foreground">No urgent tasks for today!</p>
                  <p className="text-xs text-muted-foreground mt-1">Overdue, today's tasks, and P1-P2 items appear here</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No tasks</p>
              )}
            </div>
          ) : (
            <div className="divide-y">
              {section.cards.map((card) => {
                const board = showBoardName ? boardsMap[card.board_id] : undefined
                const cardIsOverdue = isOverdue(card)
                return (
                  <div
                    key={card.id}
                    className={cn(
                      "group flex items-center gap-3 px-4 py-3 hover:bg-secondary/20 cursor-pointer transition-colors",
                      cardIsOverdue && section.isHighlight && "bg-red-500/5"
                    )}
                    onClick={() => onEditCard(card)}
                  >
                    {/* Checkbox */}
                    <button
                      className="shrink-0 w-5 h-5 rounded-full border-2 border-muted-foreground/30 hover:border-green-500 hover:bg-green-500/10 transition-colors flex items-center justify-center"
                      onClick={(e) => {
                        e.stopPropagation()
                        onMarkDone(card.id)
                      }}
                    >
                      <CheckCircle2 className="h-3 w-3 text-transparent group-hover:text-green-500/50" />
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {board && (
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: board.color }}
                          />
                        )}
                        <span className={cn(
                          "font-medium text-sm truncate",
                          cardIsOverdue && "text-red-400"
                        )}>{card.title}</span>
                        <Badge variant={priorityVariants[card.priority] || 'priority3'} className="shrink-0">
                          P{card.priority}
                        </Badge>
                        {cardIsOverdue && section.isHighlight && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded">OVERDUE</span>
                        )}
                      </div>
                      {card.description && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {card.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {board && showBoardName && (
                          <span>{board.name}</span>
                        )}
                        {card.deadline && (
                          <span className={cn(
                            "flex items-center gap-1",
                            cardIsOverdue && "text-red-400"
                          )}>
                            <Calendar className="h-3 w-3" />
                            {formatDeadline(card.deadline)}
                          </span>
                        )}
                        {card.estimated_hours && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {card.estimated_hours}h
                          </span>
                        )}
                        {card.tags && card.tags.length > 0 && (
                          <div className="flex gap-1">
                            {card.tags.slice(0, 2).map(tag => (
                              <span key={tag} className="px-1.5 py-0.5 bg-secondary rounded">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteCard(card.id)
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
