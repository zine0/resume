import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/toaster'
import Home from './routes/Home'
import Resumes from './routes/Resumes'
import EditNew from './routes/EditNew'
import EditResume from './routes/EditResume'
import ViewResume from './routes/ViewResume'
import Print from './routes/Print'
import Board from './routes/Board'
import { EditLayout } from '@/components/edit-layout'
import { ErrorBoundary } from '@/components/error-boundary'

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <ThemeProvider defaultTheme="system" storageKey="resume-theme">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/resumes" element={<Resumes />} />
            <Route
              path="/edit/new"
              element={
                <EditLayout>
                  <EditNew />
                </EditLayout>
              }
            />
            <Route
              path="/edit/:id"
              element={
                <EditLayout>
                  <EditResume />
                </EditLayout>
              }
            />
            <Route path="/view/:id" element={<ViewResume />} />
            <Route path="/board" element={<Board />} />
            <Route path="/print" element={<Print />} />
          </Routes>
          <Toaster />
        </ThemeProvider>
      </ErrorBoundary>
    </BrowserRouter>
  )
}
