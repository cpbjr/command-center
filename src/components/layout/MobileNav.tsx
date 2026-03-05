import { NavLink } from "react-router-dom"
import {
  Target,
  Users,
  CheckSquare,
  DollarSign,
  FolderKanban,
  FileText,
} from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { to: "/", icon: Target, label: "Leads" },
  { to: "/clients", icon: Users, label: "Clients" },
  { to: "/tasks", icon: CheckSquare, label: "Tasks" },
  { to: "/projects", icon: FolderKanban, label: "Projects" },
  { to: "/costs", icon: DollarSign, label: "Costs" },
  { to: "/docs", icon: FileText, label: "Docs" },
]

export default function MobileNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 flex h-16 items-stretch border-t border-wpa-border bg-warmwhite md:hidden">
      {navItems.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          className={({ isActive }) =>
            cn(
              "relative flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium tracking-wide transition-colors",
              isActive
                ? "text-pine-deep before:absolute before:top-0 before:inset-x-0 before:h-0.5 before:bg-pine-mid before:content-['']"
                : "text-text-tertiary hover:text-text-secondary"
            )
          }
        >
          <Icon className="h-5 w-5" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
