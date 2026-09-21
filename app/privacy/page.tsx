import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Privacy Policy - Apex Enterprise",
  description: "Read our privacy policy to understand how we protect your personal information.",
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-foreground mb-8 text-center">
            Privacy Policy
          </h1>
          
          <div className="bg-card rounded-lg shadow-sm p-8 mb-8">
            <div className="prose prose-gray dark:prose-invert max-w-none">
              <p className="text-lg text-muted-foreground mb-6">
                At Apex Enterprise, we are committed to protecting your privacy and ensuring 
                the security of your personal information. This Privacy Policy explains how we 
                collect, use, and safeguard your data.
              </p>
              
              <p className="text-sm text-muted-foreground mb-8">
                Last updated: {new Date().toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
              
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                1. Information We Collect
              </h2>
              <p className="text-muted-foreground mb-6">
                We collect information you provide directly to us, such as when you create an account, 
                place an order, contact customer service, or subscribe to our newsletter. This may include:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-6">
                <li>Name, email address, phone number, and postal address</li>
                <li>Payment information (processed securely through our payment partners)</li>
                <li>Vehicle information and purchase history</li>
                <li>Communication preferences and feedback</li>
              </ul>
              
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                2. How We Use Your Information
              </h2>
              <p className="text-muted-foreground mb-6">
                We use the information we collect to:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-6">
                <li>Process and fulfill your orders</li>
                <li>Provide customer support and respond to inquiries</li>
                <li>Send order confirmations, shipping updates, and promotional offers</li>
                <li>Improve our products and services</li>
                <li>Prevent fraud and maintain security</li>
                <li>Comply with legal obligations</li>
              </ul>
              
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                3. Information Sharing
              </h2>
              <p className="text-muted-foreground mb-6">
                We do not sell or rent your personal information to third parties. We may share 
                your information with:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-6">
                <li>Service providers who assist with order fulfillment and delivery</li>
                <li>Payment processors to complete transactions</li>
                <li>Legal authorities when required by law</li>
                <li>Business partners with your consent</li>
              </ul>
              
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                4. Data Security
              </h2>
              <p className="text-muted-foreground mb-6">
                We implement appropriate security measures to protect your personal information 
                from unauthorized access, alteration, disclosure, or destruction. This includes 
                encryption, secure socket layer (SSL) technology, and regular security audits.
              </p>
              
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                5. Cookies and Tracking
              </h2>
              <p className="text-muted-foreground mb-6">
                We use cookies and similar tracking technologies to enhance your browsing experience, 
                analyze site traffic, and personalize content. You can control cookie settings 
                through your browser preferences.
              </p>
              
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                6. Your Rights
              </h2>
              <p className="text-muted-foreground mb-6">
                You have the right to:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-6">
                <li>Access your personal information</li>
                <li>Correct inaccurate information</li>
                <li>Request deletion of your data</li>
                <li>Opt-out of marketing communications</li>
                <li>Object to certain data processing activities</li>
              </ul>
              
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                7. Data Retention
              </h2>
              <p className="text-muted-foreground mb-6">
                We retain your personal information for as long as necessary to fulfill the purposes 
                outlined in this policy, unless a longer retention period is required or permitted by law. 
                Order information is retained for accounting and legal purposes.
              </p>
              
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                8. Third-Party Links
              </h2>
              <p className="text-muted-foreground mb-6">
                Our website may contain links to third-party websites. We are not responsible for 
                the privacy practices or content of these external sites. We recommend reviewing 
                the privacy policies of any third-party websites you visit.
              </p>
              
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                9. Changes to This Policy
              </h2>
              <p className="text-muted-foreground mb-6">
                We may update this Privacy Policy from time to time. Changes will be effective 
                immediately upon posting on our website. We encourage you to review this policy 
                periodically for any updates.
              </p>
              
              <div className="bg-muted rounded-lg p-6 mt-8">
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  Contact Us
                </h3>
                <p className="text-muted-foreground">
                  If you have questions about this Privacy Policy or your personal information, please contact us at:<br />
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