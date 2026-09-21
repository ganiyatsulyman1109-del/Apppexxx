import { Resend } from 'resend'

// Lazy initialize Resend with API key from environment variables
let resendClient: Resend | null = null

function getResendClient(): Resend | null {
  if (!resendClient && process.env.RESEND_API_KEY) {
    resendClient = new Resend(process.env.RESEND_API_KEY)
  }
  return resendClient
}

// Configuration for email sender and branding
const EMAIL_CONFIG = {
  from: 'Apex Enterprise <onboarding@resend.dev>',
  replyTo: 'hello@apexenterprise.co',
  brandName: 'Apex Enterprise',
  phone: '08135494508',
  email: 'hello@apexenterprise.co',
  address: 'HQ: No. 1a Amule Road, Amule Bus stop, Ayobo, Lagos State | Branch: No. 608 Lagos-Abeokuta Express way, Ijaye Bus stop, Lagos State',
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '08135494508'
}

/**
 * Helper to generate common email styles and footer
 */
const getEmailTemplate = (content: string, title: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .header { background-color: #1a1a1a; color: #ffffff; padding: 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 1px; }
    .content { padding: 30px; }
    .footer { background-color: #f9f9f9; padding: 20px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #eee; }
    .button { display: inline-block; padding: 12px 24px; background-color: #f97316; color: #ffffff; text-decoration: none; border-radius: 4px; font-weight: bold; margin-top: 20px; }
    .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .table th { text-align: left; padding: 10px; border-bottom: 2px solid #eee; color: #666; font-size: 14px; }
    .table td { padding: 10px; border-bottom: 1px solid #eee; }
    .total-row td { font-weight: bold; border-top: 2px solid #333; border-bottom: none; font-size: 16px; }
    .highlight { color: #f97316; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${EMAIL_CONFIG.brandName}</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p style="margin: 0 0 8px 0;"><strong>${EMAIL_CONFIG.address}</strong></p>
      <p style="margin: 0 0 8px 0;">📞 Phone: ${EMAIL_CONFIG.phone} | 📧 Email: ${EMAIL_CONFIG.email}</p>
      <p style="margin: 0;">© 2026 ${EMAIL_CONFIG.brandName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`

/**
 * Send order confirmation email to customer
 */
export async function sendOrderConfirmationToCustomer(order: {
  order_number: string
  items: any[]
  total_amount: number
  shipping_address: any
  customer_email: string
  customer_name?: string
}) {
  try {
    if (!order.customer_email) {
      console.error('Skipping customer email: No email provided')
      return { success: false, error: 'No email provided' }
    }

    const { order_number, items, total_amount, shipping_address, customer_email, customer_name } = order
    const name = customer_name || 'Valued Customer'
    
    // Parse shipping address if it's a string
    let addressStr = ''
    try {
      if (typeof shipping_address === 'string') {
        const addr = JSON.parse(shipping_address)
        addressStr = `${addr.address}, ${addr.city}, ${addr.state}`
      } else if (typeof shipping_address === 'object') {
        addressStr = `${shipping_address.address}, ${shipping_address.city}, ${shipping_address.state}`
      }
    } catch (e) {
      addressStr = String(shipping_address)
    }

    const itemsHtml = items.map(item => {
      const itemTotal = (item.unit_price || 0) * (item.quantity || 1)
      return `
        <tr>
          <td>${item.name || 'Product'}</td>
          <td style="text-align: center;">${item.quantity}</td>
          <td style="text-align: right">₦${(item.unit_price || 0).toLocaleString()}</td>
          <td style="text-align: right">₦${itemTotal.toLocaleString()}</td>
        </tr>
      `
    }).join('')

    const content = `
      <h2 style="color: #1a1a1a; margin-bottom: 10px;">Order Confirmation Receipt</h2>
      <p style="color: #666; font-size: 14px; margin-top: 0;"><strong>Order Number:</strong> #${order_number}</p>
      
      <p>Hello ${name},</p>
      <p>Thank you for your purchase. Your order has been received and is being processed. Please find the receipt details below.</p>
      
      <table class="table">
        <thead>
          <tr style="background-color: #f5f5f5;">
            <th>Item Description</th>
            <th style="text-align: center;">Qty</th>
            <th style="text-align: right;">Unit Price</th>
            <th style="text-align: right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
          <tr class="total-row" style="background-color: #f9f9f9;">
            <td colspan="3" style="text-align: right;">Total Purchase Value:</td>
            <td style="text-align: right; color: #f97316; font-size: 16px;">₦${total_amount.toLocaleString()}</td>
          </tr>
        </tbody>
      </table>

      <div style="background-color: #f9f9f9; padding: 15px; border-radius: 4px; margin-top: 20px; border-left: 4px solid #f97316;">
        <h3 style="margin-top: 0; font-size: 16px; color: #1a1a1a;">Delivery Address</h3>
        <p style="margin-bottom: 0; color: #666;">${addressStr}</p>
      </div>

      <p style="margin-top: 20px; color: #666;">We will contact you within 24 hours to confirm delivery arrangements and provide you with a tracking reference.</p>
      
      <p style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px;"><strong>Contact Us:</strong></p>
      <p style="color: #666; font-size: 14px; margin-top: 5px; margin-bottom: 0;">📧 Email: ${EMAIL_CONFIG.email}<br>📞 Phone: ${EMAIL_CONFIG.phone}</p>
    `

    const html = getEmailTemplate(content, `Order Confirmed - ${order_number}`)

    const client = getResendClient()
    if (!client) {
      console.warn('Resend client not configured (missing RESEND_API_KEY). Skipping email send.')
      return { success: false, error: 'Resend API key not configured' }
    }

    const data = await client.emails.send({
      from: EMAIL_CONFIG.from,
      to: customer_email,
      subject: `Order Confirmation - #${order_number} - ${EMAIL_CONFIG.brandName}`,
      html: html
    })

    return { success: true, data }
  } catch (error) {
    console.error('Failed to send order confirmation email:', error)
    return { success: false, error }
  }
}

/**
 * Send new order alert to admin
 */
export async function sendOrderAlertToAdmin(order: {
  order_number: string
  items: any[]
  total_amount: number
  customer_name?: string
  customer_email?: string
  shipping_address: any
}) {
  try {
    const adminEmail = process.env.ADMIN_EMAIL
    if (!adminEmail) {
      console.error('Skipping admin alert: ADMIN_EMAIL not set')
      return { success: false, error: 'ADMIN_EMAIL not set' }
    }

    const { order_number, items, total_amount, customer_name, customer_email, shipping_address } = order
    
    // Parse shipping address
    let addressStr = ''
    try {
      if (typeof shipping_address === 'string') {
        const addr = JSON.parse(shipping_address)
        addressStr = `${addr.address}, ${addr.city}, ${addr.state}`
      } else {
        addressStr = String(shipping_address)
      }
    } catch (e) {
      addressStr = String(shipping_address)
    }

    const itemsSummary = items.map(i => `${i.quantity}x ${i.name || 'Product'}`).join(', ')

    const content = `
      <h2>New Order Received</h2>
      <p>A new order <span class="highlight">#${order_number}</span> has been placed.</p>
      
      <div style="background-color: #eef2ff; padding: 15px; border-radius: 4px; margin: 20px 0;">
        <p><strong>Customer:</strong> ${customer_name || 'Guest'} (${customer_email || 'No email'})</p>
        <p><strong>Total:</strong> ₦${total_amount.toLocaleString()}</p>
        <p><strong>Items:</strong> ${itemsSummary}</p>
        <p><strong>Address:</strong> ${addressStr}</p>
      </div>

      <p>Please log in to the admin dashboard to process this order.</p>
      
      <a href="${process.env.NEXT_PUBLIC_SITE_URL}/admin" class="button">Go to Dashboard</a>
    `

    const html = getEmailTemplate(content, `New Order - ${order_number}`)

    const client = getResendClient()
    if (!client) {
      console.warn('Resend client not configured (missing RESEND_API_KEY). Skipping email send.')
      return { success: false, error: 'Resend API key not configured' }
    }

    const data = await client.emails.send({
      from: EMAIL_CONFIG.from,
      to: adminEmail,
      subject: `New Order - ${order_number} | Action Required`,
      html: html
    })

    return { success: true, data }
  } catch (error) {
    console.error('Failed to send admin alert email:', error)
    return { success: false, error }
  }
}

/**
 * Send order status update to customer
 */
export async function sendOrderStatusUpdate(
  customer_email: string,
  customer_name: string,
  order_number: string,
  new_status: string,
  items_summary?: string
) {
  try {
    if (!customer_email) return { success: false, error: 'No email provided' }

    let statusMessage = ''
    switch (new_status.toLowerCase()) {
      case 'processing':
        statusMessage = 'Your order is being prepared and will be shipped soon.'
        break
      case 'shipped':
        statusMessage = 'Great news! Your order is on the way.'
        break
      case 'delivered':
        statusMessage = 'Your order has been delivered. Thank you for shopping with us!'
        break
      case 'cancelled':
        statusMessage = 'Your order has been cancelled. If you did not request this, please contact us.'
        break
      default:
        statusMessage = `Your order status has been updated to: ${new_status}`
    }

    const content = `
      <h2>Order Update</h2>
      <p>Hello ${customer_name || 'Customer'},</p>
      <p>There is an update on your order <span class="highlight">#${order_number}</span>.</p>
      
      <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 15px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #166534; text-transform: capitalize;">Status: ${new_status}</h3>
        <p style="margin-bottom: 0;">${statusMessage}</p>
      </div>

      ${items_summary ? `<p><strong>Items:</strong> ${items_summary}</p>` : ''}
      
      <p>You can check the full details in your account.</p>
    `

    const html = getEmailTemplate(content, `Order Update - ${order_number}`)

    const client = getResendClient()
    if (!client) {
      console.warn('Resend client not configured (missing RESEND_API_KEY). Skipping email send.')
      return { success: false, error: 'Resend API key not configured' }
    }

    const data = await client.emails.send({
      from: EMAIL_CONFIG.from,
      to: customer_email,
      subject: `Order Update - ${order_number} | ${EMAIL_CONFIG.brandName}`,
      html: html
    })
    return { success: true, data }
  } catch (error) {
    console.error('Failed to send status update email:', error)
    return { success: false, error }
  }
}

/**
 * Send EasyBuy welcome email
 */
export async function sendEasybuyWelcome(
  customer_name: string,
  email: string,
  easybuy_id: string,
  credit_limit: number,
  staff_name?: string
) {
  try {
    if (!email) return { success: false, error: 'No email provided' }

    const content = `
      <h2>Welcome to EasyBuy!</h2>
      <p>Hello ${customer_name},</p>
      <p>Your EasyBuy account has been successfully created${staff_name ? ` by ${staff_name}` : ''}.</p>
      
      <div style="background-color: #fff7ed; border: 1px solid #fed7aa; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
        <p style="margin: 0; font-size: 14px; color: #666;">Your EasyBuy ID</p>
        <p style="margin: 5px 0 15px 0; font-size: 24px; font-weight: bold; color: #f97316; letter-spacing: 2px;">${easybuy_id}</p>
        
        <div style="border-top: 1px solid #fed7aa; padding-top: 15px; margin-top: 15px;">
          <p style="margin: 0; font-size: 14px; color: #666;">Credit Limit</p>
          <p style="margin: 5px 0 0 0; font-size: 20px; font-weight: bold; color: #333;">₦${credit_limit.toLocaleString()}</p>
        </div>
      </div>

      <p>You can now make purchases on credit using your EasyBuy ID at any of our locations.</p>
    `

    const html = getEmailTemplate(content, 'EasyBuy Account Created')

    const client = getResendClient()
    if (!client) {
      console.warn('Resend client not configured (missing RESEND_API_KEY). Skipping email send.')
      return { success: false, error: 'Resend API key not configured' }
    }

    const data = await client.emails.send({
      from: EMAIL_CONFIG.from,
      to: email,
      subject: `EasyBuy Account Created | ${EMAIL_CONFIG.brandName}`,
      html: html
    })

    return { success: true, data }
  } catch (error) {
    console.error('Failed to send EasyBuy welcome email:', error)
    return { success: false, error }
  }
}
