import { Metadata } from "next"

export const metadata: Metadata = {
  title: "About Us - Apex Enterprise",
  description: "Learn about Apex Enterprise and our quality products and services.",
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-foreground mb-8 text-center">
            About Apex Enterprise
          </h1>
          
          <div className="bg-card rounded-lg shadow-sm p-8 mb-8">
            <div className="prose prose-gray dark:prose-invert max-w-none">
              <p className="text-lg text-muted-foreground mb-6">
                Welcome to Apex Enterprise, your destination for quality everyday essentials and trusted products.
                We are committed to making shopping simple, convenient, and dependable for every customer.
              </p>
              
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                Our Mission
              </h2>
              <p className="text-muted-foreground mb-6">
                To deliver reliable products and excellent service at competitive prices while helping customers
                find what they need quickly and confidently.
              </p>
              
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                What We Offer
              </h2>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-6">
                <li>Curated products from trusted brands</li>
                <li>Simple, customer-friendly shopping experience</li>
                <li>Competitive pricing and regular offers</li>
                <li>Fast and reliable delivery services</li>
                <li>Friendly customer support</li>
              </ul>
              
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                Our Location
              </h2>
              <p className="text-muted-foreground mb-6">
                Visit our Head Office at No. 1a Amule Road, Amule Bus stop, Ayobo, Lagos State, or our Branch at No. 608 Lagos-Abeokuta Express way, Ijaye Bus stop, Lagos State. Our team is ready to assist with your orders and product questions.
              </p>
              
              <div className="bg-muted rounded-lg p-6 mt-8">
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  Contact Information
                </h3>
                <p className="text-muted-foreground">
                  Phone: 08135494508<br />
                  Email: hello@apexenterprise.co<br />
                  Head Office: No. 1a Amule Road, Amule Bus stop, Ayobo, Lagos State<br />
                  Branch: No. 608 Lagos-Abeokuta Express way, Ijaye Bus stop, Lagos State
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}