import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Check, X, RotateCcw, Archive } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { boardsApi } from '@/lib/api'
import type { Board } from '@/types'

interface BoardManagementProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  boards: Board[]
  onCreateBoard: (data: { name: string; description?: string; color: string }) => void
  onUpdateBoard: (id: string, data: { name?: string; description?: string; color?: string }) => void
  onDeleteBoard: (id: string) => void
  onRestoreBoard: (id: string) => void
}

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899', '#6366f1']

export function BoardManagement({ open, onOpenChange, boards, onCreateBoard, onUpdateBoard, onDeleteBoard, onRestoreBoard }: BoardManagementProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editColor, setEditColor] = useState('#6366f1')
  const [isAdding, setIsAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newColor, setNewColor] = useState('#6366f1')
  const [archivedBoards, setArchivedBoards] = useState<Board[]>([])
  const [showArchived, setShowArchived] = useState(false)

  useEffect(() => {
    if (open && showArchived) {
      boardsApi.listArchived().then(res => setArchivedBoards(res.data)).catch(() => setArchivedBoards([]))
    }
  }, [open, showArchived])

  const startEdit = (board: Board) => {
    setEditingId(board.id)
    setEditName(board.name)
    setEditDesc(board.description || '')
    setEditColor(board.color)
  }

  const saveEdit = () => {
    if (editingId && editName.trim()) {
      onUpdateBoard(editingId, { name: editName.trim(), description: editDesc.trim() || undefined, color: editColor })
      setEditingId(null)
    }
  }

  const cancelEdit = () => { setEditingId(null) }

  const handleAdd = () => {
    if (newName.trim()) {
      onCreateBoard({ name: newName.trim(), description: newDesc.trim() || undefined, color: newColor })
      setNewName('')
      setNewDesc('')
      setNewColor('#6366f1')
      setIsAdding(false)
    }
  }

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Archive board "${name}" and all its cards? You can restore it later.`)) {
      onDeleteBoard(id)
    }
  }

  const handleRestore = (id: string) => {
    onRestoreBoard(id)
    setArchivedBoards(prev => prev.filter(b => b.id !== id))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)} className="sm:max-w-[500px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Manage Boards</span>
            <Button variant="ghost" size="sm" onClick={() => setShowArchived(!showArchived)} className="text-xs">
              <Archive className="h-3 w-3 mr-1" />{showArchived ? 'Hide' : 'Show'} Archived
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 py-4 overflow-y-auto space-y-3">
          {boards.map((board) => (
            <div key={board.id} className="border rounded-lg p-3 bg-card">
              {editingId === board.id ? (
                <div className="space-y-3">
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Board name" autoFocus />
                  <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Description (optional)" rows={2} />
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Color:</span>
                    {COLORS.map((c) => (
                      <button key={c} onClick={() => setEditColor(c)} className={`w-6 h-6 rounded-full border-2 ${editColor === c ? 'border-white' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                    ))}
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={cancelEdit}><X className="h-4 w-4" /></Button>
                    <Button size="sm" onClick={saveEdit}><Check className="h-4 w-4" /></Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-4 h-4 rounded-full" style={{ backgroundColor: board.color }} />
                    <div>
                      <h4 className="font-medium text-sm">{board.name}</h4>
                      {board.description && <p className="text-xs text-muted-foreground">{board.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(board)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(board.id, board.name)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {isAdding ? (
            <div className="border rounded-lg p-3 bg-card border-primary space-y-3">
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New board name" autoFocus />
              <Textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Description (optional)" rows={2} />
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Color:</span>
                {COLORS.map((c) => (
                  <button key={c} onClick={() => setNewColor(c)} className={`w-6 h-6 rounded-full border-2 ${newColor === c ? 'border-white' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setIsAdding(false)}>Cancel</Button>
                <Button size="sm" onClick={handleAdd} disabled={!newName.trim()}>Add Board</Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" className="w-full" onClick={() => setIsAdding(true)}><Plus className="h-4 w-4 mr-2" />Add New Board</Button>
          )}

          {showArchived && archivedBoards.length > 0 && (
            <>
              <div className="border-t pt-3 mt-3">
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Archived Boards</h4>
                {archivedBoards.map((board) => (
                  <div key={board.id} className="border rounded-lg p-3 bg-card/50 opacity-60 flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="w-4 h-4 rounded-full" style={{ backgroundColor: board.color }} />
                      <div>
                        <h4 className="font-medium text-sm">{board.name}</h4>
                        {board.description && <p className="text-xs text-muted-foreground">{board.description}</p>}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleRestore(board.id)}>
                      <RotateCcw className="h-4 w-4 mr-1" />Restore
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}
          {showArchived && archivedBoards.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4 border-t mt-3">No archived boards</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

