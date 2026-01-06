import { useState, useMemo } from 'react'
import { Search, RotateCcw, Calendar } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Card, Board } from '@/types'

interface DoneArchiveProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cards: Card[]
  boards: Board[]
  onRestoreToTodo: (cardId: string) => void
}

export function DoneArchive({ open, onOpenChange, cards, boards, onRestoreToTodo }: DoneArchiveProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedBoardFilter, setSelectedBoardFilter] = useState<string | null>(null)

  const boardsMap = useMemo(() =>
    Object.fromEntries(boards.map(b => [b.id, b])),
    [boards]
  )

  const filteredCards = useMemo(() => {
    return cards.filter(card => {
      // Search filter
      const matchesSearch = searchQuery === '' ||
        card.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        card.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        card.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))

      // Board filter
      const matchesBoard = !selectedBoardFilter || card.board_id === selectedBoardFilter

      return matchesSearch && matchesBoard
    })
  }, [cards, searchQuery, selectedBoardFilter])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Completed Tasks
            <Badge variant="secondary" className="ml-2">
              {cards.length} total
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Search and Filters */}
        <div className="flex flex-col gap-3 py-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search completed tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Board Filter Pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setSelectedBoardFilter(null)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                !selectedBoardFilter
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary hover:bg-secondary/80"
              )}
            >
              All Boards
            </button>
            {boards.map((board) => (
              <button
                key={board.id}
                onClick={() => setSelectedBoardFilter(board.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors",
                  selectedBoardFilter === board.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary hover:bg-secondary/80"
                )}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: board.color }}
                />
                {board.name}
              </button>
            ))}
          </div>
        </div>

        {/* Cards List */}
        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          {filteredCards.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              {cards.length === 0 ? (
                <>
                  <p className="text-sm">No completed tasks yet</p>
                  <p className="text-xs mt-1">Tasks you complete will appear here</p>
                </>
              ) : (
                <>
                  <Search className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">No tasks match your search</p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-2 pb-4">
              {filteredCards.map((card) => {
                const board = boardsMap[card.board_id]
                return (
                  <div
                    key={card.id}
                    className="group flex items-center gap-3 p-3 bg-card border rounded-lg hover:border-primary/30 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      {/* Board indicator */}
                      {board && (
                        <div className="flex items-center gap-1.5 mb-1">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: board.color }}
                          />
                          <span className="text-xs text-muted-foreground">{board.name}</span>
                        </div>
                      )}

                      <h4 className="font-medium text-sm truncate">{card.title}</h4>

                      {card.description && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {card.description}
                        </p>
                      )}

                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Completed {formatDate(card.updated_at)}
                        </span>
                        {card.tags && card.tags.length > 0 && (
                          <div className="flex gap-1">
                            {card.tags.slice(0, 2).map(tag => (
                              <span key={tag} className="px-1.5 py-0.5 bg-secondary rounded text-xs">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Restore Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      onClick={() => onRestoreToTodo(card.id)}
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Restore
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer with count */}
        {filteredCards.length > 0 && filteredCards.length !== cards.length && (
          <div className="pt-2 border-t text-xs text-muted-foreground text-center">
            Showing {filteredCards.length} of {cards.length} completed tasks
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
