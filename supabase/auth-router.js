/**
 * Miras Auth & Role-Based Router
 * نظام المصادقة والتوجيه الذكي بحسب الصلاحيات لمنصة مِـرَاس
 * 
 * يحدد المسار المخصص لكل مستخدم بعد تسجيل الدخول بناءً على نوع حسابه وصلاحياته في Supabase:
 * 1. المدير (admin / is_admin = true) ➔ لوحة تحكم المدير (/admin/)
 * 2. صاحب المهنة (craftsman) ➔ لوحة تحكم صاحب المهنة (/pro/)
 * 3. المستخدم العادي (client) ➔ واجهة المستخدم الرئيسية (/index.html)
 */

window.MirasRouter = {
  // تهيئة عميل Supabase
  getClient() {
    const config = window.MIRAS_ENV || {};
    if (window.supabase && config.SUPABASE_URL && !config.SUPABASE_URL.includes('YOUR_PROJECT_ID')) {
      try {
        const cleanUrl = config.SUPABASE_URL.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
        return window.supabase.createClient(cleanUrl, config.SUPABASE_ANON_KEY);
      } catch (e) {
        console.error('[MirasRouter] خطأ في تهيئة عميل Supabase:', e);
      }
    }
    return null;
  },

  // توجيه المستخدم تلقائياً بناءً على دوره وصلاحياته
  async routeUser(sessionUser = null, explicitRole = null) {
    const supabase = this.getClient();

    // 1. فحص الدور والصلاحيات الحية في Supabase
    if (supabase) {
      try {
        let user = sessionUser;
        if (!user) {
          const { data: { session } } = await supabase.auth.getSession();
          user = session?.user;
        }

        if (user) {
          // استعلام الصلاحيات من جدول profiles
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('role, is_admin')
            .eq('id', user.id)
            .single();

          if (!error && profile) {
            if (profile.role === 'admin' || profile.is_admin === true) {
              sessionStorage.setItem('miras_auth_role', 'admin');
              return this.navigate('admin/index.html');
            }
            if (profile.role === 'craftsman') {
              sessionStorage.setItem('miras_auth_role', 'craftsman');
              return this.navigate('pro/index.html');
            }
            // مستخدم عادي
            sessionStorage.setItem('miras_auth_role', 'client');
            return this.navigate('index.html');
          }
        }
      } catch (err) {
        console.error('[MirasRouter] خطأ أثناء استعلام الصلاحيات من Supabase:', err);
      }
    }

    // 2. وضع المعاينة والتطوير (عندما تكون مفاتيح Supabase غير مفعلة بعد):
    const role = explicitRole || sessionStorage.getItem('miras_auth_role') || 'client';
    if (role === 'admin') {
      return this.navigate('admin/index.html');
    } else if (role === 'craftsman' || role === 'pro') {
      return this.navigate('pro/index.html');
    } else {
      return this.navigate('index.html');
    }
  },

  // حل المسار النسبي بدقة من أي صفحة فرعية
  navigate(targetPath) {
    const pathname = window.location.pathname;
    let prefix = '';
    
    // إذا كانت الصفحة داخل مجلد فرعي
    if (pathname.includes('/admin/mobile/') || pathname.includes('/pro/mobile/')) {
      prefix = '../../';
    } else if (pathname.includes('/admin/') || pathname.includes('/pro/') || pathname.includes('/mobile/')) {
      prefix = '../';
    }
    
    window.location.href = prefix + targetPath;
  }
};
