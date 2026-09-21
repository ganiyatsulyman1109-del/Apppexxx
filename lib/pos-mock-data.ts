/**
 * @deprecated This file contains mock data that is no longer used.
 * All POS data should now be fetched from the Supabase database.
 * This file will be removed in a future cleanup.
 */
import type { Product, Sale, DailyStats } from "./pos-types"

export const MOCK_PRODUCTS: Product[] = [
  // Batteries
  {
    id: "bat-001",
    name: "Bosch 12V Car Battery",
    sku: "BAT-BOSCH-12V",
    price: 45000,
    stock: 15,
    category: "batteries",
    image: "/car-battery-bosch.jpg",
  },
  {
    id: "bat-002",
    name: "Delco 75Ah Battery",
    sku: "BAT-DELCO-75",
    price: 38000,
    stock: 8,
    category: "batteries",
    image: "/delco-car-battery.jpg",
  },
  // Filters
  {
    id: "flt-001",
    name: "Toyota Oil Filter",
    sku: "FLT-TOY-OIL",
    price: 2500,
    stock: 45,
    category: "filters",
    image: "/toyota-oil-filter.jpg",
  },
  {
    id: "flt-002",
    name: "Universal Air Filter",
    sku: "FLT-UNI-AIR",
    price: 3500,
    stock: 32,
    category: "filters",
    image: "/car-air-filter.jpg",
  },
  {
    id: "flt-003",
    name: "Honda Fuel Filter",
    sku: "FLT-HON-FUEL",
    price: 4200,
    stock: 18,
    category: "filters",
    image: "/honda-fuel-filter.jpg",
  },
  // Engine Parts
  {
    id: "eng-001",
    name: "Spark Plug Set (4pc)",
    sku: "ENG-SPARK-4",
    price: 8500,
    stock: 25,
    category: "engine",
    image: "/spark-plugs-set-automotive.jpg",
  },
  {
    id: "eng-002",
    name: "Timing Belt Kit",
    sku: "ENG-TIM-KIT",
    price: 22000,
    stock: 6,
    category: "engine",
    image: "/timing-belt-kit-car.jpg",
  },
  {
    id: "eng-003",
    name: "Engine Mount",
    sku: "ENG-MOUNT-01",
    price: 15000,
    stock: 12,
    category: "engine",
    image: "/engine-mount-automotive.jpg",
  },
  // Brakes
  {
    id: "brk-001",
    name: "Front Brake Pads",
    sku: "BRK-PAD-FRT",
    price: 12000,
    stock: 20,
    category: "brakes",
    image: "/front-brake-pads-car.jpg",
  },
  {
    id: "brk-002",
    name: "Rear Brake Disc",
    sku: "BRK-DSC-RER",
    price: 18500,
    stock: 10,
    category: "brakes",
    image: "/rear-brake-disc-rotor.jpg",
  },
  // Electrical
  {
    id: "elc-001",
    name: "Alternator Universal",
    sku: "ELC-ALT-UNI",
    price: 35000,
    stock: 5,
    category: "electrical",
    image: "/car-alternator.jpg",
  },
  {
    id: "elc-002",
    name: "Starter Motor",
    sku: "ELC-START-01",
    price: 28000,
    stock: 7,
    category: "electrical",
    image: "/car-starter-motor.jpg",
  },
  // Lubricants
  {
    id: "lub-001",
    name: "Mobil 1 5W-30 (4L)",
    sku: "LUB-MOB-5W30",
    price: 18000,
    stock: 30,
    category: "lubricants",
    image: "/mobil-1-engine-oil-bottle.jpg",
  },
  {
    id: "lub-002",
    name: "Shell Helix 10W-40 (4L)",
    sku: "LUB-SHL-10W40",
    price: 15000,
    stock: 35,
    category: "lubricants",
    image: "/shell-helix-engine-oil.jpg",
  },
  {
    id: "lub-003",
    name: "Brake Fluid DOT4",
    sku: "LUB-BRK-DOT4",
    price: 3500,
    stock: 40,
    category: "lubricants",
    image: "/brake-fluid-dot4-bottle.jpg",
  },
  // Accessories
  {
    id: "acc-001",
    name: "Car Phone Holder",
    sku: "ACC-PHN-HLD",
    price: 2500,
    stock: 50,
    category: "accessories",
    image: "/car-phone-holder-mount.jpg",
  },
  {
    id: "acc-002",
    name: "Floor Mat Set",
    sku: "ACC-MAT-SET",
    price: 8000,
    stock: 25,
    category: "accessories",
    image: "/car-floor-mats-set.jpg",
  },
  {
    id: "acc-003",
    name: "LED Interior Light",
    sku: "ACC-LED-INT",
    price: 4500,
    stock: 30,
    category: "accessories",
    image: "/car-led-interior-light.jpg",
  },
]

export const MOCK_SALES: Sale[] = []

export const MOCK_STATS: DailyStats = {
  cashCollected: 0,
  posTransfer: 0,
  easyBuyCredit: 0,
  totalSales: 0,
  itemsSold: 0,
}
