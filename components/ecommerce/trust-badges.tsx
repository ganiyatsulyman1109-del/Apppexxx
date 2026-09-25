import { ShieldCheck, CreditCard, Truck } from "lucide-react"

export function TrustBadges() {
  const badges = [
    {
      icon: ShieldCheck,
      title: "Genuine Parts",
      description: "100% authentic products",
    },
    {
      icon: CreditCard,
      title: "Secure Payment",
      description: "Safe & encrypted checkout",
    },
    {
      icon: Truck,
      title: "Fast Delivery",
      description: "Same-day delivery in Nigeria",
    },
  ]

  return (
    <section className="py-8 bg-white border-b border-[#f3f4f6]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {badges.map((badge, index) => (
            <div
              key={index}
              className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-br from-gray-50 to-white border border-[#f3f4f6] hover:shadow-md hover:scale-105 transition-all"
            >
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-md">
                <badge.icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-[#111827]">{badge.title}</h3>
                <p className="text-sm text-[#6b7280]">{badge.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
