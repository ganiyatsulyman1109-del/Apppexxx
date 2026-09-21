import { Metadata } from "next"

export const metadata: Metadata = {
  title: "About Us - Apex Enterprise",
  description: "Learn about Apex Enterprise, your trusted car parts supplier in Nigeria.",
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
                Welcome to Apex Enterprise, your premier destination for quality car parts and accessories 
                in Nigeria. With years of experience in the automotive industry, we pride ourselves 
                on providing top-quality products and exceptional customer service.
              </p>
              
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                Our Mission
              </h2>
              <p className="text-muted-foreground mb-6">
                To be the leading supplier of automotive parts in Nigeria, offering reliable products 
                at competitive prices while maintaining the highest standards of customer satisfaction.
              </p>
              
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                What We Offer
              </h2>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-6">
                <li>Wide range of genuine and quality aftermarket parts</li>
                <li>Expert advice and technical support</li>
                <li>Competitive pricing and regular promotions</li>
                <li>Fast and reliable delivery services</li>
                <li>Professional installation services</li>
              </ul>
              
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                Our Location
              </h2>
              <p className="text-muted-foreground mb-6">
                Visit our Head Office at No. 1a Amule Road, Amule Bus stop, Ayobo, Lagos State, or our Branch at No. 608 Lagos-Abeokuta Express way, Ijaye Bus stop, Lagos State. Our knowledgeable staff is ready 
                to assist you with all your automotive needs.
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