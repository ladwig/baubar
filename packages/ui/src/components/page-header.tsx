import * as React from 'react'
import { cn } from '../lib/utils'

interface PageHeaderProps {
  title: string
  description?: string
  breadcrumb?: React.ReactNode
  action?: React.ReactNode
  className?: string
}

export function PageHeader({ title, description, breadcrumb, action, className }: PageHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between', className)}>
      <div className="flex flex-col gap-1">
        {breadcrumb && <div className="text-xs text-zinc-400">{breadcrumb}</div>}
        <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">{title}</h1>
        {description && <p className="text-sm text-zinc-500">{description}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}
