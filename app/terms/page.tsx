import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Terms & Conditions - Apex Enterprise",
  description: "Read our terms and conditions for shopping with Apex Enterprise.",
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-foreground mb-8 text-center">
            Terms & Conditions
          </h1>
          
          <div className="bg-card rounded-lg shadow-sm p-8 mb-8">
            <div className="prose prose-gray max-w-none">
              <p className="text-lg text-muted-foreground mb-6">
                Please read these terms and conditions carefully before using our website and purchasing 
                products from Apex Enterprise. By accessing and using our services, you agree to be 
                bound by these terms.
              </p>
              
              <p className="text-sm text-muted-foreground mb-8">
                Last updated: {new Date().toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
              
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                1. General Terms
              </h2>
              <p className="text-muted-foreground mb-6">
                By accessing and placing an order with Apex Enterprise, you confirm that you are in 
                agreement with and bound by the terms and conditions contained in this agreement. 
                These terms apply to the entire website and any email or other type of communication 
                between you and Apex Enterprise.
              </p>
              
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                2. Products and Services
              </h2>
              <p className="text-muted-foreground mb-6">
                All products and services listed on our website are subject to availability. 
                We reserve the right to discontinue any product at any time. Prices for our 
                products are subject to change without notice. We shall not be liable to you 
                or to any third-party for any modification, price change, suspension or 
                discontinuance of the service.
              </p>
              
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                3. Ordering and Payment
              </h2>
              <p className="text-muted-foreground mb-6">
                By placing an order, you agree to purchase the product(s) at the prices stated. 
                All orders are subject to acceptance and availability. We reserve the right to 
                refuse or cancel any order for any reason, including errors in pricing or 
                product information. Payment must be made in full before products are shipped.
              </p>
              
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                4. Shipping and Delivery
              </h2>
              <p className="text-muted-foreground mb-6">
                We aim to deliver products within the estimated timeframes, but delivery 
                times are not guaranteed. We are not responsible for delays caused by 
                circumstances beyond our control. Risk of loss and title for items 
                purchased pass to you upon delivery to the carrier.
              </p>
              
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                5. Returns and Refunds
              </h2>
              <p className="text-muted-foreground mb-6">
                Please refer to our Return Policy for detailed information about returns 
                and refunds. We accept returns within 14 days of delivery for eligible 
                items. Items must be unused and in original packaging. Shipping costs 
                are non-refundable unless the return is due to our error.
              </p>
              
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                6. Product Information
              </h2>
              <p className="text-muted-foreground mb-6">
                We make every effort to display product information accurately, including 
                descriptions, specifications, and images. However, we do not guarantee 
                that product information is complete, reliable, current, or error-free. 
                If a product is not as described, your sole remedy is to return it in 
                unused condition.
              </p>
              
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                7. Intellectual Property
              </h2>
              <p className="text-muted-foreground mb-6">
                All content, features, and functionality of our website, including text, 
                graphics, logos, and software, are the exclusive property of Apex Enterprise 
                and are protected by copyright, trademark, and other intellectual property laws.
              </p>
              
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                8. Limitation of Liability
              </h2>
              <p className="text-muted-foreground mb-6">
                To the maximum extent permitted by law, Apex Enterprise shall not be liable 
                for any indirect, incidental, special, consequential, or punitive damages, or any 
                loss of profits or revenues, whether incurred directly or indirectly, or any 
                loss of data, use, goodwill, or other intangible losses.
              </p>
              
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                9. Governing Law
              </h2>
              <p className="text-muted-foreground mb-6">
                These terms and conditions are governed by and construed in accordance with 
                the laws of Nigeria. Any disputes arising from these terms shall be subject 
                to the exclusive jurisdiction of the courts of Nigeria.
              </p>
              
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                10. Changes to Terms
              </h2>
              <p className="text-muted-foreground mb-6">
                We reserve the right to modify these terms and conditions at any time. 
                Changes will be effective immediately upon posting on our website. 
                Your continued use of our services after any changes constitutes 
                acceptance of the modified terms.
              </p>
              
              <div className="bg-muted rounded-lg p-6 mt-8">
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  Contact Information
                </h3>
                <p className="text-muted-foreground">
                  If you have any questions about these terms and conditions, please contact us at:<br />
                  Phone: 08135494508<br />
                  Email: hello@apexenterprise.co
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}