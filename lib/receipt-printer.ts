import { toNigeriaDateTime } from '@/lib/utils/date'

export interface ReceiptItem {
  name: string
  quantity: number
  unitPrice: number
  total: number
}

export interface ReceiptData {
  type: 'pos' | 'easybuy'
  receiptNumber: string
  date: string
  customerName?: string
  items: ReceiptItem[]
  subtotal: number
  total: number
  paymentMethod?: string
  amountPaid?: number
  balanceAfter?: number
  servedBy?: string
}

export function printReceipt(data: ReceiptData): void {
  const companyName = 'My Business'
  const address = 'HQ: No. 1a Amule Road, Amule Bus stop, Ayobo, Lagos State<br/>Branch: No. 608 Lagos-Abeokuta Express way, Ijaye Bus stop, Lagos State'
  const phone = '08135494508'
  const email = 'hello@mybusiness.com'

  const formatCurrency = (amount: number) =>
    '₦' + Number(amount || 0).toLocaleString('en-NG')

  const formatDate = (dateStr: string) => {
    return toNigeriaDateTime(dateStr)
  }

  const printWindow = window.open('', '_blank', 'width=400,height=600')
  if (!printWindow) {
    alert('Please allow popups to print receipts')
    return
  }

  printWindow.document.write(` 
   <!DOCTYPE html> 
   <html> 
   <head> 
     <title>Receipt - ${data.receiptNumber}</title> 
     <style> 
       body { 
         font-family: Arial, sans-serif; 
         font-size: 14px; 
         margin: 0 auto; 
         padding: 10px;
         max-width: 100%; 
         width: 100%;
         box-sizing: border-box;
       } 
       .center { text-align: center; } 
       .bold { font-weight: bold; } 
       .large { font-size: 16px; } 
       .divider { 
         border-top: 1px dashed #000; 
         margin: 8px 0; 
       } 
       table { 
         width: 100%; 
         border-collapse: collapse; 
         table-layout: fixed;
       } 
       td { padding: 3px 0; font-size: 13px; word-wrap: break-word; } 
       .item-name { font-weight: bold; width: 45%; } 
       .price { text-align: right; } 
       .total-row td { 
         font-weight: bold; 
         font-size: 15px; 
         border-top: 1px solid #000; 
         padding-top: 6px; 
       } 
       @media print { 
         body { 
           margin: 0; 
           padding: 0;
           width: 100%;
           max-width: 100%;
         } 
       } 
       @page { 
         margin: 0; 
       }
     </style> 
   </head> 
   <body> 
     <div class="center"> 
       <div class="bold large">${companyName}</div> 
       <div>${address}</div> 
       <div>Tel: ${phone}</div> 
       <div>${email}</div> 
     </div> 
     <div class="divider"></div> 
     <div><span class="bold">Receipt No:</span> ${data.receiptNumber}</div> 
     <div><span class="bold">Date:</span> ${formatDate(data.date)}</div> 
     ${data.customerName ? '<div><span class="bold">Customer:</span> ' + data.customerName + '</div>' : ''} 
     ${data.servedBy ? '<div><span class="bold">Served By:</span> ' + data.servedBy + '</div>' : ''} 
     <div class="divider"></div> 
     <table> 
       <tr> 
         <td class="bold">Item</td> 
         <td class="bold" style="text-align:center">Qty</td> 
         <td class="bold price">Price</td> 
         <td class="bold price">Total</td> 
       </tr> 
       ${data.items.map(item => ` 
       <tr> 
         <td class="item-name">${item.name}</td> 
         <td style="text-align:center">${item.quantity}</td> 
         <td class="price">${formatCurrency(item.unitPrice)}</td> 
         <td class="price">${formatCurrency(item.total)}</td> 
       </tr> 
       `).join('')} 
       <tr class="total-row"> 
         <td colspan="3">TOTAL</td> 
         <td class="price">${formatCurrency(data.total)}</td> 
       </tr> 
     </table> 
     ${data.paymentMethod ? '<div class="divider"></div><div><span class="bold">Payment:</span> ' + data.paymentMethod + '</div>' : ''} 
     ${data.amountPaid !== undefined ? '<div><span class="bold">Amount Paid:</span> ' + formatCurrency(data.amountPaid) + '</div>' : ''} 
     ${data.balanceAfter !== undefined ? '<div><span class="bold">' + (data.type === 'easybuy' ? 'Customer Debt Amount' : 'Balance Due') + ':</span> ' + formatCurrency(data.balanceAfter) + '</div>' : ''} 
     <div class="divider"></div> 
     <div class="center bold">Thank you for your business!</div> 
     <div class="center">Please come again.</div> 
     <script> 
       window.onload = function() { 
         window.print() 
         window.onafterprint = function() { window.close() } 
       } 
     </script> 
   </body> 
   </html> 
 `)
  printWindow.document.close()
}
