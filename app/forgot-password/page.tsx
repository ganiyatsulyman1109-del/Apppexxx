"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Mail, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createServerSupabaseClient } from "@/lib/utils/supabase"
import { BrandLogo } from "@/components/brand-logo"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email) {
      setError("Please enter your email address")
      return
    }

    setIsLoading(true)
    setError("")

    try {
      const supabase = createServerSupabaseClient()
      
      // Check if user exists and has admin or investor role
      const { data: userData, error: userError } = await supabase
        .from('user_roles')
        .select(`
          user_id,
          role,
          profiles!inner(
            email
          )
        `)
        .eq('profiles.email', email)
        .in('role', ['admin', 'investor'])
        .single()

      if (userError || !userData) {
        setError("No admin or investor account found with this email address")
        return
      }

      // Send password reset email
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (resetError) {
        setError("Failed to send reset email. Please try again.")
        return
      }

      setSuccess(true)
    } catch (err) {
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 p-4">
        <div className="w-full max-w-md">
          <div className="mb-6">
            <Link href="/" className="inline-flex items-center text-sm text-blue-600 hover:underline">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Home
            </Link>
          </div>
          
          <Card className="w-full shadow-xl">
            <CardHeader className="text-center space-y-4">
              <BrandLogo size={64} className="mx-auto rounded-full" />
              <div>
                <CardTitle className="text-2xl font-bold text-blue-900">Check Your Email</CardTitle>
                <CardDescription className="text-lg mt-1">
                  Password reset instructions have been sent to your email
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-center space-y-4">
                <p className="text-sm text-muted-foreground">
                  We've sent a password reset link to <strong>{email}</strong>. 
                  Please check your email and click the link to reset your password.
                </p>
                <p className="text-xs text-muted-foreground">
                  The link will expire in 1 hour for security reasons.
                </p>
                <div className="pt-4">
                  <Button 
                    onClick={() => router.push("/")}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    Return to Home
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center text-sm text-blue-600 hover:underline">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Home
          </Link>
        </div>
        
        <Card className="w-full shadow-xl">
          <CardHeader className="text-center space-y-4">
            <BrandLogo size={64} className="mx-auto rounded-full" />
            <div>
              <CardTitle className="text-2xl font-bold text-blue-900">Apex Enterprise</CardTitle>
              <CardDescription className="text-lg mt-1">Reset Your Password</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-11"
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                  {error}
                </div>
              )}

              <div className="text-sm text-muted-foreground">
                <p>Enter your email address and we'll send you a link to reset your password.</p>
                <p className="mt-2 text-xs">
                  <strong>Note:</strong> This is only available for admin and investor accounts.
                </p>
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white"
                disabled={isLoading || !email}
              >
                {isLoading ? "Sending..." : "Send Reset Link"}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Remember your password?{" "}
                <Link href="/admin" className="text-blue-600 hover:underline">
                  Admin Login
                </Link>
                {" "}or{" "}
                <Link href="/investor" className="text-blue-600 hover:underline">
                  Investor Login
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
