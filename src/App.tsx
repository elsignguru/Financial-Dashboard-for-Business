// Root layout component — splits the viewport into a fixed sidebar and a scrollable main dashboard area.
import AuthGate from './components/auth/AuthGate'
import Sidebar from './components/sidebar/Sidebar'
import DashboardGrid from './components/dashboard/DashboardGrid'
import './App.css'

export default function App() {
  return (
    <AuthGate>
      <div className="flex h-screen overflow-hidden bg-gray-50">
        <Sidebar />
        <main className="flex-1 overflow-y-auto flex flex-col">
          <DashboardGrid />
        </main>
      </div>
    </AuthGate>
  )
}
