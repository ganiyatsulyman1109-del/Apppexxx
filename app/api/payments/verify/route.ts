import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/utils/supabase"
import { notifyNewOrder, notifyPayment } from "@/lib/notifications"
import { createOrderTransaction } from "@/lib/order-utils"
import { sendOrderConfirmationToCustomer, sendOrderAlertToAdmin } from "@/lib/email"

async function verifyPaymentReference(reference: string) {
  if (!reference) {
    return NextResponse.json(
      { error: "Missing payment reference" },
      { status: 400 }
    )
  }

  if (!process.env.PAYSTACK_SECRET_KEY) {
    return NextResponse.json(
      { error: 'Payment service not configured' },
      { status: 500 }
    )
  }

  const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY

  const paystackResponse = await fetch(
    `https://api.paystack.co/transaction/verify/${reference}`,
    {
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
      },
    }
  )

  const paystackData = await paystackResponse.json()

  if (!paystackResponse.ok) {
    console.error("Paystack verification error for reference:", reference)
    console.error(paystackData);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
  }

  if (!paystackData?.status) {
    console.error(paystackData);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
  }

  if (paystackData?.data?.status !== "success") {
    return NextResponse.json(
      { verified: false, error: "Payment was not successful" },
      { status: 400 }
    )
  }

  const supabaseAdmin = createAdminSupabaseClient()
  const paymentData = paystackData.data
  const metadata = paymentData.metadata || {}
  const customerEmail = paymentData.customer?.email || metadata.customer_email || null
  const firstName = paymentData.customer?.first_name || ""
  const lastName = paymentData.customer?.last_name || ""
  const paystackName = `${firstName} ${lastName}`.trim()
  const customerName = metadata.customer_name || metadata.full_name || paystackName || null

  const { data: existingOrder } = await supabaseAdmin
    .from("orders")
    .select("order_number, total_amount, items, payment_reference")
    .eq("payment_reference", reference)
    .maybeSingle()

  if (existingOrder) {
    const rawItems = Array.isArray(existingOrder.items)
      ? existingOrder.items
      : typeof existingOrder.items === 'string'
      ? (() => { try {
 return JSON.parse(existingOrder.items) }
                 catch { return [] } })()
      : []

    // Fetch product names for items that don't have them
    const itemsNeedingNames = rawItems.filter(
      (i: any) => !i.name && !i.product_name && i.product_id)
    
    const productNameMap: Record<string, string> = {}
    
    if (itemsNeedingNames.length > 0) {
      const productIds = itemsNeedingNames
        .map((i: any) => i.product_id)
      const { data: products } = await supabaseAdmin
        .from('products')
        .select('id, name')
        .in('id', productIds)
      
      if (products) {
        products.forEach((p: any) => {
          productNameMap[p.id] = p.name
        })
      }
    }

    const enrichedItems = rawItems.map((item: any) => ({
      ...item,
      name: item.name
        || item.product_name
        || productNameMap[item.product_id]
        || 'Product',
      product_name: item.product_name
        || item.name
        || productNameMap[item.product_id]
        || 'Product',
    }))

    return NextResponse.json({
      verified: true,
      order_number: existingOrder.order_number,
      customer_email: customerEmail || null,
      customer_name: customerName,
      customer_phone: metadata.customer_phone || null,
      order_total: Number(existingOrder.total_amount || 0),
      order_items: enrichedItems
    })
  }

  const shippingAddress = metadata.shipping_address || ""
  const cartItems = metadata.cart_items || []

  const supabase = createServerSupabaseClient()
  let authUser: any;
  try {

    const {
      data: { user },
    } = await supabase.auth.getUser()
    authUser = user
  } catch {
    authUser = null
  }

  let customerId: string | null = null

  // CRITICAL: Always use the form-submitted email as the source of truth for customer assignment
  // If email is provided, upsert/fetch customer by email regardless of session user
  if (customerEmail) {
    const phone = metadata.customer_phone || metadata.phone || paymentData.customer?.phone || (metadata.custom_fields?.find((f: any) => f.variable_name === 'phone')?.value) || null;

    // Fetch existing customer first to avoid overwriting data with nulls
    const { data: existingCustomer } = await supabaseAdmin
      .from('customers')
      .select('id, phone, full_name')
      .eq('email', customerEmail)
      .maybeSingle()

    if (existingCustomer) {
      // Update only if we have new information
      const updates: any = { updated_at: new Date().toISOString() }
      if (phone && !existingCustomer.phone) updates.phone = phone
      if (customerName && !existingCustomer.full_name) updates.full_name = customerName

      if (Object.keys(updates).length > 1) {
        await supabaseAdmin
          .from("customers")
          .update(updates)
          .eq("id", existingCustomer.id)
      }
    } else {
      // Insert new customer
      const { error: insertError } = await supabaseAdmin
        .from("customers")
        .insert({
          email: customerEmail,
          full_name: customerName,
          phone: phone,
          updated_at: new Date().toISOString(),
        })

      if (insertError) {
        console.error("Customer creation failed:", insertError)
        console.error(insertError);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
      }
    }

    // After upsert, fetch the customer by email to get the correct ID
    const { data: customerRecord } = await supabaseAdmin
      .from('customers')
      .select('id, user_id')
      .eq('email', customerEmail)
      .single()

    if (customerRecord) {
      customerId = customerRecord.id
      
      // If user is authenticated and doesn't have their user_id linked, link it now
      if (authUser && !customerRecord.user_id) {
        await supabaseAdmin
          .from('customers')
          .update({ user_id: authUser.id, updated_at: new Date().toISOString() })
          .eq('email', customerEmail)
      }
    } else {
      return NextResponse.json(
        { error: "Failed to retrieve customer record after creation" },
        { status: 500 }
      )
    }
  } else if (authUser) {
    // Fallback: if no email from form, try to link order to authenticated user's customer
    const { data: authCustomer } = await supabaseAdmin
      .from("customers")
      .select("id")
      .eq('user_id', authUser.id)
      .maybeSingle()

    if (authCustomer) {
      customerId = authCustomer.id
    }
  }

  if (!customerId) {
    console.error("No customer ID found for order");
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
  }

  let orderData
  try {

    orderData = await createOrderTransaction(supabaseAdmin, {
      source: "ecommerce",
      customer_id: customerId,
      status: "confirmed",
      payment_status: "paid",
      payment_method: "paystack",
      payment_reference: reference,
      total: paymentData.amount / 100,
      items: (cartItems || []).map((item: any) => ({
        product_id: item.product_id || item.id,
        quantity: item.quantity,
        unit_price: item.price ?? item.unit_price ?? 0,
        name: item.name,
      })),
      shipping_address: metadata.shipping_address || shippingAddress || null,
    })
  } catch (error: any) {
    console.error("Error creating ecommerce order after payment verification:", error)
    
    // Check if the error is a unique constraint violation (duplicate payment_reference)
    if (error?.message?.includes('duplicate key value') || error?.code === '23505') {
      return NextResponse.json({
        verified: true,
        order_number: "ALREADY_PROCESSED",
        message: "Payment was processed concurrently by another request."
      })
    }

    console.error(error);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
  }

  try {

    await notifyNewOrder({
      id: orderData?.id,
      order_number: orderData?.order_number,
      source: "ecommerce",
      total_amount: paymentData.amount / 100
    })

    await notifyPayment({
      amount: paymentData.amount / 100,
      reference
    })
  } catch (notificationError) {
    console.error("Notification delivery failed:", notificationError)
  }

  try {

    const emailOrderData = {
      order_number: orderData?.order_number,
      items: (cartItems || []).map((item: any) => ({
        name: item.name || "Product",
        quantity: item.quantity,
        unit_price: item.price
      })),
      total_amount: paymentData.amount / 100,
      shipping_address: shippingAddress,
      customer_email: authUser?.email || customerEmail,
      customer_name: metadata.customer_name || customerName
    }

    await Promise.all([
      sendOrderConfirmationToCustomer(emailOrderData),
      sendOrderAlertToAdmin(emailOrderData)
    ])
  } catch (emailError) {
    console.error("Failed to send emails:", emailError)
  }

  return NextResponse.json({
    verified: true,
    order_number: orderData?.order_number || "ORDER_CREATED",
    customer_email: customerEmail || null,
    customer_name: customerName,
    customer_phone: metadata.customer_phone || null,
    order_total: Number(paymentData.amount / 100),
    order_items: (cartItems || []).map((item: any) => ({
      name: item.name || "Product",
      quantity: item.quantity,
      unit_price: item.price
    }))
  })
}

export async function GET(request: Request) {
  try {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'Database service not configured' },
      { status: 500 }
    )
  }
  

    const { searchParams } = new URL(request.url)
    const reference = searchParams.get("reference") || searchParams.get("trxref") || ""
    return await verifyPaymentReference(reference)
  } catch (error: any) {
    console.error("VERIFY ROUTE CRASHED:", error)
    console.error(error);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'Database service not configured' },
      { status: 500 }
    )
  }
  

    const body = await request.json()
    const { reference } = body
    return await verifyPaymentReference(reference)
  } catch (error: any) {
    console.error("VERIFY ROUTE CRASHED:", error)
    console.error(error);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 }
    )
  }
}
