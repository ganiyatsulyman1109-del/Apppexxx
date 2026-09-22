"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { Search, AlertCircle, FileSpreadsheet } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { DatePicker } from "@/components/ui/date-picker"
import { format } from "date-fns"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { createBrowserClient } from "@/lib/utils/supabase"
import { formatCurrency } from "@/lib/admin-types"

type TransactionRow = {
  id: string
  date: string
  type: 'pos_sale' | 'easybuy_sale' | 'easybuy_payment' | 'ecommerce'
  label: string
  amount: number
  paymentMethod: string
  status: string
  reference: string
}

const typeLabel = (type: string) => { 
  switch(type) { 
    case 'pos_sale': return 'POS Sale' 
    case 'easybuy_sale': return 'EasyBuy Credit Sale' 
    case 'easybuy_payment': return 'EasyBuy Payment' 
    default: return type 
  } 
}

import { toNigeriaDateTime } from "@/lib/utils/date"

export function POSTransactionHistory() {
  const channelNameRef = useRef(`pos-transactions-${Math.random().toString(36).slice(2)}`)
  const [transactions, setTransactions] = useState<TransactionRow[]>([])
  const [easybuyCreditSales, setEasybuyCreditSales] = useState<TransactionRow[]>([])
  const [summary, setSummary] = useState({ posTotal: 0, easyBuyPaymentsTotal: 0, combinedTotal: 0 })
  const [filteredTransactions, setFilteredTransactions] = useState<TransactionRow[]>([])
  const [filteredEasybuyCreditSales, setFilteredEasybuyCreditSales] = useState<TransactionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [period, setPeriod] = useState("today")
  const [searchQuery, setSearchQuery] = useState("")
  const [customStart, setCustomStart] = useState("")
  const [customEnd, setCustomEnd] = useState("")
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      let url = `/api/pos/transactions?period=${period}`
      if (period === 'custom' && customStart && customEnd) {
        url += `&start=${customStart}&end=${customEnd}`
      }

      const res = await fetch(url, { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to fetch transactions')
      
      const data = await res.json()
      setTransactions(data.transactions || [])
      setEasybuyCreditSales(data.easybuy_credit_sales || [])
      setSummary(data.summary || { posTotal: 0, easyBuyPaymentsTotal: 0, combinedTotal: 0 })
      
    } catch (err: unknown) {
      setError(err instanceof Error ? (err.message?.includes('duplicate') ? 'This record already exists' : err.message?.includes('not found') ? 'Record not found' : err.message?.includes('constraint') ? 'This action could not be completed' : 'An error occurred. Please try again.') : 'Failed to fetch transactions')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [period, customStart, customEnd])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  useEffect(() => {
    let result = transactions
    let easybuyResult = easybuyCreditSales

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(t => 
        t.label.toLowerCase().includes(q) || 
        t.reference.toLowerCase().includes(q)
      )
      easybuyResult = easybuyResult.filter(t =>
        t.label.toLowerCase().includes(q) ||
        t.reference.toLowerCase().includes(q)
      )
    }

    // Sort oldest to newest
    result = [...result].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    easybuyResult = [...easybuyResult].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    setFilteredTransactions(result)
    setFilteredEasybuyCreditSales(easybuyResult)
    setCurrentPage(1)
  }, [transactions, easybuyCreditSales, searchQuery])

  // Realtime subscription
  useEffect(() => {
    const supabase = createBrowserClient()
    const handleWindowFocus = () => {
      fetchTransactions()
    }
    const pollInterval = window.setInterval(() => {
      fetchTransactions()
    }, 15000)
    
    const channel = supabase
      .channel(channelNameRef.current)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => fetchTransactions()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "easybuy_payments" },
        () => fetchTransactions()
      )
      .subscribe()

    window.addEventListener("focus", handleWindowFocus)

    return () => {
      window.clearInterval(pollInterval)
      window.removeEventListener("focus", handleWindowFocus)
      supabase.removeChannel(channel)
    }
  }, [fetchTransactions])

  const formatTransactionDate = (date: string) => {
    return toNigeriaDateTime(date)
  }

  const handleExportCSV = () => {
    const headers = ['Date', 'Type', 'Reference', 'Customer', 'Method', 'Amount']
    const rows = filteredTransactions.map(t => [
      formatTransactionDate(t.date),
      typeLabel(t.type),
      t.reference,
      `"${t.label}"`,
      t.paymentMethod,
      t.amount
    ])
    
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pos-transactions-${period}-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const posSalesTotal = summary.posTotal
  const easybuyPaymentsTotal = summary.easyBuyPaymentsTotal
  const totalCollected = summary.combinedTotal

  // Paginate data
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage)
  const paginatedData = filteredTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Transaction History</h2>
          <p className="text-muted-foreground">View POS sales and EasyBuy payments received</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExportCSV} disabled={filteredTransactions.length === 0}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Main Transactions</CardTitle>
          <CardDescription>POS sales and EasyBuy payments received</CardDescription>
          <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search reference or customer..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            
            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1">
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Select Period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="year">This Year</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>

              {period === 'custom' && (
                <div className="flex items-center gap-2">
                  <DatePicker
                    date={customStart ? new Date(customStart) : undefined}
                    setDate={(date) => setCustomStart(date ? format(date, "yyyy-MM-dd") : "")}
                    className="w-[140px]"
                    placeholder="Start date"
                  />
                  <span>-</span>
                  <DatePicker
                    date={customEnd ? new Date(customEnd) : undefined}
                    setDate={(date) => setCustomEnd(date ? format(date, "yyyy-MM-dd") : "")}
                    className="w-[140px]"
                    placeholder="End date"
                  />
                </div>
              )}
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing <span className="font-medium text-foreground">{filteredTransactions.length}</span> transactions
            </div>
            <div className="text-sm font-medium text-right">
              <div>POS Sales: <span className="text-foreground">{formatCurrency(posSalesTotal)}</span></div>
              <div>EasyBuy Payments: <span className="text-foreground">{formatCurrency(easybuyPaymentsTotal)}</span></div>
              <div>Total Collected: <span className="text-lg text-primary">{formatCurrency(totalCollected)}</span></div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          {error && (
            <div className="m-4 p-4 rounded-md bg-destructive/10 text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          <div className="rounded-md border-y">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><div className="h-4 w-4 bg-muted animate-pulse rounded" /></TableCell>
                      <TableCell><div className="h-4 w-24 bg-muted animate-pulse rounded" /></TableCell>
                      <TableCell><div className="h-4 w-20 bg-muted animate-pulse rounded" /></TableCell>
                      <TableCell><div className="h-4 w-32 bg-muted animate-pulse rounded" /></TableCell>
                      <TableCell><div className="h-4 w-24 bg-muted animate-pulse rounded" /></TableCell>
                      <TableCell><div className="h-4 w-16 bg-muted animate-pulse rounded" /></TableCell>
                      <TableCell><div className="h-4 w-20 bg-muted animate-pulse rounded ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : paginatedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      No transactions found for the selected period.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedData.map((tx) => (
                    <React.Fragment key={tx.id}>
                    <TableRow>
                      <TableCell>
                        <button onClick={() => setExpandedRow(expandedRow === tx.id ? null : tx.id)} className="text-muted-foreground hover:text-foreground">
                          {expandedRow === tx.id ? '▲' : '▼'}
                        </button>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatTransactionDate(tx.date)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          tx.type === 'pos_sale' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          tx.type === 'easybuy_sale' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                          'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }>
                          {typeLabel(tx.type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{tx.reference}</TableCell>
                      <TableCell>{tx.label}</TableCell>
                      <TableCell className="capitalize">{tx.paymentMethod?.replace('_', ' ')}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(tx.amount)}</TableCell>
                    </TableRow>
                    {expandedRow === tx.id && (
                      <TableRow>
                        <TableCell colSpan={7} className="px-4 py-3 bg-muted/30">
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground block text-xs">Customer</span>
                              <span className="font-medium">{tx.label}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-xs">Method</span>
                              <span className="font-medium capitalize">{tx.paymentMethod?.replace('_', ' ')}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-xs">Reference</span>
                              <span className="font-mono text-xs">{tx.reference}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-xs">Amount</span>
                              <span className="font-medium text-green-600">₦{tx.amount.toLocaleString('en-NG')}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-xs">Date</span>
                              <span className="font-medium">{formatTransactionDate(tx.date)}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-xs">Type</span>
                              <span className="font-medium">
                                {typeLabel(tx.type)}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                    </React.Fragment>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {!loading && filteredTransactions.length > 0 && (
            <div className="p-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>EasyBuy Credit Sales - For Reference Only</CardTitle>
          <CardDescription>These are credit sales not yet paid. They are excluded from Total Collected.</CardDescription>
          <div className="text-sm text-muted-foreground">
            Showing <span className="font-medium text-foreground">{filteredEasybuyCreditSales.length}</span> credit sales
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="rounded-md border-y">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><div className="h-4 w-24 bg-muted animate-pulse rounded" /></TableCell>
                      <TableCell><div className="h-4 w-20 bg-muted animate-pulse rounded" /></TableCell>
                      <TableCell><div className="h-4 w-32 bg-muted animate-pulse rounded" /></TableCell>
                      <TableCell><div className="h-4 w-24 bg-muted animate-pulse rounded" /></TableCell>
                      <TableCell><div className="h-4 w-16 bg-muted animate-pulse rounded" /></TableCell>
                      <TableCell><div className="h-4 w-20 bg-muted animate-pulse rounded ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredEasybuyCreditSales.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      No EasyBuy credit sales found for the selected period.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEasybuyCreditSales.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell className="text-sm">{formatTransactionDate(transaction.date)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                          {typeLabel(transaction.type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{transaction.reference}</TableCell>
                      <TableCell>{transaction.label}</TableCell>
                      <TableCell className="capitalize">{transaction.paymentMethod?.replace('_', ' ')}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(transaction.amount)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
