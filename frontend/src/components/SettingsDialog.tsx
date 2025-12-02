import { useState, useEffect } from 'react'
import { Settings, Eye, EyeOff, ExternalLink, Check, AlertCircle, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { settingsApi } from '@/lib/api'

interface SettingsDialogProps { open: boolean; onOpenChange: (open: boolean) => void }

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [supabaseUrl, setSupabaseUrl] = useState('')
  const [supabaseKey, setSupabaseKey] = useState('')
  const [openaiKey, setOpenaiKey] = useState('')
  const [showKeys, setShowKeys] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')

  useEffect(() => { // Load settings from backend (with timeout + localStorage fallback)
    if (open) {
      setLoading(true); setError('')
      const loadLocal = () => { // Fallback to localStorage
        const stored = localStorage.getItem('canban-settings')
        if (stored) { const { supabaseUrl: u, supabaseKey: k, openaiKey: o } = JSON.parse(stored); setSupabaseUrl(u || ''); setSupabaseKey(k || ''); setOpenaiKey(o || '') }
      }
      const timeout = setTimeout(() => { setLoading(false); loadLocal(); setError('Backend not responding. Enter your keys below.') }, 3000)
      settingsApi.get()
        .then(res => { clearTimeout(timeout); setSupabaseUrl(res.data.supabase_url || ''); setSupabaseKey(res.data.supabase_key || ''); setOpenaiKey(res.data.openai_api_key || '') })
        .catch(() => { clearTimeout(timeout); loadLocal(); setError('Backend not running. Enter keys below.') })
        .finally(() => setLoading(false))
    }
  }, [open])

  const handleSave = async () => {
    setSaving(true); setError('')
    try {
      await settingsApi.save({ supabase_url: supabaseUrl, supabase_key: supabaseKey, openai_api_key: openaiKey })
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } catch {
      // Fallback: save to localStorage if backend unavailable
      localStorage.setItem('canban-settings', JSON.stringify({ supabaseUrl, supabaseKey, openaiKey }))
      setError('Saved locally. Backend not running - keys will sync when backend starts.')
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    }
    finally { setSaving(false) }
  }

  const handleTest = async () => {
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

        {loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="space-y-4 py-4">
            {error && <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">{error}</div>}

            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <p className="font-medium mb-1">✨ Settings are saved to <code className="bg-muted px-1 rounded">~/.canban-ai/.env</code></p>
              <p className="text-muted-foreground">The app will use these keys after restart.</p>
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
              {testStatus === 'success' && <span className="text-sm text-green-500 flex items-center gap-1"><Check className="h-4 w-4" />Backend connected!</span>}
              {testStatus === 'error' && <span className="text-sm text-red-500 flex items-center gap-1"><AlertCircle className="h-4 w-4" />Backend not running</span>}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : saved ? <Check className="h-4 w-4 mr-1" /> : null}
            {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
