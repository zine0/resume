import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from '@/components/theme-provider'
import { ColorPickerProvider } from '@/components/color-picker-manager'
import { ToolbarProvider } from '@/components/rich-text-toolbar-manager'
import { Toaster } from '@/components/toaster'
import Home from './routes/Home'
import EditNew from './routes/EditNew'
import EditResume from './routes/EditResume'
import ViewResume from './routes/ViewResume'
import Print from './routes/Print'
import Board from './routes/Board'
import { ErrorBoundary } from '@/components/error-boundary'

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <ThemeProvider defaultTheme="system" storageKey="resume-theme">
          <ColorPickerProvider>
            <ToolbarProvider>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/edit/new" element={<EditNew />} />
                <Route path="/edit/:id" element={<EditResume />} />
                <Route path="/view/:id" element={<ViewResume />} />
                <Route path="/board" element={<Board />} />
                <Route path="/print" element={<Print />} />
              </Routes>
              <Toaster />
            </ToolbarProvider>
          </ColorPickerProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </BrowserRouter>
  )
}
