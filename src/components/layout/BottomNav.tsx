import { NavLink } from "react-router-dom"
import { Target, Users, CheckSquare, Telescope, FolderKanban } from "lucide-react"
import { cn } from "@/lib/utils"

// The five primary destinations, thumb-reachable at the bottom of the screen.
// Costs + Docs stay in the hamburger drawer (secondary). Mobile only — the
// desktop sidebar covers md+.
const tabs = [
  { to: "/discovery", icon: Telescope, label: "Discovery" },
  { to: "/", icon: Target, label: "Leads", end: true },
  { to: "/clients", icon: Users, label: "Clients" },
  { to: "/tasks", icon: CheckSquare, label: "Tasks" },
  { to: "/projects", icon: FolderKanban, label: "Projects" },
]

export default function BottomNav() {
  return (
    <nav
      className="md:hidden shrink-0 bg-gradient-to-b from-pine-forest to-pine-deep border-t border-pine-mid/40 bottom-nav-safe"
      aria-label="Primary"
    >
      <div className="flex items-stretch justify-around">
        {tabs.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "relative flex flex-1 flex-col items-center justify-center gap-1 min-h-[56px] px-1 pt-2 pb-1.5 transition-colors",
                isActive ? "text-white" : "text-sand/70 hover:text-white"
              )
            }
          >
            {({ isActive }) => (
              <>
                {/* Active indicator: a short needle-green tick at the top edge */}
                <span
                  className={cn(
                    "absolute top-0 h-0.5 w-8 rounded-full bg-needle-light transition-opacity",
                    isActive ? "opacity-100" : "opacity-0"
                  )}
                />
                <Icon className="h-5 w-5 shrink-0" strokeWidth={isActive ? 2.4 : 1.8} />
                <span className="text-[10px] font-medium tracking-wide leading-none">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
