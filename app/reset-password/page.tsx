"use client"

import { Suspense } from "react"
import ResetPasswordContent from "./reset-password-content"

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 p-4">
        <div className="w-full max-w-md">
          <div className="mb-6">
            <div className="h-4 w-20 bg-[#e5e7eb] rounded animate-pulse" />
          </div>
          <div className="h-96 bg-white rounded-lg shadow-xl animate-pulse" />
        </div>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  )
}