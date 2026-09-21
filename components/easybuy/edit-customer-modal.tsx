"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2, AlertCircle } from "lucide-react"
import type { EasyBuyCustomer } from "@/lib/easybuy-types"

interface EditCustomerModalProps {
  customer: EasyBuyCustomer
  onClose: () => void
  onUpdate: (updatedCustomer: EasyBuyCustomer) => void
}

export function EditCustomerModal({ customer, onClose, onUpdate }: EditCustomerModalProps) {
  const [formData, setFormData] = useState({
    fullName: customer.fullName,
    phone: customer.phone,
    email: customer.email,
    address: customer.address,
    creditLimit: customer.creditLimit,
    guarantorName: customer.guarantor.name,
    guarantorPhone: customer.guarantor.phone,
    guarantorRelationship: customer.guarantor.relationship,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    
    if (!formData.fullName || !formData.phone || !formData.email || !formData.address) {
      setError("Please fill in all required fields (Name, Phone, Email, Address)")
      return
    }

    try {
      setIsSubmitting(true)
      setError(null)

      const response = await fetch(`/api/easybuy/customers/${customer.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          full_name: formData.fullName,
          phone: formData.phone,
          email: formData.email,
          address: formData.address,
          credit_limit: formData.creditLimit,
          guarantor_name: formData.guarantorName,
          guarantor_phone: formData.guarantorPhone,
          guarantor_relationship: formData.guarantorRelationship,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update customer')
      }

      const { customer: updatedData } = await response.json()
      
      // Construct updated EasyBuyCustomer object
      const updatedCustomer: EasyBuyCustomer = {
        ...customer,
        fullName: updatedData.full_name,
        phone: updatedData.phone,
        email: updatedData.email || '',
        address: updatedData.address || '',
        creditLimit: updatedData.credit_limit,
        guarantor: {
            ...customer.guarantor,
            name: updatedData.guarantor_name || customer.guarantor.name,
            phone: updatedData.guarantor_phone || customer.guarantor.phone,
            relationship: updatedData.guarantor_relationship || customer.guarantor.relationship,
        }
      }

      onUpdate(updatedCustomer)
      onClose()
    } catch (err) {
      console.error('Error updating customer:', err)
      setError(err instanceof Error ? (err.message?.includes('duplicate') ? 'This record already exists' : err.message?.includes('not found') ? 'Record not found' : err.message?.includes('constraint') ? 'This action could not be completed' : 'An error occurred. Please try again.') : 'Failed to update customer')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Customer</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-800 font-medium">Error</p>
              <p className="text-sm text-red-600">{error}</p>
            </div>
          </div>
        )}

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone *</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="address">Address *</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="creditLimit">Credit Limit (₦)</Label>
              <Input
                id="creditLimit"
                type="number"
                value={formData.creditLimit}
                onChange={(e) => setFormData({ ...formData, creditLimit: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="border-t pt-4 mt-2">
            <h3 className="text-sm font-medium mb-3">Guarantor Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="guarantorName">Name</Label>
                <Input
                  id="guarantorName"
                  value={formData.guarantorName}
                  onChange={(e) => setFormData({ ...formData, guarantorName: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="guarantorPhone">Phone</Label>
                <Input
                  id="guarantorPhone"
                  value={formData.guarantorPhone}
                  onChange={(e) => setFormData({ ...formData, guarantorPhone: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="guarantorRelationship">Relationship</Label>
                <Input
                  id="guarantorRelationship"
                  value={formData.guarantorRelationship}
                  onChange={(e) => setFormData({ ...formData, guarantorRelationship: e.target.value })}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
