// API client for frontend components
class ApiClient {
  private async request(endpoint: string, options: RequestInit = {}) {
    const normalizedEndpoint = endpoint.startsWith('/api') ? endpoint : `/api${endpoint}`
    
    const config: RequestInit = {
      credentials: 'include',
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    }
    
    let response = await fetch(normalizedEndpoint, config)
    
    // Global interceptor for 401 Unauthorized
    if (response.status === 401) {
      // Refresh the session using Supabase browser client
      const { createBrowserClient } = await import('@/lib/utils/supabase');
      const supabase = createBrowserClient();
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error || !data.session) {
        // If refresh fails, sign out and redirect
        await supabase.auth.signOut();
        if (typeof window !== 'undefined') {
          const currentPath = window.location.pathname;
          // Only redirect if we're not already on a login page
          if (!currentPath.includes('/login')) {
            const redirectPath = currentPath.startsWith('/admin') ? '/login' : '/';
            if (currentPath !== redirectPath) {
              window.location.href = redirectPath;
            }
          }
        }
        throw new Error('Session expired. Please log in again.');
      }
      
      // If refresh succeeded, retry the original request
      response = await fetch(normalizedEndpoint, config);
    }
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error || 'API request failed')
    }
    
    return response.json()
  }

  // Products API
  async getProducts(filters: {
    category?: string
    featured?: boolean
    search?: string
    brand?: string
    minPrice?: number
    maxPrice?: number
    min_price?: number
    max_price?: number
    stock_status?: string
    sort?: string
    t?: number
  } = {}) {
    const params = new URLSearchParams()
    if (filters.category) params.append('category', filters.category)
    if (filters.featured) params.append('featured', 'true')
    if (filters.search) params.append('search', filters.search)
    if (filters.brand) params.append('brand', filters.brand)
    if (filters.minPrice !== undefined) params.append('minPrice', filters.minPrice.toString())
    if (filters.maxPrice !== undefined) params.append('maxPrice', filters.maxPrice.toString())
    if (filters.min_price !== undefined) params.append('minPrice', filters.min_price.toString())
    if (filters.max_price !== undefined) params.append('maxPrice', filters.max_price.toString())
    if (filters.stock_status) params.append('stock_status', filters.stock_status)
    if (filters.sort) params.append('sort', filters.sort)
    if (filters.t) params.append('t', filters.t.toString())
    
    return this.request(`/products?${params}`)
  }

  async getProduct(id: string) {
    return this.request(`/products/${id}`)
  }

  async createProduct(data: any) {
    return this.request('/products', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateProduct(id: string, data: any) {
    return this.request(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteProduct(id: string) {
    return this.request(`/products/${id}`, {
      method: 'DELETE',
    })
  }

  async adjustProductStock(productId: string, adjustment: number, reason: string) {
    return this.request('/inventory/adjust', {
      method: 'POST',
      body: JSON.stringify({ product_id: productId, adjustment, reason }),
    })
  }

  // Orders API
  async getOrders(filters: {
    customer_id?: string
    source?: string
    status?: string
    payment_status?: string
    payment_method?: string
    countOnly?: boolean
    limit?: number
  } = {}) {
    const params = new URLSearchParams()
    if (filters.customer_id) params.append('customer_id', filters.customer_id)
    if (filters.source) params.append('source', filters.source)
    if (filters.status) params.append('status', filters.status)
    if (filters.payment_status) params.append('payment_status', filters.payment_status)
    if (filters.payment_method) params.append('payment_method', filters.payment_method)
    if (filters.countOnly) params.append('countOnly', 'true')
    if (filters.limit) params.append('limit', filters.limit.toString())
    
    return this.request(`/orders?${params}`)
  }

  async getOrder(id: string) {
    return this.request(`/orders/${id}`)
  }

  async createOrder(data: any) {
    return this.request('/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateOrder(id: string, data: any) {
    return this.request(`/orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteOrder(id: string) {
    return this.request(`/orders/${id}`, {
      method: 'DELETE',
    })
  }

  async getCustomerProfile(customerId: string) {
    return this.request(`/customers/${customerId}`)
  }

  // Auth API
  async login(email: string, password: string) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  }

  async register(data: { email: string; password: string; full_name: string; phone?: string }) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async logout() {
    return this.request('/auth/logout', {
      method: 'POST',
    })
  }

  async getMe() {
    return this.request('/auth/me')
  }

  async staffLogin(staff_id: string, pin: string) {
    return this.request('/auth/staff-login', {
      method: 'POST',
      body: JSON.stringify({ staff_id, pin }),
    })
  }

  // EasyBuy API
  async getEasyBuyCustomers(filters: {
    search?: string
    status?: string
  } = {}) {
    const params = new URLSearchParams()
    if (filters.search) params.append('search', filters.search)
    if (filters.status) params.append('status', filters.status)
    
    return this.request(`/easybuy/customers?${params}`)
  }

  async getEasyBuyCustomer(id: string) {
    return this.request(`/easybuy/customers/${id}`)
  }

  async createEasyBuyCustomer(data: any) {
    return this.request('/easybuy/customers', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateEasyBuyCustomer(id: string, data: any) {
    return this.request(`/easybuy/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async getEasyBuyPurchases(filters: {
    customer_id?: string
    status?: string
  } = {}) {
    const params = new URLSearchParams()
    if (filters.customer_id) params.append('customer_id', filters.customer_id)
    if (filters.status) params.append('status', filters.status)
    
    return this.request(`/easybuy/purchases?${params}`)
  }

  async createEasyBuyPurchase(data: any) {
    return this.request('/easybuy/purchases', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getEasyBuyPayments(filters: {
    customer_id?: string
    purchase_id?: string
  } = {}) {
    const params = new URLSearchParams()
    if (filters.customer_id) params.append('customer_id', filters.customer_id)
    if (filters.purchase_id) params.append('purchase_id', filters.purchase_id)
    
    return this.request(`/easybuy/payments?${params}`)
  }

  async createEasyBuyPayment(data: any) {
    return this.request('/easybuy/payments', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // Investors API
  async getInvestors(filters: {
    status?: string
  } = {}) {
    const params = new URLSearchParams()
    if (filters.status) params.append('status', filters.status)
    
    return this.request(`/investors?${params}`)
  }

  async getInvestor(id: string) {
    return this.request(`/investors/${id}`)
  }

  async createInvestor(data: any) {
    return this.request('/investors', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateInvestor(id: string, data: any) {
    return this.request(`/investors/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async getInvestorPayments(filters: {
    investor_id?: string
  } = {}) {
    const params = new URLSearchParams()
    if (filters.investor_id) params.append('investor_id', filters.investor_id)
    
    return this.request(`/investors/payments?${params}`)
  }

  async createInvestorPayment(data: any) {
    return this.request('/investors/payments', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // Notifications API
  async getNotifications(filters: {
    type?: string
    target_role?: string
    is_read?: boolean
  } = {}) {
    const params = new URLSearchParams()
    if (filters.type) params.append('type', filters.type)
    if (filters.target_role) params.append('target_role', filters.target_role)
    if (filters.is_read !== undefined) params.append('is_read', filters.is_read.toString())
    
    return this.request(`/notifications?${params}`)
  }

  async createNotification(data: any) {
    return this.request('/notifications', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async markNotificationAsRead(id: string) {
    return this.request(`/notifications/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ is_read: true }),
    })
  }

  async deleteNotification(id: string) {
    return this.request(`/notifications/${id}`, {
      method: 'DELETE',
    })
  }

  // Inventory API
  async getInventoryLogs(filters: {
    product_id?: string
    action?: string
    t?: number
  } = {}) {
    const params = new URLSearchParams()
    if (filters.product_id) params.append('product_id', filters.product_id)
    if (filters.action) params.append('action', filters.action)
    if (filters.t) params.append('t', filters.t.toString())
    
    return this.request(`/inventory?${params}`)
  }

  async createInventoryLog(data: any) {
    return this.request('/inventory', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // Settings API
  async getSettings() {
    return this.request('/settings')
  }

  async updateSetting(key: string, value: any) {
    return this.request('/settings', {
      method: 'PUT',
      body: JSON.stringify({ key, value }),
    })
  }
}

export const apiClient = new ApiClient()
export default apiClient
