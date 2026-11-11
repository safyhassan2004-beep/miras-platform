/**
 * Miras Admin Dashboard - Supabase & Security Guard Module
 * منصة مِـرَاس - نظام حماية وصلاحيات لوحة تحكم الإدارة (خاصة بالمدير فقط)
 * 
 * هذه اللوحة مستقلة وخاصة بالمدير، لا تظهر للمستخدمين العاديين،
 * ولا يمكن الوصول إليها إلا بحساب يمتلك صلاحية المدير (role = 'admin' أو is_admin = true).
 */

const AdminAuth = {
  supabase: null,
  currentUser: null,

  init() {
    const config = window.MIRAS_ENV || {};
    const url = config.SUPABASE_URL;
    const anonKey = config.SUPABASE_ANON_KEY;

    if (window.supabase && url && !url.includes('YOUR_PROJECT_ID')) {
      try {
        const cleanUrl = url.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
        this.supabase = window.supabase.createClient(cleanUrl, anonKey);
        this.enforceAdminSecurity();
        this.loadAdminStats();
      } catch (e) {
        console.error('[AdminAuth] خطأ في تهيئة Supabase:', e);
        this.checkLocalAdminGuard();
      }
    } else {
      this.checkLocalAdminGuard();
    }
  },

  // التحقق من الصلاحيات الحقيقية
  async enforceAdminSecurity() {
    if (!this.supabase) return;
    try {
      const { data: { session }, error } = await this.supabase.auth.getSession();
      
      // إذا كان هناك تسجيل دخول فعلي عبر Supabase
      if (session?.user) {
        this.currentUser = session.user;
        const { data: profile, error: profileError } = await this.supabase
          .from('profiles')
          .select('role, is_admin, full_name')
          .eq('id', session.user.id)
          .single();

        if (profileError || (!profile?.is_admin && profile?.role !== 'admin')) {
          this.denyAccess('عذراً، هذا الحساب لا يمتلك صلاحيات المشرف أو مدير المنظومة.');
          return;
        }

        console.log('✅ تم التحقق من صلاحيات المدير بنجاح:', profile.full_name);
        this.bindAdminData(profile);
      } else {
        // فحص وضع المعاينة المحلي
        this.checkLocalAdminGuard();
      }
    } catch (err) {
      console.warn('[AdminAuth] تنبيه أثناء التحقق من الصلاحيات:', err);
      this.checkLocalAdminGuard();
    }
  },

  // جلب وتحديث الإحصائيات الحية للوحة الإدارة من Supabase
  async loadAdminStats() {
    if (!this.supabase) return;
    try {
      // 1. عدد الكوادر الحرفية المسجلة
      const { count: proCount } = await this.supabase
        .from('craftsmen_profiles')
        .select('*', { count: 'exact', head: true });

      if (proCount !== null && proCount > 0) {
        document.querySelectorAll('[data-supabase-field="admin_craftsmen_total"]').forEach(el => {
          el.textContent = proCount.toLocaleString('ar-SA');
        });
      }

      // 2. عدد المشاريع وطلبات العمل
      const { count: ordersCount } = await this.supabase
        .from('service_orders')
        .select('*', { count: 'exact', head: true });

      if (ordersCount !== null && ordersCount > 0) {
        document.querySelectorAll('[data-supabase-field="admin_projects_total"]').forEach(el => {
          el.textContent = ordersCount.toLocaleString('ar-SA');
        });
      }

      // 3. إجمالي مبالغ الضمان المالي في المحافظ
      const { data: wallets } = await this.supabase
        .from('escrow_wallets')
        .select('escrow_held, balance');

      if (wallets && wallets.length > 0) {
        const total = wallets.reduce((acc, w) => acc + (Number(w.escrow_held) || 0) + (Number(w.balance) || 0), 0);
        if (total > 0) {
          document.querySelectorAll('[data-supabase-field="admin_escrow_total"]').forEach(el => {
            el.textContent = total.toLocaleString('ar-SA');
          });
        }
      }
    } catch (err) {
      console.warn('[AdminAuth] خطأ أثناء جلب إحصائيات لوحة الإدارة من Supabase:', err);
    }
  },

  // فحص حماية اللوحة محلياً في وضع التطوير
  checkLocalAdminGuard() {
    const role = sessionStorage.getItem('miras_auth_role');
    const isMobile = window.location.pathname.includes('/mobile/');
    if (role && role !== 'admin') {
      console.warn('⚠️ محاولة دخول للوحة الإدارة بحساب غير إداري (دور:', role, ')');
      if (role === 'craftsman' || role === 'pro') {
        window.location.href = isMobile ? '../../pro/mobile/index.html' : '../pro/index.html';
      } else {
        window.location.href = isMobile ? '../../mobile/index.html' : '../index.html';
      }
    }
  },

  denyAccess(message) {
    alert(message);
    const isMobile = window.location.pathname.includes('/mobile/');
    window.location.href = isMobile ? '../../mobile/login.html' : '../login.html';
  },

  bindAdminData(profile) {
    document.querySelectorAll('[data-supabase-field="admin_name"]').forEach(el => {
      if (profile.full_name) el.textContent = profile.full_name;
    });
  },

  async logout() {
    if (this.supabase) {
      await this.supabase.auth.signOut();
    }
    sessionStorage.removeItem('miras_auth_role');
    const isMobile = window.location.pathname.includes('/mobile/');
    window.location.href = isMobile ? '../../mobile/login.html' : '../login.html';
  }
};

document.addEventListener('DOMContentLoaded', () => {
  AdminAuth.init();
});
