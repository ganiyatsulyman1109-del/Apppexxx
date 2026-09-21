import { createBrowserSupabaseClient } from "@/lib/utils/supabase"

// Storage utility for file uploads
export class StorageService {
  private getSupabase() {
    return createBrowserSupabaseClient()
  }

  /**
   * Upload a file to a specific bucket
   */
  async uploadFile(
    bucket: string,
    file: File,
    path: string,
    options?: { upsert?: boolean }
  ): Promise<string> {
    try {
      const supabase = this.getSupabase()
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, file, {
          upsert: options?.upsert || false,
          contentType: file.type,
        })

      if (error) {
        throw error
      }

      // Get the public URL for the uploaded file
      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path)

      return publicUrl
    } catch (error) {
      console.error('Error uploading file:', error)
      throw error
    }
  }

  /**
   * Upload customer profile photo
   */
  async uploadCustomerPhoto(file: File, customerId: string): Promise<string> {
    const fileName = `customer-${customerId}-${Date.now()}.${file.name.split('.').pop()}`
    const path = `profile-photos/${fileName}`
    return this.uploadFile('customer-photos', file, path)
  }

  /**
   * Upload ID card photo
   */
  async uploadIdCardPhoto(file: File, customerId: string, side: 'front' | 'back'): Promise<string> {
    const fileName = `id-${customerId}-${side}-${Date.now()}.${file.name.split('.').pop()}`
    const path = `id-cards/${fileName}`
    return this.uploadFile('id-cards', file, path)
  }

  /**
   * Upload product image
   */
  async uploadProductImage(file: File, productId: string): Promise<string> {
    const fileName = `product-${productId}-${Date.now()}.${file.name.split('.').pop()}`
    const path = `products/${fileName}`
    return this.uploadFile('product-images', file, path)
  }

  /**
   * Delete a file from storage
   */
  async deleteFile(bucket: string, path: string): Promise<void> {
    try {
      const supabase = this.getSupabase()
      const { error } = await supabase.storage
        .from(bucket)
        .remove([path])

      if (error) {
        throw error
      }
    } catch (error) {
      console.error('Error deleting file:', error)
      throw error
    }
  }

  /**
   * Get public URL for a file
   */
  getPublicUrl(bucket: string, path: string): string {
    const supabase = this.getSupabase()
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(path)
    
    return publicUrl
  }
}

// Export singleton instance
export const storageService = new StorageService()
