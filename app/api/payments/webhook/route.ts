import crypto from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabaseClient } from "@/lib/utils/supabase"
import { notifyNewOrder, notifyPayment } from "@/lib/notifications"
import { createOrderTransaction } from "@/lib/order-utils"
import { sendOrderConfirmationToCustomer, sendOrderAlertToAdmin } from "@/lib/email"

export async function POST(request: NextRequest) {
  try {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'Database service not configured' },
      { status: 500 }
    )
  }

    // Verify webhook signature
    const signature = request.headers.get("x-paystack-signature")
    const webhookSecret = process.env.PAYSTACK_WEBHOOK_SECRET

    if (!signature || !webhookSecret) {
      console.error("Missing signature or webhook secret")
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Get raw body for signature verification
    const rawBody = await request.text()
    
    // Verify the signature
    const expectedSignature = crypto
      .createHmac("sha512", webhookSecret)
      .update(rawBody)
      .digest("hex")

    if (signature !== expectedSignature) {
      console.error("Invalid webhook signature")
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Parse the event data
    const event = JSON.parse(rawBody)

    // Handle successful charge events
    if (event.event === "charge.success") {
      const paymentData = event.data
      const reference = paymentData.reference
      
      // Create admin Supabase client
      const supabase = createAdminSupabaseClient()
      
      // Check if order already exists for this payment reference
      const { data: existingOrder, error: orderCheckError } = await supabase
        .from('orders')
        .select('id')
        .eq('payment_reference', reference)
        .single()

      if (orderCheckError && orderCheckError.code !== 'PGRST116') {
        console.error("Error checking existing order:", orderCheckError)
        return NextResponse.json(
          { error: "Database error" },
          { status: 500 }
        )
      }

      // If order already exists, return success
      if (existingOrder) {
        return NextResponse.json({ received: true })
      }

      // Extract metadata from payment data
      const metadata = paymentData.metadata || {}
      const shippingAddress = metadata.shipping_address || ""
      const customerName = metadata.customer_name || ""
      
      // Paystack might put phone in customer object, custom_fields, or top-level metadata
      const phone = 
        metadata.customer_phone || 
        metadata.phone || 
        paymentData.customer?.phone || 
        (metadata.custom_fields?.find((f: any) => f.variable_name === 'phone')?.value) || 
        "";
        
      const cartItems = metadata.cart_items || []
      const customerEmail = paymentData.customer?.email

      let customerId: string | null = null
      if (typeof metadata.customer_id === "string" && metadata.customer_id) {
        customerId = metadata.customer_id
        
        // Try to update phone if we have it and customer might not
        if (phone) {
          const { data: customer } = await supabase
            .from("customers")
            .select("phone")
            .eq("id", customerId)
            .maybeSingle()
            
          if (customer && !customer.phone) {
            await supabase
              .from("customers")
              .update({ phone: phone })
              .eq("id", customerId)
          }
        }
      } else if (customerEmail) {
        const { data: customer } = await supabase
          .from("customers")
          .select("id, phone")
          .eq("email", customerEmail)
          .maybeSingle()

        if (customer) {
          customerId = customer.id
          
          // If the customer doesn't have a phone number but we got one from the order, update it
          if (!customer.phone && phone) {
            await supabase
              .from("customers")
              .update({ phone: phone })
              .eq("id", customer.id)
          }
        }
      }

      if (!customerId && customerEmail) {
        const { data: createdCustomer } = await supabase
          .from('customers')
          .insert({
            full_name: customerName || customerEmail.split('@')[0],
            email: customerEmail,
            phone: phone || null
          })
          .select('id')
          .single()
        
        if (createdCustomer) {
          customerId = createdCustomer.id
        }
      }

      if (!customerId) {
        console.error("Webhook: Could not link to a customer account.")
        // We still return 200 to Paystack to acknowledge receipt, but we can't process the order
        return NextResponse.json({ received: true, status: "failed_no_customer" })
      }

      let orderData: any
      try {
        orderData = await createOrderTransaction(supabase, {
          source: "ecommerce",
          items: cartItems.map((item: any) => ({
            product_id: item.product_id || item.id, // Handle both product_id and id
            quantity: item.quantity,
            unit_price: item.price ?? item.unit_price ?? 0,
            name: item.name
          })),
          total: paymentData.amount / 100,
          customer_id: customerId,
          payment_method: "paystack",
          payment_reference: reference,
          shipping_address: typeof shippingAddress === 'string' ? shippingAddress : JSON.stringify(shippingAddress), // Ensure string
          notes: [customerName, phone].filter(Boolean).join(" | ") || null,
          status: "processing",
          payment_status: "paid"
        })
      } catch (orderError) {
        console.error("Error creating order:", orderError)
        return NextResponse.json(
          { error: "Failed to create order" },
          { status: 500 }
        )
      }

      await notifyNewOrder({
        id: orderData?.id,
        order_number: orderData?.order_number,
        source: 'ecommerce',
        total_amount: paymentData.amount / 100
      })

      await notifyPayment({
        amount: paymentData.amount / 100,
        reference
      })

      // Send emails (fail silently)
      try {
        const emailOrderData = {
          order_number: orderData?.order_number,
          items: cartItems.map((item: any) => ({
              name: item.name || 'Product',
              quantity: item.quantity,
              unit_price: item.price
          })),
          total_amount: paymentData.amount / 100,
          shipping_address: shippingAddress,
          customer_email: customerEmail,
          customer_name: customerName
        }

        await Promise.all([
          sendOrderConfirmationToCustomer(emailOrderData),
          sendOrderAlertToAdmin(emailOrderData)
        ])
      } catch (emailError) {
        console.error("Failed to send emails:", emailError)
      }

      // Return 200 response quickly
      return NextResponse.json({ received: true })
    }

    // For other events, just acknowledge receipt
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("Webhook error:", error)
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    )
  }
}
