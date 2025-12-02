import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { Card, CardStatus, Board } from '@/types'

interface CardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  card?: Card | null
  boardId: string
  defaultStatus?: CardStatus
  onSave: (data: Partial<Card> & { title: string; board_id: string }) => void
  boards?: Board[] // For "All" view board selection
  isAllBoards?: boolean
}

export function CardDialog({
  open,
  onOpenChange,
  card,
  boardId,
  defaultStatus = 'todo',
  onSave,
  boards = [],
  isAllBoards = false,
}: CardDialogProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState(3)
  const [estimatedHours, setEstimatedHours] = useState('')
  const [deadline, setDeadline] = useState('')
  const [tags, setTags] = useState('')
  const [status, setStatus] = useState<CardStatus>(defaultStatus)
  const [selectedBoardId, setSelectedBoardId] = useState(boardId)

  useEffect(() => {
    if (card) {
      setTitle(card.title)
      setDescription(card.description || '')
      setPriority(card.priority)
      setEstimatedHours(card.estimated_hours?.toString() || '')
      setDeadline(card.deadline ? card.deadline.split('T')[0] : '')
      setTags(card.tags?.join(', ') || '')
      setStatus(card.status)
      setSelectedBoardId(card.board_id)
    } else {
      setTitle('')
      setDescription('')
      setPriority(3)
      setEstimatedHours('')
      setDeadline('')
      setTags('')
      setStatus(defaultStatus)
      setSelectedBoardId(isAllBoards && boards.length > 0 ? boards[0].id : boardId)
    }
  }, [card, defaultStatus, open, boardId, isAllBoards, boards])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    if (isAllBoards && !selectedBoardId) return // Must select board in All view

    onSave({
      ...(card?.id && { id: card.id }),
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      estimated_hours: estimatedHours ? parseFloat(estimatedHours) : undefined,
      deadline: deadline ? new Date(deadline).toISOString() : undefined,
      tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      status,
      board_id: selectedBoardId || boardId,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)} className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{card ? 'Edit Card' : 'New Card'}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Title *</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" autoFocus />
            </div>

            {isAllBoards && boards.length > 0 && (
              <div>
                <label className="text-sm font-medium mb-1.5 block">Board *</label>
                <select
                  value={selectedBoardId}
                  onChange={(e) => setSelectedBoardId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {boards.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="text-sm font-medium mb-1.5 block">Description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add more details..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as CardStatus)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="done">Done</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Priority (1-5)</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(parseInt(e.target.value))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value={1}>1 - Critical</option>
                  <option value={2}>2 - High</option>
                  <option value={3}>3 - Medium</option>
                  <option value={4}>4 - Low</option>
                  <option value={5}>5 - Minimal</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Estimated Hours</label>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  value={estimatedHours}
                  onChange={(e) => setEstimatedHours(e.target.value)}
                  placeholder="e.g., 2.5"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Deadline</label>
                <Input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Tags (comma separated)</label>
              <Input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g., urgent, research, coding"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{card ? 'Save Changes' : 'Create Card'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
