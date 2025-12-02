import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Calendar, Clock, GripVertical, Sparkles, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Card } from '@/types'

interface KanbanCardProps {
  card: Card
  onEdit: (card: Card) => void
  onDelete: (id: string) => void
  onAISuggest: (id: string) => void
  boardName?: string // Show board name in "All" view
  boardColor?: string
}

const priorityVariants: Record<number, 'priority1' | 'priority2' | 'priority3' | 'priority4' | 'priority5'> = {
  1: 'priority1',
  2: 'priority2',
  3: 'priority3',
  4: 'priority4',
  5: 'priority5',
}

export function KanbanCard({ card, onEdit, onDelete, onAISuggest, boardName, boardColor }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const formatDeadline = (deadline: string) => {
    const date = new Date(deadline)
    const now = new Date()
    const diff = date.getTime() - now.getTime()
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24))

    if (days < 0) return { text: `${Math.abs(days)}d overdue`, isOverdue: true }
    if (days === 0) return { text: 'Today', isOverdue: false }
    if (days === 1) return { text: 'Tomorrow', isOverdue: false }
    return { text: `${days}d left`, isOverdue: false }
  }

  const deadline = card.deadline ? formatDeadline(card.deadline) : null

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group bg-card border rounded-lg p-3 cursor-pointer hover:border-primary/50 transition-colors",
        isDragging && "opacity-50 shadow-lg"
      )}
      onClick={() => onEdit(card)}
    >
      <div className="flex items-start gap-2">
        <button
          className="mt-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="flex-1 min-w-0">
          {boardName && (
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: boardColor || '#6366f1' }} />
              <span className="text-xs text-muted-foreground">{boardName}</span>
            </div>
          )}
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium text-sm leading-tight">{card.title}</h3>
            <Badge variant={priorityVariants[card.priority] || 'priority3'}>
              P{card.priority}
            </Badge>
          </div>

          {card.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {card.description}
            </p>
          )}

          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            {card.estimated_hours && (
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {card.estimated_hours}h
              </div>
            )}

            {deadline && (
              <div className={cn(
                "flex items-center gap-1",
                deadline.isOverdue && "text-red-400"
              )}>
                <Calendar className="h-3 w-3" />
                {deadline.text}
              </div>
            )}
          </div>

          {card.tags && card.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {card.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="px-1.5 py-0.5 bg-secondary rounded text-xs"
                >
                  {tag}
                </span>
              ))}
              {card.tags.length > 3 && (
                <span className="px-1.5 py-0.5 text-xs text-muted-foreground">
                  +{card.tags.length - 3}
                </span>
              )}
            </div>
          )}

          {card.priority_reason && (
            <p className="text-xs text-primary/70 mt-2 italic line-clamp-1">
              AI: {card.priority_reason}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 mt-2 pt-2 border-t opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={(e) => {
            e.stopPropagation()
            onAISuggest(card.id)
          }}
        >
          <Sparkles className="h-3 w-3 mr-1" />
          AI Suggest
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-destructive hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation()
            onDelete(card.id)
          }}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}
