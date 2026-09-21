"use client"
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/utils/supabase'

export default function InvestorLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Email and password are required')
      return
    }
    setLoading(true)
    setError('')
    try {
      const supabase = createBrowserSupabaseClient()
      const { data, error: authError } =
        await supabase.auth.signInWithPassword({ email, password })
      if (authError) {
        setError('Invalid email or password')
        return
      }
      const { data: inv } = await supabase
        .from('investors')
        .select('id, investor_id, full_name')
        .eq('user_id', data.user.id)
        .maybeSingle()
      if (!inv) {
        setError('No investor account found for this email')
        await supabase.auth.signOut()
        return
      }
      router.push('/investor/dashboard')
    } catch {
      setError('Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-sm p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-2">Investor Portal</h1>
        <p className="text-center text-gray-500 text-sm mb-6">
          Sign in to your investor account
        </p>
        {error && (
          <p className="text-red-600 text-sm mb-4 text-center">{error}</p>
        )}
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full mt-1 border rounded-lg px-3 py-2 text-sm"
              placeholder="investor@email.com"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full mt-1 border rounded-lg px-3 py-2 text-sm"
              placeholder="Enter password"
            />
          </div>
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </div>
      </div>
    </div>
  )
}
