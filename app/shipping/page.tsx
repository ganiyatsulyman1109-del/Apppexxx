import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Shipping & Delivery - JOEBEK AUTO-MART",
  description: "Learn about our shipping and delivery policies for car parts in Nigeria.",
}

export default function ShippingPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-foreground mb-8 text-center">
            Shipping & Delivery
          </h1>
          
          <div className="bg-card rounded-lg shadow-sm p-8 mb-8">
            <div className="prose prose-gray dark:prose-invert max-w-none">
              <p className="text-lg text-muted-foreground mb-6">
                At JOEBEK AUTO-MART, we strive to provide fast and reliable delivery services 
                for all your automotive parts needs across Nigeria.
              </p>
              
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                Delivery Options
              </h2>
              <div className="space-y-4 mb-6">
                <div className="bg-muted rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Same-Day Delivery (Nigeria)
                  </h3>
                  <p className="text-muted-foreground">
                    Available for orders placed before 2 PM within major cities. 
                    Delivery details and fees will be discussed and agreed upon with the customer.
                  </p>
                </div>
                
                <div className="bg-muted rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Next-Day Delivery
                  </h3>
                  <p className="text-muted-foreground">
                    Available for major cities in Nigeria. Orders placed before 6 PM will be 
                    delivered the next business day. Delivery details and fees will be discussed.
                  </p>
                </div>
                
                <div className="bg-muted rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Standard Delivery (2-3 days)
                  </h3>
                  <p className="text-muted-foreground">
                    Available nationwide. Delivery within 2-3 business days. 
                    Delivery details and fees will be discussed and agreed upon with the customer.
                  </p>
                </div>
              </div>
              
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                Delivery Arrangements
              </h2>
              <p className="text-muted-foreground mb-6">
                All delivery arrangements, including logistics and applicable fees, will be discussed 
                directly with you after your order is confirmed to ensure the most convenient and cost-effective 
                method for your location.
              </p>
              
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                Processing Time
              </h2>
              <p className="text-muted-foreground mb-6">
                Orders are processed within 1-2 business hours during working days (Monday-Saturday, 8 AM - 6 PM). 
                Orders placed outside these hours will be processed the next business day.
              </p>
              
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                Tracking Your Order
              </h2>
              <p className="text-muted-foreground mb-6">
                Once your order is shipped, you will receive a tracking number via SMS and email. 
                You can track your delivery status through our website or contact our customer service.
              </p>
              
              <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg p-6 mt-8">
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  Important Notes
                </h3>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>Delivery times may vary during peak seasons or due to unforeseen circumstances</li>
                  <li>Large or heavy items may require special handling and additional delivery time</li>
                  <li>Someone must be available to receive the package at the delivery address</li>
                  <li>Additional fees may apply for remote locations</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}