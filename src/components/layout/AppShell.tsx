import { useState } from "react"
import { Outlet } from "react-router-dom"
import Sidebar from "./Sidebar"
import Header from "./Header"
import MobileNav from "./MobileNav"

export default function AppShell() {
  const [collapsed] = useState(false)

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-warmwhite">
      {/* Sidebar — hidden on mobile, icon-only on md, full on lg+ */}
      <div className="hidden md:flex md:shrink-0">
        <Sidebar collapsed={collapsed} />
      </div>

      {/* Content column */}
      <div className="flex flex-1 flex-col min-h-0">
        <Header />

        {/* Scrollable page content */}
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <MobileNav />
    </div>
  )
}
