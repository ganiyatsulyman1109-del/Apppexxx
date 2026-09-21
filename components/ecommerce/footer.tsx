import Link from "next/link"
import { Phone, Mail, MapPin, Facebook, Instagram, Twitter } from "lucide-react"
import { BrandLogo } from "@/components/brand-logo"

export function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <BrandLogo size={40} className="rounded-xl" />
              <div>
                <div className="font-bold text-white text-lg leading-none">Apex</div>
                <div className="text-xs text-gray-400">Enterprise</div>
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              Your trusted partner for quality products and everyday essentials.
            </p>
            <div className="flex gap-3">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-gray-800 hover:bg-blue-600 flex items-center justify-center transition-colors"
              >
                <Facebook className="w-5 h-5" />
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-gray-800 hover:bg-pink-600 flex items-center justify-center transition-colors"
              >
                <Instagram className="w-5 h-5" />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-gray-800 hover:bg-blue-400 flex items-center justify-center transition-colors"
              >
                <Twitter className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold text-white mb-4">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/shop" className="hover:text-[#2563eb] transition-colors">
                  Shop All Products
                </Link>
              </li>
              <li>
                <Link href="/shop?category=electronics" className="hover:text-[#2563eb] transition-colors">
                  Electronics
                </Link>
              </li>
              <li>
                <Link href="/shop?category=fashion" className="hover:text-[#2563eb] transition-colors">
                  Fashion
                </Link>
              </li>
              <li>
                <Link href="/shop?category=home-office" className="hover:text-[#2563eb] transition-colors">
                  Home & Office
                </Link>
              </li>
            </ul>
          </div>

          {/* Customer Service */}
          <div>
            <h3 className="font-semibold text-white mb-4">Customer Service</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/about" className="hover:text-[#2563eb] transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/shipping" className="hover:text-[#2563eb] transition-colors">
                  Shipping & Delivery
                </Link>
              </li>
              <li>
                <Link href="/returns" className="hover:text-[#2563eb] transition-colors">
                  Return Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-[#2563eb] transition-colors">
                  Terms & Conditions
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-[#2563eb] transition-colors">
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="font-semibold text-white mb-4">Contact Us</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <MapPin className="w-4 h-4 mt-1 flex-shrink-0 text-[#2563eb]" />
                <div className="flex flex-col gap-1">
                  <span>HQ: No. 1a Amule Road, Amule Bus stop, Ayobo, Lagos State</span>
                  <span>Branch: No. 608 Lagos-Abeokuta Express way, Ijaye Bus stop, Lagos State</span>
                </div>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4 flex-shrink-0 text-[#2563eb]" />
                <a href="tel:08135494508" className="hover:text-[#2563eb] transition-colors">
                  08135494508
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 flex-shrink-0 text-[#2563eb]" />
                <a href="mailto:hello@apexenterprise.co" className="hover:text-[#2563eb] transition-colors">
                  hello@apexenterprise.co
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-gray-800 text-center text-sm text-gray-400">
          <p>© 2026 Apex Enterprise. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
