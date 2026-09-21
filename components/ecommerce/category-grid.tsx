import Link from "next/link"
import { BatteryCharging, Filter, Cog, Disc, Zap, Droplet, Package } from "lucide-react"

const categories = [
  {
    id: "batteries",
    name: "Batteries",
    icon: BatteryCharging,
    description: "12V & 75Ah batteries",
    gradient: "from-yellow-500 to-orange-500",
  },
  {
    id: "filters",
    name: "Filters",
    icon: Filter,
    description: "Oil, air & fuel filters",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    id: "engine",
    name: "Engine Parts",
    icon: Cog,
    description: "Spark plugs & belts",
    gradient: "from-purple-500 to-pink-500",
  },
  {
    id: "brakes",
    name: "Brake Systems",
    icon: Disc,
    description: "Pads, discs & fluids",
    gradient: "from-red-500 to-orange-500",
  },
  {
    id: "electrical",
    name: "Electrical",
    icon: Zap,
    description: "Alternators & starters",
    gradient: "from-indigo-500 to-blue-500",
  },
  {
    id: "lubricants",
    name: "Lubricants",
    icon: Droplet,
    description: "Engine oils & fluids",
    gradient: "from-green-500 to-teal-500",
  },
  {
    id: "accessories",
    name: "Accessories",
    icon: Package,
    description: "Car gadgets & more",
    gradient: "from-gray-600 to-gray-800",
  },
]

export function CategoryGrid() {
  return (
    <section id="categories" className="py-16 bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Shop by Category
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Find exactly what you need for your vehicle
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/shop?category=${category.id}`}
              className="group relative overflow-hidden rounded-2xl bg-white/90 backdrop-blur-md border border-gray-200 hover:border-blue-300 shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105"
            >
              {/* Gradient Background */}
              <div className={`absolute inset-0 bg-gradient-to-br ${category.gradient} opacity-0 group-hover:opacity-10 transition-opacity`} />
              
              {/* Content */}
              <div className="relative p-6">
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${category.gradient} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform`}>
                  <category.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                  {category.name}
                </h3>
                <p className="text-sm text-gray-600">{category.description}</p>
              </div>

              {/* Hover Arrow */}
              <div className="absolute bottom-4 right-4 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
