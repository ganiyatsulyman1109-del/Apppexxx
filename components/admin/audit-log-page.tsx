"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, CalendarIcon } from "lucide-react"
import { formatNigerianDate } from "@/lib/utils/date"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns"

interface AuditLog {
  id: string
  action_type: string
  entity_type: string
  entity_id: string
  performed_by: string
  performed_by_role: string
  before_data: any
  after_data: any
  metadata: any
  notes: string
  created_at: string
}

export function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [actionFilter, setActionFilter] = useState("all")
  const [entityFilter, setEntityFilter] = useState("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  useEffect(() => {
    fetchLogs()
  }, [page, actionFilter, entityFilter, startDate, endDate])

  const fetchLogs = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "50",
        action_type: actionFilter,
        entity_type: entityFilter,
      })
      
      if (startDate) params.set('start_date', startDate)
      if (endDate) params.set('end_date', endDate)
      
      const response = await fetch(`/api/admin/audit-logs?${params}`, {
        credentials: 'include'
      })
      
      if (!response.ok) throw new Error('Failed to fetch logs')
      
      const data = await response.json()
      setLogs(data.logs)
      setTotalPages(data.totalPages)
    } catch (error) {
      console.error("Error fetching audit logs:", error)
    } finally {
      setLoading(false)
    }
  }

  const toggleRow = (id: string) => {
    setExpandedRow(expandedRow === id ? null : id)
  }

  function renderAuditDetails(log: AuditLog) {
    const before = log.before_data || {}
    const after = log.after_data || {}
    const meta = log.metadata || {}

    const changes: string[] = []

    // Order changes
    if (before.status !== after.status && after.status)
      changes.push(`Status changed from "${before.status}" to "${after.status}"`)
    if (before.payment_status !== after.payment_status && after.payment_status)
      changes.push(`Payment status changed from "${before.payment_status}" to "${after.payment_status}"`)
    if (before.total_amount !== after.total_amount && after.total_amount)
      changes.push(`Amount changed from ₦${Number(before.total_amount||0).toLocaleString('en-NG')} to ₦${Number(after.total_amount||0).toLocaleString('en-NG')}`)

    // Debt changes
    if (before.debt !== undefined || after.debt !== undefined)
      changes.push(`Customer debt: ₦${Number(before.debt||0).toLocaleString('en-NG')} → ₦${Number(after.debt||0).toLocaleString('en-NG')}`)

    // Investor payment
    if (before.current_balance !== undefined || after.current_balance !== undefined)
      changes.push(`Investor balance: ₦${Number(before.current_balance||0).toLocaleString('en-NG')} → ₦${Number(after.current_balance||0).toLocaleString('en-NG')}`)
    if (before.total_returns_paid !== undefined || after.total_returns_paid !== undefined)
      changes.push(`Total paid to investor: ₦${Number(before.total_returns_paid||0).toLocaleString('en-NG')} → ₦${Number(after.total_returns_paid||0).toLocaleString('en-NG')}`)

    // Payment metadata
    if (meta.amount)
      changes.push(`Payment amount: ₦${Number(meta.amount||0).toLocaleString('en-NG')}`)
    if (meta.payment_method)
      changes.push(`Payment method: ${meta.payment_method}`)
    if (meta.quantity_change)
      changes.push(`Stock changed by: ${meta.quantity_change > 0 ? '+' : ''}${meta.quantity_change}`)

    if (changes.length === 0 && log.notes)
      changes.push(log.notes)

    if (changes.length === 0)
      changes.push('No detailed changes recorded')

    return changes
  }

  return (
    <div className="p-6 space-y-6 bg-background text-foreground">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Audit Log</h1>
          <p className="text-muted-foreground">Track system activities and changes</p>
        </div>
      </div>

      <div className="flex gap-4">
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by Action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="order_updated">Order Updated</SelectItem>
            <SelectItem value="order_edited">Order Edited</SelectItem>
            <SelectItem value="order_deleted">Order Deleted</SelectItem>
            <SelectItem value="easybuy_payment">EasyBuy Payment</SelectItem>
            <SelectItem value="investor_payment">Investor Payment</SelectItem>
          </SelectContent>
        </Select>

        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by Entity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Entities</SelectItem>
            <SelectItem value="order">Order</SelectItem>
            <SelectItem value="easybuy_customer">EasyBuy Customer</SelectItem>
            <SelectItem value="investor">Investor</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={e => {
              setStartDate(e.target.value)
              setPage(1)
            }}
            className="border rounded-md px-3 py-1.5 text-sm bg-background"
          />
          <span className="text-sm text-muted-foreground">to</span>
          <input
            type="date"
            value={endDate}
            onChange={e => {
              setEndDate(e.target.value)
              setPage(1)
            }}
            className="border rounded-md px-3 py-1.5 text-sm bg-background"
          />
          <button
            onClick={() => {
              setStartDate('')
              setEndDate('')
              setPage(1)
            }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        </div>
      </div>

      <Card className="bg-card border-border shadow-sm">
        <CardContent className="p-0">
          <Table className="bg-card border border-border rounded-lg overflow-hidden">
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Entity ID</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}>
                        <div className="h-4 bg-muted rounded animate-pulse" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    No logs found
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <>
                    <TableRow 
                      key={log.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleRow(log.id)}
                    >
                      <TableCell className="whitespace-nowrap">
                        {formatNigerianDate(new Date(log.created_at), 'datetime')}
                      </TableCell>
                      <TableCell className="capitalize">
                        {log.action_type.replace(/_/g, ' ')}
                      </TableCell>
                      <TableCell className="capitalize">
                        {log.entity_type.replace(/_/g, ' ')}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {log.entity_id}
                      </TableCell>
                      <TableCell className="capitalize">{log.performed_by_role}</TableCell>
                      <TableCell className="max-w-xs truncate">{log.notes || '-'}</TableCell>
                      <TableCell>
                        {expandedRow === log.id ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </TableCell>
                    </TableRow>
                    {expandedRow === log.id && (
                      <TableRow className="bg-muted/30">
                        <TableCell colSpan={7}>
                          <div className="p-4 space-y-2">
                            <p className="text-sm font-semibold mb-2">What changed:</p>
                            {renderAuditDetails(log).map((change, i) => (
                              <p key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                                <span className="text-[#2563eb] mt-0.5">•</span>
                                {change}
                              </p>
                            ))}
                            {log.notes && (
                              <p className="text-sm text-muted-foreground mt-2 pt-2 border-t">
                                Note: {log.notes}
                              </p>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Page {page} of {totalPages}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}