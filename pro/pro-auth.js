/**
 * Miras Professional Dashboard - Supabase & Dynamic Account Module
 * منصة مِـرَاس - نظام لوحة الحرفي والمهني (خاصة بكل صاحب مهنة)
 * 
 * هذه اللوحة مستقلة وخاصة بأصحاب المهن فقط، ولا يمكن الدخول إليها إلا بعد
 * مراجعة واعتماد الحساب من قبل مالكة المنصة (Super Admin).
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

  // التحقق الحقيقي من صلاحيات الحرفي وشرط اعتماد مالكة المنصة
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
          .select('role, full_name, phone_number, is_admin, is_super_admin')
          .eq('id', userId)
          .single();

        // استثناء مالكة المنصة: إذا كانت مالكة المنصة، توجه للوحة الإدارة
        const isOwner = session.user.email?.toLowerCase() === 'safyhassan2004@gmail.com' || userProfile?.role === 'super_admin';
        if (isOwner) {
          const isMobile = window.location.pathname.includes('/mobile/');
          window.location.href = isMobile ? '../../admin/mobile/index.html' : '../admin/index.html';
          return;
        }

        if (profileError || (userProfile && userProfile.role !== 'craftsman')) {
          this.denyAccess('عذراً، هذه الواجهة مخصصة لأصحاب المهن والكوادر الحرفية المعتمدة فقط.');
          return;
        }

        // 2. جلب بيانات الملف المهني وحالة الاعتماد
        const { data: proProfile } = await this.supabase
          .from('craftsmen_profiles')
          .select(`
            id, trade_category, experience_years, is_available,
            rating, total_reviews, completed_orders, active_orders_count,
            verification_status
          `)
          .eq('user_id', userId)
          .single();

        const vStatus = proProfile?.verification_status || 'pending';

        // شرط صارم: لا يمكن الدخول إلا إذا تمت الموافقة والاعتماد من قبل مالكة المنصة
        if (vStatus !== 'verified') {
          this.showPendingApprovalScreen(userProfile || { full_name: 'صاحب المهنة' }, vStatus);
          return;
        }

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

        console.log('✅ تم التحقق والاعتماد بنجاح للمهني:', userProfile?.full_name);
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
    
    // إذا كان الحساب لعميل عادي
    if (role === 'client') {
      console.warn('⚠️ محاولة دخول للوحة أصحاب المهن بحساب عميل عادي.');
      window.location.href = isMobile ? '../../mobile/index.html' : '../index.html';
      return;
    }

    // فحص حالة الاعتماد في الجلسة أو التخزين المحلي
    const craftsmanStatus = localStorage.getItem('miras_current_pro_status') || sessionStorage.getItem('miras_craftsman_status');
    if (craftsmanStatus === 'pending' || craftsmanStatus === 'rejected') {
      this.showPendingApprovalScreen({ full_name: 'صاحب المهنة (المسجل)' }, craftsmanStatus);
    }
  },

  // شاشة حجب الدخول حتى موافقة مالكة المنصة
  showPendingApprovalScreen(profile, status = 'pending') {
    // إزالة أي قفل موجود مسبقاً لمنع التكرار
    const existingModal = document.getElementById('mirasApprovalGate');
    if (existingModal) existingModal.remove();

    const isRejected = status === 'rejected' || status === 'suspended';
    const statusText = isRejected ? 'مرفوض أو معلّق من الإدارة' : 'قيد المراجعة والتدقيق ⏳';
    const statusColor = isRejected ? 'text-red-600 bg-red-100' : 'text-amber-800 bg-amber-100';

    const gate = document.createElement('div');
    gate.id = 'mirasApprovalGate';
    gate.className = 'fixed inset-0 z-[99999] bg-primary/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto';
    gate.innerHTML = `
      <div class="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-2xl text-right border border-gray-100 relative">
        <div class="flex items-center justify-between pb-4 border-b border-gray-100">
          <div class="flex items-center gap-2">
            <img src="../assets/logo.png" alt="مِراس" class="h-10 w-auto object-contain rounded-md" onerror="this.src='https://lh3.googleusercontent.com/aida/ALJJyrBJvcIWV6XTBKheJBgG_V8UaW6RGPiAvnarmMdnlhNxoa2GuAiaRZHA-RwNK4B61N4TDOp3m4IfkpNJkce9dohTQ3emb93HvXkrhQc71_5u62k3TRw0zff7CC1gmi18R5WCktu7p_HEQS8YixW4xFPdxFWpHraSV5FALaKKLwlwJMHRwiTSl5IIemu-Qg6dIlArCuY6hMt0oqqEwGCKRm4F7N00ikddB64KPVxD6NNlEA'"/>
            <span class="font-bold text-xl text-[#001e2f]">منصة مِـرَاس</span>
          </div>
          <span class="px-3 py-1 rounded-full text-xs font-bold ${statusColor}">
            ${statusText}
          </span>
        </div>

        <div class="my-6 text-center">
          <div class="w-16 h-16 mx-auto rounded-full ${isRejected ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'} flex items-center justify-center mb-4">
            <span class="material-symbols-outlined text-4xl">${isRejected ? 'block' : 'hourglass_top'}</span>
          </div>
          <h2 class="text-xl sm:text-2xl font-bold text-[#001e2f] mb-2">
            ${isRejected ? 'حسابك المهني معلّق أو غير معتمد' : 'حسابك المهني بانتظار موافقة الإدارة'}
          </h2>
          <p class="text-sm text-gray-600 leading-relaxed max-w-md mx-auto">
            أهلاً بك <strong>${profile?.full_name || 'صاحب المهنة'}</strong>. حرصاً على ضبط الجودة وموثوقية العقود، لا يمكن الدخول إلى لوحة المشاريع والطلبات إلا بعد <strong>مراجعة واعتماد حسابك من قبل مالكة المنصة (Super Admin)</strong>.
          </p>
        </div>

        <div class="bg-gray-50 rounded-xl p-4 space-y-2.5 text-xs text-gray-700 mb-6 border border-gray-100">
          <div class="flex items-center justify-between">
            <span class="text-gray-500">حالة الحساب:</span>
            <span class="font-bold text-amber-700">بانتظار موافقة مالكة المنصة</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-gray-500">النطاق الجغرافي:</span>
            <span class="font-semibold text-gray-800">الجمهورية اليمنية — حضرموت وباقي المحافظات</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-gray-500">جهة التدقيق:</span>
            <span class="font-semibold text-[#00324b]">إدارة الرقابة والاعتماد المهني</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-gray-500">التواصل الرسمي:</span>
            <span class="font-mono text-gray-700">support@miras.ye</span>
          </div>
        </div>

        <div class="flex flex-col sm:flex-row gap-2.5">
          <button onclick="location.reload()" class="flex-1 py-3 px-4 rounded-xl bg-[#001e2f] text-white font-bold text-sm hover:bg-[#00324b] transition-colors flex items-center justify-center gap-1.5 shadow-sm">
            <span class="material-symbols-outlined text-base">sync</span>
            <span>فحص حالة الموافقة الآن</span>
          </button>
          <button onclick="ProAuth.logout()" class="py-3 px-4 rounded-xl bg-gray-100 text-gray-700 font-bold text-sm hover:bg-gray-200 transition-colors">
            تسجيل الخروج
          </button>
        </div>

        <div class="mt-4 text-center">
          <a href="../index.html" class="text-xs text-gray-500 hover:text-primary transition-colors">
            العودة إلى الصفحة الرئيسية لمنصة مِراس
          </a>
        </div>
      </div>
    `;

    document.body.appendChild(gate);
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
    sessionStorage.removeItem('miras_craftsman_status');
    localStorage.removeItem('miras_current_pro_status');
    const isMobile = window.location.pathname.includes('/mobile/');
    window.location.href = isMobile ? '../../mobile/pro-login.html' : '../pro-login.html';
  }
};

document.addEventListener('DOMContentLoaded', () => {
  ProAuth.init();
});
