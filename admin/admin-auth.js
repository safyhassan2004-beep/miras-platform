/**
 * Miras Admin Dashboard - Supabase & Auth Integration Module
 * منصة مِـرَاس - نظام حوكمة وصلاحيات المشرفين والإدارة
 * 
 * هذا الملف مجهز للربط المباشر مع Supabase ونظام الصلاحيات (RBAC).
 * عند توفير مفاتيح الربط (SUPABASE_URL و SUPABASE_ANON_KEY)،
 * يقوم هذا السكربت بالتحقق التلقائي من جلسة المشرف وصلاحياته.
 */

const MIRAS_ADMIN_CONFIG = {
  SUPABASE_URL: window.ENV?.SUPABASE_URL || 'https://YOUR_PROJECT_ID.supabase.co',
  SUPABASE_ANON_KEY: window.ENV?.SUPABASE_ANON_KEY || 'YOUR_ANON_KEY',
  REQUIRED_ROLE: 'admin' // الصلاحية المطلوبة للوصول لهذه اللوحة
};

const AdminAuth = {
  supabase: null,
  currentUser: null,

  init() {
    if (window.supabase) {
      this.supabase = window.supabase.createClient(MIRAS_ADMIN_CONFIG.SUPABASE_URL, MIRAS_ADMIN_CONFIG.SUPABASE_ANON_KEY);
      this.checkSession();
    } else {
      console.info('💡 [مِـرَاس الإدارة]: واجهة إدارة مِـرَاس جاهزة ومجهزة للربط الحي مع Supabase.');
    }
  },

  async checkSession() {
    if (!this.supabase) return;
    try {
      const { data: { session }, error } = await this.supabase.auth.getSession();
      if (error || !session) {
        console.warn('⚠️ لا توجد جلسة نشطة للمشرف. سيتم التوجيه لتسجيل الدخول عند تفعيل الحماية الحية.');
        return;
      }
      this.currentUser = session.user;
      await this.verifyAdminRole(session.user.id);
    } catch (err) {
      console.error('خطأ أثناء فحص الجلسة:', err);
    }
  },

  async verifyAdminRole(userId) {
    if (!this.supabase) return;
    const { data: profile, error } = await this.supabase
      .from('profiles')
      .select('role, is_admin, full_name')
      .eq('id', userId)
      .single();

    if (error || (!profile.is_admin && profile.role !== MIRAS_ADMIN_CONFIG.REQUIRED_ROLE)) {
      alert('عذراً، هذا الحساب غير مصرح له بالدخول إلى لوحة الإدارة.');
      window.location.href = '../login.html';
      return;
    }
    console.log('✅ تم التحقق من صلاحية المشرف:', profile.full_name);
    this.bindAdminData(profile);
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
    window.location.href = '../login.html';
  }
};

document.addEventListener('DOMContentLoaded', () => {
  AdminAuth.init();
});
