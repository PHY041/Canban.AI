import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { KanbanCard } from '@/components/KanbanCard'
import { cn } from '@/lib/utils'
import type { Card, CardStatus, Board } from '@/types'

interface KanbanColumnProps {
  status: CardStatus
  title: string
  cards: Card[]
  onAddCard: () => void
  onEditCard: (card: Card) => void
  onDeleteCard: (id: string) => void
  onAISuggest: (id: string) => void
  showBoardName?: boolean // Show board name on cards (All view)
  boardsMap?: Record<string, Board> // Map of board_id -> board
}

const statusColors: Record<CardStatus, string> = {
  todo: 'border-t-blue-500',
  in_progress: 'border-t-yellow-500',
  done: 'border-t-green-500',
}

export function KanbanColumn({
  status,
  title,
  cards,
  onAddCard,
  onEditCard,
  onDeleteCard,
  onAISuggest,
  showBoardName,
  boardsMap,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col min-w-[300px] max-w-[300px] bg-secondary/30 rounded-lg border-t-4",
        statusColors[status],
        isOver && "bg-secondary/50"
      )}
    >
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-sm">{title}</h2>
          <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
            {cards.length}
          </span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onAddCard}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 p-2 overflow-y-auto space-y-2 min-h-[200px]">
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map((card) => {
            const board = showBoardName && boardsMap ? boardsMap[card.board_id] : undefined
            return (
              <KanbanCard
                key={card.id}
                card={card}
                onEdit={onEditCard}
                onDelete={onDeleteCard}
                onAISuggest={onAISuggest}
                boardName={board?.name}
                boardColor={board?.color}
              />
            )
          })}
        </SortableContext>

        {cards.length === 0 && (
          <div className="flex items-center justify-center h-20 text-sm text-muted-foreground border border-dashed rounded-lg">
            Drop cards here
          </div>
        )}
      </div>
    </div>
  )
}
