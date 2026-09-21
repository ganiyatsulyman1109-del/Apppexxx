/**
 * @deprecated This file contains mock data that is no longer used.
 * All ecommerce data should now be fetched from the Supabase database.
 * This file will be removed in a future cleanup.
 */
import type { EcommerceProduct, CategoryInfo } from "./ecommerce-types"

export const ECOMMERCE_PRODUCTS: EcommerceProduct[] = [
  // Batteries
  {
    id: "bat-001",
    sku: "BAT-001",
    name: "S75 Premium Car Battery",
    brand: "Bosch",
    price: 45000,
    stock: 15,
    category: "batteries",
    image: "/car-battery-bosch.jpg",
    description: "12V 75Ah high-performance battery with 3-year warranty",
    featured: true,
  },
  {
    id: "bat-002",
    sku: "BAT-002",
    name: "Freedom Battery 75Ah",
    brand: "Delco",
    price: 38000,
    stock: 8,
    category: "batteries",
    image: "/delco-car-battery.jpg",
    description: "Reliable 75Ah battery for all vehicle types",
    featured: false,
  },
  // Filters
  {
    id: "flt-001",
    sku: "FLT-001",
    name: "Oil Filter Genuine",
    brand: "Toyota",
    price: 2500,
    stock: 45,
    category: "filters",
    image: "/toyota-oil-filter.jpg",
    description: "OEM quality oil filter for Toyota vehicles",
    featured: true,
  },
  {
    id: "flt-002",
    sku: "FLT-002",
    name: "Universal Air Filter",
    brand: "Mann",
    price: 3500,
    stock: 32,
    category: "filters",
    image: "/car-air-filter.jpg",
    description: "High-flow air filter for improved engine performance",
    featured: false,
  },
  {
    id: "flt-003",
    sku: "FLT-003",
    name: "Fuel Filter Premium",
    brand: "Honda",
    price: 4200,
    stock: 18,
    category: "filters",
    image: "/honda-fuel-filter.jpg",
    description: "Genuine Honda fuel filter for optimal fuel delivery",
    featured: false,
  },
  // Engine Parts
  {
    id: "eng-001",
    sku: "ENG-001",
    name: "Spark Plug Set",
    brand: "NGK",
    price: 8500,
    stock: 25,
    category: "engine",
    image: "/spark-plugs-set-automotive.jpg",
    description: "Set of 4 platinum spark plugs for better ignition",
    featured: true,
  },
  {
    id: "eng-002",
    sku: "ENG-002",
    name: "Timing Belt Kit Complete",
    brand: "Gates",
    price: 22000,
    stock: 6,
    category: "engine",
    image: "/timing-belt-kit-car.jpg",
    description: "Complete timing belt kit with tensioners and pulleys",
    featured: true,
  },
  {
    id: "eng-003",
    sku: "ENG-003",
    name: "Engine Mount Rubber",
    brand: "Febi",
    price: 15000,
    stock: 12,
    category: "engine",
    image: "/engine-mount-automotive.jpg",
    description: "Heavy-duty engine mount for reduced vibration",
    featured: false,
  },
  // Brakes
  {
    id: "brk-001",
    sku: "BRK-001",
    name: "Front Brake Pads Ceramic",
    brand: "Brembo",
    price: 12000,
    stock: 20,
    category: "brakes",
    image: "/front-brake-pads-car.jpg",
    description: "Low-dust ceramic brake pads for superior stopping power",
    featured: true,
  },
  {
    id: "brk-002",
    sku: "BRK-002",
    name: "Rear Brake Disc Set",
    brand: "ATE",
    price: 18500,
    stock: 10,
    category: "brakes",
    image: "/rear-brake-disc-rotor.jpg",
    description: "Ventilated brake disc for better heat dissipation",
    featured: false,
  },
  // Electrical
  {
    id: "elc-001",
    sku: "ELC-001",
    name: "Alternator 90A",
    brand: "Denso",
    price: 35000,
    stock: 5,
    category: "electrical",
    image: "/car-alternator.jpg",
    description: "High-output alternator for modern vehicles",
    featured: false,
  },
  {
    id: "elc-002",
    sku: "ELC-002",
    name: "Starter Motor Heavy Duty",
    brand: "Valeo",
    price: 28000,
    stock: 7,
    category: "electrical",
    image: "/car-starter-motor.jpg",
    description: "Reliable starter motor with enhanced cranking power",
    featured: true,
  },
  // Lubricants
  {
    id: "lub-001",
    sku: "LUB-001",
    name: "1 Advanced 5W-30",
    brand: "Mobil",
    price: 18000,
    stock: 30,
    category: "lubricants",
    image: "/mobil-1-engine-oil-bottle.jpg",
    description: "4L fully synthetic engine oil for maximum protection",
    featured: true,
  },
  {
    id: "lub-002",
    sku: "LUB-002",
    name: "Helix Ultra 10W-40",
    brand: "Shell",
    price: 15000,
    stock: 35,
    category: "lubricants",
    image: "/shell-helix-engine-oil.jpg",
    description: "4L semi-synthetic engine oil for all conditions",
    featured: false,
  },
  {
    id: "lub-003",
    sku: "LUB-003",
    name: "Brake Fluid DOT4",
    brand: "Castrol",
    price: 3500,
    stock: 40,
    category: "lubricants",
    image: "/brake-fluid-dot4-bottle.jpg",
    description: "High-quality brake fluid for all brake systems",
    featured: false,
  },
  // Accessories
  {
    id: "acc-001",
    sku: "ACC-001",
    name: "Phone Holder Magnetic",
    brand: "Ugreen",
    price: 2500,
    stock: 50,
    category: "accessories",
    image: "/car-phone-holder-mount.jpg",
    description: "Strong magnetic phone holder with 360° rotation",
    featured: false,
  },
  {
    id: "acc-002",
    sku: "ACC-002",
    name: "Floor Mat Set Rubber",
    brand: "WeatherTech",
    price: 8000,
    stock: 25,
    category: "accessories",
    image: "/car-floor-mats-set.jpg",
    description: "All-weather rubber floor mats set of 4",
    featured: true,
  },
  {
    id: "acc-003",
    sku: "ACC-003",
    name: "LED Interior Light Strip",
    brand: "Philips",
    price: 4500,
    stock: 30,
    category: "accessories",
    image: "/car-led-interior-light.jpg",
    description: "RGB LED strip for interior ambient lighting",
    featured: false,
  },
]

export const CATEGORIES: CategoryInfo[] = [
  {
    id: "batteries",
    name: "Batteries",
    icon: "battery-charging",
    description: "Car batteries from trusted brands",
  },
  {
    id: "filters",
    name: "Filters",
    icon: "filter",
    description: "Oil, air, and fuel filters",
  },
  {
    id: "engine",
    name: "Engine Parts",
    icon: "cog",
    description: "Spark plugs, timing belts, and more",
  },
  {
    id: "brakes",
    name: "Brake Systems",
    icon: "disc",
    description: "Brake pads, discs, and fluids",
  },
  {
    id: "electrical",
    name: "Electrical",
    icon: "zap",
    description: "Alternators, starters, and wiring",
  },
  {
    id: "lubricants",
    name: "Lubricants",
    icon: "droplet",
    description: "Engine oils and fluids",
  },
  {
    id: "accessories",
    name: "Accessories",
    icon: "package",
    description: "Car accessories and gadgets",
  },
]

// Get featured products (8 items)
export const getFeaturedProducts = (): EcommerceProduct[] => {
  return ECOMMERCE_PRODUCTS.filter((p) => p.featured).slice(0, 8)
}

// Get products by category
export const getProductsByCategory = (category: string): EcommerceProduct[] => {
  return ECOMMERCE_PRODUCTS.filter((p) => p.category === category)
}

// Get stock status
export const getStockStatus = (stock: number): "in-stock" | "low-stock" | "out-of-stock" => {
  if (stock === 0) return "out-of-stock"
  if (stock <= 10) return "low-stock"
  return "in-stock"
}
