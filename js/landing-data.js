/**
 * Miras Landing Page - Supabase Integration Module
 * ربط الواجهة الرئيسية الحية بمنصة Supabase
 */

(async function initLandingSupabase() {
  const config = window.MIRAS_ENV || {};
  if (!window.supabase || !config.SUPABASE_URL || config.SUPABASE_URL.includes('YOUR_PROJECT_ID')) {
    return;
  }

  let supabaseClient = null;
  try {
    const cleanUrl = config.SUPABASE_URL.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
    supabaseClient = window.supabase.createClient(cleanUrl, config.SUPABASE_ANON_KEY);
  } catch (e) {
    console.warn('[Landing] تعذر تهيئة عميل Supabase:', e);
    return;
  }

  // 1. فحص حالة جلسة المستخدم الحالية لتحديث القائمة العلوية
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const storedRole = sessionStorage.getItem('miras_auth_role');
    const storedName = sessionStorage.getItem('miras_user_name');

    if (session?.user || storedRole) {
      const user = session?.user;
      let role = storedRole || 'client';
      let displayName = storedName || 'المستخدم';

      if (user) {
        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('full_name, role, is_admin')
          .eq('id', user.id)
          .single();

        if (profile) {
          role = profile.role || (profile.is_admin ? 'admin' : 'client');
          displayName = profile.full_name || displayName;
        }
      }

      // تحديث أزرار تسجيل الدخول في رأس الصفحة
      const loginLinks = document.querySelectorAll('a[data-path="login"], a[href="login.html"]');
      loginLinks.forEach(link => {
        if (role === 'admin') {
          link.innerHTML = '<span class="material-symbols-outlined text-[18px]">admin_panel_settings</span><span>لوحة المدير</span>';
          link.href = 'admin/index.html';
          link.classList.add('text-primary', 'font-bold');
        } else if (role === 'craftsman') {
          link.innerHTML = '<span class="material-symbols-outlined text-[18px]">handyman</span><span>لوحة الحرفي</span>';
          link.href = 'pro/index.html';
          link.classList.add('text-secondary', 'font-bold');
        } else {
          link.innerHTML = `<span class="material-symbols-outlined text-[18px]">person</span><span>${displayName}</span>`;
          link.href = '#';
        }
      });
    }
  } catch (err) {
    console.warn('[Landing] ملاحظة أثناء فحص الجلسة:', err);
  }

  // 2. محاولة جلب الكوادر الحرفية المعتمدة من Supabase
  try {
    const { data: craftsmen, error } = await supabaseClient
      .from('craftsmen_profiles')
      .select('id, trade_category, rating, total_reviews, experience_years, verification_status')
      .eq('verification_status', 'verified')
      .limit(6);

    if (!error && craftsmen && craftsmen.length > 0) {
      console.log('✅ تم جلب الكوادر الحرفية المعتمدة من Supabase بنجاح:', craftsmen.length);
    }
  } catch (err) {
    console.warn('[Landing] ملاحظة أثناء استعلام الكوادر الحرفية:', err);
  }
})();
