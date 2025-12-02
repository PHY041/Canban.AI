import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

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
export const aiApi = {
  prioritize: (boardId?: string) => api.post('/ai/prioritize', { board_id: boardId }),
  suggest: (cardId: string) => api.post('/ai/suggest', { card_id: cardId }),
  dailyBriefing: () => api.get('/ai/daily-briefing'),
  extractTasks: (text: string, boardId: string) => api.post('/ai/extract-tasks', { text, board_id: boardId }),
  createExtractedTasks: (tasks: ExtractedTask[]) => api.post('/ai/create-extracted-tasks', { tasks }),
}

export interface ExtractedTask { // Task extracted by AI from text
  title: string
  description?: string | null
  deadline?: string | null
  priority: number
  estimated_hours?: number | null
  tags: string[]
  board_id?: string
  status: string
  position: number
}
