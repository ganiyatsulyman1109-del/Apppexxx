export function getPostLoginRedirect(role: string, isOnboarded = false): string | null {
  switch (role) {
    case "business_owner":
    case "staff":
      return isOnboarded ? "/admin" : "/onboarding"
    case "platform_admin":
    case "admin":
      return "/admin"
    case "customer":
      return "/account"
    case "investor":
      return "/investor/dashboard"
    default:
      return null
  }
}

export function canAccessAdminDashboard(role: string | null | undefined): boolean {
  return role === "business_owner" ||
    role === "staff" ||
    role === "platform_admin" ||
    role === "admin"
}

export function canCompleteBusinessOnboarding(role: string | null | undefined): boolean {
  return role === "business_owner" || role === "staff"
}
