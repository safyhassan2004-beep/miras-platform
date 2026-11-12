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
          .select('role, is_admin, is_super_admin, full_name, phone_number, country, city')
          .eq('id', session.user.id)
          .single();

        const isSuperAdmin = session.user?.email && session.user.email.toLowerCase() === 'safyhassan2004@gmail.com';
        const hasAdminAccess = isSuperAdmin || profile?.role === 'super_admin' || profile?.role === 'admin' || profile?.is_admin || profile?.is_super_admin;
        
        if (!hasAdminAccess) {
          this.denyAccess('عذراً، هذا الحساب لا يمتلك صلاحيات المشرف أو مدير المنظومة.');
          return;
        }

        console.log('✅ تم التحقق من صلاحيات الإدارة بنجاح:', profile?.full_name || session.user.email);
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
    if (role && role !== 'admin' && role !== 'super_admin') {
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
    const isOwner = (this.currentUser?.email && this.currentUser.email.toLowerCase() === 'safyhassan2004@gmail.com') || profile?.role === 'super_admin' || profile?.is_super_admin;
    const displayName = isOwner ? 'مالكة المنصة (Super Admin)' : (profile?.full_name || 'مدير المنصة');

    document.querySelectorAll('[data-supabase-field="admin_name"]').forEach(el => {
      el.textContent = displayName;
    });

    document.querySelectorAll('[data-supabase-field="admin_role_badge"]').forEach(el => {
      el.textContent = isOwner ? 'مالكة المنصة • Super Admin' : 'مدير النظام';
    });

    document.querySelectorAll('[data-supabase-field="admin_country_badge"]').forEach(el => {
      el.textContent = 'الجمهورية اليمنية (+967)';
    });

    document.querySelectorAll('[data-supabase-field="admin_email"]').forEach(el => {
      el.textContent = this.currentUser?.email || (isOwner ? 'safyhassan2004@gmail.com' : 'admin@miras.ye');
    });

    document.querySelectorAll('[data-supabase-field="admin_phone"]').forEach(el => {
      el.textContent = isOwner ? '+967 78 112 5928' : (profile?.phone_number || '+967 78 112 5928');
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
