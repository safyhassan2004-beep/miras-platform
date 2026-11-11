/**
 * Miras Admin Dashboard - Supabase & Auth Integration Module
 * منصة مِـرَاس - نظام حوكمة وصلاحيات المشرفين والإدارة
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
        this.supabase = window.supabase.createClient(url, anonKey);
        this.checkSession();
      } catch (e) {
        console.error('خطأ في تهيئة Supabase:', e);
      }
    } else {
      console.info('💡 [مِـرَاس الإدارة]: وضع المعاينة نشط. للربط الحي، ضع مفاتيح Supabase في supabase/config.js');
    }
  },

  async checkSession() {
    if (!this.supabase) return;
    try {
      const { data: { session }, error } = await this.supabase.auth.getSession();
      if (error || !session) {
        console.warn('⚠️ لا توجد جلسة نشطة للمشرف.');
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

    if (error || (!profile.is_admin && profile.role !== 'admin')) {
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
