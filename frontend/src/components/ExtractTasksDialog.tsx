import { useState } from 'react'
import { Sparkles, Loader2, Check, X, Calendar, Clock, AlertCircle, Plus } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { aiApi, boardsApi, type ExtractedTask, type SuggestedBoard } from '@/lib/api'
import type { Board } from '@/types'

interface ExtractTasksDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  boardId: string | null  // Not used anymore, kept for compatibility
  boardName: string  // Not used anymore, kept for compatibility
  onTasksCreated: () => void
  boards: Board[]
  isAllBoards?: boolean  // Not used anymore, kept for compatibility
}

const priorityVariants: Record<number, 'priority1' | 'priority2' | 'priority3' | 'priority4' | 'priority5'> = {
  1: 'priority1', 2: 'priority2', 3: 'priority3', 4: 'priority4', 5: 'priority5',
}

export function ExtractTasksDialog({ open, onOpenChange, onTasksCreated, boards }: ExtractTasksDialogProps) {
  const [text, setText] = useState('')
  const [extractedTasks, setExtractedTasks] = useState<ExtractedTask[]>([])
  const [suggestedBoards, setSuggestedBoards] = useState<SuggestedBoard[]>([])
  const [summary, setSummary] = useState('')
  const [isExtracting, setIsExtracting] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [step, setStep] = useState<'input' | 'preview'>('input')
  const [creatingBoards, setCreatingBoards] = useState<Set<string>>(new Set())

  const handleExtract = async () => {
    if (!text.trim() || boards.length === 0) return
    setIsExtracting(true)
    try {
      const boardsInfo = boards.map(b => ({ id: b.id, name: b.name, description: b.description }))
      const response = await aiApi.extractTasks(text, boardsInfo)
      setExtractedTasks(response.data.tasks || [])
      setSuggestedBoards(response.data.suggested_new_boards || [])
      setSummary(response.data.summary || '')
      setStep('preview')
    } catch (error) {
      console.error('Extraction failed:', error)
      alert('Failed to extract tasks. Please try again.')
    } finally {
      setIsExtracting(false)
    }
  }

  const handleCreateBoard = async (suggestion: SuggestedBoard) => {
    setCreatingBoards(prev => new Set(prev).add(suggestion.name))
    try {
      const response = await boardsApi.create({ name: suggestion.name })
      const newBoardId = response.data.id

      // Update tasks that were assigned to this new board
      setExtractedTasks(prev =>
        prev.map((task, idx) => {
          if (suggestion.task_indices.includes(idx) && task.board_id === 'NEW_BOARD') {
            return { ...task, board_id: newBoardId, suggested_board_name: null }
          }
          return task
        })
      )

      // Remove from suggested boards
      setSuggestedBoards(prev => prev.filter(s => s.name !== suggestion.name))
    } catch (error) {
      console.error('Failed to create board:', error)
      alert('Failed to create board. Please try again.')
    } finally {
      setCreatingBoards(prev => {
        const next = new Set(prev)
        next.delete(suggestion.name)
        return next
      })
    }
  }

  const handleChangeBoardForTask = (taskIndex: number, newBoardId: string) => {
    setExtractedTasks(prev =>
      prev.map((task, idx) =>
        idx === taskIndex ? { ...task, board_id: newBoardId, suggested_board_name: null } : task
      )
    )
  }

  const handleCreate = async () => {
    // Filter out tasks that still have NEW_BOARD (user didn't create the board)
    const validTasks = extractedTasks.filter(t => t.board_id && t.board_id !== 'NEW_BOARD')
    if (validTasks.length === 0) {
      alert('No tasks to create. Please assign boards to all tasks or create suggested boards first.')
      return
    }
    setIsCreating(true)
    try {
      await aiApi.createExtractedTasks(validTasks)
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
    // Update suggested boards task indices
    setSuggestedBoards(prev =>
      prev.map(sb => ({
        ...sb,
        task_indices: sb.task_indices
          .filter(i => i !== index)
          .map(i => (i > index ? i - 1 : i)),
      })).filter(sb => sb.task_indices.length > 0)
    )
  }

  const handleClose = () => {
    setText('')
    setExtractedTasks([])
    setSuggestedBoards([])
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

  const getBoardColor = (boardId: string | undefined) => {
    if (!boardId || boardId === 'NEW_BOARD') return '#6366f1'
    return boards.find(b => b.id === boardId)?.color || '#6366f1'
  }

  const validTaskCount = extractedTasks.filter(t => t.board_id && t.board_id !== 'NEW_BOARD').length
  const newBoardTasks = extractedTasks.filter(t => t.board_id === 'NEW_BOARD').length

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent onClose={handleClose} className="sm:max-w-[650px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {step === 'input' ? 'AI Extract' : 'Review Extracted Tasks'}
          </DialogTitle>
        </DialogHeader>

        {step === 'input' ? (
          <>
            <div className="flex-1 py-4 overflow-y-auto min-h-0">
              <p className="text-sm text-muted-foreground mb-3">
                Paste any text and AI will extract tasks and automatically assign them to the right boards.
              </p>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste your text here...

Example:
- Read Chapter 5 by Friday (personal)
- Submit quarterly report due Dec 15 (work)
- Group presentation next Tuesday
- Review lecture notes for midterm
- Book flight for vacation"
                rows={14}
                className="resize-none"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleExtract} disabled={!text.trim() || boards.length === 0 || isExtracting}>
                {isExtracting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Extracting...</> : <><Sparkles className="h-4 w-4 mr-2" />Extract Tasks</>}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="flex-1 py-4 overflow-y-auto">
              {summary && <p className="text-sm text-muted-foreground mb-4 p-3 bg-secondary/50 rounded-lg">{summary}</p>}

              {/* Suggested New Boards Alert */}
              {suggestedBoards.length > 0 && (
                <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-amber-500 mb-2">
                        AI suggests creating {suggestedBoards.length} new board{suggestedBoards.length > 1 ? 's' : ''}:
                      </p>
                      <div className="space-y-2">
                        {suggestedBoards.map((sb) => (
                          <div key={sb.name} className="flex items-center justify-between gap-2 bg-background/50 rounded p-2">
                            <div className="flex-1 min-w-0">
                              <span className="font-medium text-sm">{sb.name}</span>
                              <span className="text-xs text-muted-foreground ml-2">({sb.task_indices.length} task{sb.task_indices.length > 1 ? 's' : ''})</span>
                              <p className="text-xs text-muted-foreground truncate">{sb.reason}</p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCreateBoard(sb)}
                              disabled={creatingBoards.has(sb.name)}
                              className="shrink-0"
                            >
                              {creatingBoards.has(sb.name) ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <><Plus className="h-3 w-3 mr-1" />Create</>
                              )}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {extractedTasks.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No tasks found in the text.</p>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-medium">
                    {extractedTasks.length} task{extractedTasks.length !== 1 ? 's' : ''} extracted
                    {newBoardTasks > 0 && (
                      <span className="text-amber-500 ml-1">({newBoardTasks} need board assignment)</span>
                    )}
                  </p>
                  {extractedTasks.map((task, index) => (
                    <div key={index} className={`border rounded-lg p-3 bg-card group ${task.board_id === 'NEW_BOARD' ? 'border-amber-500/50' : ''}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h4 className="font-medium text-sm truncate">{task.title}</h4>
                            <Badge variant={priorityVariants[task.priority] || 'priority3'}>P{task.priority}</Badge>
                            {/* Board badge with selector */}
                            <select
                              value={task.board_id || ''}
                              onChange={(e) => handleChangeBoardForTask(index, e.target.value)}
                              className="text-xs px-2 py-0.5 rounded-full border-0 focus:ring-1 focus:ring-ring cursor-pointer"
                              style={{
                                backgroundColor: `${getBoardColor(task.board_id)}20`,
                                color: getBoardColor(task.board_id),
                              }}
                            >
                              {task.board_id === 'NEW_BOARD' && (
                                <option value="NEW_BOARD" disabled>
                                  {task.suggested_board_name || 'Select Board'}
                                </option>
                              )}
                              {boards.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                              ))}
                            </select>
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
              <Button onClick={handleCreate} disabled={validTaskCount === 0 || isCreating}>
                {isCreating ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating...</>
                ) : (
                  <><Check className="h-4 w-4 mr-2" />Create {validTaskCount} Task{validTaskCount !== 1 ? 's' : ''}</>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
