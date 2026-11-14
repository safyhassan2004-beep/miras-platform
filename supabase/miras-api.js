/**
 * Miras Platform - Unified Supabase Data & Business Operations Service
 * طبقة الخدمات البرمجية المركزية الشاملة لمنصة مِـرَاس (MirasAPI)
 * 
 * تدير جميع عمليات التطبيق الحقيقية:
 * 1. الحسابات والمصادقة (Auth & Profiles)
 * 2. تصنيفات المهن (Categories)
 * 3. أصحاب المهن ومعرض الأعمال (Craftsmen & Portfolio)
 * 4. الخدمات والأسعار (Services & Pricing)
 * 5. طلبات الخدمات وإدارتها (Orders & Statuses)
 * 6. المحادثات المباشرة بين العميل والحرفي (Realtime Chat)
 * 7. مركز خدمة عملاء الدعم الحضرمي اليدوي (Manual Support Desk - NO BOTS)
 * 8. المفضلة والتقييمات (Favorites & Reviews)
 * 9. الإشعارات وسجل العمليات (Notifications & Admin Activity Logs)
 * 10. رفع وتخزين الملفات (Supabase Storage)
 */

window.MirasAPI = {
  // الثوابت الوطنية وإعدادات محافظة حضرموت لمنصة مِـرَاس
  CONSTANTS: {
    COUNTRY: 'Yemen',
    COUNTRY_AR: 'الجمهورية اليمنية',
    DIAL_CODE: '+967',
    CURRENCY_CODE: 'YER',
    CURRENCY_SYMBOL: 'ر.ي',
    DEFAULT_CITY: 'المكلا',
    CITIES: ['المكلا', 'سيئون', 'تريم', 'الشحر', 'غيل باوزير', 'وادي دوعن', 'القطن'],
    SUPER_ADMIN_EMAIL: 'safyhassan2004@gmail.com',
    SUPER_ADMIN_PHONE: '+967781125928',
    ORDER_STATUSES: {
      new: 'جديد',
      pending_review: 'قيد المراجعة',
      accepted: 'مقبول',
      in_progress: 'جارٍ التنفيذ',
      completed: 'مكتمل',
      rejected: 'مرفوض',
      cancelled: 'ملغى'
    },
    TICKET_STATUSES: {
      new: 'جديدة',
      in_progress: 'قيد المعالجة',
      waiting_user: 'بانتظار رد المستخدم',
      closed: 'مغلقة'
    }
  },

  // تنسيق وتحويل رقم الهاتف إلى صيغة E.164 اليمنية الموحدة (+967XXXXXXXXX)
  normalizePhone(phone) {
    if (!phone) return '';
    let cleaned = phone.toString().replace(/[^\+0-9]/g, '');
    if (cleaned.startsWith('+967')) return cleaned;
    if (cleaned.startsWith('00967')) return '+' + cleaned.substring(2);
    if (cleaned.startsWith('967')) return '+' + cleaned;
    if (cleaned.startsWith('0') && cleaned.length === 10) return '+967' + cleaned.substring(1);
    if (cleaned.length === 9 && cleaned.startsWith('7')) return '+967' + cleaned;
    return cleaned.startsWith('+') ? cleaned : '+967' + cleaned;
  },

  // التحقق من صحة رقم الهاتف اليمني (9 أرقام تبدأ بـ 7xx xxx xxx)
  isValidYemeniPhone(phone) {
    if (!phone) return false;
    const norm = this.normalizePhone(phone);
    return /^\+967[7][0-9]{8}$/.test(norm);
  },

  // فحص صلاحية Super Admin
  isSuperAdmin(user, profile) {
    if (user && user.email && user.email.toLowerCase() === 'safyhassan2004@gmail.com') return true;
    if (profile && (profile.role === 'super_admin' || profile.is_super_admin)) return true;
    const sessionRole = sessionStorage.getItem('role') || sessionStorage.getItem('miras_auth_role');
    return sessionRole === 'super_admin';
  },

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
      if (window.MirasRouter) return window.MirasRouter.signUp(params);
      return { data: null, error: new Error('Router not available') };
    },

    async signIn(params) {
      if (window.MirasRouter) return window.MirasRouter.signInWithPassword(params);
      return { data: null, error: new Error('Router not available') };
    },

    async signOut() {
      if (window.MirasRouter) return window.MirasRouter.signOut();
      return { error: null };
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
      try {
        const { data: { session } } = await client.auth.getSession();
        return session?.user || null;
      } catch (e) {
        return null;
      }
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
        .maybeSingle();
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
          id, user_id, trade_category, experience_years, rating, total_reviews,
          completed_orders, is_available, verification_status, bio, hourly_rate,
          user:profiles!craftsmen_profiles_user_id_fkey (id, full_name, city, avatar_url, phone_number)
        `)
        .eq('verification_status', 'verified');

      if (filters.category) {
        query = query.ilike('trade_category', `%${filters.category}%`);
      }
      if (filters.city) {
        // فلترة المدينة من ملف المستخدم
        query = query.eq('user.city', filters.city);
      }
      if (filters.search) {
        query = query.or(`trade_category.ilike.%${filters.search}%,bio.ilike.%${filters.search}%`);
      }
      if (filters.limit) {
        query = query.limit(filters.limit);
      }
      return query;
    },

    async getById(craftsmanId) {
      const client = window.MirasAPI.getClient();
      if (!client) return { data: null, error: null };
      return client
        .from('craftsmen_profiles')
        .select(`
          *,
          user:profiles!craftsmen_profiles_user_id_fkey (id, full_name, city, avatar_url, phone_number, created_at),
          services:craftsman_services(*),
          portfolio:craftsman_portfolio(*),
          reviews:reviews(*, client:profiles!reviews_client_id_fkey(full_name, avatar_url))
        `)
        .eq('id', craftsmanId)
        .maybeSingle();
    },

    async getByUserId(userId) {
      const client = window.MirasAPI.getClient();
      if (!client) return { data: null, error: null };
      return client
        .from('craftsmen_profiles')
        .select(`
          *,
          services:craftsman_services(*),
          portfolio:craftsman_portfolio(*)
        `)
        .eq('user_id', userId)
        .maybeSingle();
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
  // 5. معرض أعمال الحرفي (Portfolio)
  // ----------------------------------------------------------------------------
  portfolio: {
    async list(craftsmanId) {
      const client = window.MirasAPI.getClient();
      if (!client) return { data: [], error: null };
      return client
        .from('craftsman_portfolio')
        .select('*')
        .eq('craftsman_id', craftsmanId)
        .order('created_at', { ascending: false });
    },

    async add(itemData) {
      const client = window.MirasAPI.getClient();
      if (!client) return { error: new Error('Supabase not connected') };
      return client
        .from('craftsman_portfolio')
        .insert([itemData])
        .select();
    },

    async delete(itemId) {
      const client = window.MirasAPI.getClient();
      if (!client) return { error: new Error('Supabase not connected') };
      return client
        .from('craftsman_portfolio')
        .delete()
        .eq('id', itemId);
    }
  },

  // ----------------------------------------------------------------------------
  // 6. طلبات الخدمات والمشاريع (Orders)
  // ----------------------------------------------------------------------------
  orders: {
    async list(filters = {}) {
      const client = window.MirasAPI.getClient();
      if (!client) return { data: [], error: null };

      let query = client
        .from('service_orders')
        .select(`
          *,
          client:profiles!service_orders_client_id_fkey(id, full_name, phone_number, city),
          craftsman:craftsmen_profiles!service_orders_craftsman_id_fkey(
            id, trade_category, rating,
            user:profiles!craftsmen_profiles_user_id_fkey(id, full_name, phone_number, avatar_url)
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
          client:profiles!service_orders_client_id_fkey(id, full_name, phone_number, city, avatar_url),
          craftsman:craftsmen_profiles!service_orders_craftsman_id_fkey(
            id, trade_category, rating, total_reviews,
            user:profiles!craftsmen_profiles_user_id_fkey(id, full_name, phone_number, avatar_url)
          ),
          bids:bids(
            id, bid_amount, execution_days, proposal_notes, status, created_at,
            craftsman:craftsmen_profiles!bids_craftsman_id_fkey(
              id, rating, trade_category,
              user:profiles!craftsmen_profiles_user_id_fkey(full_name, avatar_url)
            )
          )
        `)
        .eq('id', orderId)
        .maybeSingle();
    },

    async create(orderData) {
      const client = window.MirasAPI.getClient();
      if (!client) return { error: new Error('Supabase not connected') };
      
      const payload = {
        title: orderData.title,
        trade_category: orderData.trade_category || 'صيانة عامة',
        description: orderData.description,
        city: orderData.city || 'المكلا',
        location_details: orderData.location_details || '',
        attachment_url: orderData.attachment_url || null,
        estimated_budget: orderData.estimated_budget || null,
        client_id: orderData.client_id,
        craftsman_id: orderData.craftsman_id || null,
        status: 'new'
      };

      const result = await client.from('service_orders').insert([payload]).select();
      
      // إرسال إشعار إداري لمالكة المنصة
      if (result.data && result.data[0]) {
        await window.MirasAPI.notifications.create({
          userId: orderData.client_id,
          targetRole: 'super_admin',
          title: 'طلب خدمة جديد',
          message: `تم إنشاء طلب جديد: "${orderData.title}" في ${payload.city}.`,
          type: 'order',
          link: `order-details.html?id=${result.data[0].id}`,
          actorName: orderData.clientName || 'عميل مِـرَاس'
        });

        // إذا تم تحديد صاحب مهنة، إرسال إشعار له
        if (orderData.craftsman_id) {
          // استعلام user_id للحرفي
          const { data: pro } = await client.from('craftsmen_profiles').select('user_id').eq('id', orderData.craftsman_id).single();
          if (pro?.user_id) {
            await window.MirasAPI.notifications.create({
              userId: pro.user_id,
              targetRole: 'craftsman',
              title: 'طلب خدمة جديد موجه إليك',
              message: `وصلك طلب خدمة مباشر جديد: "${orderData.title}".`,
              type: 'order',
              link: `order-details.html?id=${result.data[0].id}`
            });
          }
        }
      }

      return result;
    },

    async updateStatus(orderId, status, details = {}) {
      const client = window.MirasAPI.getClient();
      if (!client) return { error: new Error('Supabase not connected') };
      
      const updates = { 
        status, 
        updated_at: new Date().toISOString(),
        ...details
      };
      if (status === 'completed') {
        updates.completed_at = new Date().toISOString();
      }

      return client
        .from('service_orders')
        .update(updates)
        .eq('id', orderId)
        .select();
    }
  },

  // ----------------------------------------------------------------------------
  // 7. نظام المحادثات المباشرة بين العميل وصاحب المهنة (Realtime Chat)
  // ----------------------------------------------------------------------------
  chat: {
    async getOrCreateConversation(orderId, clientId, craftsmanId) {
      const client = window.MirasAPI.getClient();
      if (!client) return { data: null, error: new Error('Supabase not connected') };

      // محاولة البحث عن محادثة سابقة
      let query = client.from('conversations').select('*');
      if (orderId) query = query.eq('order_id', orderId);
      query = query.eq('client_id', clientId).eq('craftsman_id', craftsmanId);

      const { data: existing, error } = await query.maybeSingle();
      if (existing) return { data: existing, error: null };

      // إنشاء محادثة جديدة
      return client
        .from('conversations')
        .insert([{
          order_id: orderId || null,
          client_id: clientId,
          craftsman_id: craftsmanId,
          last_message: 'بدأت المحادثة',
          last_message_at: new Date().toISOString()
        }])
        .select()
        .single();
    },

    async listUserConversations(userId) {
      const client = window.MirasAPI.getClient();
      if (!client) return { data: [], error: null };

      // البحث عن محادثات المستخدم سواء كان عميلاً أو حرفياً
      return client
        .from('conversations')
        .select(`
          *,
          client:profiles!conversations_client_id_fkey(id, full_name, avatar_url),
          craftsman:craftsmen_profiles!conversations_craftsman_id_fkey(
            id, trade_category,
            user:profiles!craftsmen_profiles_user_id_fkey(id, full_name, avatar_url)
          ),
          order:service_orders!conversations_order_id_fkey(id, title, status)
        `)
        .order('last_message_at', { ascending: false });
    },

    async getMessages(conversationId) {
      const client = window.MirasAPI.getClient();
      if (!client) return { data: [], error: null };

      return client
        .from('messages')
        .select(`
          *,
          sender:profiles!messages_sender_id_fkey(id, full_name, avatar_url)
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
    },

    async sendMessage({ conversationId, senderId, receiverId, content, attachmentUrl = null }) {
      const client = window.MirasAPI.getClient();
      if (!client) return { error: new Error('Supabase not connected') };

      const messageRes = await client
        .from('messages')
        .insert([{
          conversation_id: conversationId,
          sender_id: senderId,
          receiver_id: receiverId,
          content: content,
          attachment_url: attachmentUrl,
          is_read: false
        }])
        .select()
        .single();

      // تحديث آخر رسالة في المحادثة
      if (!messageRes.error) {
        await client.from('conversations').update({
          last_message: content,
          last_message_at: new Date().toISOString()
        }).eq('id', conversationId);
      }

      return messageRes;
    },

    subscribeToMessages(conversationId, callback) {
      const client = window.MirasAPI.getClient();
      if (!client) return null;

      return client
        .channel(`chat_${conversationId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        }, (payload) => {
          callback(payload.new);
        })
        .subscribe();
    }
  },

  // ----------------------------------------------------------------------------
  // 8. مركز خدمة عملاء الدعم الحضرمي اليدوي (Support Desk - NO BOTS)
  // الردود تتم يدوياً فقط بواسطة مالكة المنصة
  // ----------------------------------------------------------------------------
  support: {
    async createTicket({ userId, userName, userPhone, userRole, subject, category, message, attachmentUrl = null }) {
      const client = window.MirasAPI.getClient();
      if (!client) return { error: new Error('Supabase not connected') };

      // 1. إنشاء التذكرة
      const { data: ticket, error: ticketError } = await client
        .from('support_tickets')
        .insert([{
          user_id: userId || null,
          user_name: userName,
          user_phone: userPhone || null,
          user_role: userRole || 'client',
          subject: subject,
          category: category || 'general',
          status: 'new',
          priority: 'normal'
        }])
        .select()
        .single();

      if (ticketError || !ticket) return { data: null, error: ticketError };

      // 2. إدراج الرسالة الأولى
      const { data: msg, error: msgError } = await client
        .from('support_messages')
        .insert([{
          ticket_id: ticket.id,
          sender_id: userId || null,
          sender_type: 'user',
          sender_name: userName,
          message: message,
          attachment_url: attachmentUrl
        }])
        .select()
        .single();

      // 3. إرسال إشعار فوري لمالكة المنصة في لوحة Super Admin
      await window.MirasAPI.notifications.create({
        userId: userId,
        targetRole: 'super_admin',
        title: 'استفسار دعم حضرمي جديد',
        message: `استفسار جديد من ${userName} بعنوان: "${subject}"`,
        type: 'support',
        link: 'admin/settings.html',
        actorName: userName
      });

      return { data: { ticket, message: msg }, error: msgError };
    },

    async getUserTickets(userId) {
      const client = window.MirasAPI.getClient();
      if (!client) return { data: [], error: null };

      return client
        .from('support_tickets')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
    },

    async getAllTickets(statusFilter = null) {
      const client = window.MirasAPI.getClient();
      if (!client) return { data: [], error: null };

      let query = client
        .from('support_tickets')
        .select('*, messages:support_messages(*)')
        .order('updated_at', { ascending: false });

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      return query;
    },

    async getTicketMessages(ticketId) {
      const client = window.MirasAPI.getClient();
      if (!client) return { data: [], error: null };

      return client
        .from('support_messages')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });
    },

    async sendReply({ ticketId, senderId, senderType = 'admin', senderName = 'خدمة عملاء مِـرَاس', message, attachmentUrl = null }) {
      const client = window.MirasAPI.getClient();
      if (!client) return { error: new Error('Supabase not connected') };

      // التأكيد: لا توجد أي ردود آلية، هذا رد يدوي حقيقي
      const res = await client
        .from('support_messages')
        .insert([{
          ticket_id: ticketId,
          sender_id: senderId || null,
          sender_type: senderType,
          sender_name: senderName,
          message: message,
          attachment_url: attachmentUrl
        }])
        .select()
        .single();

      // تحديث حالة التذكرة
      const nextStatus = senderType === 'admin' ? 'waiting_user' : 'in_progress';
      await client
        .from('support_tickets')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', ticketId);

      return res;
    },

    async updateTicketStatus(ticketId, newStatus) {
      const client = window.MirasAPI.getClient();
      if (!client) return { error: new Error('Supabase not connected') };

      return client
        .from('support_tickets')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', ticketId)
        .select();
    },

    subscribeToTicket(ticketId, callback) {
      const client = window.MirasAPI.getClient();
      if (!client) return null;

      return client
        .channel(`support_${ticketId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
          filter: `ticket_id=eq.${ticketId}`
        }, (payload) => {
          callback(payload.new);
        })
        .subscribe();
    }
  },

  // ----------------------------------------------------------------------------
  // 9. المفضلة (Favorites)
  // ----------------------------------------------------------------------------
  favorites: {
    async list(userId) {
      const client = window.MirasAPI.getClient();
      if (!client) return { data: [], error: null };

      return client
        .from('favorites')
        .select(`
          id, created_at,
          craftsman:craftsmen_profiles!favorites_craftsman_id_fkey(
            id, trade_category, rating, total_reviews, completed_orders,
            user:profiles!craftsmen_profiles_user_id_fkey(id, full_name, city, avatar_url, phone_number)
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
    },

    async isFavorite(userId, craftsmanId) {
      const client = window.MirasAPI.getClient();
      if (!client || !userId) return false;

      const { data } = await client
        .from('favorites')
        .select('id')
        .eq('user_id', userId)
        .eq('craftsman_id', craftsmanId)
        .maybeSingle();

      return !!data;
    },

    async toggle(userId, craftsmanId) {
      const client = window.MirasAPI.getClient();
      if (!client || !userId) return { isFavorite: false };

      const existing = await this.isFavorite(userId, craftsmanId);
      if (existing) {
        await client.from('favorites').delete().eq('user_id', userId).eq('craftsman_id', craftsmanId);
        return { isFavorite: false };
      } else {
        await client.from('favorites').insert([{ user_id: userId, craftsman_id: craftsmanId }]);
        return { isFavorite: true };
      }
    }
  },

  // ----------------------------------------------------------------------------
  // 10. التقييمات والآراء (Reviews)
  // ----------------------------------------------------------------------------
  reviews: {
    async listForCraftsman(craftsmanId) {
      const client = window.MirasAPI.getClient();
      if (!client) return { data: [], error: null };

      return client
        .from('reviews')
        .select(`
          *,
          client:profiles!reviews_client_id_fkey(full_name, avatar_url, city)
        `)
        .eq('craftsman_id', craftsmanId)
        .order('created_at', { ascending: false });
    },

    async create({ orderId, clientId, craftsmanId, rating, comment }) {
      const client = window.MirasAPI.getClient();
      if (!client) return { error: new Error('Supabase not connected') };

      // التحقق أولاً من أن الطلب مكتمل فعلياً
      if (orderId) {
        const { data: ord } = await client.from('service_orders').select('status').eq('id', orderId).single();
        if (ord && ord.status !== 'completed') {
          return { data: null, error: new Error('لا يمكن تقييم خدمة لم تكتمل بعد.') };
        }
      }

      const reviewRes = await client
        .from('reviews')
        .insert([{
          order_id: orderId || null,
          client_id: clientId,
          craftsman_id: craftsmanId,
          rating: rating,
          comment: comment
        }])
        .select()
        .single();

      // تحديث متوسط تقييم الحرفي
      if (!reviewRes.error) {
        const { data: allReviews } = await client
          .from('reviews')
          .select('rating')
          .eq('craftsman_id', craftsmanId);

        if (allReviews && allReviews.length > 0) {
          const avg = allReviews.reduce((sum, r) => sum + Number(r.rating), 0) / allReviews.length;
          await client.from('craftsmen_profiles').update({
            rating: Number(avg.toFixed(2)),
            total_reviews: allReviews.length
          }).eq('id', craftsmanId);
        }
      }

      return reviewRes;
    }
  },

  // ----------------------------------------------------------------------------
  // 11. الإشعارات وسجل النشاطات الإدارية (Notifications & Logs)
  // ----------------------------------------------------------------------------
  notifications: {
    async list(userId) {
      const client = window.MirasAPI.getClient();
      if (!client || !userId) return { data: [], error: null };

      return client
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30);
    },

    async listAdminNotifications() {
      const client = window.MirasAPI.getClient();
      if (!client) return { data: [], error: null };

      return client
        .from('notifications')
        .select('*')
        .eq('target_role', 'super_admin')
        .order('created_at', { ascending: false })
        .limit(50);
    },

    async create({ userId = null, targetRole = 'user', title, message, type = 'info', link = null, actorName = null }) {
      const client = window.MirasAPI.getClient();
      if (!client) return { error: null };

      return client
        .from('notifications')
        .insert([{
          user_id: userId,
          target_role: targetRole,
          title,
          message,
          type,
          link,
          actor_name: actorName,
          is_read: false
        }]);
    },

    async markAsRead(notificationId) {
      const client = window.MirasAPI.getClient();
      if (!client) return { error: null };

      return client
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);
    },

    subscribeAdmin(callback) {
      const client = window.MirasAPI.getClient();
      if (!client) return null;

      return client
        .channel('admin_notifications_channel')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: 'target_role=eq.super_admin'
        }, (payload) => {
          callback(payload.new);
        })
        .subscribe();
    }
  },

  // ----------------------------------------------------------------------------
  // 12. رفع وتخزين الملفات (Supabase Storage)
  // ----------------------------------------------------------------------------
  storage: {
    async uploadFile(bucket, file, customPath = null) {
      const client = window.MirasAPI.getClient();
      if (!client) return { url: null, error: new Error('Supabase not connected') };

      const fileExt = file.name ? file.name.split('.').pop() : 'jpg';
      const fileName = customPath || `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { data, error } = await client.storage
        .from(bucket)
        .upload(filePath, file, { cacheControl: '3600', upsert: true });

      if (error) return { url: null, error };

      const { data: publicUrlData } = client.storage.from(bucket).getPublicUrl(filePath);
      return { url: publicUrlData.publicUrl, error: null };
    }
  },

  // ----------------------------------------------------------------------------
  // 13. وظائف إدارة المنصة الخاصة بمالكة المنصة (Super Admin Control)
  // ----------------------------------------------------------------------------
  admin: {
    async getStats() {
      const client = window.MirasAPI.getClient();
      if (!client) return null;

      const [craftsmenAll, craftsmenPending, ordersRes, usersRes] = await Promise.all([
        client.from('craftsmen_profiles').select('*', { count: 'exact', head: true }),
        client.from('craftsmen_profiles').select('*', { count: 'exact', head: true }).eq('verification_status', 'pending'),
        client.from('service_orders').select('*', { count: 'exact', head: true }),
        client.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'client')
      ]);

      return {
        totalCraftsmen: craftsmenAll.count || 0,
        pendingApprovals: craftsmenPending.count || 0,
        totalOrders: ordersRes.count || 0,
        totalClients: usersRes.count || 0
      };
    },

    async listCraftsmen(status = null) {
      const client = window.MirasAPI.getClient();
      if (!client) return { data: [], error: null };

      let query = client
        .from('craftsmen_profiles')
        .select(`
          *,
          user:profiles!craftsmen_profiles_user_id_fkey(id, full_name, phone_number, city, avatar_url, created_at)
        `)
        .order('created_at', { ascending: false });

      if (status && status !== 'all') {
        query = query.eq('verification_status', status);
      }
      return query;
    },

    async updateCraftsmanStatus(craftsmanId, status) {
      const client = window.MirasAPI.getClient();
      if (!client) return { error: new Error('Supabase not connected') };

      const res = await client
        .from('craftsmen_profiles')
        .update({ 
          verification_status: status, 
          is_available: status === 'verified',
          updated_at: new Date().toISOString() 
        })
        .eq('id', craftsmanId)
        .select(`*, user:profiles!craftsmen_profiles_user_id_fkey(id, full_name)`);

      // إشعار للحرفي بنتيجة قرار مالكة المنصة
      if (res.data && res.data[0]) {
        const item = res.data[0];
        const statusAr = status === 'verified' ? 'تم اعتماد وتفعيل حسابك بنجاح' : 'تم رفض طلب الانضمام';
        await window.MirasAPI.notifications.create({
          userId: item.user_id,
          targetRole: 'craftsman',
          title: 'تحديث حالة الحساب من إدارة مِـرَاس',
          message: `${statusAr} من قبل مالكة المنصة.`,
          type: 'verification',
          link: status === 'verified' ? 'pro/index.html' : 'support.html'
        });
      }

      return res;
    },

    async listAllOrders(status = null) {
      const client = window.MirasAPI.getClient();
      if (!client) return { data: [], error: null };

      let query = client
        .from('service_orders')
        .select(`
          *,
          client:profiles!service_orders_client_id_fkey(id, full_name, phone_number, city),
          craftsman:craftsmen_profiles!service_orders_craftsman_id_fkey(
            id, trade_category,
            user:profiles!craftsmen_profiles_user_id_fkey(id, full_name, phone_number)
          )
        `)
        .order('created_at', { ascending: false });

      if (status && status !== 'all') {
        query = query.eq('status', status);
      }
      return query;
    }
  }
};
