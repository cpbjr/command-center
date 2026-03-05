import { useLocation } from "react-router-dom"
import { Separator } from "@/components/ui/separator"

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

  return (
    <header className="flex h-14 items-center justify-between bg-parchment border-b border-wpa-border px-6 shrink-0">
      <h1 className="font-serif text-base font-bold text-text-primary tracking-wide">{title}</h1>

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

export { Separator }
