/**
 * Miras Platform - Unified Supabase Data & Business Operations Service
 * طبقة الخدمات البرمجية المركزية الشاملة لمنصة مِـرَاس (MirasAPI)
 */

window.MirasAPI = {
  // استدعاء عميل Supabase المشترك
  getClient() {
    if (window.MirasRouter && window.MirasRouter.getClient) {
      return window.MirasRouter.getClient();
    }
    const config = window.MIRAS_ENV || {};
    if (window.supabase && config.SUPABASE_URL && !config.SUPABASE_URL.includes('YOUR_PROJECT_ID')) {
      const cleanUrl = config.SUPABASE_URL.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
      return window.supabase.createClient(cleanUrl, config.SUPABASE_ANON_KEY);
    }
    return null;
  },

  // ----------------------------------------------------------------------------
  // 1. خدمات المصادقة وإدارة الحسابات (Auth & Profiles)
  // ----------------------------------------------------------------------------
  auth: {
    async signUp(params) {
      return window.MirasRouter.signUp(params);
    },

    async signIn(params) {
      return window.MirasRouter.signInWithPassword(params);
    },

    async signOut() {
      return window.MirasRouter.signOut();
    },

    async resetPassword(email) {
      const client = window.MirasAPI.getClient();
      if (!client) return { error: new Error('Supabase not connected') };
      return client.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/login.html?action=reset-password'
      });
    },

    async updatePassword(newPassword) {
      const client = window.MirasAPI.getClient();
      if (!client) return { error: new Error('Supabase not connected') };
      return client.auth.updateUser({ password: newPassword });
    },

    async getCurrentUser() {
      const client = window.MirasAPI.getClient();
      if (!client) return null;
      const { data: { session } } = await client.auth.getSession();
      return session?.user || null;
    },

    async getCurrentProfile() {
      const client = window.MirasAPI.getClient();
      if (!client) return null;
      const user = await this.getCurrentUser();
      if (!user) return null;

      const { data, error } = await client
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      return error ? null : data;
    },

    async updateProfile(userId, updates) {
      const client = window.MirasAPI.getClient();
      if (!client) return { error: new Error('Supabase not connected') };
      return client
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select();
    }
  },

  // ----------------------------------------------------------------------------
  // 2. تصنيفات المهن (Categories)
  // ----------------------------------------------------------------------------
  categories: {
    async list() {
      const client = window.MirasAPI.getClient();
      if (!client) return { data: [], error: null };
      return client
        .from('trade_categories')
        .select('*')
        .order('is_featured', { ascending: false })
        .order('active_pros_count', { ascending: false });
    }
  },

  // ----------------------------------------------------------------------------
  // 3. أصحاب المهن والكوادر الحرفية (Craftsmen)
  // ----------------------------------------------------------------------------
  craftsmen: {
    async list(filters = {}) {
      const client = window.MirasAPI.getClient();
      if (!client) return { data: [], error: null };

      let query = client
        .from('craftsmen_profiles')
        .select(`
          id, trade_category, experience_years, rating, total_reviews,
          completed_orders, is_available, verification_status,
          user:profiles!craftsmen_profiles_user_id_fkey (id, full_name, city, avatar_url, phone_number)
        `)
        .eq('verification_status', 'verified');

      if (filters.category) {
        query = query.ilike('trade_category', `%${filters.category}%`);
      }
      if (filters.limit) {
        query = query.limit(filters.limit);
      }
      return query;
    },

    async getByUserId(userId) {
      const client = window.MirasAPI.getClient();
      if (!client) return { data: null, error: null };
      return client
        .from('craftsmen_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
    },

    async update(craftsmanId, updates) {
      const client = window.MirasAPI.getClient();
      if (!client) return { error: new Error('Supabase not connected') };
      return client
        .from('craftsmen_profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', craftsmanId)
        .select();
    }
  },

  // ----------------------------------------------------------------------------
  // 4. خدمات أصحاب المهن (Craftsman Services)
  // ----------------------------------------------------------------------------
  services: {
    async listByCraftsman(craftsmanId) {
      const client = window.MirasAPI.getClient();
      if (!client) return { data: [], error: null };
      return client
        .from('craftsman_services')
        .select('*')
        .eq('craftsman_id', craftsmanId)
        .order('created_at', { ascending: false });
    },

    async create(serviceData) {
      const client = window.MirasAPI.getClient();
      if (!client) return { error: new Error('Supabase not connected') };
      return client
        .from('craftsman_services')
        .insert([serviceData])
        .select();
    },

    async update(serviceId, updates) {
      const client = window.MirasAPI.getClient();
      if (!client) return { error: new Error('Supabase not connected') };
      return client
        .from('craftsman_services')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', serviceId)
        .select();
    },

    async delete(serviceId) {
      const client = window.MirasAPI.getClient();
      if (!client) return { error: new Error('Supabase not connected') };
      return client
        .from('craftsman_services')
        .delete()
        .eq('id', serviceId);
    }
  },

  // ----------------------------------------------------------------------------
  // 5. طلبات الخدمات والمشاريع (Orders & Projects)
  // ----------------------------------------------------------------------------
  orders: {
    async list(filters = {}) {
      const client = window.MirasAPI.getClient();
      if (!client) return { data: [], error: null };

      let query = client
        .from('service_orders')
        .select(`
          *,
          client:profiles!service_orders_client_id_fkey(full_name, phone_number, city),
          craftsman:craftsmen_profiles!service_orders_craftsman_id_fkey(
            id, trade_category,
            user:profiles!craftsmen_profiles_user_id_fkey(full_name)
          )
        `)
        .order('created_at', { ascending: false });

      if (filters.status) query = query.eq('status', filters.status);
      if (filters.client_id) query = query.eq('client_id', filters.client_id);
      if (filters.craftsman_id) query = query.eq('craftsman_id', filters.craftsman_id);
      if (filters.limit) query = query.limit(filters.limit);

      return query;
    },

    async getById(orderId) {
      const client = window.MirasAPI.getClient();
      if (!client) return { data: null, error: null };
      return client
        .from('service_orders')
        .select(`
          *,
          client:profiles!service_orders_client_id_fkey(full_name, phone_number, city),
          bids:bids(
            id, bid_amount, execution_days, proposal_notes, status, created_at,
            craftsman:craftsmen_profiles!bids_craftsman_id_fkey(
              id, rating, trade_category,
              user:profiles!craftsmen_profiles_user_id_fkey(full_name, avatar_url)
            )
          )
        `)
        .eq('id', orderId)
        .single();
    },

    async create(orderData) {
      const client = window.MirasAPI.getClient();
      if (!client) return { error: new Error('Supabase not connected') };
      return client
        .from('service_orders')
        .insert([orderData])
        .select();
    },

    async updateStatus(orderId, status, finalAmount = null) {
      const client = window.MirasAPI.getClient();
      if (!client) return { error: new Error('Supabase not connected') };
      const updates = { status, updated_at: new Date().toISOString() };
      if (finalAmount !== null) updates.final_amount = finalAmount;
      return client
        .from('service_orders')
        .update(updates)
        .eq('id', orderId)
        .select();
    }
  },

  // ----------------------------------------------------------------------------
  // 6. عروض الأسعار (Bids)
  // ----------------------------------------------------------------------------
  bids: {
    async listForOrder(orderId) {
      const client = window.MirasAPI.getClient();
      if (!client) return { data: [], error: null };
      return client
        .from('bids')
        .select(`
          *,
          craftsman:craftsmen_profiles!bids_craftsman_id_fkey(
            id, rating, trade_category,
            user:profiles!craftsmen_profiles_user_id_fkey(full_name, avatar_url)
          )
        `)
        .eq('order_id', orderId)
        .order('bid_amount', { ascending: true });
    },

    async listForCraftsman(craftsmanId) {
      const client = window.MirasAPI.getClient();
      if (!client) return { data: [], error: null };
      return client
        .from('bids')
        .select(`
          *,
          order:service_orders!bids_order_id_fkey(id, title, city, status, estimated_budget)
        `)
        .eq('craftsman_id', craftsmanId)
        .order('created_at', { ascending: false });
    },

    async submit(bidData) {
      const client = window.MirasAPI.getClient();
      if (!client) return { error: new Error('Supabase not connected') };
      return client
        .from('bids')
        .insert([bidData])
        .select();
    },

    async accept(bidId, orderId, craftsmanId, amount) {
      const client = window.MirasAPI.getClient();
      if (!client) return { error: new Error('Supabase not connected') };

      // قبول العرض وتحديث حالة الطلب إلى قيد التنفيذ
      await client.from('bids').update({ status: 'accepted' }).eq('id', bidId);
      await client.from('bids').update({ status: 'rejected' }).eq('order_id', orderId).neq('id', bidId);
      return client.from('service_orders').update({
        craftsman_id: craftsmanId,
        final_amount: amount,
        status: 'in_progress',
        updated_at: new Date().toISOString()
      }).eq('id', orderId).select();
    }
  },

  // ----------------------------------------------------------------------------
  // 7. المحفظة والضمان المالي (Wallet & Escrow)
  // ----------------------------------------------------------------------------
  escrow: {
    async getWallet(userId) {
      const client = window.MirasAPI.getClient();
      if (!client) return { data: null, error: null };
      return client
        .from('escrow_wallets')
        .select('*')
        .eq('user_id', userId)
        .single();
    },

    async getTransactions(walletId) {
      const client = window.MirasAPI.getClient();
      if (!client) return { data: [], error: null };
      return client
        .from('escrow_transactions')
        .select('*')
        .eq('wallet_id', walletId)
        .order('created_at', { ascending: false });
    }
  },

  // ----------------------------------------------------------------------------
  // 8. التقييمات (Reviews)
  // ----------------------------------------------------------------------------
  reviews: {
    async listForCraftsman(craftsmanId) {
      const client = window.MirasAPI.getClient();
      if (!client) return { data: [], error: null };
      return client
        .from('reviews')
        .select(`
          *,
          client:profiles!reviews_client_id_fkey(full_name, avatar_url)
        `)
        .eq('craftsman_id', craftsmanId)
        .order('created_at', { ascending: false });
    },

    async create(reviewData) {
      const client = window.MirasAPI.getClient();
      if (!client) return { error: new Error('Supabase not connected') };
      return client
        .from('reviews')
        .insert([reviewData])
        .select();
    }
  },

  // ----------------------------------------------------------------------------
  // 9. الإشعارات (Notifications)
  // ----------------------------------------------------------------------------
  notifications: {
    async list(userId) {
      const client = window.MirasAPI.getClient();
      if (!client) return { data: [], error: null };
      return client
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);
    },

    async markAsRead(notificationId) {
      const client = window.MirasAPI.getClient();
      if (!client) return { error: new Error('Supabase not connected') };
      return client
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);
    }
  },

  // ----------------------------------------------------------------------------
  // 10. وظائف إدارة المنصة (Admin Management)
  // ----------------------------------------------------------------------------
  admin: {
    async getStats() {
      const client = window.MirasAPI.getClient();
      if (!client) return null;

      const [craftsmenRes, ordersRes, walletsRes] = await Promise.all([
        client.from('craftsmen_profiles').select('*', { count: 'exact', head: true }),
        client.from('service_orders').select('*', { count: 'exact', head: true }),
        client.from('escrow_wallets').select('balance, escrow_held')
      ]);

      const totalEscrow = (walletsRes.data || []).reduce((acc, w) => {
        return acc + (Number(w.balance) || 0) + (Number(w.escrow_held) || 0);
      }, 0);

      return {
        totalCraftsmen: craftsmenRes.count || 0,
        totalOrders: ordersRes.count || 0,
        totalEscrow: totalEscrow
      };
    },

    async listUsers(role = null) {
      const client = window.MirasAPI.getClient();
      if (!client) return { data: [], error: null };
      let query = client.from('profiles').select('*').order('created_at', { ascending: false });
      if (role) query = query.eq('role', role);
      return query;
    },

    async verifyCraftsman(craftsmanId, status = 'verified') {
      const client = window.MirasAPI.getClient();
      if (!client) return { error: new Error('Supabase not connected') };
      return client
        .from('craftsmen_profiles')
        .update({ verification_status: status, updated_at: new Date().toISOString() })
        .eq('id', craftsmanId)
        .select();
    }
  }
};
