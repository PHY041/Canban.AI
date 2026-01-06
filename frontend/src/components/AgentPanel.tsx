import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Send, Square, Terminal, CheckCircle2, AlertCircle, Loader2, GitBranch, GitMerge, FileCode, Plus, Minus, RefreshCw, MessageCircleQuestion } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { agentsApi, gitApi, type DiffResponse } from '@/lib/api'
import type { AgentSession, Card } from '@/types'

interface AgentPanelProps {
  card: Card
  session: AgentSession | null
  onClose: () => void
  onCancel: (sessionId: string) => void
  onSessionUpdate?: (session: AgentSession) => void
}

interface ParsedOutput {
  type: 'text' | 'tool' | 'result' | 'error' | 'assistant' | 'user' | 'question'
  content: string
  tool?: string
}

function parseOutputLine(line: string): ParsedOutput {
  // Check for user messages (from interactive mode)
  if (line.startsWith('[user] ')) {
    return { type: 'user', content: line.substring(7) }
  }
  // Check for kanban system messages
  if (line.startsWith('[kanban]')) {
    return { type: 'text', content: line }
  }

  try {
    const json = JSON.parse(line)
    if (json.type === 'assistant') {
      const content = json.message?.content
      if (Array.isArray(content)) {
        const texts = content
          .filter((c: { type: string }) => c.type === 'text')
          .map((c: { text: string }) => c.text)
          .join('\n')
        return { type: 'assistant', content: texts || '[thinking...]' }
      }
      return { type: 'assistant', content: String(content) }
    }
    if (json.type === 'result') {
      return { type: 'result', content: json.result || 'Completed' }
    }
    if (json.type === 'error') {
      return { type: 'error', content: json.error || json.message || 'Error' }
    }
    // Tool usage
    if (json.tool) {
      return { type: 'tool', content: `Using ${json.tool}...`, tool: json.tool }
    }
    return { type: 'text', content: line }
  } catch {
    return { type: 'text', content: line }
  }
}

type TabType = 'output' | 'changes'

export function AgentPanel({ card, session, onClose, onCancel, onSessionUpdate }: AgentPanelProps) {
  const [outputLines, setOutputLines] = useState<ParsedOutput[]>([])
  const [inputText, setInputText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('output')
  const [diffData, setDiffData] = useState<DiffResponse | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)
  const [diffError, setDiffError] = useState<string | null>(null)
  const [merging, setMerging] = useState(false)
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())
  const outputRef = useRef<HTMLDivElement>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Check if agent is waiting for user input
  const isWaitingForInput = session?.status === 'waiting_for_input' || session?.waiting_for_input

  // Connect to SSE stream when session is active
  useEffect(() => {
    if (!session || !['running', 'waiting_for_input'].includes(session.status)) {
      return
    }

    setIsStreaming(true)
    const eventSource = new EventSource(agentsApi.streamUrl(session.id))
    eventSourceRef.current = eventSource

    eventSource.onmessage = (event) => {
      const parsed = parseOutputLine(event.data)
      setOutputLines(prev => [...prev, parsed])
    }

    eventSource.addEventListener('done', () => {
      setIsStreaming(false)
      eventSource.close()
    })

    eventSource.onerror = () => {
      setIsStreaming(false)
      eventSource.close()
    }

    return () => {
      eventSource.close()
    }
  }, [session?.id, session?.status])

  // Focus input when waiting for input
  useEffect(() => {
    if (isWaitingForInput && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isWaitingForInput])

  // Auto-scroll to bottom
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [outputLines])

  // Populate initial output if session already has lines
  useEffect(() => {
    if (session?.output_lines) {
      setOutputLines(session.output_lines.map(parseOutputLine))
    }
  }, [session?.id])

  const handleCancel = useCallback(() => {
    if (session) {
      onCancel(session.id)
    }
  }, [session, onCancel])

  // Handle sending message - uses --resume for multi-turn
  const handleSendMessage = useCallback(async () => {
    if (!inputText.trim() || !session) return

    // Can only send when completed or waiting for input
    if (!['completed', 'waiting_for_input'].includes(session.status)) {
      return
    }

    // Need claude_session_id for resumption
    if (!session.claude_session_id) {
      setOutputLines(prev => [...prev, {
        type: 'error',
        content: 'Cannot resume: No Claude session ID available.'
      }])
      return
    }

    setIsSending(true)
    try {
      // Use sendMessage API which uses --resume internally
      const response = await agentsApi.sendMessage(session.id, inputText.trim())
      const updatedSession = response.data

      setInputText('')
      if (onSessionUpdate) {
        onSessionUpdate(updatedSession)
      }
    } catch (err) {
      console.error('Failed to send message:', err)
      setOutputLines(prev => [...prev, {
        type: 'error',
        content: 'Failed to send message. Please try again.'
      }])
    } finally {
      setIsSending(false)
    }
  }, [inputText, session, onSessionUpdate])

  // Fetch diff data
  const fetchDiff = useCallback(async () => {
    if (!card?.id) return
    setDiffLoading(true)
    setDiffError(null)
    try {
      const response = await gitApi.getDiff(card.id)
      setDiffData(response.data)
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      setDiffError(error.response?.data?.detail || 'Failed to fetch diff')
    } finally {
      setDiffLoading(false)
    }
  }, [card?.id])

  // Fetch diff when switching to changes tab or when session completes
  useEffect(() => {
    if (activeTab === 'changes' && session?.worktree_path) {
      fetchDiff()
    }
  }, [activeTab, session?.worktree_path, fetchDiff])

  // Handle merge
  const handleMerge = useCallback(async () => {
    if (!card?.id) return
    setMerging(true)
    try {
      const response = await gitApi.merge(card.id)
      if (response.data.success) {
        setOutputLines(prev => [...prev, { type: 'result', content: `Merged: ${response.data.message}` }])
        setDiffData(null) // Clear diff after merge
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      setOutputLines(prev => [...prev, { type: 'error', content: `Merge failed: ${error.response?.data?.detail || 'Unknown error'}` }])
    } finally {
      setMerging(false)
    }
  }, [card?.id])

  // Toggle file expansion
  const toggleFileExpansion = (path: string) => {
    setExpandedFiles(prev => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  const statusIcon = () => {
    if (!session) return null
    switch (session.status) {
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
      case 'waiting_for_input':
        return <MessageCircleQuestion className="h-4 w-4 text-yellow-500 animate-pulse" />
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'failed':
      case 'cancelled':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <Terminal className="h-4 w-4 text-muted-foreground" />
    }
  }

  return (
    <div className="flex flex-col h-full border-l bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          {statusIcon()}
          <span className="font-medium text-sm truncate max-w-[200px]">{card.title}</span>
        </div>
        <div className="flex items-center gap-1">
          {session?.status === 'running' && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={handleCancel}>
              <Square className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        <button
          className={`flex-1 px-4 py-2 text-sm font-medium ${
            activeTab === 'output'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('output')}
        >
          <Terminal className="h-4 w-4 inline mr-2" />
          Output
        </button>
        <button
          className={`flex-1 px-4 py-2 text-sm font-medium ${
            activeTab === 'changes'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('changes')}
        >
          <GitBranch className="h-4 w-4 inline mr-2" />
          Changes
          {diffData && diffData.files.length > 0 && (
            <span className="ml-2 bg-primary/10 text-primary text-xs px-2 py-0.5 rounded">
              {diffData.files.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'output' ? (
        <>
          {/* Output area */}
          <div
            ref={outputRef}
            className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1 bg-slate-950"
          >
            {outputLines.length === 0 && !isStreaming && (
              <div className="text-slate-500 text-center py-8">
                {session ? 'Waiting for output...' : 'No agent running'}
              </div>
            )}
            {outputLines.map((line, i) => (
              <div
                key={i}
                className={`
                  ${line.type === 'assistant' ? 'text-green-400' : ''}
                  ${line.type === 'tool' ? 'text-yellow-400' : ''}
                  ${line.type === 'error' ? 'text-red-400' : ''}
                  ${line.type === 'result' ? 'text-blue-400' : ''}
                  ${line.type === 'text' ? 'text-slate-300' : ''}
                  ${line.type === 'user' ? 'text-cyan-400 bg-cyan-950/30 px-2 py-1 rounded my-1' : ''}
                  ${line.type === 'question' ? 'text-yellow-300 bg-yellow-950/30 px-2 py-1 rounded my-1' : ''}
                `}
              >
                {line.type === 'tool' && <span className="text-slate-500">[tool] </span>}
                {line.type === 'user' && <span className="text-cyan-600">[you] </span>}
                {line.content}
              </div>
            ))}
            {isStreaming && (
              <div className="text-slate-500 animate-pulse">...</div>
            )}
          </div>

          {/* Session info */}
          {session && (
            <div className="px-4 py-2 border-t text-xs text-muted-foreground">
              Status: <span className="capitalize">{session.status}</span>
              {session.worktree_branch && (
                <span className="ml-2">
                  <GitBranch className="h-3 w-3 inline" /> {session.worktree_branch}
                </span>
              )}
              {session.error && <span className="text-red-500 ml-2">({session.error})</span>}
            </div>
          )}

          {/* Message input - uses --resume for multi-turn */}
          <div className="p-3 border-t">
            {/* Show the question if agent is waiting for input */}
            {isWaitingForInput && session?.last_question && (
              <div className="mb-2 p-2 bg-yellow-950/30 border border-yellow-800/50 rounded text-sm">
                <div className="flex items-center gap-2 text-yellow-400 mb-1">
                  <MessageCircleQuestion className="h-4 w-4" />
                  <span className="font-medium">Agent is asking:</span>
                </div>
                <p className="text-yellow-200">{session.last_question}</p>
              </div>
            )}
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  session?.status === 'running'
                    ? 'Wait for completion...'
                    : session?.claude_session_id
                    ? 'Send follow-up message...'
                    : 'Waiting for session...'
                }
                className="flex-1 text-sm"
                disabled={!session || !['waiting_for_input', 'completed'].includes(session.status) || !session.claude_session_id || isSending}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
              />
              <Button
                size="icon"
                disabled={!session || !['waiting_for_input', 'completed'].includes(session.status) || !session.claude_session_id || !inputText.trim() || isSending}
                onClick={handleSendMessage}
              >
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            {session?.status === 'running' && (
              <p className="text-xs text-muted-foreground mt-1">
                Agent is working. Wait for completion to send a follow-up.
              </p>
            )}
            {session?.status === 'completed' && !session?.claude_session_id && (
              <p className="text-xs text-muted-foreground mt-1">
                No Claude session available for resumption.
              </p>
            )}
            {session?.message_count !== undefined && session.message_count > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Messages exchanged: {session.message_count}
              </p>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Changes/Diff view */}
          <div className="flex-1 overflow-y-auto">
            {diffLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : diffError ? (
              <div className="p-4 text-center">
                <p className="text-sm text-muted-foreground">{diffError}</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={fetchDiff}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
              </div>
            ) : !diffData || diffData.files.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                <FileCode className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No changes detected</p>
                {session?.worktree_branch && (
                  <p className="text-xs mt-1">Branch: {session.worktree_branch}</p>
                )}
              </div>
            ) : (
              <div className="divide-y">
                {/* Summary */}
                <div className="px-4 py-3 bg-muted/50">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{diffData.files.length} file(s) changed</span>
                    <div className="flex items-center gap-3">
                      <span className="text-green-600 flex items-center">
                        <Plus className="h-3 w-3 mr-1" />
                        {diffData.total_additions}
                      </span>
                      <span className="text-red-600 flex items-center">
                        <Minus className="h-3 w-3 mr-1" />
                        {diffData.total_deletions}
                      </span>
                    </div>
                  </div>
                  {diffData.branch && (
                    <p className="text-xs text-muted-foreground mt-1">
                      <GitBranch className="h-3 w-3 inline mr-1" />
                      {diffData.branch}
                    </p>
                  )}
                </div>

                {/* File list */}
                {diffData.files.map((file) => (
                  <div key={file.path} className="border-b">
                    <button
                      className="w-full px-4 py-2 flex items-center justify-between hover:bg-muted/50 text-left"
                      onClick={() => toggleFileExpansion(file.path)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileCode className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                        <span className="text-sm truncate">{file.path}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <span className="text-green-600 text-xs">+{file.additions}</span>
                        <span className="text-red-600 text-xs">-{file.deletions}</span>
                      </div>
                    </button>
                    {expandedFiles.has(file.path) && file.patch && (
                      <pre className="px-4 py-2 bg-slate-950 text-xs overflow-x-auto font-mono">
                        {file.patch.split('\n').map((line, i) => (
                          <div
                            key={i}
                            className={`${
                              line.startsWith('+') && !line.startsWith('+++')
                                ? 'bg-green-950 text-green-400'
                                : line.startsWith('-') && !line.startsWith('---')
                                ? 'bg-red-950 text-red-400'
                                : line.startsWith('@@')
                                ? 'text-blue-400'
                                : 'text-slate-400'
                            }`}
                          >
                            {line}
                          </div>
                        ))}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Merge controls */}
          {diffData && diffData.files.length > 0 && (
            <div className="p-3 border-t">
              <Button
                className="w-full"
                onClick={handleMerge}
                disabled={merging || session?.status === 'running'}
              >
                {merging ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Merging...
                  </>
                ) : (
                  <>
                    <GitMerge className="h-4 w-4 mr-2" />
                    Merge Changes
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Squash merge into {session?.base_branch || 'main'}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
