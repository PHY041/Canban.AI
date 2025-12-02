import { LayoutGrid } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Board } from '@/types'

export const ALL_BOARDS_ID = 'all' // Virtual "All" board ID

interface BoardSelectorProps {
  boards: Board[]
  selectedBoardId: string | null
  onSelectBoard: (id: string) => void
}

export function BoardSelector({ boards, selectedBoardId, onSelectBoard }: BoardSelectorProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2">
      {/* All Boards Tab */}
      <button
        onClick={() => onSelectBoard(ALL_BOARDS_ID)}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
          selectedBoardId === ALL_BOARDS_ID ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/80"
        )}
      >
        <LayoutGrid className="w-3 h-3" />
        All
      </button>
      {/* Individual Boards */}
      {boards.map((board) => (
        <button
          key={board.id}
          onClick={() => onSelectBoard(board.id)}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
            selectedBoardId === board.id ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/80"
          )}
        >
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: board.color }} />
          {board.name}
        </button>
      ))}
    </div>
  )
}
