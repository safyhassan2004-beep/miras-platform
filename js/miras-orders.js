/**
 * Miras Orders Management Engine
 * منصة مِـرَاس - محرك إدارة طلبات وحجوزات العملاء
 */

const MirasOrders = {
  STORAGE_KEY: 'miras_orders',

  // جلب كافة طلبات العميل
  getOrders() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('[MirasOrders] خطأ في قراءة الطلبات:', e);
    }
    return [];
  },

  // حفظ قائمة الطلبات
  saveOrders(list) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list));
      window.dispatchEvent(new CustomEvent('miras:orders_updated', { detail: { count: list.length, list } }));
    } catch (e) {
      console.error('[MirasOrders] خطأ في حفظ الطلبات:', e);
    }
  },

  // البحث عن طلب بمعرفه
  getOrderById(orderId) {
    if (!orderId) return null;
    const cleanId = String(orderId).replace('#', '').trim();
    const orders = this.getOrders();
    return orders.find(o => String(o.id).replace('#', '').trim() === cleanId) || null;
  },

  // إنشاء وتوثيق طلب جديد
  async createOrder(orderData) {
    const randomCode = 'MRS-' + Math.floor(100000 + Math.random() * 900000);
    const newOrder = {
      id: randomCode,
      title: orderData.title || orderData.notes?.substring(0, 45) || 'طلب صيانة منزلية بضمان مِـرَاس',
      description: orderData.notes || orderData.description || 'طلب صيانة معتمد عبر منصة مِـرَاس في حضرموت',
      trade_category: orderData.trade_category || 'تكييف وتبريد',
      city: orderData.city || 'المكلا',
      location_details: orderData.address || `${orderData.city || 'المكلا'} — حضرموت`,
      estimated_budget: Number(orderData.budget) || 12000,
      status: 'new', // new, in_progress, completed, cancelled
      status_label: 'طلب جديد بانتظار التأكيد',
      urgency: orderData.urgency || 'اليوم - فترة العصر',
      created_at: new Date().toISOString(),
      craftsman: {
        id: orderData.craftsman_id || '1',
        name: orderData.craftsman_name || 'المعلم سعيد بن مخاشن',
        trade: orderData.craftsman_trade || 'فني تكييف وتبريد معتمد',
        city: orderData.city || 'المكلا',
        phone: orderData.craftsman_phone || '+967781125928',
        rating: '4.9',
        avatar_url: orderData.craftsman_avatar || 'https://lh3.googleusercontent.com/aida-public/AB6AXuAo_sGOwgiy2SLIEuzYnLAVbAT1SqhbWskKmEJ1N5J_ZbU43QH2vyWghadkgbtXD5jUJU6MfkrPs0zQv83kpoUHFdwodNpzimFwwsYOLy6j3hpLCLdyD9d32Kafddv_qCe7CIqcOe3MBNAuzic6SlfYORAngjWmEorfuoCjzuqXrmN6tsdhMuWbhkiHP-ogNLYYraMYsUMv7P5PGBbb0-GqGW4C5bzkWxp6sWnvJSY'
      },
      client: {
        name: orderData.client_name || localStorage.getItem('miras_user_name') || 'عميل مِـرَاس',
        phone: orderData.client_phone || localStorage.getItem('miras_registered_phone') || '+967 7XXXXXXXX'
      }
    };

    // حفظ في التخزين المحلي فورياً
    let list = this.getOrders();
    list.unshift(newOrder);
    this.saveOrders(list);

    // محاولة الإرسال لـ Supabase في الخلفية إن توفرت
    try {
      if (window.MirasAPI && window.MirasAPI.orders) {
        const user = await window.MirasAPI.auth.getCurrentUser();
        await window.MirasAPI.orders.create({
          client_id: user?.id || null,
          craftsman_id: newOrder.craftsman.id,
          title: newOrder.title,
          trade_category: newOrder.trade_category,
          description: newOrder.description,
          city: newOrder.city,
          location_details: newOrder.location_details,
          estimated_budget: newOrder.estimated_budget,
          clientName: newOrder.client.name
        });
      }
    } catch (e) {
      console.warn('[MirasOrders] مزامنة Supabase الخلفية:', e);
    }

    return newOrder;
  }
};

window.MirasOrders = MirasOrders;
