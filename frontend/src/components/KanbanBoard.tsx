import { useState, useEffect, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { Sparkles, RefreshCw, ClipboardPaste, Settings } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import { KanbanColumn } from '@/components/KanbanColumn'
import { KanbanCard } from '@/components/KanbanCard'
import { CardDialog } from '@/components/CardDialog'
import { BoardSelector, ALL_BOARDS_ID } from '@/components/BoardSelector'
import { DailyBriefing } from '@/components/DailyBriefing'
import { ExtractTasksDialog } from '@/components/ExtractTasksDialog'
import { BoardManagement } from '@/components/BoardManagement'
import { boardsApi, cardsApi, aiApi } from '@/lib/api'
import { useKanbanStore } from '@/store/kanban'
import type { Card, CardStatus, DailyBriefing as DailyBriefingType } from '@/types'

const COLUMNS: { status: CardStatus; title: string }[] = [
  { status: 'todo', title: 'To Do' },
  { status: 'in_progress', title: 'In Progress' },
  { status: 'done', title: 'Done' },
]

export function KanbanBoard() {
  const queryClient = useQueryClient()
  const {
    boards,
    cards,
    selectedBoardId,
    setBoards,
    setCards,
    setSelectedBoardId,
    updateCard,
  } = useKanbanStore()

  const [activeCard, setActiveCard] = useState<Card | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCard, setEditingCard] = useState<Card | null>(null)
  const [defaultStatus, setDefaultStatus] = useState<CardStatus>('todo')
  const [briefing, setBriefing] = useState<DailyBriefingType | null>(null)
  const [briefingLoading, setBriefingLoading] = useState(false)
  const [extractDialogOpen, setExtractDialogOpen] = useState(false)
  const [boardManagementOpen, setBoardManagementOpen] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  )

  // Fetch boards
  const { data: boardsData } = useQuery({
    queryKey: ['boards'],
    queryFn: () => boardsApi.list(),
  })

  // Fetch cards - all cards or by board
  const { data: cardsData, refetch: refetchCards } = useQuery({
    queryKey: ['cards', selectedBoardId],
    queryFn: async () => {
      if (!selectedBoardId) return { data: [] }
      if (selectedBoardId === ALL_BOARDS_ID) return cardsApi.listAll() // Fetch ALL cards
      return cardsApi.listByBoard(selectedBoardId)
    },
    enabled: !!selectedBoardId,
  })

  useEffect(() => {
    if (boardsData?.data) {
      setBoards(boardsData.data)
      if (!selectedBoardId) setSelectedBoardId(ALL_BOARDS_ID) // Default to "All"
    }
  }, [boardsData, selectedBoardId, setBoards, setSelectedBoardId])

  useEffect(() => {
    if (cardsData?.data) {
      setCards(cardsData.data)
    }
  }, [cardsData, setCards])

  // Mutations
  const createCardMutation = useMutation({
    mutationFn: cardsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards', selectedBoardId] })
    },
  })

  const updateCardMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof cardsApi.update>[1] }) =>
      cardsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards', selectedBoardId] })
    },
  })

  const deleteCardMutation = useMutation({
    mutationFn: cardsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards', selectedBoardId] })
    },
  })

  const moveCardMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof cardsApi.move>[1] }) =>
      cardsApi.move(id, data),
  })

  // Board mutations
  const createBoardMutation = useMutation({
    mutationFn: boardsApi.create,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['boards'] }) },
  })
  const updateBoardMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof boardsApi.update>[1] }) => boardsApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['boards'] }) },
  })
  const deleteBoardMutation = useMutation({
    mutationFn: boardsApi.delete,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['boards'] }) },
  })
  const restoreBoardMutation = useMutation({
    mutationFn: boardsApi.restore,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['boards'] }) },
  })

  // AI prioritization - pass undefined for "All" to prioritize across all boards
  const prioritizeMutation = useMutation({
    mutationFn: () => aiApi.prioritize(selectedBoardId === ALL_BOARDS_ID ? undefined : selectedBoardId || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards', selectedBoardId] })
    },
  })

  const fetchBriefing = useCallback(async () => {
    setBriefingLoading(true)
    try {
      const response = await aiApi.dailyBriefing()
      setBriefing(response.data)
    } catch (error) {
      console.error('Failed to fetch briefing:', error)
    } finally {
      setBriefingLoading(false)
    }
  }, [])

  const handleAISuggest = async (cardId: string) => {
    try {
      const response = await aiApi.suggest(cardId)
      alert(`AI Suggestions:\n\n${response.data.suggestions.join('\n\n')}\n\nReasoning: ${response.data.reasoning}`)
    } catch (error) {
      console.error('Failed to get suggestions:', error)
      alert('Failed to get AI suggestions. Make sure your OpenAI API key is configured.')
    }
  }

  const getCardsByStatus = (status: CardStatus) => {
    const filtered = cards.filter((c) => c.status === status)
    // In "All" view, sort by priority (P1 first); otherwise by position
    return selectedBoardId === ALL_BOARDS_ID
      ? filtered.sort((a, b) => a.priority - b.priority || a.position - b.position)
      : filtered.sort((a, b) => a.position - b.position)
  }

  const handleDragStart = (event: DragStartEvent) => {
    const card = cards.find((c) => c.id === event.active.id)
    if (card) setActiveCard(card)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    const activeCard = cards.find((c) => c.id === activeId)
    if (!activeCard) return

    // Check if we're over a column
    const overColumn = COLUMNS.find((col) => col.status === overId)
    if (overColumn && activeCard.status !== overColumn.status) {
      updateCard(activeId, { status: overColumn.status })
    }

    // Check if we're over another card
    const overCard = cards.find((c) => c.id === overId)
    if (overCard && activeCard.status !== overCard.status) {
      updateCard(activeId, { status: overCard.status })
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveCard(null)

    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    if (activeId === overId) return

    const activeCard = cards.find((c) => c.id === activeId)
    if (!activeCard) return

    // Determine target status
    let targetStatus = activeCard.status
    const overColumn = COLUMNS.find((col) => col.status === overId)
    if (overColumn) {
      targetStatus = overColumn.status
    } else {
      const overCard = cards.find((c) => c.id === overId)
      if (overCard) {
        targetStatus = overCard.status
      }
    }

    // Get cards in target column
    const columnCards = getCardsByStatus(targetStatus)
    const oldIndex = columnCards.findIndex((c) => c.id === activeId)
    const newIndex = columnCards.findIndex((c) => c.id === overId)

    // Calculate new position
    let newPosition = 0
    if (newIndex >= 0) {
      const reorderedCards = arrayMove(columnCards, oldIndex >= 0 ? oldIndex : columnCards.length, newIndex)
      newPosition = newIndex

      // Update positions for all affected cards
      reorderedCards.forEach((card, index) => {
        if (card.position !== index) {
          updateCard(card.id, { position: index })
        }
      })
    }

    // Persist the move
    moveCardMutation.mutate({
      id: activeId,
      data: { status: targetStatus, position: newPosition },
    })
  }

  const handleAddCard = (status: CardStatus) => {
    setEditingCard(null)
    setDefaultStatus(status)
    setDialogOpen(true)
  }

  const handleEditCard = (card: Card) => {
    setEditingCard(card)
    setDialogOpen(true)
  }

  const handleDeleteCard = (id: string) => {
    if (confirm('Are you sure you want to delete this card?')) {
      deleteCardMutation.mutate(id)
    }
  }

  const handleSaveCard = (data: Partial<Card> & { title: string; board_id: string }) => {
    if (editingCard?.id) {
      updateCardMutation.mutate({ id: editingCard.id, data })
    } else {
      createCardMutation.mutate(data as Parameters<typeof cardsApi.create>[0])
    }
  }

  const isAllBoards = selectedBoardId === ALL_BOARDS_ID
  const currentBoardName = isAllBoards ? 'All Boards' : boards.find(b => b.id === selectedBoardId)?.name || 'Board'
  const boardsMap = Object.fromEntries(boards.map(b => [b.id, b])) // For showing board name on cards

  return (
    <div className="flex flex-col h-full">
      {/* Header Row: Title + Action Buttons */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">CanBan.AI</h1>
          <p className="text-muted-foreground text-sm">AI-powered task management with automatic prioritization</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setBoardManagementOpen(true)}>
            <Settings className="h-4 w-4 mr-1" />
            Boards
          </Button>
          <Button variant="outline" size="sm" onClick={() => setExtractDialogOpen(true)}>
            <ClipboardPaste className="h-4 w-4 mr-1" />
            Paste & Extract
          </Button>
          <Button variant="outline" size="sm" onClick={() => prioritizeMutation.mutate()} disabled={prioritizeMutation.isPending}>
            <Sparkles className="h-4 w-4 mr-1" />
            {prioritizeMutation.isPending ? 'Prioritizing...' : 'AI Prioritize'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetchCards()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Board Tabs */}
      <div className="mb-4">
        <BoardSelector boards={boards} selectedBoardId={selectedBoardId} onSelectBoard={setSelectedBoardId} />
      </div>

      {/* Daily Briefing */}
      <div className="mb-4">

        <DailyBriefing
          briefing={briefing}
          isLoading={briefingLoading}
          onRefresh={fetchBriefing}
        />
      </div>

      {/* Kanban Columns */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 flex-1">
          {COLUMNS.map((column) => (
            <KanbanColumn
              key={column.status}
              status={column.status}
              title={column.title}
              cards={getCardsByStatus(column.status)}
              onAddCard={() => handleAddCard(column.status)}
              onEditCard={handleEditCard}
              onDeleteCard={handleDeleteCard}
              onAISuggest={handleAISuggest}
              showBoardName={isAllBoards}
              boardsMap={boardsMap}
            />
          ))}
        </div>

        <DragOverlay>
          {activeCard && (
            <div className="opacity-80">
              <KanbanCard
                card={activeCard}
                onEdit={() => {}}
                onDelete={() => {}}
                onAISuggest={() => {}}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Card Dialog */}
      <CardDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        card={editingCard}
        boardId={selectedBoardId || ''}
        defaultStatus={defaultStatus}
        onSave={handleSaveCard}
        boards={boards}
        isAllBoards={isAllBoards}
      />

      {/* Extract Tasks Dialog */}
      <ExtractTasksDialog
        open={extractDialogOpen}
        onOpenChange={setExtractDialogOpen}
        boardId={selectedBoardId}
        boardName={currentBoardName}
        onTasksCreated={() => refetchCards()}
        boards={boards}
        isAllBoards={isAllBoards}
      />

      {/* Board Management Dialog */}
      <BoardManagement
        open={boardManagementOpen}
        onOpenChange={setBoardManagementOpen}
        boards={boards}
        onCreateBoard={(data) => createBoardMutation.mutate(data)}
        onUpdateBoard={(id, data) => updateBoardMutation.mutate({ id, data })}
        onDeleteBoard={(id) => deleteBoardMutation.mutate(id)}
        onRestoreBoard={(id) => restoreBoardMutation.mutate(id)}
      />
    </div>
  )
}
