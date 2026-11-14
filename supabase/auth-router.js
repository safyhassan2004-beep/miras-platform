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
  _client: null,

  // تهيئة واستعادة عميل Supabase المشترك
  getClient() {
    if (this._client) return this._client;
    const config = window.MIRAS_ENV || {};
    if (window.supabase && config.SUPABASE_URL && !config.SUPABASE_URL.includes('YOUR_PROJECT_ID')) {
      try {
        const cleanUrl = config.SUPABASE_URL.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
        this._client = window.supabase.createClient(cleanUrl, config.SUPABASE_ANON_KEY);
        return this._client;
      } catch (e) {
        console.error('[MirasRouter] خطأ في تهيئة عميل Supabase:', e);
      }
    }
    return null;
  },

  // تسجيل حساب جديد في Supabase Auth
  async signUp({ email, password, fullName, phone, role, city, tradeCategory }) {
    const supabase = this.getClient();
    if (!supabase) {
      console.warn('[MirasRouter] Supabase غير متصل، استخدام الوضع المحلي');
      sessionStorage.setItem('miras_auth_role', role || 'client');
      return { data: { user: { email } }, error: null };
    }

    try {
      const isOwner = email && email.toLowerCase() === 'safyhassan2004@gmail.com';
      const safeRole = isOwner ? 'super_admin' : (role === 'admin' || role === 'super_admin' ? 'client' : (role || 'client'));
      const normPhone = (window.MirasAPI && window.MirasAPI.normalizePhone) 
        ? window.MirasAPI.normalizePhone(phone) 
        : (phone ? (phone.startsWith('+967') ? phone : '+967' + phone.replace(/^0/, '')) : '+967781125928');

      const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            full_name: isOwner ? 'مالكة المنصة (Super Admin)' : fullName,
            phone_number: isOwner ? '+967781125928' : normPhone,
            role: safeRole,
            country: 'Yemen',
            city: city || 'حضرموت — المكلا',
            trade_category: tradeCategory || 'صيانة وتشطيبات عامة'
          }
        }
      });
      return { data, error };
    } catch (err) {
      console.error('[MirasRouter] استثناء أثناء إنشاء الحساب:', err);
      return { data: null, error: err };
    }
  },

  // تسجيل الدخول بكلمة المرور في Supabase Auth
  async signInWithPassword({ email, password }) {
    const supabase = this.getClient();
    if (!supabase) {
      return { data: null, error: new Error('Supabase client not initialized') };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
      });
      return { data, error };
    } catch (err) {
      console.error('[MirasRouter] استثناء أثناء تسجيل الدخول:', err);
      return { data: null, error: err };
    }
  },

  // تسجيل الخروج
  async signOut() {
    const supabase = this.getClient();
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn('[MirasRouter] خطأ أثناء تسجيل الخروج:', e);
      }
    }
    sessionStorage.removeItem('miras_auth_role');
    sessionStorage.removeItem('role');
    this.navigate('index.html');
  },

  // توجيه المستخدم تلقائياً بناءً على دوره وصلاحياته الحية في Supabase
  async routeUser(sessionUser = null, explicitRole = null) {
    const supabase = this.getClient();

    // 1. فحص الدور والصلاحيات الحية في Supabase إذا توفرت الجلسة
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

          const isOwner = user?.email && user.email.toLowerCase() === 'safyhassan2004@gmail.com';
          if (isOwner || (profile && (profile.role === 'super_admin' || profile.role === 'admin' || profile.is_admin === true || profile.is_super_admin === true))) {
            sessionStorage.setItem('miras_auth_role', (isOwner || profile?.role === 'super_admin') ? 'super_admin' : 'admin');
            return this.navigate('admin/index.html');
          }
          if (!error && profile) {
            if (profile.role === 'craftsman') {
              // فحص حالة الاعتماد من قبل مالكة المنصة
              const { data: pro } = await supabase
                .from('craftsmen_profiles')
                .select('verification_status')
                .eq('user_id', user.id)
                .single();

              const vStatus = pro?.verification_status || 'pending';
              sessionStorage.setItem('miras_craftsman_status', vStatus);

              if (vStatus !== 'verified') {
                alert('حسابك المهني قيد المراجعة والاعتماد من قبل إدارة المنصة . لا يمكنك الدخول حتى تتم الموافقة.');
                sessionStorage.setItem('miras_auth_role', 'craftsman');
                return this.navigate('pro-login.html?pending=true');
              }

              sessionStorage.setItem('miras_auth_role', 'craftsman');
              return this.navigate('pro/index.html');
            }
            // مستخدم عادي
            sessionStorage.setItem('miras_auth_role', 'client');
            return this.navigate('index.html');
          }
        }
      } catch (err) {
        console.warn('[MirasRouter] جاري الاعتماد على الدور المحلي المؤقت:', err);
      }
    }

    // 2. وضع التوجيه الاحتياطي:
    const role = explicitRole || sessionStorage.getItem('miras_auth_role') || sessionStorage.getItem('role') || 'client';
    if (role === 'admin' || role === 'super_admin') {
      return this.navigate('admin/index.html');
    } else if (role === 'craftsman' || role === 'pro') {
      const vStatus = localStorage.getItem('miras_current_pro_status') || sessionStorage.getItem('miras_craftsman_status') || 'pending';
      if (vStatus !== 'verified') {
        alert('عذراً، حساب صاحب المهنة بانتظار المراجعة والاعتماد من قبل مالكة المنصة (Super Admin).\nلا يمكنك الدخول إلى لوحة الحرفيين حتى يتم تفعيل حسابك من الإدارة.');
        return this.navigate('login.html?role=craftsman&pending=true');
      }
      return this.navigate('pro/index.html');
    } else {
      return this.navigate('my-requests.html');
    }
  },

  // حل المسار النسبي بدقة من أي صفحة فرعية
  navigate(targetPath) {
    const pathname = window.location.pathname;
    let prefix = '';
    
    if (pathname.includes('/admin/mobile/') || pathname.includes('/pro/mobile/')) {
      prefix = '../../';
    } else if (pathname.includes('/admin/') || pathname.includes('/pro/') || pathname.includes('/mobile/')) {
      prefix = '../';
    }
    
    window.location.href = prefix + targetPath;
  }
};
