import { useState, useEffect } from "react"
import { useLocation } from "react-router-dom"
import { Menu } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import Sidebar from "./Sidebar"

const routeTitles: Record<string, string> = {
  "/": "Leads",
  "/clients": "Clients",
  "/tasks": "Tasks",
  "/costs": "Costs",
  "/projects": "Projects",
  "/docs": "Docs",
}

export default function Header() {
  const { pathname } = useLocation()
  const title = routeTitles[pathname] ?? "WPA Command Center"
  const [open, setOpen] = useState(false)

  // Automatically close sidebar when navigation completes on mobile
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  return (
    <header className="flex h-16 items-center justify-between bg-parchment border-b border-wpa-border px-4 sm:px-6 shrink-0 md:px-8">
      <div className="flex items-center gap-3">
        {/* Mobile Hamburger Menu */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button className="md:hidden flex items-center justify-center shrink-0 min-h-[44px] min-w-[44px] -ml-2 text-pine-deep hover:bg-pine-deep/10 rounded-md transition-colors">
              <Menu className="h-6 w-6" />
              <span className="sr-only">Toggle Menu</span>
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 border-none w-56 max-w-[75vw]">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SheetDescription className="sr-only">Main navigation menu</SheetDescription>
            <Sidebar className="w-full" />
          </SheetContent>
        </Sheet>

        <h1 className="font-serif text-lg font-bold text-pine-deep tracking-wide">{title}</h1>
      </div>

      {/* Placeholder for future user avatar / settings */}
      <div className="flex items-center gap-3">
        <div
          className="h-8 w-8 rounded-full bg-pine-mid flex items-center justify-center text-white text-xs font-semibold"
          title="Christopher Bisgaard"
        >
          CB
        </div>
      </div>
    </header>
  )
}
