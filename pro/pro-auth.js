/**
 * Miras Professional Dashboard - Supabase & Dynamic Account Module
 * منصة مِـرَاس - نظام لوحة الحرفي والمهني متعدد الحسابات
 * 
 * واجهة واحدة مشتركة لجميع المهنيين تعرض بيانات كل مهني ديناميكياً
 * بناءً على حسابه المسجل (Account ID / User ID) في Supabase.
 */

const MIRAS_PRO_CONFIG = {
  SUPABASE_URL: window.ENV?.SUPABASE_URL || 'https://YOUR_PROJECT_ID.supabase.co',
  SUPABASE_ANON_KEY: window.ENV?.SUPABASE_ANON_KEY || 'YOUR_ANON_KEY',
  REQUIRED_ROLE: 'craftsman'
};

const ProAuth = {
  supabase: null,
  currentPro: null,

  init() {
    if (window.supabase) {
      this.supabase = window.supabase.createClient(MIRAS_PRO_CONFIG.SUPABASE_URL, MIRAS_PRO_CONFIG.SUPABASE_ANON_KEY);
      this.loadProAccount();
    } else {
      console.info('💡 [مِـرَاس الحرفيين]: واجهة الحرفي والمهني موحدة وجاهزة لعرض بيانات كل حساب ديناميكياً.');
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
