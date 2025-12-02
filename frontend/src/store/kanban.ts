import { create } from 'zustand'
import type { Board, Card } from '@/types'

interface KanbanState {
  boards: Board[]
  cards: Card[]
  selectedBoardId: string | null
  isLoading: boolean
  error: string | null

  // Actions
  setBoards: (boards: Board[]) => void
  setCards: (cards: Card[]) => void
  addBoard: (board: Board) => void
  updateBoard: (id: string, updates: Partial<Board>) => void
  removeBoard: (id: string) => void
  addCard: (card: Card) => void
  updateCard: (id: string, updates: Partial<Card>) => void
  removeCard: (id: string) => void
  setSelectedBoardId: (id: string | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void

  // Computed
  getCardsByBoard: (boardId: string) => Card[]
  getCardsByStatus: (boardId: string, status: string) => Card[]
}

export const useKanbanStore = create<KanbanState>((set, get) => ({
  boards: [],
  cards: [],
  selectedBoardId: null,
  isLoading: false,
  error: null,

  setBoards: (boards) => set({ boards }),
  setCards: (cards) => set({ cards }),

  addBoard: (board) => set((state) => ({ boards: [...state.boards, board] })),

  updateBoard: (id, updates) =>
    set((state) => ({
      boards: state.boards.map((b) => (b.id === id ? { ...b, ...updates } : b)),
    })),

  removeBoard: (id) =>
    set((state) => ({
      boards: state.boards.filter((b) => b.id !== id),
      cards: state.cards.filter((c) => c.board_id !== id),
    })),

  addCard: (card) => set((state) => ({ cards: [...state.cards, card] })),

  updateCard: (id, updates) =>
    set((state) => ({
      cards: state.cards.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    })),

  removeCard: (id) =>
    set((state) => ({
      cards: state.cards.filter((c) => c.id !== id),
    })),

  setSelectedBoardId: (id) => set({ selectedBoardId: id }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  getCardsByBoard: (boardId) => get().cards.filter((c) => c.board_id === boardId),

  getCardsByStatus: (boardId, status) =>
    get()
      .cards.filter((c) => c.board_id === boardId && c.status === status)
      .sort((a, b) => a.position - b.position),
}))
