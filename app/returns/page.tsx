import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Return Policy - Apex Enterprise",
  description: "Learn about our return policy for purchases.",
}

export default function ReturnsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-foreground mb-8 text-center">
            Return Policy
          </h1>
          
          <div className="bg-card rounded-lg shadow-sm p-8 mb-8">
            <div className="prose prose-gray max-w-none">
              <p className="text-lg text-muted-foreground mb-6">
                At Apex Enterprise, we want you to be completely satisfied with your purchase. 
                If you need to return an item, please review our return policy below.
              </p>
              
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                Return Period
              </h2>
              <p className="text-muted-foreground mb-6">
                You have 14 days from the date of delivery to return most items. Some products 
                may have different return periods, which will be clearly stated on the product page.
              </p>
              
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                Eligible Items for Return
              </h2>
              <div className="bg-green-50 bg-green-950/20 border border-green-200 border-green-800 rounded-lg p-4 mb-4">
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Items that can be returned:
                </h3>
                <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                  <li>Unused items in original packaging</li>
                  <li>Items with manufacturing defects</li>
                  <li>Wrong items delivered</li>
                  <li>Damaged items during shipping</li>
                </ul>
              </div>
              
              <div className="bg-red-50 bg-red-950/20 border border-red-200 border-red-800 rounded-lg p-4 mb-6">
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Items that cannot be returned:
                </h3>
                <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                  <li>Electrical components that have been installed</li>
                  <li>Items missing original packaging or tags</li>
                  <li>Custom-ordered or special-order items</li>
                  <li>Items damaged due to customer misuse</li>
                  <li>Clearance or final sale items</li>
                </ul>
              </div>
              
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                Return Process
              </h2>
              <ol className="list-decimal pl-6 space-y-2 text-muted-foreground mb-6">
                <li>Contact our customer service within 14 days of delivery</li>
                <li>Provide your order number and reason for return</li>
                <li>Wait for return authorization and instructions</li>
                <li>Package the item securely in original packaging</li>
                <li>Ship the item back to our store (return shipping costs may apply)</li>
                <li>Once received and inspected, we will process your refund</li>
              </ol>
              
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                Refund Policy
              </h2>
              <p className="text-muted-foreground mb-6">
                Refunds will be processed within 5-7 business days after we receive and inspect the returned item. 
                The refund will be issued to your original payment method. Shipping costs are non-refundable unless 
                the return is due to our error (wrong item or defective product).
              </p>
              
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                Exchange Policy
              </h2>
              <p className="text-muted-foreground mb-6">
                We offer exchanges for items of equal or lesser value. If you need a different item, 
                please return the original item and place a new order for the replacement.
              </p>
              
              <div className="bg-muted rounded-lg p-6 mt-8">
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  Contact for Returns
                </h3>
                <p className="text-muted-foreground">
                  For return inquiries, please contact us at:<br />
                  Phone: +234 801 234 5678<br />
                  Email: returns@apexenterprise.co<br />
                  Hours: Monday-Saturday, 8 AM - 6 PM
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}