/**
 * Miras Professional Dashboard - Supabase & Dynamic Account Module
 * منصة مِـرَاس - نظام لوحة الحرفي والمهني متعدد الحسابات
 */

const ProAuth = {
  supabase: null,
  currentPro: null,

  init() {
    const config = window.MIRAS_ENV || {};
    const url = config.SUPABASE_URL;
    const anonKey = config.SUPABASE_ANON_KEY;

    if (window.supabase && url && !url.includes('YOUR_PROJECT_ID')) {
      try {
        this.supabase = window.supabase.createClient(url, anonKey);
        this.loadProAccount();
      } catch (e) {
        console.error('خطأ في تهيئة Supabase للحرفي:', e);
      }
    } else {
      console.info('💡 [مِـرَاس الحرفيين]: وضع المعاينة نشط. للربط الحي، ضع مفاتيح Supabase في supabase/config.js');
    }
  },

  async loadProAccount() {
    if (!this.supabase) return;
    try {
      const { data: { session }, error } = await this.supabase.auth.getSession();
      if (error || !session) return;
      
      const userId = session.user.id;
      
      // جلب بيانات الحرفي الخاصة بحسابه حصراً بدون خلط
      const { data: proProfile, error: proError } = await this.supabase
        .from('craftsmen_profiles')
        .select(`
          id, full_name, trade_category, national_id_verified,
          rating, total_reviews, wallet_balance, active_orders_count
        `)
        .eq('user_id', userId)
        .single();

      if (proError || !proProfile) {
        console.warn('لم يتم العثور على ملف مهني خاص بهذا الحساب.');
        return;
      }

      this.currentPro = proProfile;
      this.renderProData(proProfile);
    } catch (err) {
      console.error('خطأ أثناء تحميل بيانات الحرفي:', err);
    }
  },

  renderProData(data) {
    const map = {
      'pro_name': data.full_name,
      'pro_trade': data.trade_category,
      'pro_rating': data.rating ? `${data.rating} ★` : '',
      'pro_wallet_balance': data.wallet_balance ? `${data.wallet_balance} ر.س` : '',
      'pro_active_orders': data.active_orders_count || '0'
    };

    for (const [field, value] of Object.entries(map)) {
      document.querySelectorAll(`[data-supabase-field="${field}"]`).forEach(el => {
        if (value) el.textContent = value;
      });
    }
  },

  async logout() {
    if (this.supabase) {
      await this.supabase.auth.signOut();
    }
    window.location.href = '../pro-login.html';
  }
};

document.addEventListener('DOMContentLoaded', () => {
  ProAuth.init();
});
