import { useState, useEffect, useCallback, useRef } from 'react'
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
import { Sparkles, RefreshCw, Settings, Cog, CheckCircle2, LayoutGrid, CalendarDays, MoreHorizontal, Wand2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import { KanbanColumn } from '@/components/KanbanColumn'
import { KanbanCard } from '@/components/KanbanCard'
import { CardDialog } from '@/components/CardDialog'
import { BoardSelector, ALL_BOARDS_ID } from '@/components/BoardSelector'
import { DailyBriefing } from '@/components/DailyBriefing'
import { ExtractTasksDialog } from '@/components/ExtractTasksDialog'
import { BoardManagement } from '@/components/BoardManagement'
import { SettingsDialog } from '@/components/SettingsDialog'
import { DoneArchive } from '@/components/DoneArchive'
import { TimelineView } from '@/components/TimelineView'
import { AgentPanel } from '@/components/AgentPanel'
import { boardsApi, cardsApi, aiApi, agentsApi } from '@/lib/api'
import { useKanbanStore } from '@/store/kanban'
import type { Card, CardStatus, DailyBriefing as DailyBriefingType, AgentSession } from '@/types'

const COLUMNS: { status: CardStatus; title: string }[] = [
  { status: 'todo', title: 'To Do' },
  { status: 'in_progress', title: 'In Progress' },
]

type ViewMode = 'kanban' | 'timeline'

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
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [doneArchiveOpen, setDoneArchiveOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('kanban')
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const moreMenuRef = useRef<HTMLDivElement>(null)
  const [runningAgentCardIds, setRunningAgentCardIds] = useState<Set<string>>(new Set())
  const [agentPanelCard, setAgentPanelCard] = useState<Card | null>(null)
  const [agentSession, setAgentSession] = useState<AgentSession | null>(null)

  // Close more menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setMoreMenuOpen(false)
      }
    }
    if (moreMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [moreMenuOpen])

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards', selectedBoardId] })
    },
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

  const handleRunAgent = async (cardId: string) => {
    const card = cards.find(c => c.id === cardId)
    if (!card) return

    try {
      // Add to running set
      setRunningAgentCardIds(prev => new Set([...prev, cardId]))

      // Open the agent panel
      setAgentPanelCard(card)

      // Start the agent
      const response = await agentsApi.start(cardId)
      setAgentSession(response.data)

      // Poll for completion to update running state
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await agentsApi.getSession(response.data.id)
          setAgentSession(statusResponse.data)

          if (['completed', 'failed', 'cancelled'].includes(statusResponse.data.status)) {
            clearInterval(pollInterval)
            setRunningAgentCardIds(prev => {
              const next = new Set(prev)
              next.delete(cardId)
              return next
            })
          }
        } catch (e) {
          console.error('Failed to poll agent status:', e)
        }
      }, 2000)

    } catch (error: unknown) {
      console.error('Failed to start agent:', error)
      setRunningAgentCardIds(prev => {
        const next = new Set(prev)
        next.delete(cardId)
        return next
      })
      // Extract error message from axios response or fallback to generic
      let errorMessage = 'Unknown error'
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { data?: { detail?: string } } }
        errorMessage = axiosError.response?.data?.detail || 'Request failed'
      } else if (error instanceof Error) {
        errorMessage = error.message
      }
      // Show error in panel if open
      if (agentPanelCard?.id === cardId) {
        setAgentSession({
          id: '',
          card_id: cardId,
          status: 'failed',
          output_lines: [],
          error: errorMessage,
        })
      }
    }
  }

  const handleCancelAgent = async (sessionId: string) => {
    try {
      await agentsApi.cancel(sessionId)
      setAgentSession(prev => prev ? { ...prev, status: 'cancelled' } : null)
      if (agentPanelCard) {
        setRunningAgentCardIds(prev => {
          const next = new Set(prev)
          next.delete(agentPanelCard.id)
          return next
        })
      }
    } catch (e) {
      console.error('Failed to cancel agent:', e)
    }
  }

  const handleCloseAgentPanel = () => {
    setAgentPanelCard(null)
    setAgentSession(null)
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

  const handleMarkDone = (cardId: string) => {
    moveCardMutation.mutate({
      id: cardId,
      data: { status: 'done', position: 0 },
    })
    // Optimistic update
    updateCard(cardId, { status: 'done' })
  }

  const handleRestoreToTodo = (cardId: string) => {
    moveCardMutation.mutate({
      id: cardId,
      data: { status: 'todo', position: 0 },
    })
    // Optimistic update
    updateCard(cardId, { status: 'todo' })
  }

  const doneCards = cards.filter(c => c.status === 'done')

  const isAllBoards = selectedBoardId === ALL_BOARDS_ID
  const currentBoardName = isAllBoards ? 'All Boards' : boards.find(b => b.id === selectedBoardId)?.name || 'Board'
  const boardsMap = Object.fromEntries(boards.map(b => [b.id, b])) // For showing board name on cards

  return (
    <div className="flex h-full">
      {/* Main content area */}
      <div className={`flex flex-col flex-1 ${agentPanelCard ? 'mr-[400px]' : ''}`}>
      {/* Row 1: Title + View Toggle + Action Buttons */}
      <div className="flex items-center gap-4 mb-3 electron-drag pt-2">
        <h1 className="text-2xl font-bold shrink-0">CanBan.AI</h1>

        {/* View Toggle */}
        <div className="flex items-center bg-secondary rounded-lg p-1 electron-no-drag">
          <button
            onClick={() => setViewMode('kanban')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'kanban'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
            Kanban
          </button>
          <button
            onClick={() => setViewMode('timeline')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'timeline'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <CalendarDays className="h-4 w-4" />
            Timeline
          </button>
        </div>

        {/* Separator */}
        <div className="h-6 w-px bg-border electron-no-drag" />

        {/* Action Buttons - Primary AI actions + More menu */}
        <div className="flex items-center gap-2 electron-no-drag">
          <Button variant="outline" size="sm" onClick={() => setExtractDialogOpen(true)}>
            <Wand2 className="h-4 w-4 mr-1" />
            AI Extract
          </Button>
          <Button variant="outline" size="sm" onClick={() => prioritizeMutation.mutate()} disabled={prioritizeMutation.isPending}>
            <Sparkles className="h-4 w-4 mr-1" />
            {prioritizeMutation.isPending ? 'Prioritizing...' : 'AI Prioritize'}
          </Button>

          {/* More Menu */}
          <div className="relative" ref={moreMenuRef}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMoreMenuOpen(!moreMenuOpen)}
              className="relative"
            >
              <MoreHorizontal className="h-4 w-4" />
              {doneCards.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 text-white text-[10px] rounded-full flex items-center justify-center">
                  {doneCards.length > 9 ? '9+' : doneCards.length}
                </span>
              )}
            </Button>

            {moreMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-card border rounded-lg shadow-xl z-50 py-1">
                <button
                  onClick={() => { setBoardManagementOpen(true); setMoreMenuOpen(false) }}
                  className="w-full px-3 py-2 text-sm text-left hover:bg-secondary flex items-center gap-2"
                >
                  <Settings className="h-4 w-4" />
                  Manage Boards
                </button>
                <button
                  onClick={() => { setSettingsOpen(true); setMoreMenuOpen(false) }}
                  className="w-full px-3 py-2 text-sm text-left hover:bg-secondary flex items-center gap-2"
                >
                  <Cog className="h-4 w-4" />
                  Settings
                </button>
                <button
                  onClick={() => { refetchCards(); setMoreMenuOpen(false) }}
                  className="w-full px-3 py-2 text-sm text-left hover:bg-secondary flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </button>
                <div className="border-t my-1" />
                <button
                  onClick={() => { setDoneArchiveOpen(true); setMoreMenuOpen(false) }}
                  className="w-full px-3 py-2 text-sm text-left hover:bg-secondary flex items-center gap-2"
                >
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Done Archive
                  {doneCards.length > 0 && (
                    <span className="ml-auto px-1.5 py-0.5 bg-green-500/20 text-green-500 text-xs rounded-full">
                      {doneCards.length}
                    </span>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Board Tabs + Daily Briefing */}
      <div className="flex items-center gap-4 mb-3">
        <BoardSelector boards={boards} selectedBoardId={selectedBoardId} onSelectBoard={setSelectedBoardId} />

        {/* Compact Daily Briefing */}
        <div className="ml-auto shrink-0">
          <DailyBriefing
            briefing={briefing}
            isLoading={briefingLoading}
            onRefresh={fetchBriefing}
            compact={true}
          />
        </div>
      </div>

      {/* Main Content - Kanban or Timeline */}
      {viewMode === 'kanban' ? (
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
                onMarkDone={handleMarkDone}
                onAISuggest={handleAISuggest}
                onRunAgent={handleRunAgent}
                runningAgentCardIds={runningAgentCardIds}
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
                  onMarkDone={() => {}}
                  onAISuggest={() => {}}
                />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <TimelineView
            cards={cards}
            boards={boards}
            showBoardName={isAllBoards}
            onEditCard={handleEditCard}
            onDeleteCard={handleDeleteCard}
            onMarkDone={handleMarkDone}
          />
        </div>
      )}

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

      {/* Settings Dialog */}
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

      {/* Done Archive */}
      <DoneArchive
        open={doneArchiveOpen}
        onOpenChange={setDoneArchiveOpen}
        cards={doneCards}
        boards={boards}
        onRestoreToTodo={handleRestoreToTodo}
      />
      </div>

      {/* Agent Panel - Fixed right side panel */}
      {agentPanelCard && (
        <div className="fixed right-0 top-0 bottom-0 w-[400px] z-40">
          <AgentPanel
            card={agentPanelCard}
            session={agentSession}
            onClose={handleCloseAgentPanel}
            onCancel={handleCancelAgent}
          />
        </div>
      )}
    </div>
  )
}
