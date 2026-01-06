export type CardStatus = 'todo' | 'in_progress' | 'done'

export interface Board {
  id: string
  name: string
  description?: string
  color: string
  position: number
  repo_path?: string  // Git repository path for agent context
  created_at: string
  updated_at: string
}

export interface AgentSession {
  id: string
  card_id: string
  status: 'pending' | 'running' | 'waiting_for_input' | 'completed' | 'failed' | 'cancelled'
  started_at?: string
  completed_at?: string
  output_lines: string[]
  error?: string
  // Git worktree info
  worktree_path?: string
  worktree_branch?: string
  base_branch?: string
  // Interactive mode info
  waiting_for_input?: boolean
  last_question?: string
  message_count?: number
  // Claude session ID for resumption
  claude_session_id?: string
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
  repo_path?: string  // Override board's repo_path for this task
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
