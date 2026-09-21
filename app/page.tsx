import { Navbar } from "@/components/ecommerce/navbar"
import { HeroSection } from "@/components/ecommerce/hero-section"
import { TrustBadges } from "@/components/ecommerce/trust-badges"
import { CategoryGrid } from "@/components/ecommerce/category-grid"
import { FeaturedProducts } from "@/components/ecommerce/featured-products"
import { Footer } from "@/components/ecommerce/footer"
import { WhatsAppButton } from "@/components/ecommerce/whatsapp-button"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <HeroSection />
      <TrustBadges />
      <CategoryGrid />
      <FeaturedProducts />
      <Footer />
      <WhatsAppButton />
    </div>
  )
}
