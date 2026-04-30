import Link from 'next/link'

const actions = [
  { name: 'המלצות', icon: '⭐', color: 'text-orange-500', bg: 'bg-orange-50', href: '#' },
  { name: 'לוח מודעות', icon: '📋', color: 'text-green-500', bg: 'bg-green-50', href: '/marketplace' },
  { name: "צ'אט", icon: '💬', color: 'text-blue-500', bg: 'bg-blue-50', href: '#' },
  { name: 'התראות', icon: '🔔', color: 'text-red-500', bg: 'bg-red-50', href: '/notifications' },
  { name: 'שירותים', icon: '💼', color: 'text-teal-500', bg: 'bg-teal-50', href: '/services' },
  { name: 'תשלומים', icon: '💳', color: 'text-purple-500', bg: 'bg-purple-50', href: '#' },
]

export default function QuickActions() {
  return (
    <div className="grid grid-cols-3 gap-6 mb-10 px-2" dir="rtl">
      {actions.map((action) => (
        <Link key={action.name} href={action.href} className="flex flex-col items-center gap-2 group">
          <div className={`${action.bg} ${action.color} w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-sm group-active:scale-95 transition`}>
            {action.icon}
          </div>
          <span className="text-xs font-bold text-brand-dark">{action.name}</span>
        </Link>
      ))}
    </div>
  )
}
