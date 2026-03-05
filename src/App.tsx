import { BrowserRouter, Routes, Route } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import AppShell from "@/components/layout/AppShell"
import LeadsPage from "@/pages/LeadsPage"
import ClientsPage from "@/pages/ClientsPage"
import TasksPage from "@/pages/TasksPage"
import CostsPage from "@/pages/CostsPage"
import ProjectsPage from "@/pages/ProjectsPage"
import DiscoveryPage from "@/pages/DiscoveryPage"
import DocsPage from "@/pages/DocsPage"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<LeadsPage />} />
            <Route path="/clients" element={<ClientsPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/costs" element={<CostsPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/discovery" element={<DiscoveryPage />} />
            <Route path="/docs" element={<DocsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
