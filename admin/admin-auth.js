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
      } catch (e) {
        console.error('[AdminAuth] خطأ في تهيئة Supabase:', e);
      }
    } else {
      // فحص الحماية في وضع المعاينة
      this.checkLocalAdminGuard();
    }
  },

  // التحقق الحقيقي الصارم من الصلاحيات عبر Supabase
  async enforceAdminSecurity() {
    if (!this.supabase) return;
    try {
      const { data: { session }, error } = await this.supabase.auth.getSession();
      if (error || !session) {
        this.denyAccess('يجب تسجيل الدخول بحساب مدير للوصول إلى لوحة التحكم.');
        return;
      }

      this.currentUser = session.user;
      const { data: profile, error: profileError } = await this.supabase
        .from('profiles')
        .select('role, is_admin, full_name')
        .eq('id', session.user.id)
        .single();

      if (profileError || (!profile.is_admin && profile.role !== 'admin')) {
        this.denyAccess('عذراً، هذا الحساب لا يمتلك صلاحيات المشرف أو مدير المنظومة.');
        return;
      }

      console.log('✅ تم التحقق من صلاحيات المدير بنجاح:', profile.full_name);
      this.bindAdminData(profile);
    } catch (err) {
      console.error('[AdminAuth] خطأ أثناء التحقق من الصلاحيات:', err);
    }
  },

  // فحص حماية اللوحة محلياً في وضع التطوير
  checkLocalAdminGuard() {
    const role = sessionStorage.getItem('miras_auth_role');
    const isMobile = window.location.pathname.includes('/mobile/');
    if (role && role !== 'admin') {
      console.warn('⚠️ محاولة دخول للوحة الإدارة بحساب غير إداري (دور:', role, ')');
      // تحويل المستخدم لواجهته المخصصة
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
