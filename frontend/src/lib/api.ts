import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:51723'

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Board API
export const boardsApi = {
  list: () => api.get('/boards'),
  listArchived: () => api.get('/boards/archived'),
  get: (id: string) => api.get(`/boards/${id}`),
  create: (data: { name: string; description?: string; color?: string }) => api.post('/boards', data),
  update: (id: string, data: { name?: string; description?: string; color?: string; position?: number }) => api.put(`/boards/${id}`, data),
  delete: (id: string) => api.delete(`/boards/${id}`),
  restore: (id: string) => api.post(`/boards/${id}/restore`),
}

// Card API
export const cardsApi = {
  listByBoard: (boardId: string) => api.get(`/cards/board/${boardId}`),
  listAll: () => api.get('/cards'),
  get: (id: string) => api.get(`/cards/${id}`),
  create: (data: {
    board_id: string
    title: string
    description?: string
    status?: string
    priority?: number
    estimated_hours?: number
    deadline?: string
    tags?: string[]
  }) => api.post('/cards', data),
  update: (id: string, data: {
    title?: string
    description?: string
    status?: string
    priority?: number
    priority_reason?: string
    estimated_hours?: number
    actual_hours?: number
    deadline?: string
    position?: number
    tags?: string[]
    board_id?: string
  }) => api.put(`/cards/${id}`, data),
  delete: (id: string) => api.delete(`/cards/${id}`),
  move: (id: string, data: { status?: string; position?: number; board_id?: string }) =>
    api.post(`/cards/${id}/move`, data),
  reorder: (positions: { id: string; position: number; status?: string }[]) =>
    api.post('/cards/reorder', positions),
}

// AI API
export interface BoardInfo {
  id: string
  name: string
  description?: string | null
}

export interface SuggestedBoard {
  name: string
  reason: string
  task_indices: number[]
}

export interface ExtractTasksResponse {
  tasks: ExtractedTask[]
  summary: string
  suggested_new_boards: SuggestedBoard[]
}

export const aiApi = {
  prioritize: (boardId?: string) => api.post('/ai/prioritize', { board_id: boardId }),
  suggest: (cardId: string) => api.post('/ai/suggest', { card_id: cardId }),
  dailyBriefing: () => api.get('/ai/daily-briefing'),
  extractTasks: (text: string, boards: BoardInfo[]) =>
    api.post<ExtractTasksResponse>('/ai/extract-tasks', { text, boards }),
  createExtractedTasks: (tasks: ExtractedTask[]) => api.post('/ai/create-extracted-tasks', { tasks }),
}

export interface ExtractedTask {
  title: string
  description?: string | null
  deadline?: string | null
  priority: number
  estimated_hours?: number | null
  tags: string[]
  board_id?: string
  suggested_board_name?: string | null  // For NEW_BOARD tasks
  status: string
  position: number
}

// Settings API
export interface Settings { supabase_url: string; supabase_key: string; openai_api_key: string; saved?: boolean }
export const settingsApi = {
  get: () => api.get<Settings>('/settings'),
  save: (data: Settings) => api.post<Settings>('/settings', data),
}

// Agents API - Claude Code integration
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

export interface ClaudeCodeStatus {
  available: boolean
  message: string
}

export const agentsApi = {
  // Check if Claude Code CLI is available
  checkStatus: () => api.get<ClaudeCodeStatus>('/agents/status'),
  start: (cardId: string, workingDir?: string, customPrompt?: string) =>
    api.post<AgentSession>('/agents/start', {
      card_id: cardId,
      working_dir: workingDir,
      custom_prompt: customPrompt,
    }),
  getSession: (sessionId: string) => api.get<AgentSession>(`/agents/session/${sessionId}`),
  getForCard: (cardId: string) => api.get<AgentSession | null>(`/agents/card/${cardId}`),
  listActive: () => api.get<AgentSession[]>('/agents/active'),
  cancel: (sessionId: string) => api.post(`/agents/cancel/${sessionId}`),
  // Send message to running agent (interactive mode)
  sendMessage: (sessionId: string, message: string) =>
    api.post<AgentSession>('/agents/message', { session_id: sessionId, message }),
  // Send follow-up to completed session (starts new session)
  followUp: (sessionId: string, message: string) =>
    api.post<AgentSession>('/agents/followup', { session_id: sessionId, message }),
  // SSE stream URL for real-time output
  streamUrl: (sessionId: string) => `${API_BASE_URL}/api/agents/stream/${sessionId}`,
}

// Git API - Worktree and diff operations
export interface FileDiff {
  path: string
  old_path?: string
  status: string
  additions: number
  deletions: number
  patch: string
  is_binary: boolean
}

export interface DiffResponse {
  files: FileDiff[]
  total_additions: number
  total_deletions: number
  base_commit?: string
  head_commit?: string
  branch?: string
  worktree_path?: string
}

export interface MergeResponse {
  success: boolean
  commit_sha?: string
  message: string
}

export interface WorktreeResponse {
  path: string
  branch: string
  card_id: string
  exists: boolean
}

export const gitApi = {
  getDiff: (cardId: string) => api.get<DiffResponse>(`/git/diff/${cardId}`),
  getWorktree: (cardId: string) => api.get<WorktreeResponse>(`/git/worktree/${cardId}`),
  merge: (cardId: string, squash = true, commitMessage?: string, deleteBranch = true) =>
    api.post<MergeResponse>('/git/merge', {
      card_id: cardId,
      squash,
      commit_message: commitMessage,
      delete_branch: deleteBranch,
    }),
  rebase: (cardId: string) => api.post<MergeResponse>(`/git/rebase/${cardId}`),
  abortRebase: (cardId: string) => api.post<MergeResponse>(`/git/rebase/${cardId}/abort`),
  deleteWorktree: (cardId: string, force = false) =>
    api.delete(`/git/worktree/${cardId}`, { params: { force } }),
  getBranchInfo: (cardId: string) => api.get(`/git/branches/${cardId}`),
}
