import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { KanbanBoard } from '@/components/KanbanBoard'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 1,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-background p-6">
        <main className="h-[calc(100vh-48px)]">
          <KanbanBoard />
        </main>
      </div>
    </QueryClientProvider>
  )
}

export default App
