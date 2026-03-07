import { useState } from "react"
import { Outlet } from "react-router-dom"
import Sidebar from "./Sidebar"
import Header from "./Header"

export default function AppShell() {
  const [collapsed] = useState(false)

  return (
    <div className="flex h-screen w-full overflow-hidden bg-warmwhite">
      {/* Sidebar — hidden on mobile, icon-only on md, full on lg+ */}
      <div className="hidden md:flex md:shrink-0">
        <Sidebar collapsed={collapsed} />
      </div>

      {/* Content column */}
      <div className="flex flex-1 flex-col min-w-0">
        <Header />

        {/* Scrollable page content */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto min-w-0 w-full">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
