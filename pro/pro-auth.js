/**
 * Miras Professional Dashboard - Supabase & Dynamic Account Module
 * منصة مِـرَاس - نظام لوحة الحرفي والمهني (خاصة بكل صاحب مهنة)
 * 
 * هذه اللوحة مستقلة وخاصة بأصحاب المهن فقط، وتعرض بيانات كل مهني وملفه
 * ومحفظته وطلباته بحسب حسابه المسجل (Account ID / User ID) في Supabase دون خلط مع حسابات أخرى.
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
        const cleanUrl = url.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
        this.supabase = window.supabase.createClient(cleanUrl, anonKey);
        this.enforceCraftsmanSecurity();
      } catch (e) {
        console.error('[ProAuth] خطأ في تهيئة Supabase للحرفي:', e);
        this.checkLocalCraftsmanGuard();
      }
    } else {
      this.checkLocalCraftsmanGuard();
    }
  },

  // التحقق الحقيقي من صلاحيات الحرفي وجلب بيانات حسابه حصراً
  async enforceCraftsmanSecurity() {
    if (!this.supabase) return;
    try {
      const { data: { session }, error } = await this.supabase.auth.getSession();
      
      // إذا كان هناك تسجيل دخول حي في Supabase
      if (session?.user) {
        const userId = session.user.id;

        // 1. فحص نوع الحساب
        const { data: userProfile, error: profileError } = await this.supabase
          .from('profiles')
          .select('role, full_name, phone_number')
          .eq('id', userId)
          .single();

        if (profileError || (userProfile && userProfile.role !== 'craftsman' && userProfile.role !== 'admin')) {
          this.denyAccess('عذراً، هذه الواجهة مخصصة لأصحاب المهن والكوادر الحرفية المعتمدة فقط.');
          return;
        }

        // 2. جلب بيانات الملف المهني الخاصة بالحرفي المسجل حصراً
        const { data: proProfile } = await this.supabase
          .from('craftsmen_profiles')
          .select(`
            id, trade_category, experience_years, is_available,
            rating, total_reviews, completed_orders, active_orders_count,
            verification_status
          `)
          .eq('user_id', userId)
          .single();

        // 3. جلب رصيد محفظة الحرفي حصراً
        const { data: walletData } = await this.supabase
          .from('escrow_wallets')
          .select('balance, escrow_held')
          .eq('user_id', userId)
          .single();

        this.currentPro = {
          ...userProfile,
          ...proProfile,
          wallet: walletData
        };

        console.log('✅ تم تحميل بيانات الحساب المهني بنجاح للمستخدم:', userProfile?.full_name);
        this.renderProData(this.currentPro);
      } else {
        // فحص وضع المعاينة المحلي
        this.checkLocalCraftsmanGuard();
      }
    } catch (err) {
      console.warn('[ProAuth] تنبيه أثناء جلب بيانات الحرفي:', err);
      this.checkLocalCraftsmanGuard();
    }
  },

  // فحص حماية اللوحة محلياً في وضع التطوير
  checkLocalCraftsmanGuard() {
    const role = sessionStorage.getItem('miras_auth_role');
    const isMobile = window.location.pathname.includes('/mobile/');
    if (role === 'client') {
      console.warn('⚠️ محاولة دخول للوحة أصحاب المهن بحساب عميل عادي.');
      window.location.href = isMobile ? '../../mobile/index.html' : '../index.html';
    }
  },

  denyAccess(message) {
    alert(message);
    const isMobile = window.location.pathname.includes('/mobile/');
    window.location.href = isMobile ? '../../mobile/pro-login.html' : '../pro-login.html';
  },

  renderProData(data) {
    if (!data) return;
    const map = {
      'pro_name': data.full_name,
      'pro_trade': data.trade_category,
      'pro_rating': data.rating ? `${data.rating} ★` : '',
      'pro_wallet_balance': data.wallet?.balance !== undefined ? `${data.wallet.balance} ر.ي` : '',
      'pro_escrow_held': data.wallet?.escrow_held !== undefined ? `${data.wallet.escrow_held} ر.ي` : '',
      'pro_active_orders': data.active_orders_count !== undefined ? String(data.active_orders_count) : '',
      'pro_completed_orders': data.completed_orders !== undefined ? String(data.completed_orders) : ''
    };

    for (const [field, value] of Object.entries(map)) {
      if (value) {
        document.querySelectorAll(`[data-supabase-field="${field}"]`).forEach(el => {
          el.textContent = value;
        });
      }
    }
  },

  async logout() {
    if (this.supabase) {
      await this.supabase.auth.signOut();
    }
    sessionStorage.removeItem('miras_auth_role');
    const isMobile = window.location.pathname.includes('/mobile/');
    window.location.href = isMobile ? '../../mobile/pro-login.html' : '../pro-login.html';
  }
};

document.addEventListener('DOMContentLoaded', () => {
  ProAuth.init();
});
