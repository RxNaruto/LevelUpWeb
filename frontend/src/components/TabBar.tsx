import { NavLink, useLocation } from 'react-router'

const TABS = [
  { to: '/', label: 'Today', icon: '◉', end: true },
  { to: '/tasks', label: 'Tasks', icon: '▣', end: false },
  { to: '/projects', label: 'Projects', icon: '◆', end: false },
  { to: '/apps', label: 'Apps', icon: '⇄', end: false },
  { to: '/history', label: 'History', icon: '▤', end: false },
  { to: '/settings', label: 'Settings', icon: '⚙', end: false },
] as const

/** Detail screens sit on top of the tabs on phones, like the mobile app's stack screens. */
const DETAIL = /^\/(tasks|projects)\/.+/

export function TabBar() {
  const { pathname } = useLocation()

  return (
    <nav className={`tabbar ${DETAIL.test(pathname) ? 'tabbar--hidden' : ''}`} aria-label="Main">
      <div className="tabbar__brand">
        <img src="/icon-192.png" alt="LevelUp" width={44} height={44} />
      </div>
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) => `tabbar__item ${isActive ? 'active' : ''}`}
        >
          <span className="tabbar__pill" aria-hidden>{tab.icon}</span>
          <span className="tabbar__label">{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
