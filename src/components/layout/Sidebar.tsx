import { NavLink } from "react-router-dom"
import {
  Target,
  Users,
  CheckSquare,
  DollarSign,
  FolderKanban,
  Telescope,
  FileText,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"

const topNav = [
  { to: "/discovery", icon: Telescope, label: "Discovery" },
  { to: "/", icon: Target, label: "Leads" },
  { to: "/clients", icon: Users, label: "Clients" },
  { to: "/tasks", icon: CheckSquare, label: "Tasks" },
  { to: "/projects", icon: FolderKanban, label: "Projects" },
]

const bottomNav = [
  { to: "/costs", icon: DollarSign, label: "Costs" },
  { to: "/docs", icon: FileText, label: "Docs" },
]

interface SidebarProps {
  collapsed?: boolean
  className?: string
}

export default function Sidebar({ collapsed = false, className }: SidebarProps) {
  return (
    <aside
      className={cn(
        "flex h-full flex-col bg-gradient-to-b from-pine-deep to-pine-forest transition-all duration-200",
        collapsed ? "w-16" : "w-60",
        className
      )}
    >
      {/* Logo area */}
      <div className={cn("flex flex-col px-4 py-5", collapsed && "items-center px-2")}>
        <span className="text-xl font-bold tracking-tight text-white">WPA</span>
        {!collapsed && (
          <span className="text-xs text-sand leading-tight mt-0.5">Command Center</span>
        )}
      </div>

      <Separator className="bg-pine-mid/50 mx-3" />

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <div className="space-y-0.5">
          {topNav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-pine-deep text-white"
                    : "text-sand hover:bg-pine-mid/40 hover:text-white",
                  collapsed && "justify-center gap-0 px-2"
                )
              }
              title={collapsed ? label : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </div>

        <Separator className="bg-pine-mid/50 mx-1 my-3" />

        <div className="space-y-0.5">
          {bottomNav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-pine-deep text-white"
                    : "text-sand hover:bg-pine-mid/40 hover:text-white",
                  collapsed && "justify-center gap-0 px-2"
                )
              }
              title={collapsed ? label : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Bottom spacer */}
      <div className="h-4" />
    </aside>
  )
}
