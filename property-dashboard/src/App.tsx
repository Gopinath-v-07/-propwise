import { useEffect, useMemo, useState, type FormEvent, type ReactElement, type ReactNode } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { AuthProvider, getRoleLabel, useAuth, type Role } from './auth'
import './App.css'

type Property = {
  name: string
  location: string
  units: number
  occupied: number
  revenue: string
  status: 'On track' | 'Needs attention'
}

type RequestStatus = 'Open' | 'In progress' | 'Overdue' | 'Resolved'
type Priority = 'High' | 'Medium' | 'Low'
type ServiceRequest = {
  id: string
  title: string
  property: string
  category: string
  priority: Priority
  status: RequestStatus
  vendor: string
  created: string
}
type WidgetKey = 'metrics' | 'occupancy' | 'tasks' | 'requests' | 'properties'
type Notification = { id: string; title: string; detail: string; time: string; read: boolean }

const initialProperties: Property[] = [
  { name: 'The Franklin', location: 'Austin, TX', units: 128, occupied: 121, revenue: '₹184,200', status: 'On track' },
  { name: 'Lakeside Commons', location: 'Dallas, TX', units: 96, occupied: 82, revenue: '₹126,800', status: 'Needs attention' },
  { name: 'Parkview Residences', location: 'Houston, TX', units: 74, occupied: 71, revenue: '₹98,450', status: 'On track' },
  { name: 'Willow Creek', location: 'San Antonio, TX', units: 52, occupied: 49, revenue: '₹67,900', status: 'On track' },
]

const serviceRequests: ServiceRequest[] = [
  { id: 'REQ-1042', title: 'Kitchen sink leak', property: 'The Franklin', category: 'Plumbing', priority: 'High', status: 'Overdue', vendor: 'Apex Plumbing', created: 'Today' },
  { id: 'REQ-1041', title: 'Replace hallway light', property: 'Lakeside Commons', category: 'Electrical', priority: 'Medium', status: 'In progress', vendor: 'BrightWorks', created: 'Yesterday' },
  { id: 'REQ-1040', title: 'AC not cooling', property: 'Parkview Residences', category: 'HVAC', priority: 'High', status: 'Open', vendor: 'Unassigned', created: 'Sep 5' },
  { id: 'REQ-1039', title: 'Broken gate remote', property: 'Willow Creek', category: 'Access', priority: 'Low', status: 'Resolved', vendor: 'SecureEntry', created: 'Sep 4' },
  { id: 'REQ-1038', title: 'Water stain on ceiling', property: 'The Franklin', category: 'Plumbing', priority: 'High', status: 'Open', vendor: 'Unassigned', created: 'Sep 3' },
  { id: 'REQ-1037', title: 'Lobby paint touch-up', property: 'Lakeside Commons', category: 'General', priority: 'Low', status: 'Resolved', vendor: 'In-house', created: 'Sep 2' },
]

const navItems = [
  ['Overview', '▦', '/manager/dashboard'],
  ['Properties', '⌂', '/properties'],
  ['Tenants', '♙', '/tenants'],
  ['Maintenance', '⚒', '/maintenance'],
  ['Payments', '₹', '/payments'],
  ['Reports', '▤', '/reports'],
  ['Settings', '⚙', '/settings'],
]

function DashboardPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [query, setQuery] = useState('')
  const [requestQuery, setRequestQuery] = useState('')
  const [requestStatus, setRequestStatus] = useState<'All' | RequestStatus>('All')
  const [requestPriority, setRequestPriority] = useState<'All' | Priority>('All')
  const [requestPage, setRequestPage] = useState(1)
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null)
  const [showExport, setShowExport] = useState(false)
  const [showWidgetSettings, setShowWidgetSettings] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [compactMode] = useState(() => window.localStorage.getItem('propwise_compact_mode') === 'true')
  const [notifications, setNotifications] = useState<Notification[]>(() => {
    const stored = window.localStorage.getItem('propwise_notifications')
    return stored ? JSON.parse(stored) as Notification[] : [
      { id: 'n1', title: 'Maintenance request overdue', detail: 'Kitchen sink leak needs attention at The Franklin.', time: '10 min ago', read: false },
      { id: 'n2', title: 'New request assigned', detail: 'BrightWorks accepted the hallway light request.', time: '1 hour ago', read: false },
      { id: 'n3', title: 'Weekly report ready', detail: 'Your portfolio performance report is available.', time: 'Yesterday', read: true },
    ]
  })
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(() => new Date())
  const [widgets, setWidgets] = useState<WidgetKey[]>(() => {
    const stored = window.localStorage.getItem('propwise_dashboard_widgets')
    return stored ? JSON.parse(stored) as WidgetKey[] : ['metrics', 'occupancy', 'tasks', 'requests', 'properties']
  })
  const [showAddProperty, setShowAddProperty] = useState(false)
  const [properties, setProperties] = useState<Property[]>(() => {
    const stored = window.localStorage.getItem('propwise_properties')
    return stored
      ? (JSON.parse(stored) as Property[]).map((property) => ({
          ...property,
          revenue: property.revenue.replaceAll('$', '₹'),
        }))
      : initialProperties
  })

  useEffect(() => {
    window.localStorage.setItem('propwise_properties', JSON.stringify(properties))
  }, [properties])
  useEffect(() => {
    window.localStorage.setItem('propwise_dashboard_widgets', JSON.stringify(widgets))
  }, [widgets])
  useEffect(() => {
    window.localStorage.setItem('propwise_notifications', JSON.stringify(notifications))
  }, [notifications])
  useEffect(() => {
    const interval = window.setInterval(() => setLastUpdated(new Date()), 60000)
    return () => window.clearInterval(interval)
  }, [])
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileNavOpen(false)
        setShowSearch(false)
        setShowNotifications(false)
        setShowAddProperty(false)
        setShowWidgetSettings(false)
        setShowExport(false)
        setSelectedRequest(null)
      }
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [])

  const filteredProperties = useMemo(
    () =>
      properties.filter((property) =>
        `${property.name} ${property.location}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [properties, query],
  )
  const filteredRequests = useMemo(() => serviceRequests.filter((request) => {
    const matchesQuery = `${request.title} ${request.property} ${request.id}`.toLowerCase().includes(requestQuery.toLowerCase())
    return matchesQuery && (requestStatus === 'All' || request.status === requestStatus) && (requestPriority === 'All' || request.priority === requestPriority)
  }), [requestQuery, requestStatus, requestPriority])
  const requestPageSize = 4
  const requestPages = Math.max(1, Math.ceil(filteredRequests.length / requestPageSize))
  const visibleRequests = filteredRequests.slice((requestPage - 1) * requestPageSize, requestPage * requestPageSize)
  const openRequests = serviceRequests.filter((request) => request.status !== 'Resolved').length
  const overdueRequests = serviceRequests.filter((request) => request.status === 'Overdue').length
  const unreadNotifications = notifications.filter((notification) => !notification.read).length
  const refreshDashboard = () => {
    setRefreshing(true)
    window.setTimeout(() => {
      setLastUpdated(new Date())
      setRefreshing(false)
    }, 450)
  }
  const moveWidget = (widget: WidgetKey, direction: -1 | 1) => {
    setWidgets((current) => {
      const index = current.indexOf(widget)
      const target = index + direction
      if (index < 0 || target < 0 || target >= current.length) return current
      const next = [...current]
      next[index] = next[target]
      next[target] = widget
      return next
    })
  }
  const exportRequests = (format: 'csv' | 'json') => {
    const content = format === 'json'
      ? JSON.stringify(filteredRequests, null, 2)
      : ['ID,Title,Property,Category,Priority,Status,Assigned To,Created', ...filteredRequests.map((request) => [request.id, request.title, request.property, request.category, request.priority, request.status, request.vendor, request.created].map((value) => `"${value.replaceAll('"', '""')}"`).join(','))].join('\n')
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([content], { type: format === 'json' ? 'application/json' : 'text/csv' }))
    link.download = `propwise-requests.${format}`
    link.click()
    URL.revokeObjectURL(link.href)
    setShowExport(false)
  }

  return (
    <div className={`app-shell ${compactMode ? 'compact-mode' : ''}`}>
      {mobileNavOpen && <button className="mobile-nav-backdrop" type="button" aria-label="Close navigation menu" onClick={() => setMobileNavOpen(false)} />}
      <aside className={`sidebar ${mobileNavOpen ? 'mobile-open' : ''}`}>
        <div className="brand">
          <span className="brand-mark">P</span>
          <span>propwise</span>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {navItems.map(([label, icon, path]) => (
            <button
              className={`nav-item ${location.pathname === path ? 'active' : ''}`}
              key={label}
              onClick={() => { navigate(path); setMobileNavOpen(false) }}
              type="button"
            >
              <span className="nav-icon">{icon}</span>
              {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-item" type="button" onClick={() => { navigate('/help'); setMobileNavOpen(false) }}><span className="nav-icon">?</span>Help center</button>
          <div className="profile">
            <div className="avatar">{user?.name.slice(0, 2).toUpperCase() ?? 'JD'}</div>
            <div><strong>{user?.name ?? 'Jordan Davis'}</strong><small>{user ? getRoleLabel(user.role) : 'Admin'}</small></div>
            <button className="profile-menu" type="button" onClick={() => { logout(); navigate('/login') }} aria-label="Log out">Log out</button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu" type="button" aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'} aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen((open) => !open)}>☰</button>
          <div className="breadcrumb">Workspace <span>/</span> Overview</div>
          <div className="top-actions">
            <button className="icon-button" type="button" aria-label="Search" onClick={() => setShowSearch(true)}>⌕</button><button className="icon-button" type="button" aria-label="Notifications" onClick={() => setShowNotifications(true)}>♢{unreadNotifications > 0 && <i />}</button>
            <button className="profile-button" type="button" onClick={() => navigate('/profile')}><div className="avatar small">{user?.name.slice(0, 2).toUpperCase() ?? 'JD'}</div></button>
          </div>
        </header>

        <div className="content">
          <section className="page-heading">
            <div><p className="eyebrow">SUNDAY, SEPTEMBER 7, 2025</p><h1>Good morning, Jordan</h1><p className="muted">Here&apos;s what&apos;s happening across your portfolio today.</p></div>
            <div className="heading-actions"><span className="updated-label">{refreshing ? 'Refreshing…' : `Updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}</span><button className="secondary-button dashboard-action" type="button" onClick={refreshDashboard} disabled={refreshing}>↻ Refresh</button><button className="secondary-button dashboard-action" type="button" onClick={() => setShowWidgetSettings(true)}>⚙ Widgets</button><button className="primary-button" type="button" onClick={() => setShowAddProperty(true)}><span>+</span> Add property</button></div>
          </section>

          {widgets.includes('metrics') && <section className="metric-grid" aria-label="Portfolio summary">
            <Metric label="Open requests" value={String(openRequests)} change={`${overdueRequests} overdue`} icon="⚒" warning />
            <Metric label="SLA compliance" value="91.6%" change="+3.2% vs last month" icon="◉" positive />
            <Metric label="Avg. response time" value="2h 18m" change="-24m vs last month" icon="◷" positive />
            <Metric label="Satisfaction" value="4.8/5" change="+0.3 vs last month" icon="★" positive />
          </section>}

          {(widgets.includes('occupancy') || widgets.includes('tasks')) && <section className="dashboard-grid">
            {widgets.includes('occupancy') && <article className="card occupancy-card">
              <div className="card-heading"><div><h2>Occupancy overview</h2><p className="muted">Portfolio occupancy over the last 6 months</p></div><button className="select-button" type="button">Last 6 months</button></div>
              <div className="chart-area">
                <div className="chart-y"><span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span></div>
                <div className="chart">
                  <div className="grid-line" /><div className="grid-line" /><div className="grid-line" /><div className="grid-line" />
                  <svg viewBox="0 0 600 210" preserveAspectRatio="none" role="img" aria-label="Occupancy rose from 88 to 94 percent">
                    <defs><linearGradient id="fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#6956d8" stopOpacity=".22" /><stop offset="100%" stopColor="#6956d8" stopOpacity="0" /></linearGradient></defs>
                    <path d="M0 145 C70 150 92 124 130 130 S205 120 250 95 S330 112 365 82 S440 72 480 60 S550 68 600 35 V210 H0Z" fill="url(#fill)" />
                    <path d="M0 145 C70 150 92 124 130 130 S205 120 250 95 S330 112 365 82 S440 72 480 60 S550 68 600 35" fill="none" stroke="#6956d8" strokeWidth="3" />
                  </svg>
                  <div className="chart-labels"><span>Apr</span><span>May</span><span>Jun</span><span>Jul</span><span>Aug</span><span>Sep</span></div>
                </div>
              </div>
            </article>}
            {widgets.includes('tasks') && <article className="card tasks-card">
              <div className="card-heading"><div><h2>Tasks & reminders</h2><p className="muted">Your priorities for today</p></div><button className="more-button" type="button" aria-label="More task options">•••</button></div>
              <div className="task-list">
                <Task title="Review lease renewals" detail="4 leases expiring this week" color="purple" />
                <Task title="Approve maintenance requests" detail="5 requests need your review" color="orange" />
                <Task title="Send monthly statements" detail="Due in 3 days" color="blue" />
              </div>
              <button className="text-button" type="button">View all tasks</button>
            </article>}
          </section>}

          {widgets.includes('requests') && <section className="card requests-card">
            <div className="card-heading"><div><h2>Service requests</h2><p className="muted">Track work across your portfolio</p></div><div className="table-actions"><label className="search"><span>⌕</span><input value={requestQuery} onChange={(event) => { setRequestQuery(event.target.value); setRequestPage(1) }} placeholder="Search requests" /></label><select className="filter-select" aria-label="Filter by status" value={requestStatus} onChange={(event) => { setRequestStatus(event.target.value as 'All' | RequestStatus); setRequestPage(1) }}><option value="All">All statuses</option><option>Open</option><option>In progress</option><option>Overdue</option><option>Resolved</option></select><select className="filter-select" aria-label="Filter by priority" value={requestPriority} onChange={(event) => { setRequestPriority(event.target.value as 'All' | Priority); setRequestPage(1) }}><option value="All">All priorities</option><option>High</option><option>Medium</option><option>Low</option></select><button className="filter-button" type="button" onClick={() => setShowExport(true)}>Export</button></div></div>
            <div className="table-wrap"><table><thead><tr><th>REQUEST</th><th>PROPERTY</th><th>PRIORITY</th><th>STATUS</th><th>ASSIGNED TO</th><th>CREATED</th></tr></thead><tbody>{visibleRequests.map((request) => <tr className="clickable-row" key={request.id} onClick={() => setSelectedRequest(request)}><td><strong>{request.title}</strong><small>{request.id} · {request.category}</small></td><td>{request.property}</td><td><span className={`priority priority-${request.priority.toLowerCase()}`}>{request.priority}</span></td><td><span className={`status status-${request.status === 'Resolved' ? 'good' : request.status === 'Overdue' ? 'warning' : 'info'}`}><i />{request.status}</span></td><td>{request.vendor}</td><td>{request.created}</td></tr>)}</tbody></table>{visibleRequests.length === 0 && <p className="empty-state">No service requests match these filters.</p>}</div>
            <div className="pagination"><span>Showing {filteredRequests.length === 0 ? 0 : (requestPage - 1) * requestPageSize + 1}-{Math.min(requestPage * requestPageSize, filteredRequests.length)} of {filteredRequests.length}</span><div><button className="pagination-button" type="button" disabled={requestPage === 1} onClick={() => setRequestPage((page) => page - 1)}>Previous</button><span className="page-number">{requestPage} / {requestPages}</span><button className="pagination-button" type="button" disabled={requestPage === requestPages} onClick={() => setRequestPage((page) => page + 1)}>Next</button></div></div>
          </section>}

          {widgets.includes('properties') && <section className="card properties-card">
            <div className="card-heading"><div><h2>Properties</h2><p className="muted">A quick look at your managed properties</p></div><div className="table-actions"><label className="search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search properties" /></label>            <button className="filter-button" type="button">Filter</button></div></div>
            <div className="table-wrap"><table><thead><tr><th>PROPERTY</th><th>OCCUPANCY</th><th>REVENUE</th><th>STATUS</th><th aria-label="Actions" /></tr></thead><tbody>{filteredProperties.map((property) => <tr key={property.name}><td><div className="property-name"><span className="property-icon">⌂</span><div><strong>{property.name}</strong><small>{property.location}</small></div></div></td><td><div className="occupancy-cell"><strong>{Math.round((property.occupied / property.units) * 100)}%</strong><span>{property.occupied}/{property.units} units</span></div></td><td><strong>{property.revenue}</strong><small className="table-subtitle">This month</small></td><td><span className={`status ${property.status === 'On track' ? 'status-good' : 'status-warning'}`}><i />{property.status}</span></td><td><button className="more-button" type="button" aria-label={`More options for ${property.name}`}>•••</button></td></tr>)}</tbody></table>{filteredProperties.length === 0 && <p className="empty-state">No properties match your search.</p>}</div>
            <button className="text-button view-properties" type="button" onClick={() => navigate('/properties')}>View all properties</button>
          </section>}
        </div>
      </main>
      {showAddProperty && <AddPropertyModal onClose={() => setShowAddProperty(false)} onAdd={(property) => {
        setProperties((current) => [property, ...current])
        setShowAddProperty(false)
      }} />}
      {showWidgetSettings && <WidgetSettings widgets={widgets} onClose={() => setShowWidgetSettings(false)} onToggle={(widget) => setWidgets((current) => current.includes(widget) ? current.filter((item) => item !== widget) : [...current, widget])} onMove={moveWidget} />}
      {showExport && <ExportModal onClose={() => setShowExport(false)} onExport={exportRequests} count={filteredRequests.length} />}
      {selectedRequest && <RequestDetail request={selectedRequest} onClose={() => setSelectedRequest(null)} />}
      {showSearch && <GlobalSearch onClose={() => setShowSearch(false)} properties={properties} />}
      {showNotifications && <NotificationsPanel notifications={notifications} onClose={() => setShowNotifications(false)} onRead={(id) => setNotifications((items) => items.map((item) => item.id === id ? { ...item, read: true } : item))} onReadAll={() => setNotifications((items) => items.map((item) => ({ ...item, read: true })))} />}
      <QuickPageNavigator />
    </div>
  )
}

const widgetLabels: Record<WidgetKey, string> = { metrics: 'KPI summary', occupancy: 'Occupancy chart', tasks: 'Tasks & reminders', requests: 'Service requests', properties: 'Properties table' }

function WidgetSettings({ widgets, onClose, onToggle, onMove }: { widgets: WidgetKey[]; onClose: () => void; onToggle: (widget: WidgetKey) => void; onMove: (widget: WidgetKey, direction: -1 | 1) => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="modal-card widget-modal" role="dialog" aria-modal="true" aria-labelledby="widget-settings-title"><div className="modal-heading"><div><p className="eyebrow">DASHBOARD LAYOUT</p><h2 id="widget-settings-title">Customize widgets</h2><p className="muted">Choose what appears and adjust its order.</p></div><button className="modal-close" type="button" onClick={onClose} aria-label="Close">×</button></div><div className="widget-list">{(['metrics', 'occupancy', 'tasks', 'requests', 'properties'] as WidgetKey[]).map((widget) => { const index = widgets.indexOf(widget); return <div className={`widget-item ${index < 0 ? 'widget-hidden' : ''}`} key={widget}><label><input type="checkbox" checked={index >= 0} onChange={() => onToggle(widget)} /> {widgetLabels[widget]}</label>{index >= 0 && <span><button type="button" className="pagination-button" aria-label={`Move ${widgetLabels[widget]} up`} disabled={index === 0} onClick={() => onMove(widget, -1)}>Up</button><button type="button" className="pagination-button" aria-label={`Move ${widgetLabels[widget]} down`} disabled={index === widgets.length - 1} onClick={() => onMove(widget, 1)}>Down</button></span>}</div> })}</div><div className="modal-actions"><button className="primary-button" type="button" onClick={onClose}>Done</button></div></section></div>
}

function ExportModal({ onClose, onExport, count }: { onClose: () => void; onExport: (format: 'csv' | 'json') => void; count: number }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="modal-card export-modal" role="dialog" aria-modal="true" aria-labelledby="export-title"><div className="modal-heading"><div><p className="eyebrow">DATA EXPORT</p><h2 id="export-title">Export requests</h2><p className="muted">{count} filtered requests are ready to download.</p></div><button className="modal-close" type="button" onClick={onClose} aria-label="Close">×</button></div><div className="export-options"><button type="button" onClick={() => onExport('csv')}><strong>CSV</strong><span>Spreadsheet-friendly format</span></button><button type="button" onClick={() => onExport('json')}><strong>JSON</strong><span>Structured data format</span></button></div></section></div>
}

function RequestDetail({ request, onClose }: { request: ServiceRequest; onClose: () => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="modal-card request-detail" role="dialog" aria-modal="true" aria-labelledby="request-detail-title"><div className="modal-heading"><div><p className="eyebrow">{request.id} · {request.category.toUpperCase()}</p><h2 id="request-detail-title">{request.title}</h2><p className="muted">Opened {request.created} at {request.property}</p></div><button className="modal-close" type="button" onClick={onClose} aria-label="Close">×</button></div><div className="detail-grid"><div><small>Priority</small><strong className={`priority priority-${request.priority.toLowerCase()}`}>{request.priority}</strong></div><div><small>Status</small><strong>{request.status}</strong></div><div><small>Assigned to</small><strong>{request.vendor}</strong></div><div><small>Property</small><strong>{request.property}</strong></div></div><div className="request-timeline"><span className="timeline-dot active" /><div><strong>Request created</strong><small>{request.created}</small></div><span className="timeline-line" /><span className={`timeline-dot ${request.status !== 'Open' ? 'active' : ''}`} /><div><strong>Work {request.status === 'Resolved' ? 'completed' : 'in progress'}</strong><small>{request.status === 'Open' ? 'Awaiting assignment' : request.vendor}</small></div></div></section></div>
}

function GlobalSearch({ onClose, properties }: { onClose: () => void; properties: Property[] }) {
  const [query, setQuery] = useState('')
  const results = useMemo(() => {
    const normalized = query.toLowerCase().trim()
    if (!normalized) return []
    return [
      ...properties.filter((property) => `${property.name} ${property.location}`.toLowerCase().includes(normalized)).map((property) => ({ type: 'Property', title: property.name, detail: property.location })),
      ...serviceRequests.filter((request) => `${request.id} ${request.title} ${request.property}`.toLowerCase().includes(normalized)).map((request) => ({ type: 'Request', title: request.title, detail: `${request.id} · ${request.property}` })),
    ]
  }, [properties, query])
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="modal-card search-modal" role="dialog" aria-modal="true" aria-labelledby="global-search-title"><div className="modal-heading"><div><p className="eyebrow">WORKSPACE SEARCH</p><h2 id="global-search-title">Find anything</h2></div><button className="modal-close" type="button" onClick={onClose} aria-label="Close">×</button></div><input className="global-search-input" autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search properties, requests, or IDs…" />{query && <div className="search-results">{results.map((result) => <div className="search-result" key={`${result.type}-${result.title}`}><span>{result.type}</span><div><strong>{result.title}</strong><small>{result.detail}</small></div></div>)}{results.length === 0 && <p className="empty-state">No matching workspace records.</p>}</div>}<p className="search-hint">Search is scoped to your current organization.</p></section></div>
}

function NotificationsPanel({ notifications, onClose, onRead, onReadAll }: { notifications: Notification[]; onClose: () => void; onRead: (id: string) => void; onReadAll: () => void }) {
  return <div className="modal-backdrop notification-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="notification-panel" role="dialog" aria-modal="true" aria-labelledby="notifications-title"><div className="modal-heading"><div><p className="eyebrow">ACTIVITY CENTER</p><h2 id="notifications-title">Notifications</h2></div><div className="notification-actions"><button className="text-button" type="button" onClick={onReadAll}>Mark all read</button><button className="modal-close" type="button" onClick={onClose} aria-label="Close">×</button></div></div><div className="notification-list">{notifications.map((notification) => <button className={`notification-item ${notification.read ? '' : 'unread'}`} type="button" key={notification.id} onClick={() => onRead(notification.id)}><span className="notification-dot" /><div><strong>{notification.title}</strong><small>{notification.detail}</small><em>{notification.time}</em></div></button>)}</div></section></div>
}

function SettingsPage() {
  const [emailUpdates, setEmailUpdates] = useState(() => window.localStorage.getItem('propwise_email_updates') !== 'false')
  const [compactMode, setCompactMode] = useState(() => window.localStorage.getItem('propwise_compact_mode') === 'true')
  const [saved, setSaved] = useState(false)
  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    window.localStorage.setItem('propwise_email_updates', String(emailUpdates))
    window.localStorage.setItem('propwise_compact_mode', String(compactMode))
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2200)
  }
  return <div className="settings-page"><Link className="landing-brand" to="/manager/dashboard"><span className="brand-mark">P</span> propwise</Link><section className="settings-card"><p className="eyebrow">WORKSPACE SETTINGS</p><h1>Settings</h1><p className="muted">Control notifications and dashboard preferences for your workspace.</p>{saved && <p className="profile-success" role="status">Settings saved successfully.</p>}<form className="settings-form" onSubmit={save}><label className="setting-row"><span><strong>Email notifications</strong><small>Receive updates about requests, assignments, and reports.</small></span><input type="checkbox" checked={emailUpdates} onChange={(event) => setEmailUpdates(event.target.checked)} /></label><label className="setting-row"><span><strong>Compact dashboard</strong><small>Use tighter spacing to see more operational data at once.</small></span><input type="checkbox" checked={compactMode} onChange={(event) => setCompactMode(event.target.checked)} /></label><div className="profile-actions"><Link className="secondary-button profile-cancel" to="/manager/dashboard">Cancel</Link><button className="primary-button" type="submit">Save settings</button></div></form></section></div>
}

function AddPropertyModal({ onClose, onAdd }: { onClose: () => void; onAdd: (property: Property) => void }) {
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [units, setUnits] = useState('')
  const [error, setError] = useState('')

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const unitCount = Number(units)
    if (!name.trim() || !location.trim() || !Number.isInteger(unitCount) || unitCount < 1) {
      setError('Enter a property name, location, and a whole number of units.')
      return
    }
    onAdd({ name: name.trim(), location: location.trim(), units: unitCount, occupied: 0, revenue: '₹0', status: 'Needs attention' })
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="add-property-title">
        <div className="modal-heading"><div><p className="eyebrow">PORTFOLIO SETUP</p><h2 id="add-property-title">Add property</h2><p className="muted">Create a property record to start tracking its operations.</p></div><button className="modal-close" type="button" onClick={onClose} aria-label="Close">×</button></div>
        <form className="property-form" onSubmit={submit}>
          <label>Property name<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. The Franklin" /></label>
          <label>Location<input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="e.g. Austin, TX" /></label>
          <label>Total units<input type="number" min="1" step="1" value={units} onChange={(event) => setUnits(event.target.value)} placeholder="e.g. 128" /></label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <div className="modal-actions"><button className="secondary-button modal-cancel" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit">Save property</button></div>
        </form>
      </section>
    </div>
  )
}

function Metric({ label, value, change, icon, positive, warning }: { label: string; value: string; change: string; icon: string; positive?: boolean; warning?: boolean }) {
  return <article className="metric-card"><div className={`metric-icon ${warning ? 'metric-warning' : ''}`}>{icon}</div><div><p>{label}</p><strong>{value}</strong><small className={warning ? 'warning-text' : positive ? 'positive-text' : ''}>{change}</small></div></article>
}

function Task({ title, detail, color }: { title: string; detail: string; color: string }) {
  return <div className="task"><span className={`task-dot ${color}`} /><div><strong>{title}</strong><small>{detail}</small></div></div>
}

const routeNames = ['Properties', 'Tenants', 'Maintenance', 'Payments', 'Reports', 'Help']

function LandingPage() {
  return (
    <div className="landing-page">
      <header className="landing-nav">
        <Link className="landing-brand" to="/"><span className="brand-mark">P</span> propwise</Link>
        <nav><a href="#features">Features</a><a href="#workflow">How it works</a><a href="#security">Security</a></nav>
        <Link className="landing-login" to="/manager/dashboard">Sign in</Link>
      </header>
      <main>
        <section className="landing-hero">
          <div className="hero-copy">
            <p className="eyebrow">PROPERTY OPERATIONS, SIMPLIFIED</p>
            <h1>Smarter property operations. <em>Happier tenants.</em></h1>
            <p className="hero-subtitle">Connect tenants, property managers, and staff through one intelligent operations platform.</p>
            <div className="hero-actions"><Link className="primary-button" to="/manager/dashboard">Explore the platform</Link><a className="secondary-button" href="#workflow">See how it works</a></div>
            <div className="trust-row"><span className="trust-avatars">JD&nbsp; MK&nbsp; AL</span><span>Trusted by modern property teams</span></div>
          </div>
          <div className="hero-preview"><div className="preview-top"><span className="preview-dot" /><span>Portfolio overview</span><span className="preview-menu">•••</span></div><div className="preview-number"><small>Occupancy rate</small><strong>94.2%</strong><span>1.8% increase</span></div><div className="preview-bars"><i /><i /><i /><i /><i /><i /></div><div className="preview-footer"><span>Apr</span><span>May</span><span>Jun</span><span>Jul</span><span>Aug</span><span>Sep</span></div></div>
        </section>
        <section className="logo-strip"><span>Built for teams who manage</span><strong>RESIDENTIAL</strong><strong>COMMERCIAL</strong><strong>COMMUNITY</strong><strong>PORTFOLIOS</strong></section>
        <section className="landing-section" id="features"><p className="eyebrow">EVERYTHING IN ONE PLACE</p><h2>Run your properties with clarity.</h2><p className="section-subtitle">Replace scattered spreadsheets and messages with a connected workspace designed for real-world property operations.</p><div className="feature-grid"><Feature icon="⌂" title="Portfolio visibility" text="See occupancy, revenue and property health at a glance." /><Feature icon="⚒" title="Faster maintenance" text="Move every request from report to resolution with a clear history." /><Feature icon="◉" title="Connected teams" text="Keep tenants, staff and managers aligned in one workflow." /></div></section>
        <section className="workflow-section" id="workflow"><div><p className="eyebrow">A BETTER WAY TO WORK</p><h2>From issue to resolution, without the chaos.</h2></div><div className="workflow-steps"><Step number="01" title="Tenant reports" text="A simple request form captures the right details from day one." /><Step number="02" title="Manager coordinates" text="Prioritize, assign and schedule work with complete context." /><Step number="03" title="Everyone stays informed" text="Updates, proof and feedback keep the whole team moving." /></div></section>
        <section className="security-section" id="security"><div><p className="eyebrow">BUILT FOR TRUST</p><h2>Your operations, protected.</h2><p className="section-subtitle">Role-aware workspaces and property-level visibility help every person see exactly what they need.</p></div><div className="security-points"><span>✓ Role-based access</span><span>✓ Complete request history</span><span>✓ Secure by design</span></div></section>
        <section className="landing-cta"><h2>Make every property run better.</h2><p>Bring your team together with a clearer way to manage operations.</p><Link className="primary-button" to="/manager/dashboard">Get started</Link></section>
      </main>
      <footer className="landing-footer"><span className="landing-brand"><span className="brand-mark">P</span> propwise</span><span>© 2025 Propwise. Property operations, simplified.</span></footer>
      <QuickPageNavigator />
    </div>
  )
}

function Feature({ icon, title, text }: { icon: string; title: string; text: string }) {
  return <article className="feature"><span className="feature-icon">{icon}</span><h3>{title}</h3><p>{text}</p></article>
}

function Step({ number, title, text }: { number: string; title: string; text: string }) {
  return <article className="workflow-step"><span>{number}</span><div><h3>{title}</h3><p>{text}</p></div></article>
}

function QuickPageNavigator() {
  const [open, setOpen] = useState(false)
  const { user, switchRole } = useAuth()
  const navigate = useNavigate()

  const handleRoleSwitch = (role: Role, targetPath?: string) => {
    switchRole(role)
    if (targetPath) navigate(targetPath)
    setOpen(false)
  }

  const handleNavigate = (path: string, requiredRole?: Role) => {
    if (requiredRole && user?.role !== requiredRole && user?.role !== 'SUPER_ADMIN') {
      switchRole(requiredRole)
    }
    navigate(path)
    setOpen(false)
  }

  return (
    <>
      <button className="quick-nav-floating" type="button" onClick={() => setOpen(true)} title="View all 18 pages & switch accounts">
        <span className="quick-nav-pill">🌐 All Pages (18)</span>
        <span style={{ opacity: 0.7, paddingLeft: 4 }}>• {user ? getRoleLabel(user.role) : 'Guest'}</span>
      </button>

      {open && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false) }}>
          <section className="modal-card page-directory-modal" role="dialog" aria-modal="true">
            <div className="modal-heading">
              <div>
                <p className="eyebrow">PROPWISE SYSTEM DIRECTORY</p>
                <h2>All Application Pages</h2>
                <p className="muted">Switch role accounts or jump directly to any workspace page.</p>
              </div>
              <button className="modal-close" type="button" onClick={() => setOpen(false)} aria-label="Close">×</button>
            </div>

            <div className="role-switch-row">
              <strong style={{ fontSize: 12, color: '#403c53' }}>Active Account:</strong>
              <button className={`role-switch-btn ${user?.role === 'PROPERTY_MANAGER' ? 'active' : ''}`} type="button" onClick={() => handleRoleSwitch('PROPERTY_MANAGER')}>👔 Manager (Jordan)</button>
              <button className={`role-switch-btn ${user?.role === 'SUPER_ADMIN' ? 'active' : ''}`} type="button" onClick={() => handleRoleSwitch('SUPER_ADMIN')}>👑 Admin (Sam)</button>
              <button className={`role-switch-btn ${user?.role === 'TENANT' ? 'active' : ''}`} type="button" onClick={() => handleRoleSwitch('TENANT')}>🏠 Tenant (Maya)</button>
              <button className={`role-switch-btn ${user?.role === 'STAFF' ? 'active' : ''}`} type="button" onClick={() => handleRoleSwitch('STAFF')}>🛠️ Staff (Chris)</button>
            </div>

            <div className="page-directory-grid">
              <div className="page-dir-card">
                <h3>🏢 Manager Workspace</h3>
                <div className="page-dir-links">
                  <button className="page-dir-link" type="button" onClick={() => handleNavigate('/manager/dashboard', 'PROPERTY_MANAGER')}><span>Overview</span><span className="page-dir-badge">Dashboard</span></button>
                  <button className="page-dir-link" type="button" onClick={() => handleNavigate('/properties', 'PROPERTY_MANAGER')}><span>Properties</span><span className="page-dir-badge">Portfolio</span></button>
                  <button className="page-dir-link" type="button" onClick={() => handleNavigate('/tenants', 'PROPERTY_MANAGER')}><span>Tenants</span><span className="page-dir-badge">Residents</span></button>
                  <button className="page-dir-link" type="button" onClick={() => handleNavigate('/maintenance', 'PROPERTY_MANAGER')}><span>Maintenance</span><span className="page-dir-badge">Work Orders</span></button>
                  <button className="page-dir-link" type="button" onClick={() => handleNavigate('/payments', 'PROPERTY_MANAGER')}><span>Payments</span><span className="page-dir-badge">Finances</span></button>
                  <button className="page-dir-link" type="button" onClick={() => handleNavigate('/reports', 'PROPERTY_MANAGER')}><span>Reports</span><span className="page-dir-badge">Analytics</span></button>
                  <button className="page-dir-link" type="button" onClick={() => handleNavigate('/settings', 'PROPERTY_MANAGER')}><span>Settings</span><span className="page-dir-badge">Workspace</span></button>
                  <button className="page-dir-link" type="button" onClick={() => handleNavigate('/help', 'PROPERTY_MANAGER')}><span>Help Center</span><span className="page-dir-badge">Support</span></button>
                </div>
              </div>

              <div className="page-dir-card">
                <h3>👑 Super Admin Workspace</h3>
                <div className="page-dir-links">
                  <button className="page-dir-link" type="button" onClick={() => handleNavigate('/admin/dashboard', 'SUPER_ADMIN')}><span>Admin Overview</span><span className="page-dir-badge">System</span></button>
                  <button className="page-dir-link" type="button" onClick={() => handleNavigate('/admin/users', 'SUPER_ADMIN')}><span>User Directory</span><span className="page-dir-badge">Accounts</span></button>
                  <button className="page-dir-link" type="button" onClick={() => handleNavigate('/admin/audit', 'SUPER_ADMIN')}><span>Audit Log</span><span className="page-dir-badge">Security</span></button>
                </div>
              </div>

              <div className="page-dir-card">
                <h3>🏠 Tenant Portal Workspace</h3>
                <div className="page-dir-links">
                  <button className="page-dir-link" type="button" onClick={() => handleNavigate('/tenant/dashboard', 'TENANT')}><span>Tenant Home</span><span className="page-dir-badge">My Unit</span></button>
                  <button className="page-dir-link" type="button" onClick={() => handleNavigate('/tenant/maintenance', 'TENANT')}><span>My Requests</span><span className="page-dir-badge">Maintenance</span></button>
                  <button className="page-dir-link" type="button" onClick={() => handleNavigate('/tenant/payments', 'TENANT')}><span>Payments & Dues</span><span className="page-dir-badge">Rent</span></button>
                  <button className="page-dir-link" type="button" onClick={() => handleNavigate('/tenant/documents', 'TENANT')}><span>Lease Documents</span><span className="page-dir-badge">Docs</span></button>
                  <button className="page-dir-link" type="button" onClick={() => handleNavigate('/tenant/announcements', 'TENANT')}><span>Announcements</span><span className="page-dir-badge">Notices</span></button>
                </div>
              </div>

              <div className="page-dir-card">
                <h3>📋 Field Staff Workspace</h3>
                <div className="page-dir-links">
                  <button className="page-dir-link" type="button" onClick={() => handleNavigate('/staff/dashboard', 'STAFF')}><span>Tasks Queue</span><span className="page-dir-badge">Daily</span></button>
                  <button className="page-dir-link" type="button" onClick={() => handleNavigate('/staff/maintenance', 'STAFF')}><span>Maintenance Queue</span><span className="page-dir-badge">Work Orders</span></button>
                  <button className="page-dir-link" type="button" onClick={() => handleNavigate('/staff/properties', 'STAFF')}><span>Property Access</span><span className="page-dir-badge">Inspections</span></button>
                  <button className="page-dir-link" type="button" onClick={() => handleNavigate('/staff/schedule', 'STAFF')}><span>Work Schedule</span><span className="page-dir-badge">Shifts</span></button>
                </div>
              </div>

              <div className="page-dir-card">
                <h3>🔑 Portal & Auth</h3>
                <div className="page-dir-links">
                  <button className="page-dir-link" type="button" onClick={() => handleNavigate('/')}><span>Landing Page</span><span className="page-dir-badge">Public</span></button>
                  <button className="page-dir-link" type="button" onClick={() => handleNavigate('/login')}><span>Sign In</span><span className="page-dir-badge">Auth</span></button>
                  <button className="page-dir-link" type="button" onClick={() => handleNavigate('/forgot-password')}><span>Forgot Password</span><span className="page-dir-badge">Recovery</span></button>
                  <button className="page-dir-link" type="button" onClick={() => handleNavigate('/profile')}><span>User Profile</span><span className="page-dir-badge">Account</span></button>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  )
}

function RoutePlaceholder({ name }: { name: string }) {
  const navigate = useNavigate()
  const { user, rolePath } = useAuth()
  const datasets: Record<string, { subtitle: string; metrics: [string, string, string][]; headers: string[]; rows: string[][] }> = {
    Properties: {
      subtitle: 'Manage your portfolio, occupancy, revenue, and property health.',
      metrics: [['Total properties', '5', '+1 this quarter'], ['Total units', '398', '94.2% occupied'], ['Monthly revenue', '₹477,350', '+8.4% vs last month'], ['Needs attention', '2', 'Review recommended']],
      headers: ['Property', 'Location', 'Units', 'Occupancy', 'Revenue', 'Status'],
      rows: [['Cedar Heights', 'Austin, TX', '48', '0%', '₹0', 'Needs attention'], ['The Franklin', 'Austin, TX', '128', '95%', '₹184,200', 'On track'], ['Lakeside Commons', 'Dallas, TX', '96', '85%', '₹126,800', 'Needs attention'], ['Parkview Residences', 'Houston, TX', '74', '96%', '₹98,450', 'On track'], ['Willow Creek', 'San Antonio, TX', '52', '94%', '₹67,900', 'On track']],
    },
    Tenants: {
      subtitle: 'Keep resident information, leases, and communication organized.',
      metrics: [['Active tenants', '342', '+12 this month'], ['Renewals due', '18', 'Next 30 days'], ['Open balances', '₹24,680', '9 accounts'], ['Satisfaction', '4.8/5', '+0.3 vs last month']],
      headers: ['Tenant', 'Property', 'Unit', 'Lease ends', 'Balance', 'Status'],
      rows: [['Aarav Sharma', 'The Franklin', '4B', 'Oct 31, 2025', '₹0', 'Current'], ['Priya Nair', 'Lakeside Commons', '2A', 'Nov 15, 2025', '₹8,400', 'Payment due'], ['Rohan Mehta', 'Parkview Residences', '7C', 'Dec 01, 2025', '₹0', 'Current'], ['Ananya Iyer', 'Willow Creek', '12A', 'Sep 30, 2025', '₹4,200', 'Renewal due'], ['Vikram Rao', 'The Franklin', '9D', 'Jan 12, 2026', '₹0', 'Current']],
    },
    Maintenance: {
      subtitle: 'Track work orders from resident request to resolution.',
      metrics: [['Open requests', '4', '1 overdue'], ['In progress', '2', 'Vendors assigned'], ['Resolved this month', '28', '+14% vs last month'], ['Average response', '2h 18m', '-24m vs last month']],
      headers: ['Request', 'Property', 'Category', 'Priority', 'Assigned vendor', 'Status'],
      rows: [['Kitchen sink leak', 'The Franklin', 'Plumbing', 'High', 'Apex Plumbing', 'Overdue'], ['Replace hallway light', 'Lakeside Commons', 'Electrical', 'Medium', 'BrightWorks', 'In progress'], ['AC not cooling', 'Parkview Residences', 'HVAC', 'High', 'Unassigned', 'Open'], ['Broken gate remote', 'Willow Creek', 'Access', 'Low', 'SecureEntry', 'Resolved'], ['Water stain on ceiling', 'The Franklin', 'Plumbing', 'High', 'Unassigned', 'Open']],
    },
    Payments: {
      subtitle: 'Monitor rent collection, balances, and outgoing vendor payments.',
      metrics: [['Collected this month', '₹452,670', '94.8% collection rate'], ['Pending collection', '₹24,680', '9 accounts'], ['Vendor payments', '₹68,450', '12 payments'], ['Net income', '₹384,220', '+6.2% vs last month']],
      headers: ['Transaction', 'Account', 'Date', 'Amount', 'Method', 'Status'],
      rows: [['Rent collection', 'The Franklin', 'Sep 05, 2025', '₹184,200', 'ACH', 'Completed'], ['Rent collection', 'Lakeside Commons', 'Sep 05, 2025', '₹126,800', 'ACH', 'Completed'], ['Vendor invoice', 'Apex Plumbing', 'Sep 06, 2025', '₹18,450', 'Bank transfer', 'Pending'], ['Rent collection', 'Parkview Residences', 'Sep 05, 2025', '₹98,450', 'ACH', 'Completed'], ['Vendor invoice', 'BrightWorks', 'Sep 07, 2025', '₹9,800', 'Bank transfer', 'Pending']],
    },
    Reports: {
      subtitle: 'Review portfolio performance and export operational reports.',
      metrics: [['Portfolio occupancy', '94.2%', '+2.1% vs last month'], ['SLA compliance', '91.6%', '+3.2% vs last month'], ['Revenue this month', '₹477,350', '+8.4% vs last month'], ['Resident satisfaction', '4.8/5', 'Based on 126 responses']],
      headers: ['Report', 'Period', 'Owner', 'Generated', 'Format', 'Status'],
      rows: [['Portfolio performance', 'September 2025', 'Jordan Davis', 'Today, 03:30 PM', 'PDF', 'Ready'], ['Maintenance SLA report', 'August 2025', 'Jordan Davis', 'Sep 01, 2025', 'CSV', 'Ready'], ['Revenue summary', 'August 2025', 'Finance team', 'Sep 01, 2025', 'PDF', 'Ready'], ['Occupancy trend', 'Q3 2025', 'Jordan Davis', 'Aug 31, 2025', 'CSV', 'Ready'], ['Tenant balance report', 'September 2025', 'Finance team', 'Today, 09:00 AM', 'PDF', 'Ready']],
    },
    Help: {
      subtitle: 'Find answers and guidance for managing your Propwise workspace.',
      metrics: [['Help articles', '24', 'Updated recently'], ['Quick start guides', '6', 'For new team members'], ['Support tickets', '2', '1 awaiting reply'], ['Response time', '< 4 hours', 'Business hours']],
      headers: ['Topic', 'Description', 'Updated', 'Owner', 'Articles', 'Status'],
      rows: [['Getting started', 'Set up your workspace and team', 'Today', 'Propwise support', '8', 'Available'], ['Property management', 'Properties, units, and occupancy', 'Yesterday', 'Operations team', '6', 'Available'], ['Maintenance workflows', 'Requests, vendors, and SLAs', 'Sep 05, 2025', 'Operations team', '5', 'Available'], ['Payments and reports', 'Collections and exports', 'Sep 02, 2025', 'Finance team', '5', 'Available'], ['Contact support', 'Open a support conversation', 'Always available', 'Support team', '1', 'Available']],
    },
    Users: {
      subtitle: 'Manage administrative accounts, role permissions, and access privileges.',
      metrics: [['Total users', '6', '+2 this quarter'], ['Property managers', '2', 'Active'], ['Super admins', '1', 'Active'], ['Staff & Tenants', '3', 'Active']],
      headers: ['User', 'Email', 'Role', 'Organization', 'Joined', 'Status'],
      rows: [['Jordan Davis', 'manager@propwise.test', 'Property Manager', 'Propwise Management', 'Jan 2024', 'Active'], ['Sam Rivera', 'admin@propwise.test', 'Super Admin', 'Propwise Management', 'Jan 2023', 'Active'], ['Maya Carter', 'tenant@propwise.test', 'Tenant', 'Propwise Management', 'Mar 2024', 'Active'], ['Chris Lee', 'staff@propwise.test', 'Staff', 'Propwise Management', 'Jun 2024', 'Active']],
    },
    'Audit Log': {
      subtitle: 'Inspect system events, user actions, and administrative logs.',
      metrics: [['Events logged', '1,428', 'Last 30 days'], ['Security checks', '100%', 'Passed'], ['Active sessions', '4', 'Current'], ['Alerts', '0', 'Clean']],
      headers: ['Action', 'User', 'Target', 'Timestamp', 'IP Address', 'Status'],
      rows: [['Added property', 'Jordan Davis', 'Cedar Heights', 'Today, 10:14 AM', '192.168.1.45', 'Completed'], ['Updated work order', 'Alex Morgan', 'REQ-1042', 'Today, 9:22 AM', '192.168.1.12', 'Completed'], ['Submitted request', 'Maya Carter', 'REQ-1043', 'Yesterday, 5:40 PM', '172.16.0.8', 'Completed'], ['Exported report', 'Jordan Davis', 'Portfolio Sept 2025', 'Yesterday, 3:18 PM', '192.168.1.45', 'Completed'], ['Changed user role', 'Sam Rivera', 'Chris Lee → Staff', 'Sep 19, 2025', '10.0.0.1', 'Completed']],
    },
    'Tenant Maintenance': {
      subtitle: 'View and submit maintenance requests for your apartment unit.',
      metrics: [['My requests', '3', '1 open'], ['In progress', '1', 'HVAC technician assigned'], ['Resolved', '1', 'Window seal repaired'], ['Avg fix time', '1.5 days', 'Fast resolution']],
      headers: ['Request', 'Category', 'Priority', 'Assigned Vendor', 'Submitted', 'Status'],
      rows: [['Bathroom faucet dripping', 'Plumbing', 'Medium', 'Unassigned', 'Today', 'Open'], ['AC not cooling', 'HVAC', 'High', 'CoolAir Services', 'Sep 5', 'In progress'], ['Window seal broken', 'General', 'Low', 'In-house', 'Aug 28', 'Resolved']],
    },
    'Tenant Payments': {
      subtitle: 'Review lease payment history, current rent dues, and receipts.',
      metrics: [['Next payment due', '₹28,500', 'Due Oct 1, 2025'], ['Total paid YTD', '₹256,500', '9 payments'], ['Security deposit', '₹57,000', 'Held in escrow'], ['Auto-pay', 'Enabled', 'ACH Account ****4821']],
      headers: ['Description', 'Amount', 'Date', 'Payment Method', 'Receipt ID', 'Status'],
      rows: [['Rent – September 2025', '₹28,500', 'Sep 01, 2025', 'ACH Auto-pay', 'REC-8821', 'Paid'], ['Rent – August 2025', '₹28,500', 'Aug 01, 2025', 'ACH Auto-pay', 'REC-7910', 'Paid'], ['Rent – July 2025', '₹28,500', 'Jul 01, 2025', 'ACH Auto-pay', 'REC-6902', 'Paid'], ['Security deposit', '₹57,000', 'Mar 15, 2024', 'Wire Transfer', 'REC-1002', 'Paid']],
    },
    'Tenant Documents': {
      subtitle: 'Access your signed lease agreements, community rules, and inspection reports.',
      metrics: [['Total documents', '4', 'All active'], ['Lease status', 'Active', 'Expires Oct 31, 2025'], ['Insurance proof', 'Verified', 'Valid through Nov 2025'], ['Building rules', 'Updated', 'V2.4']],
      headers: ['Document Name', 'Category', 'Date Signed', 'File Format', 'Size', 'Status'],
      rows: [['Residential Lease Agreement 2024-2025', 'Lease', 'Nov 01, 2023', 'PDF', '2.4 MB', 'Active'], ['Community Rules & Guidelines', 'Policy', 'Nov 01, 2023', 'PDF', '850 KB', 'Active'], ['Move-In Inspection Checklist', 'Inspection', 'Nov 02, 2023', 'PDF', '1.1 MB', 'Completed'], ['Renter Insurance Confirmation', 'Insurance', 'Oct 28, 2024', 'PDF', '420 KB', 'Verified']],
    },
    'Tenant Announcements': {
      subtitle: 'Stay informed with building notices, maintenance updates, and community news.',
      metrics: [['Active notices', '3', '1 high priority'], ['Upcoming events', '2', 'This weekend'], ['Building updates', '4', 'This month'], ['Unread', '1', 'New fire drill notice']],
      headers: ['Announcement Title', 'Category', 'Target Property', 'Posted Date', 'Author', 'Status'],
      rows: [['Annual Fire Alarm & Sprinkler Testing', 'Building Safety', 'The Franklin', 'Today, 09:00 AM', 'Property Management', 'Important'], ['Elevator Maintenance Scheduled', 'Maintenance', 'The Franklin', 'Yesterday', 'Operations Team', 'Scheduled'], ['Community Rooftop Social Event', 'Community', 'The Franklin', 'Sep 04, 2025', 'Resident Committee', 'Upcoming']],
    },
    'Staff Maintenance': {
      subtitle: 'Operational queue of field work orders assigned to staff and contractors.',
      metrics: [['Assigned to me', '5', '2 high priority'], ['In progress', '2', 'On site'], ['Resolved today', '3', 'Verified'], ['SLA targets', '96%', 'On schedule']],
      headers: ['Work Order', 'Property', 'Unit / Area', 'Category', 'Priority', 'Status'],
      rows: [['Inspect lobby fire extinguishers', 'The Franklin', 'Lobby & Hallways', 'Safety', 'High', 'Open'], ['Replace hallway light bulbs', 'Lakeside Commons', '2nd Floor', 'Electrical', 'Medium', 'In progress'], ['Clean parking lot drains', 'Parkview Residences', 'Exterior Lot', 'Sanitation', 'Low', 'Open'], ['Pool chemical balance check', 'Willow Creek', 'Amenity Pool', 'Amenities', 'Medium', 'Resolved']],
    },
    'Staff Properties': {
      subtitle: 'Key code access, emergency contacts, and physical property inspection logs.',
      metrics: [['Assigned properties', '4', 'All accessible'], ['Master keys', 'Logged', 'Safe box B'], ['Gate codes', '4 active', 'Secured'], ['Inspections due', '1', 'This week']],
      headers: ['Property', 'Address', 'Access Gate Code', 'Emergency Contact', 'Last Inspection', 'Status'],
      rows: [['The Franklin', '1200 S Congress Ave, Austin TX', '#4821', 'Jordan Davis (555-0192)', 'Sep 01, 2025', 'Good condition'], ['Lakeside Commons', '840 Turtle Creek Blvd, Dallas TX', '#9012', 'Alex Morgan (555-0144)', 'Aug 28, 2025', 'Attention needed'], ['Parkview Residences', '310 Park Ave, Houston TX', '#1144', 'Sam Rivera (555-0100)', 'Aug 30, 2025', 'Good condition'], ['Willow Creek', '450 Creek Rd, San Antonio TX', '#7721', 'Chris Lee (555-0188)', 'Sep 02, 2025', 'Good condition']],
    },
    'Staff Schedule': {
      subtitle: 'Daily work shifts, scheduled site visits, and operational assignments.',
      metrics: [['Today shift', '8:00 AM - 4:30 PM', 'On duty'], ['Visits planned', '4 sites', 'Austin & Dallas'], ['Completed stops', '2 / 4', '50% complete'], ['Overtime status', '0 hrs', 'Standard']],
      headers: ['Time Slot', 'Activity / Task', 'Location / Property', 'Required Equipment', 'Supervisor', 'Status'],
      rows: [['8:00 AM - 9:30 AM', 'Morning property walkthrough', 'The Franklin', 'Inspection Checklist, Master Keys', 'Jordan Davis', 'Completed'], ['10:00 AM - 11:30 AM', 'Fire extinguisher inspection', 'Franklin Lobby', 'Pressure Gauge, Tags', 'Jordan Davis', 'Completed'], ['11:30 AM - 1:00 PM', 'Hallway light replacement', 'Lakeside Commons', 'Ladder, LED Bulbs', 'Alex Morgan', 'In progress'], ['2:00 PM - 4:00 PM', 'Supervisor check-in & log review', 'Central Office', 'Tablet / Work Log', 'Sam Rivera', 'Scheduled']],
    },
  }
  const data = datasets[name]
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')
  const [rows, setRows] = useState(data?.rows ?? [])
  const [showAdd, setShowAdd] = useState(false)
  const [notice, setNotice] = useState('')
  const filteredRows = rows.filter((row) => {
    const matchesSearch = row.join(' ').toLowerCase().includes(search.toLowerCase())
    const matchesFilter = filter === 'All' || row[row.length - 1] === filter
    return matchesSearch && matchesFilter
  })
  const exportRows = () => {
    if (!data) return
    const csv = [data.headers, ...filteredRows].map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(',')).join('\n')
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    link.download = `propwise-${name.toLowerCase()}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
    setNotice(`${name} export downloaded.`)
  }
  if (!data) return (
    <div className="placeholder-page">
      <Link className="landing-brand" to="/"><span className="brand-mark">P</span> propwise</Link>
      <p className="eyebrow">SYSTEM MESSAGE</p>
      <h1>{name}</h1>
      <p>This workspace page is ready for deployment.</p>
      <button className="primary-button" type="button" onClick={() => navigate(user ? rolePath(user.role) : '/manager/dashboard')}>Back to dashboard</button>
      <QuickPageNavigator />
    </div>
  )
  return (
    <div className="app-shell mock-page">
      <aside className="mock-sidebar">
        <Link className="brand" to={user ? rolePath(user.role) : '/manager/dashboard'}><span className="brand-mark">P</span><span>propwise</span></Link>
        <p className="workspace-label">WORKSPACE</p>
        <p className="mock-side-note">You are viewing the {name.toLowerCase()} workspace.</p>
        <button className="primary-button" type="button" onClick={() => navigate(user ? rolePath(user.role) : '/manager/dashboard')}>Dashboard</button>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">Workspace <span>/</span> {name}</div>
          <div className="top-actions">
            <span className="avatar small">{user?.name.slice(0, 2).toUpperCase() ?? 'JD'}</span>
            <strong>{user?.name ?? 'Jordan Davis'}</strong>
          </div>
        </header>
        <div className="content">
          <section className="page-heading">
            <div>
              <p className="eyebrow">WORKSPACE / {name.toUpperCase()}</p>
              <h1>{name}</h1>
              <p className="muted">{data.subtitle}</p>
              {notice && <p className="profile-success" role="status">{notice}</p>}
            </div>
            <div className="heading-actions">
              <button className="secondary-button" type="button" onClick={exportRows}>Export</button>
              <button className="primary-button" type="button" onClick={() => setShowAdd(true)}>Add {name === 'Help' ? 'ticket' : name === 'Reports' ? 'report' : name.slice(0, -1).toLowerCase()}</button>
            </div>
          </section>
          <section className="metric-grid">
            {data.metrics.map(([label, value, change]) => <Metric key={label} label={label} value={value} change={change} icon="●" positive />)}
          </section>
          <section className="card mock-table-card">
            <div className="card-heading">
              <div><h2>{name === 'Help' ? 'Support and guidance' : `${name} overview`}</h2><p className="muted">Mock records ready for connected workflows</p></div>
              <div className="table-actions">
                <label className="search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${name.toLowerCase()}`} /></label>
                <select className="filter-select" aria-label={`Filter ${name}`} value={filter} onChange={(event) => setFilter(event.target.value)}>
                  <option>All</option><option>Current</option><option>Open</option><option>Pending</option><option>Ready</option><option>Available</option><option>Completed</option><option>On track</option><option>Active</option><option>Paid</option><option>Verified</option><option>Important</option><option>Scheduled</option>
                </select>
                <button className="filter-button" type="button" onClick={() => { setFilter('All'); setSearch(''); setNotice('Filters cleared.') }}>Clear filters</button>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>{data.headers.map((header) => <th key={header}>{header.toUpperCase()}</th>)}</tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.join('-')}>
                      {row.map((value, index) => (
                        <td key={`${row[0]}-${index}`}>
                          <strong>{index === 0 ? value : ''}</strong>{index !== 0 ? value : <small>Record</small>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredRows.length === 0 && <p className="empty-state">No records match your filters.</p>}
            </div>
            <div className="pagination">
              <span>Showing {filteredRows.length} of {rows.length}</span>
              <span className="page-number">Page 1</span>
            </div>
          </section>
        </div>
      </main>
      {showAdd && <MockRecordModal name={name} headers={data.headers} onClose={() => setShowAdd(false)} onAdd={(record) => { setRows((current) => [record, ...current]); setShowAdd(false); setNotice('New record added.') }} />}
      <QuickPageNavigator />
    </div>
  )
}

// ─── MOCK RECORD MODAL (used by RoutePlaceholder) ────────────────────────────

function MockRecordModal({ name, headers, onClose, onAdd }: { name: string; headers: string[]; onClose: () => void; onAdd: (record: string[]) => void }) {
  const [values, setValues] = useState<string[]>(headers.map(() => ''))
  const [error, setError] = useState('')
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!values[0].trim()) { setError('The first field is required.'); return }
    onAdd(values)
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}><section className="modal-card" role="dialog" aria-modal="true"><div className="modal-heading"><div><p className="eyebrow">{name.toUpperCase()}</p><h2>Add record</h2></div><button className="modal-close" type="button" onClick={onClose} aria-label="Close">×</button></div><form className="property-form" onSubmit={submit}>{headers.map((h, i) => <label key={h}>{h}<input autoFocus={i === 0} value={values[i]} onChange={ev => setValues(v => v.map((val, j) => j === i ? ev.target.value : val))} placeholder={`e.g. ${h}`} /></label>)}{error && <p className="auth-error" role="alert">{error}</p>}<div className="modal-actions"><button className="secondary-button modal-cancel" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit">Save record</button></div></form></section></div>
}

// ─── SHARED ROLE DASHBOARD SHELL ─────────────────────────────────────────────

function RoleShell({ navItems, breadcrumb, children }: { navItems: string[][]; breadcrumb: string; children: ReactNode }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [roleNotifications, setRoleNotifications] = useState<Notification[]>([
    { id: 'rn1', title: 'Welcome to your dashboard', detail: 'Your role-specific workspace is ready.', time: 'Just now', read: false },
    { id: 'rn2', title: 'Weekly summary available', detail: 'Your activity report for this week is ready.', time: '1 hour ago', read: true },
  ])
  const unread = roleNotifications.filter(n => !n.read).length

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setMobileNavOpen(false); setShowNotifications(false) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="app-shell">
      {mobileNavOpen && <button className="mobile-nav-backdrop" type="button" aria-label="Close navigation menu" onClick={() => setMobileNavOpen(false)} />}
      <aside className={`sidebar ${mobileNavOpen ? 'mobile-open' : ''}`}>
        <div className="brand"><span className="brand-mark">P</span><span>propwise</span></div>
        <div className="workspace-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {navItems.map(([label, icon, path]) => (
            <button className={`nav-item ${location.pathname === path ? 'active' : ''}`} key={label} onClick={() => { navigate(path); setMobileNavOpen(false) }} type="button">
              <span className="nav-icon">{icon}</span>{label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-item" type="button" onClick={() => { navigate('/help'); setMobileNavOpen(false) }}><span className="nav-icon">?</span>Help center</button>
          <div className="profile">
            <div className="avatar">{user?.name.slice(0, 2).toUpperCase() ?? 'US'}</div>
            <div><strong>{user?.name ?? 'User'}</strong><small>{user ? getRoleLabel(user.role) : ''}</small></div>
            <button className="profile-menu" type="button" onClick={() => { logout(); navigate('/login') }} aria-label="Log out">Log out</button>
          </div>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu" type="button" aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'} aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen(o => !o)}>☰</button>
          <div className="breadcrumb">Workspace <span>/</span> {breadcrumb}</div>
          <div className="top-actions">
            <button className="icon-button" type="button" aria-label="Notifications" onClick={() => setShowNotifications(true)}>♢{unread > 0 && <i />}</button>
            <button className="profile-button" type="button" onClick={() => navigate('/profile')}><div className="avatar small">{user?.name.slice(0, 2).toUpperCase() ?? 'US'}</div></button>
          </div>
        </header>
        <div className="content">{children}</div>
      </main>
      {showNotifications && <NotificationsPanel notifications={roleNotifications} onClose={() => setShowNotifications(false)} onRead={id => setRoleNotifications(ns => ns.map(n => n.id === id ? { ...n, read: true } : n))} onReadAll={() => setRoleNotifications(ns => ns.map(n => ({ ...n, read: true })))} />}
      <QuickPageNavigator />
    </div>
  )
}

// ─── ADMIN DASHBOARD ──────────────────────────────────────────────────────────

const adminNav = [
  ['Overview', '▦', '/admin/dashboard'],
  ['Users', '♙', '/admin/users'],
  ['Properties', '⌂', '/properties'],
  ['Tenants', '◉', '/tenants'],
  ['Reports', '▤', '/reports'],
  ['Audit Log', '☷', '/admin/audit'],
  ['Settings', '⚙', '/settings'],
]

const allDemoUsers = [
  { name: 'Jordan Davis', email: 'manager@propwise.test', role: 'Property Manager', status: 'Active', joined: 'Jan 2024' },
  { name: 'Sam Rivera',   email: 'admin@propwise.test',   role: 'Super Admin',      status: 'Active', joined: 'Jan 2023' },
  { name: 'Maya Carter',  email: 'tenant@propwise.test',  role: 'Tenant',           status: 'Active', joined: 'Mar 2024' },
  { name: 'Chris Lee',    email: 'staff@propwise.test',   role: 'Staff',            status: 'Active', joined: 'Jun 2024' },
]

const auditLog = [
  { user: 'Jordan Davis', action: 'Added property',    target: 'Cedar Heights',        time: 'Today, 10:14 AM'    },
  { user: 'Alex Morgan',  action: 'Updated work order', target: 'REQ-1042',             time: 'Today, 9:22 AM'     },
  { user: 'Maya Carter',  action: 'Submitted request',  target: 'REQ-1043',             time: 'Yesterday, 5:40 PM' },
  { user: 'Jordan Davis', action: 'Exported report',    target: 'Portfolio Sept 2025',  time: 'Yesterday, 3:18 PM' },
  { user: 'Sam Rivera',   action: 'Changed user role',  target: 'Chris Lee → Staff',    time: 'Sep 19, 2025'       },
]

function AdminDashboardPage() {
  const { user } = useAuth()
  return (
    <RoleShell navItems={adminNav} breadcrumb="Admin Overview">
      <section className="page-heading">
        <div>
          <p className="eyebrow">SUPER ADMIN · SYSTEM OVERVIEW</p>
          <h1>Welcome back, {user?.name.split(' ')[0]}</h1>
          <p className="muted">Full system visibility across all properties, users, and activity.</p>
        </div>
        <div className="heading-actions">
          <button className="secondary-button dashboard-action" type="button">Export audit log</button>
          <button className="primary-button" type="button"><span>+</span> Add user</button>
        </div>
      </section>

      <section className="metric-grid" aria-label="System summary">
        <Metric label="Total users"        value="6"          change="+2 this quarter"      icon="♙" positive />
        <Metric label="Active properties"  value="5"          change="350 total units"      icon="⌂" positive />
        <Metric label="Monthly revenue"    value="₹4,77,350"  change="+8.4% vs last month"  icon="₹" positive />
        <Metric label="System alerts"      value="2"          change="1 critical pending"   icon="⚠" warning />
      </section>

      <section className="dashboard-grid">
        <article className="card">
          <div className="card-heading">
            <div><h2>User management</h2><p className="muted">All registered accounts</p></div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>NAME</th><th>EMAIL</th><th>ROLE</th><th>JOINED</th><th>STATUS</th></tr></thead>
              <tbody>
                {allDemoUsers.map(u => (
                  <tr key={u.email}>
                    <td><strong>{u.name}</strong></td>
                    <td><small>{u.email}</small></td>
                    <td><span style={{display:'inline-block',padding:'4px 9px',borderRadius:'12px',fontSize:'10px',fontWeight:600,color:'#6956d8',background:'#efedff'}}>{u.role}</span></td>
                    <td>{u.joined}</td>
                    <td><span className="status status-good"><i />{u.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="card tasks-card">
          <div className="card-heading"><div><h2>Audit log</h2><p className="muted">Recent system actions</p></div></div>
          <div className="task-list">
            {auditLog.map((entry, i) => (
              <div className="task" key={i}>
                <span className="task-dot purple" />
                <div><strong>{entry.action}: {entry.target}</strong><small>{entry.user} · {entry.time}</small></div>
              </div>
            ))}
          </div>
          <button className="text-button" type="button" style={{marginTop:'16px'}}>View full audit log</button>
        </article>
      </section>

      <section className="card" style={{marginTop:'22px'}}>
        <div className="card-heading"><div><h2>Properties overview</h2><p className="muted">All managed properties across the organization</p></div></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>PROPERTY</th><th>LOCATION</th><th>UNITS</th><th>OCCUPANCY</th><th>REVENUE</th><th>STATUS</th></tr></thead>
            <tbody>
              {initialProperties.map(p => (
                <tr key={p.name}>
                  <td><div className="property-name"><span className="property-icon">⌂</span><div><strong>{p.name}</strong><small>{p.location}</small></div></div></td>
                  <td>{p.location}</td>
                  <td>{p.units}</td>
                  <td><strong>{Math.round((p.occupied / p.units) * 100)}%</strong></td>
                  <td><strong>{p.revenue}</strong></td>
                  <td><span className={`status ${p.status === 'On track' ? 'status-good' : 'status-warning'}`}><i />{p.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </RoleShell>
  )
}

// ─── TENANT DASHBOARD ─────────────────────────────────────────────────────────

const tenantNav = [
  ['My Home',       '⌂', '/tenant/dashboard'],
  ['Maintenance',   '⚒', '/tenant/maintenance'],
  ['Payments',      '₹', '/tenant/payments'],
  ['Documents',     '▤', '/tenant/documents'],
  ['Announcements', '♢', '/tenant/announcements'],
]

const myMaintenanceRequests: ServiceRequest[] = [
  { id: 'REQ-1043', title: 'Bathroom faucet dripping',  property: 'The Franklin', category: 'Plumbing',  priority: 'Medium', status: 'Open',        vendor: 'Unassigned',      created: 'Today'   },
  { id: 'REQ-1040', title: 'AC not cooling',             property: 'The Franklin', category: 'HVAC',      priority: 'High',   status: 'In progress', vendor: 'CoolAir Services', created: 'Sep 5'   },
  { id: 'REQ-1035', title: 'Window seal broken',         property: 'The Franklin', category: 'General',   priority: 'Low',    status: 'Resolved',    vendor: 'In-house',        created: 'Aug 28'  },
]

const myPaymentHistory = [
  { description: 'Rent – September 2025', amount: '₹28,500', date: 'Sep 1, 2025',  status: 'Paid' },
  { description: 'Rent – August 2025',    amount: '₹28,500', date: 'Aug 1, 2025',  status: 'Paid' },
  { description: 'Security deposit',      amount: '₹57,000', date: 'Mar 15, 2024', status: 'Paid' },
]

function TenantDashboardPage() {
  const { user } = useAuth()
  const [showNewRequest, setShowNewRequest] = useState(false)
  const [tenantRequests, setTenantRequests] = useState(myMaintenanceRequests)

  return (
    <RoleShell navItems={tenantNav} breadcrumb="My Home">
      <section className="page-heading">
        <div>
          <p className="eyebrow">TENANT PORTAL · THE FRANKLIN, UNIT 4B</p>
          <h1>Hello, {user?.name.split(' ')[0]} 👋</h1>
          <p className="muted">Manage your home, maintenance requests, and payments in one place.</p>
        </div>
        <div className="heading-actions">
          <button className="primary-button" type="button" onClick={() => setShowNewRequest(true)}><span>+</span> New request</button>
        </div>
      </section>

      <section className="metric-grid" aria-label="Tenancy summary">
        <Metric label="Next rent due"   value="Oct 1"    change="₹28,500 due"          icon="₹"  />
        <Metric label="Lease ends"      value="Oct 31"   change="Renewal available"      icon="▤"  />
        <Metric label="Open requests"   value={String(tenantRequests.filter(r => r.status !== 'Resolved').length)} change="1 in progress" icon="⚒" />
        <Metric label="Satisfaction"    value="4.9/5"    change="Based on your reviews" icon="★"  positive />
      </section>

      <section className="dashboard-grid">
        <article className="card">
          <div className="card-heading"><div><h2>My maintenance requests</h2><p className="muted">Track your reported issues</p></div></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>REQUEST</th><th>CATEGORY</th><th>PRIORITY</th><th>STATUS</th><th>ASSIGNED TO</th></tr></thead>
              <tbody>
                {tenantRequests.map(r => (
                  <tr key={r.id}>
                    <td><strong>{r.title}</strong><small>{r.id} · {r.created}</small></td>
                    <td>{r.category}</td>
                    <td><span className={`priority priority-${r.priority.toLowerCase()}`}>{r.priority}</span></td>
                    <td><span className={`status status-${r.status === 'Resolved' ? 'good' : r.status === 'In progress' ? 'info' : 'warning'}`}><i />{r.status}</span></td>
                    <td>{r.vendor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="text-button" type="button" style={{marginTop:'16px'}} onClick={() => setShowNewRequest(true)}>Submit new request</button>
        </article>

        <div style={{display:'flex',flexDirection:'column',gap:'17px'}}>
          <article className="card" style={{background:'linear-gradient(135deg,#6956d8 0%,#8f7ef5 100%)',color:'#fff',border:'none'}}>
            <p style={{margin:'0 0 8px',fontSize:'10px',fontWeight:700,letterSpacing:'1px',opacity:.75}}>YOUR LEASE</p>
            <h2 style={{margin:'0 0 4px',color:'#fff',fontSize:'16px'}}>The Franklin, Unit 4B</h2>
            <p style={{margin:'0 0 20px',fontSize:'12px',opacity:.8}}>Austin, TX · 2 bed / 2 bath</p>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'14px'}}>
              {[['Monthly rent','₹28,500'],['Lease start','Nov 1, 2023'],['Lease end','Oct 31, 2025'],['Security dep.','₹57,000']].map(([k,v]) => (
                <div key={k}><small style={{display:'block',fontSize:'10px',opacity:.7}}>{k}</small><strong style={{fontSize:'13px'}}>{v}</strong></div>
              ))}
            </div>
          </article>

          <article className="card tasks-card">
            <div className="card-heading"><div><h2>Recent payments</h2><p className="muted">Your payment history</p></div></div>
            <div className="task-list">
              {myPaymentHistory.map((p, i) => (
                <div className="task" key={i}>
                  <span className="task-dot" style={{background:'#3d9a76'}} />
                  <div><strong>{p.description}</strong><small>{p.amount} · {p.date}</small></div>
                  <span className="status status-good" style={{marginLeft:'auto',flexShrink:0}}><i />{p.status}</span>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      {showNewRequest && <TenantRequestModal onClose={() => setShowNewRequest(false)} onSubmit={req => { setTenantRequests(r => [req, ...r]); setShowNewRequest(false) }} />}
    </RoleShell>
  )
}

function TenantRequestModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (r: ServiceRequest) => void }) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('Plumbing')
  const [priority, setPriority] = useState<Priority>('Medium')
  const [error, setError] = useState('')

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!title.trim()) { setError('Please describe the issue.'); return }
    const newId = `REQ-${1044 + Math.floor(Math.random() * 900)}`
    onSubmit({ id: newId, title: title.trim(), property: 'The Franklin', category, priority, status: 'Open', vendor: 'Unassigned', created: 'Just now' })
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="tenant-request-title">
        <div className="modal-heading">
          <div><p className="eyebrow">MAINTENANCE REQUEST</p><h2 id="tenant-request-title">Report an issue</h2><p className="muted">Describe the problem in your unit or common area.</p></div>
          <button className="modal-close" type="button" onClick={onClose} aria-label="Close">×</button>
        </div>
        <form className="property-form" onSubmit={submit}>
          <label>Issue description<input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Bathroom faucet dripping" /></label>
          <label>Category
            <select value={category} onChange={e => setCategory(e.target.value)} style={{width:'100%',padding:'11px 12px',border:'1px solid #e3e1ec',borderRadius:'7px',color:'#403c53',fontSize:'13px',background:'#fff'}}>
              {['Plumbing','Electrical','HVAC','General','Access','Appliance'].map(c => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label>Priority
            <select value={priority} onChange={e => setPriority(e.target.value as Priority)} style={{width:'100%',padding:'11px 12px',border:'1px solid #e3e1ec',borderRadius:'7px',color:'#403c53',fontSize:'13px',background:'#fff'}}>
              {(['High','Medium','Low'] as Priority[]).map(p => <option key={p}>{p}</option>)}
            </select>
          </label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <div className="modal-actions"><button className="secondary-button modal-cancel" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit">Submit request</button></div>
        </form>
      </section>
    </div>
  )
}

// ─── STAFF DASHBOARD ──────────────────────────────────────────────────────────

const staffNav = [
  ['Tasks',       '✓', '/staff/dashboard'],
  ['Maintenance', '⚒', '/staff/maintenance'],
  ['Properties',  '⌂', '/staff/properties'],
  ['Schedule',    '◷', '/staff/schedule'],
]

type StaffTask = { id: string; title: string; property: string; category: string; priority: Priority; status: RequestStatus; due: string }
const initialStaffTasks: StaffTask[] = [
  { id: 'TSK-221', title: 'Inspect lobby fire extinguishers', property: 'The Franklin',        category: 'Safety',     priority: 'High',   status: 'Open',        due: 'Today'  },
  { id: 'TSK-220', title: 'Replace hallway light bulbs',      property: 'Lakeside Commons',    category: 'Electrical', priority: 'Medium', status: 'In progress', due: 'Today'  },
  { id: 'TSK-219', title: 'Clean parking lot drains',         property: 'Parkview Residences', category: 'Sanitation', priority: 'Low',    status: 'Open',        due: 'Sep 9'  },
  { id: 'TSK-218', title: 'Pool chemical balance check',      property: 'Willow Creek',        category: 'Amenities',  priority: 'Medium', status: 'Resolved',    due: 'Sep 6'  },
  { id: 'TSK-217', title: 'Repaint unit 3A walls',            property: 'The Franklin',        category: 'General',    priority: 'Low',    status: 'Resolved',    due: 'Sep 5'  },
]

function StaffDashboardPage() {
  const { user } = useAuth()
  const [tasks, setTasks] = useState(initialStaffTasks)

  const toggleTask = (id: string) =>
    setTasks(t => t.map(task => task.id === id ? { ...task, status: (task.status === 'Resolved' ? 'Open' : 'Resolved') as RequestStatus } : task))

  const open     = tasks.filter(t => t.status !== 'Resolved').length
  const overdue  = tasks.filter(t => t.status === 'Overdue').length
  const resolved = tasks.filter(t => t.status === 'Resolved').length

  return (
    <RoleShell navItems={staffNav} breadcrumb="Tasks">
      <section className="page-heading">
        <div>
          <p className="eyebrow">STAFF PORTAL · OPERATIONS TEAM</p>
          <h1>Your tasks, {user?.name.split(' ')[0]}</h1>
          <p className="muted">Manage your daily assignments and maintenance queue. Click a row to toggle completion.</p>
        </div>
      </section>

      <section className="metric-grid" aria-label="Staff summary">
        <Metric label="Today's tasks"      value={String(tasks.filter(t => t.due === 'Today').length)} change="2 pending today"         icon="✓"  />
        <Metric label="Open tasks"         value={String(open)}    change="Across all properties"     icon="⚒" warning={overdue > 0} />
        <Metric label="Overdue"            value={String(overdue)} change={overdue === 0 ? 'All on track' : 'Needs attention'} icon="⚠" warning={overdue > 0} />
        <Metric label="Resolved this week" value={String(resolved)} change="+2 vs last week"           icon="◉" positive />
      </section>

      <section className="card" style={{marginBottom:'22px'}}>
        <div className="card-heading">
          <div><h2>Task queue</h2><p className="muted">Click any row to mark as complete / reopen</p></div>
          <div style={{display:'flex',gap:'8px'}}>
            <span className="status status-good" style={{fontSize:'11px'}}><i />{resolved} resolved</span>
            <span className="status status-info" style={{fontSize:'11px'}}><i />{open} open</span>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>TASK</th><th>PROPERTY</th><th>CATEGORY</th><th>PRIORITY</th><th>DUE</th><th>STATUS</th></tr></thead>
            <tbody>
              {tasks.map(t => (
                <tr key={t.id} className="clickable-row" onClick={() => toggleTask(t.id)} style={t.status === 'Resolved' ? {opacity:.5} : {}}>
                  <td><strong style={t.status === 'Resolved' ? {textDecoration:'line-through'} : {}}>{t.title}</strong><small>{t.id}</small></td>
                  <td>{t.property}</td>
                  <td>{t.category}</td>
                  <td><span className={`priority priority-${t.priority.toLowerCase()}`}>{t.priority}</span></td>
                  <td>{t.due}</td>
                  <td><span className={`status status-${t.status === 'Resolved' ? 'good' : t.status === 'Overdue' ? 'warning' : 'info'}`}><i />{t.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="dashboard-grid">
        <article className="card">
          <div className="card-heading"><div><h2>Maintenance assignments</h2><p className="muted">Requests currently assigned to staff</p></div></div>
          <div className="task-list">
            {serviceRequests.filter(r => r.status !== 'Resolved').slice(0, 4).map(r => (
              <div className="task" key={r.id}>
                <span className={`task-dot ${r.priority === 'High' ? 'orange' : r.priority === 'Medium' ? 'blue' : 'purple'}`} />
                <div><strong>{r.title}</strong><small>{r.property} · {r.category} · {r.status}</small></div>
                <span className={`priority priority-${r.priority.toLowerCase()}`} style={{marginLeft:'auto',flexShrink:0}}>{r.priority}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="card tasks-card">
          <div className="card-heading"><div><h2>Today's schedule</h2><p className="muted">{new Date().toLocaleDateString('en-US', {weekday:'long', month:'long', day:'numeric'})}</p></div></div>
          <div className="task-list">
            {[
              { time: '8:00 AM',  title: 'Morning property walkthrough',   loc: 'The Franklin'      },
              { time: '10:00 AM', title: 'Fire extinguisher inspection',    loc: 'Franklin Lobby'    },
              { time: '11:30 AM', title: 'Hallway light replacement',       loc: 'Lakeside Commons'  },
              { time: '2:00 PM',  title: 'Supervisor check-in',             loc: 'Office'            },
            ].map((slot, i) => (
              <div className="task" key={i}>
                <span className="task-dot blue" />
                <div><strong>{slot.title}</strong><small>{slot.time} · {slot.loc}</small></div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </RoleShell>
  )
}

function LoginPage() {
  const { user, login, rolePath } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('manager@propwise.test')
  const [password, setPassword] = useState('demo123')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to={rolePath(user.role)} replace />

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    if (!email.trim() || password.length < 6) {
      setError('Enter a valid email and a password with at least 6 characters.')
      return
    }
    setSubmitting(true)
    window.setTimeout(() => {
      const result = login(email, password)
      setSubmitting(false)
      if (!result.ok) {
        setError(result.error ?? 'Unable to sign in')
        return
      }
      navigate(rolePath(result.user?.role ?? 'PROPERTY_MANAGER'))
    }, 250)
  }

  return <div className="auth-page"><div className="auth-brand"><Link className="landing-brand" to="/"><span className="brand-mark">P</span> propwise</Link></div><section className="auth-card"><p className="eyebrow">WELCOME BACK</p><h1>Sign in to Propwise</h1><p className="auth-copy">Manage your properties and keep every request moving.</p><form onSubmit={submit}><label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required /></label>{error && <p className="auth-error" role="alert">{error}</p>}<div className="auth-row"><label className="remember"><input type="checkbox" defaultChecked /> Remember me</label><Link to="/forgot-password">Forgot password?</Link></div><button className="primary-button auth-submit" type="submit" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in'}</button></form><div className="demo-accounts"><strong>Demo accounts (password: demo123)</strong><button type="button" onClick={() => { setEmail('manager@propwise.test'); setPassword('demo123') }}>Manager</button><button type="button" onClick={() => { setEmail('admin@propwise.test'); setPassword('demo123') }}>Admin</button><button type="button" onClick={() => { setEmail('tenant@propwise.test'); setPassword('demo123') }}>Tenant</button><button type="button" onClick={() => { setEmail('staff@propwise.test'); setPassword('demo123') }}>Staff</button></div></section></div>
}

function RecoveryPage({ reset = false }: { reset?: boolean }) {
  return <div className="auth-page"><div className="auth-brand"><Link className="landing-brand" to="/"><span className="brand-mark">P</span> propwise</Link></div><section className="auth-card"><p className="eyebrow">{reset ? 'SET A NEW PASSWORD' : 'ACCOUNT RECOVERY'}</p><h1>{reset ? 'Reset your password' : 'Forgot your password?'}</h1><p className="auth-copy">{reset ? 'Choose a strong password for your Propwise account.' : 'Enter your email and we will send a secure reset link.'}</p><form onSubmit={(event) => event.preventDefault()}><label>{reset ? 'New password' : 'Email address'}<input type={reset ? 'password' : 'email'} required /></label>{reset && <label>Confirm password<input type="password" required /></label>}<button className="primary-button auth-submit" type="submit">{reset ? 'Update password' : 'Send reset link'}</button></form><Link className="back-link" to="/login">Back to sign in</Link></section></div>
}

function AccessDeniedPage() {
  const navigate = useNavigate()
  const { user, switchRole, rolePath } = useAuth()

  return (
    <div className="placeholder-page">
      <Link className="landing-brand" to="/"><span className="brand-mark">P</span> propwise</Link>
      <p className="eyebrow" style={{ marginTop: 40 }}>SECURITY CONTROL</p>
      <h1 style={{ marginTop: 10 }}>Access Restricted</h1>
      <p>This workspace page requires a different role account ({user ? `Current account: ${getRoleLabel(user.role)}` : 'Not signed in'}).</p>

      <div className="role-switch-row" style={{ maxWidth: 550, margin: '20px 0' }}>
        <strong style={{ width: '100%', fontSize: 12, color: '#403c53' }}>Switch account to view page:</strong>
        <button className="role-switch-btn" type="button" onClick={() => { switchRole('PROPERTY_MANAGER'); navigate('/manager/dashboard') }}>👔 Manager Account</button>
        <button className="role-switch-btn" type="button" onClick={() => { switchRole('SUPER_ADMIN'); navigate('/admin/dashboard') }}>👑 Admin Account</button>
        <button className="role-switch-btn" type="button" onClick={() => { switchRole('TENANT'); navigate('/tenant/dashboard') }}>🏠 Tenant Account</button>
        <button className="role-switch-btn" type="button" onClick={() => { switchRole('STAFF'); navigate('/staff/dashboard') }}>🛠️ Staff Account</button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
        <button className="primary-button" type="button" onClick={() => navigate(user ? rolePath(user.role) : '/login')}>Return to Dashboard</button>
        <Link className="secondary-button" to="/" style={{ display: 'inline-flex', alignItems: 'center' }}>Go to Home</Link>
      </div>
      <QuickPageNavigator />
    </div>
  )
}

function ProtectedRoute({ roles, children }: { roles?: Role[]; children: ReactElement }) {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  if (roles && !roles.includes(user.role) && user.role !== 'SUPER_ADMIN') return <Navigate to="/unauthorized" replace />
  return children
}

function ProfilePage() {
  const { user, logout, updateUser } = useAuth()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [emailUpdates, setEmailUpdates] = useState(user?.preferences?.emailUpdates ?? true)
  const [saved, setSaved] = useState(false)
  if (!user) return <Navigate to="/login" replace />
  const saveProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    updateUser({ name: name.trim(), email: email.trim().toLowerCase(), phone: phone.trim(), preferences: { emailUpdates } })
    setEditing(false)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2500)
  }
  return (
    <div className="profile-page">
      <Link className="landing-brand" to="/manager/dashboard"><span className="brand-mark">P</span> propwise</Link>
      <section className="profile-card">
        <div className="profile-header"><div className="avatar profile-avatar">{user.name.slice(0, 2).toUpperCase()}</div><div><p className="eyebrow">YOUR PROFILE</p><h1>{user.name}</h1><span className="role-pill">{getRoleLabel(user.role)}</span></div></div>
        {saved && <p className="profile-success" role="status">Profile updated successfully.</p>}
        {editing ? (
          <form className="profile-form" onSubmit={saveProfile}>
            <label>Full name<input value={name} onChange={(event) => setName(event.target.value)} required /></label>
            <label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
            <label>Phone number<input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Optional" /></label>
            <label className="profile-check"><input type="checkbox" checked={emailUpdates} onChange={(event) => setEmailUpdates(event.target.checked)} /> Receive email updates</label>
            <div className="profile-actions"><button className="secondary-button profile-cancel" type="button" onClick={() => setEditing(false)}>Cancel</button><button className="primary-button" type="submit">Save changes</button></div>
          </form>
        ) : (
          <>
            <p className="profile-contact">{user.email}{user.phone && ` · ${user.phone}`}</p>
            <hr />
            <p><strong>Organization</strong><br />{user.organization}</p>
            <div className="profile-actions"><button className="secondary-button profile-edit" type="button" onClick={() => setEditing(true)}>Edit profile</button><button className="primary-button" type="button" onClick={() => { logout(); navigate('/login') }}>Log out</button></div>
          </>
        )}
      </section>
      <QuickPageNavigator />
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<RecoveryPage />} />
          <Route path="/reset-password" element={<RecoveryPage reset />} />
          <Route path="/unauthorized" element={<AccessDeniedPage />} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute roles={['PROPERTY_MANAGER', 'SUPER_ADMIN']}><SettingsPage /></ProtectedRoute>} />

          {/* Role dashboards */}
          <Route path="/manager/dashboard" element={<ProtectedRoute roles={['PROPERTY_MANAGER', 'SUPER_ADMIN']}><DashboardPage /></ProtectedRoute>} />
          <Route path="/admin/dashboard" element={<ProtectedRoute roles={['SUPER_ADMIN']}><AdminDashboardPage /></ProtectedRoute>} />
          <Route path="/tenant/dashboard" element={<ProtectedRoute roles={['TENANT', 'SUPER_ADMIN', 'PROPERTY_MANAGER']}><TenantDashboardPage /></ProtectedRoute>} />
          <Route path="/staff/dashboard" element={<ProtectedRoute roles={['STAFF', 'SUPER_ADMIN', 'PROPERTY_MANAGER']}><StaffDashboardPage /></ProtectedRoute>} />

          {/* Admin section routes */}
          <Route path="/admin/users" element={<ProtectedRoute roles={['SUPER_ADMIN', 'PROPERTY_MANAGER']}><RoutePlaceholder name="Users" /></ProtectedRoute>} />
          <Route path="/admin/audit" element={<ProtectedRoute roles={['SUPER_ADMIN', 'PROPERTY_MANAGER']}><RoutePlaceholder name="Audit Log" /></ProtectedRoute>} />

          {/* Tenant section routes */}
          <Route path="/tenant/maintenance" element={<ProtectedRoute roles={['TENANT', 'PROPERTY_MANAGER', 'SUPER_ADMIN']}><RoutePlaceholder name="Tenant Maintenance" /></ProtectedRoute>} />
          <Route path="/tenant/payments" element={<ProtectedRoute roles={['TENANT', 'PROPERTY_MANAGER', 'SUPER_ADMIN']}><RoutePlaceholder name="Tenant Payments" /></ProtectedRoute>} />
          <Route path="/tenant/documents" element={<ProtectedRoute roles={['TENANT', 'PROPERTY_MANAGER', 'SUPER_ADMIN']}><RoutePlaceholder name="Tenant Documents" /></ProtectedRoute>} />
          <Route path="/tenant/announcements" element={<ProtectedRoute roles={['TENANT', 'PROPERTY_MANAGER', 'SUPER_ADMIN']}><RoutePlaceholder name="Tenant Announcements" /></ProtectedRoute>} />

          {/* Staff section routes */}
          <Route path="/staff/maintenance" element={<ProtectedRoute roles={['STAFF', 'PROPERTY_MANAGER', 'SUPER_ADMIN']}><RoutePlaceholder name="Staff Maintenance" /></ProtectedRoute>} />
          <Route path="/staff/properties" element={<ProtectedRoute roles={['STAFF', 'PROPERTY_MANAGER', 'SUPER_ADMIN']}><RoutePlaceholder name="Staff Properties" /></ProtectedRoute>} />
          <Route path="/staff/schedule" element={<ProtectedRoute roles={['STAFF', 'PROPERTY_MANAGER', 'SUPER_ADMIN']}><RoutePlaceholder name="Staff Schedule" /></ProtectedRoute>} />

          {/* Manager section routes */}
          {routeNames.map((name) => (
            <Route key={name} path={`/${name.toLowerCase()}`} element={<ProtectedRoute roles={['PROPERTY_MANAGER', 'SUPER_ADMIN']}><RoutePlaceholder name={name} /></ProtectedRoute>} />
          ))}

          <Route path="*" element={<RoutePlaceholder name="Page not found" />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
