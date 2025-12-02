import { useState, useEffect } from 'react'
import { Settings, Eye, EyeOff, ExternalLink, Check, AlertCircle } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface SettingsDialogProps { open: boolean; onOpenChange: (open: boolean) => void }

const STORAGE_KEY = 'canban-settings'

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [supabaseUrl, setSupabaseUrl] = useState('')
  const [supabaseKey, setSupabaseKey] = useState('')
  const [openaiKey, setOpenaiKey] = useState('')
  const [showKeys, setShowKeys] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')

  useEffect(() => { // Load saved settings
    if (open) {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const { supabaseUrl: u, supabaseKey: k, openaiKey: o } = JSON.parse(stored)
        setSupabaseUrl(u || ''); setSupabaseKey(k || ''); setOpenaiKey(o || '')
      }
    }
  }, [open])

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ supabaseUrl, supabaseKey, openaiKey }))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleTest = async () => { // Test connection to backend
    setTestStatus('testing')
    try {
      const res = await fetch('http://localhost:8000/health')
      setTestStatus(res.ok ? 'success' : 'error')
    } catch { setTestStatus('error') }
    setTimeout(() => setTestStatus('idle'), 3000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)} className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Settings className="h-5 w-5" />Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <p className="font-medium mb-2">⚠️ For Desktop App Users</p>
            <p className="text-muted-foreground">These settings are stored locally. For the app to work, you also need to create <code className="bg-muted px-1 rounded">~/.canban-ai/.env</code> with your keys.</p>
          </div>

          {/* Supabase URL */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Supabase URL</label>
            <Input value={supabaseUrl} onChange={(e) => setSupabaseUrl(e.target.value)} placeholder="https://your-project.supabase.co" />
            <p className="text-xs text-muted-foreground">Find at: <a href="https://supabase.com/dashboard" target="_blank" rel="noopener" className="text-primary hover:underline inline-flex items-center gap-1">Supabase Dashboard → Settings → API<ExternalLink className="h-3 w-3" /></a></p>
          </div>

          {/* Supabase Key */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Supabase Anon Key</label>
            <div className="relative">
              <Input type={showKeys ? 'text' : 'password'} value={supabaseKey} onChange={(e) => setSupabaseKey(e.target.value)} placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." className="pr-10" />
              <button onClick={() => setShowKeys(!showKeys)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showKeys ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Use the "anon public" key, not the service role key</p>
          </div>

          {/* OpenAI Key */}
          <div className="space-y-2">
            <label className="text-sm font-medium">OpenAI API Key</label>
            <div className="relative">
              <Input type={showKeys ? 'text' : 'password'} value={openaiKey} onChange={(e) => setOpenaiKey(e.target.value)} placeholder="sk-..." className="pr-10" />
              <button onClick={() => setShowKeys(!showKeys)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showKeys ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Get at: <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener" className="text-primary hover:underline inline-flex items-center gap-1">OpenAI API Keys<ExternalLink className="h-3 w-3" /></a></p>
          </div>

          {/* Test Connection */}
          <div className="flex items-center gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={handleTest} disabled={testStatus === 'testing'}>
              {testStatus === 'testing' ? 'Testing...' : 'Test Connection'}
            </Button>
            {testStatus === 'success' && <span className="text-sm text-green-500 flex items-center gap-1"><Check className="h-4 w-4" />Connected!</span>}
            {testStatus === 'error' && <span className="text-sm text-red-500 flex items-center gap-1"><AlertCircle className="h-4 w-4" />Backend not running</span>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>{saved ? <><Check className="h-4 w-4 mr-1" />Saved!</> : 'Save Settings'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

