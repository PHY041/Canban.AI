import { useState, useEffect } from 'react'
import { Sparkles, Loader2, Check, X, Calendar, Clock } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { aiApi, type ExtractedTask } from '@/lib/api'
import type { Board } from '@/types'

interface ExtractTasksDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  boardId: string | null
  boardName: string
  onTasksCreated: () => void
  boards?: Board[] // For "All" view
  isAllBoards?: boolean
}

const priorityVariants: Record<number, 'priority1' | 'priority2' | 'priority3' | 'priority4' | 'priority5'> = {
  1: 'priority1', 2: 'priority2', 3: 'priority3', 4: 'priority4', 5: 'priority5',
}

export function ExtractTasksDialog({ open, onOpenChange, boardId, boardName: _boardName, onTasksCreated, boards = [], isAllBoards = false }: ExtractTasksDialogProps) {
  const [text, setText] = useState('')
  const [extractedTasks, setExtractedTasks] = useState<ExtractedTask[]>([])
  const [summary, setSummary] = useState('')
  const [isExtracting, setIsExtracting] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [step, setStep] = useState<'input' | 'preview'>('input')
  const [selectedBoardId, setSelectedBoardId] = useState(boardId || (boards.length > 0 ? boards[0].id : ''))

  useEffect(() => {
    if (isAllBoards && boards.length > 0 && !selectedBoardId) setSelectedBoardId(boards[0].id)
    else if (!isAllBoards && boardId) setSelectedBoardId(boardId)
  }, [isAllBoards, boards, boardId, selectedBoardId])

  const handleExtract = async () => {
    if (!text.trim() || !selectedBoardId) return
    setIsExtracting(true)
    try {
      const response = await aiApi.extractTasks(text, selectedBoardId)
      setExtractedTasks(response.data.tasks || [])
      setSummary(response.data.summary || '')
      setStep('preview')
    } catch (error) {
      console.error('Extraction failed:', error)
      alert('Failed to extract tasks. Please try again.')
    } finally {
      setIsExtracting(false)
    }
  }

  const handleCreate = async () => {
    if (extractedTasks.length === 0) return
    setIsCreating(true)
    try {
      await aiApi.createExtractedTasks(extractedTasks)
      onTasksCreated()
      handleClose()
    } catch (error) {
      console.error('Creation failed:', error)
      alert('Failed to create tasks. Please try again.')
    } finally {
      setIsCreating(false)
    }
  }

  const handleRemoveTask = (index: number) => {
    setExtractedTasks(prev => prev.filter((_, i) => i !== index))
  }

  const handleClose = () => {
    setText('')
    setExtractedTasks([])
    setSummary('')
    setStep('input')
    onOpenChange(false)
  }

  const formatDeadline = (deadline: string | null | undefined) => {
    if (!deadline) return null
    try {
      return new Date(deadline).toLocaleDateString()
    } catch { return null }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent onClose={handleClose} className="sm:max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {step === 'input' ? 'Extract Tasks with AI' : 'Review Extracted Tasks'}
          </DialogTitle>
        </DialogHeader>

        {step === 'input' ? (
          <>
            <div className="flex-1 py-4">
              <p className="text-sm text-muted-foreground mb-3">
                Paste any text (emails, notes, syllabus, meeting notes) and AI will extract actionable tasks.
              </p>
              {isAllBoards && boards.length > 0 && (
                <div className="mb-3">
                  <label className="text-sm font-medium mb-1.5 block">Target Board *</label>
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
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste your text here...

Example:
- Read Chapter 5 by Friday
- Submit essay (2000 words) due Dec 15
- Group presentation next Tuesday
- Review lecture notes for midterm"
                rows={isAllBoards ? 10 : 12}
                className="resize-none"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleExtract} disabled={!text.trim() || !selectedBoardId || isExtracting}>
                {isExtracting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Extracting...</> : <><Sparkles className="h-4 w-4 mr-2" />Extract Tasks</>}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="flex-1 py-4 overflow-y-auto">
              {summary && <p className="text-sm text-muted-foreground mb-4 p-3 bg-secondary/50 rounded-lg">{summary}</p>}
              {extractedTasks.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No tasks found in the text.</p>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-medium">{extractedTasks.length} task{extractedTasks.length !== 1 ? 's' : ''} extracted:</p>
                  {extractedTasks.map((task, index) => (
                    <div key={index} className="border rounded-lg p-3 bg-card group">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-sm truncate">{task.title}</h4>
                            <Badge variant={priorityVariants[task.priority] || 'priority3'}>P{task.priority}</Badge>
                          </div>
                          {task.description && <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>}
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            {task.deadline && (
                              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDeadline(task.deadline)}</span>
                            )}
                            {task.estimated_hours && (
                              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{task.estimated_hours}h</span>
                            )}
                          </div>
                          {task.tags && task.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {task.tags.map((tag) => (<span key={tag} className="px-1.5 py-0.5 bg-secondary rounded text-xs">{tag}</span>))}
                            </div>
                          )}
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => handleRemoveTask(index)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('input')}>Back</Button>
              <Button onClick={handleCreate} disabled={extractedTasks.length === 0 || isCreating}>
                {isCreating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating...</> : <><Check className="h-4 w-4 mr-2" />Create {extractedTasks.length} Task{extractedTasks.length !== 1 ? 's' : ''}</>}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

