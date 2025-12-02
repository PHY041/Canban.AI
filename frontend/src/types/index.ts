export type CardStatus = 'todo' | 'in_progress' | 'done'

export interface Board {
  id: string
  name: string
  description?: string
  color: string
  position: number
  created_at: string
  updated_at: string
}

export interface Card {
  id: string
  board_id: string
  title: string
  description?: string
  status: CardStatus
  priority: number
  priority_reason?: string
  estimated_hours?: number
  actual_hours?: number
  deadline?: string
  position: number
  tags: string[]
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface DailyBriefing {
  date: string
  high_priority_tasks: { id: string; title: string; priority: number }[]
  overdue_tasks: { id: string; title: string; deadline: string }[]
  suggestions: string[]
  summary: string
}

export interface AIPrioritizeResponse {
  cards_updated: number
  priorities: { id: string; priority: number; reasoning: string }[]
}

export interface AISuggestResponse {
  suggestions: string[]
  reasoning: string
}
