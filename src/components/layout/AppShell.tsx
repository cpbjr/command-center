import { useState } from "react"
import { Outlet } from "react-router-dom"
import Sidebar from "./Sidebar"
import Header from "./Header"
import BottomNav from "./BottomNav"

export default function AppShell() {
  const [collapsed] = useState(false)

  return (
    // h-dvh (dynamic viewport height) instead of h-screen/100vh so mobile
    // browser toolbars don't push content past the visible area and clip it.
    <div className="flex h-dvh w-full overflow-hidden bg-warmwhite">
      {/* Sidebar — hidden on mobile, icon-only on md, full on lg+ */}
      <div className="hidden md:flex md:shrink-0">
        <Sidebar collapsed={collapsed} />
      </div>

      {/* Content column */}
      <div className="flex flex-1 flex-col min-w-0">
        <Header />

        {/* Scrollable page content. pb accounts for the mobile bottom nav so the
            last row is never hidden behind it (and clears the iOS home indicator). */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto min-w-0 w-full pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
          <Outlet />
        </main>

        {/* Mobile-only bottom tab bar */}
        <BottomNav />
      </div>
    </div>
  )
}
