/* oxlint-disable react/only-export-components */
import { createContext, type ReactNode, useContext, useState } from 'react'

export type Role = 'SUPER_ADMIN' | 'PROPERTY_MANAGER' | 'TENANT' | 'STAFF'

export type User = {
  id: string
  name: string
  email: string
  role: Role
  organization: string
  phone?: string
  preferences?: {
    emailUpdates: boolean
  }
}

const users: Record<string, User> = {
  'manager@propwise.test': { id: 'usr_manager', name: 'Jordan Davis', email: 'manager@propwise.test', role: 'PROPERTY_MANAGER', organization: 'Propwise Management' },
  'admin@propwise.test':   { id: 'usr_admin',   name: 'Sam Rivera',   email: 'admin@propwise.test',   role: 'SUPER_ADMIN',       organization: 'Propwise Management' },
  'tenant@propwise.test':  { id: 'usr_tenant',  name: 'Maya Carter',  email: 'tenant@propwise.test',  role: 'TENANT',            organization: 'Propwise Management' },
  'staff@propwise.test':   { id: 'usr_staff',   name: 'Chris Lee',    email: 'staff@propwise.test',   role: 'STAFF',             organization: 'Propwise Management' },
}

const rolePaths: Record<Role, string> = {
  SUPER_ADMIN: '/admin/dashboard',
  PROPERTY_MANAGER: '/manager/dashboard',
  TENANT: '/tenant/dashboard',
  STAFF: '/staff/dashboard',
}

type AuthContextValue = {
  user: User | null
  login: (email: string, password: string) => { ok: boolean; error?: string; user?: User }
  switchRole: (role: Role) => { ok: boolean; error?: string; user?: User }
  updateUser: (updates: Pick<User, 'name' | 'email' | 'phone' | 'preferences'>) => void
  logout: () => void
  rolePath: (role: Role) => string
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = window.localStorage.getItem('propwise_session')
    return stored ? JSON.parse(stored) as User : null
  })

  const login = (email: string, password: string) => {
    const nextUser = users[email.trim().toLowerCase()]
    if (!nextUser || password !== 'demo123') return { ok: false, error: 'Invalid email or password. Try a demo account below.' }
    setUser(nextUser)
    window.localStorage.setItem('propwise_session', JSON.stringify(nextUser))
    return { ok: true, user: nextUser }
  }

  const switchRole = (role: Role) => {
    const roleEmails: Record<Role, string> = {
      PROPERTY_MANAGER: 'manager@propwise.test',
      SUPER_ADMIN: 'admin@propwise.test',
      TENANT: 'tenant@propwise.test',
      STAFF: 'staff@propwise.test',
    }
    return login(roleEmails[role], 'demo123')
  }

  const updateUser = (updates: Pick<User, 'name' | 'email' | 'phone' | 'preferences'>) => {
    setUser((current) => {
      if (!current) return current
      const updated = { ...current, ...updates }
      window.localStorage.setItem('propwise_session', JSON.stringify(updated))
      return updated
    })
  }

  const logout = () => {
    setUser(null)
    window.localStorage.removeItem('propwise_session')
  }

  return <AuthContext.Provider value={{ user, login, switchRole, updateUser, logout, rolePath: (role) => rolePaths[role] }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}

export function getRoleLabel(role: Role) {
  return role.replace('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export const rolePermissions: Record<Role, string[]> = {
  SUPER_ADMIN: ['dashboard:view', 'properties:manage', 'users:manage', 'reports:view'],
  PROPERTY_MANAGER: ['dashboard:view', 'properties:manage', 'tenants:view', 'maintenance:manage', 'payments:view', 'reports:view'],
  TENANT: ['dashboard:view', 'requests:create', 'payments:view'],
  STAFF: ['dashboard:view', 'maintenance:manage'],
}

export function hasPermission(role: Role, permission: string) {
  return rolePermissions[role].includes(permission)
}
