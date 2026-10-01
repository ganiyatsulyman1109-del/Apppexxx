"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/utils/supabase'
import { BrandLogo } from "@/components/brand-logo"

export default function InvestorDashboard() {
  const router = useRouter()
  const [investor, setInvestor] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const supabase = createBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/investor/login')
        return
      }
      
      // We should use the API to get the fully synced investor data
      // which calculates returns properly like the admin page does
      try {
        const response = await fetch(`/api/investors/${session.user.id}/returns`)
        if (response.ok) {
          const data = await response.json()
          if (data.investor) {
            setInvestor(data.investor)
            setLoading(false)
            return
          }
        }
      } catch (e) {
        console.error("Error fetching investor details", e)
      }
      
      // Fallback to direct supabase query if API fails
      const { data: inv } = await supabase
        .from('investors')
        .select('id, business_id, user_id, full_name, email, phone, principal_amount, return_rate, tenure_months, start_date, end_date, status, is_banned, total_returns_earned, total_returns_paid, current_balance')
        .eq('user_id', session.user.id)
        .maybeSingle()
      if (!inv) {
        router.push('/investor/login')
        return
      }
      setInvestor({
        ...inv,
        name: inv.full_name,
        investor_id: inv.id,
        investment_amount: inv.principal_amount,
        annual_return_rate: inv.return_rate,
        daily_return_rate: Number(inv.return_rate || 0) / 365,
        investment_date: inv.start_date,
        status: inv.status === 'active' && inv.is_banned ? 'inactive' : inv.status,
      })
      setLoading(false)
    }
    init()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <BrandLogo size={64} className="animate-spin" priority />
      </div>
    )
  }

  const fmt = (n: any) => Number(n || 0).toLocaleString('en-NG')

  return (
    <div className="min-h-screen bg-[#f9fafb] p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Welcome, {investor?.full_name}</h1>
            <p className="text-[#f9fafb]0 text-sm">Investor ID: {investor?.id}</p>
          </div>
          <button
            onClick={async () => {
              const supabase = createBrowserClient()
              await supabase.auth.signOut()
              router.push('/investor/login')
            }}
            className="text-sm text-[#f9fafb]0 hover:text-[#374151] border rounded-lg px-3 py-1.5"
          >
            Sign Out
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <p className="text-sm text-[#f9fafb]0 mb-1">Investment Amount</p>
            <p className="text-2xl font-bold text-blue-600">
              &#8358;{fmt(investor?.investment_amount)}
            </p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <p className="text-sm text-[#f9fafb]0 mb-1">Total Returns Earned</p>
            <p className="text-2xl font-bold text-green-600">
              &#8358;{fmt(investor?.total_returns_earned)}
            </p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <p className="text-sm text-[#f9fafb]0 mb-1">Current Balance</p>
            <p className="text-2xl font-bold text-[#d97706]">
              &#8358;{fmt(investor?.current_balance)}
            </p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <p className="text-sm text-[#f9fafb]0 mb-1">Total Paid Out</p>
            <p className="text-2xl font-bold text-purple-600">
              &#8358;{fmt(investor?.total_returns_paid)}
            </p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <p className="text-sm text-[#f9fafb]0 mb-1">Annual Return Rate</p>
            <p className="text-2xl font-bold text-[#1f2937]">
              {investor?.annual_return_rate}%
            </p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <p className="text-sm text-[#f9fafb]0 mb-1">Investment Period</p>
            <p className="text-2xl font-bold text-[#1f2937]">
              {investor?.start_date} – {investor?.end_date}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
