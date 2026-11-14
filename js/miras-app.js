/**
 * Miras Platform - Unified Interactive Application Engine
 * محرك العمليات التفاعلية الشامل لمنصة مِـرَاس (حضرموت)
 * 
 * يربط جميع الواجهات بنظام Supabase الحقيقي:
 * - استكشاف المهن والبحث والفلترة
 * - حجز الخدمات وإنشاء الطلبات الفعلية
 * - لوحة طلباتي للعميل ومتابعة الحالات
 * - المحادثات الفورية بين العميل وصاحب المهنة
 * - مركز الدعم الحضرمي لخدمة العملاء (يدوي بالكامل)
 * - لوحة صاحب المهنة وإدارة العروض والخدمات
 * - لوحة مالكة المنصة (Super Admin) وتوثيق الحرفيين
 */

window.MirasApp = {
  currentUser: null,
  currentProfile: null,

  async init() {
    console.log('[MirasApp] تهيئة المنصة وتوثيق الجلسة...');
    
    // 1. استرجاع الجلسة والمستخدم
    if (window.MirasAPI) {
      try {
        this.currentUser = await window.MirasAPI.auth.getCurrentUser();
        if (this.currentUser) {
          this.currentProfile = await window.MirasAPI.auth.getCurrentProfile();
          this.updateGlobalHeaderUI();
        }
      } catch (e) {
        console.warn('[MirasApp] خطأ أثناء استعادة الجلسة:', e);
      }
    }

    // 2. تفعيل الصفحة المناسبة حسب المسار
    const path = window.location.pathname.toLowerCase();

    if (path.endsWith('index.html') || path === '/' || path.endsWith('/')) {
      if (path.includes('/admin/')) {
        this.initAdminDashboard();
      } else if (path.includes('/pro/')) {
        this.initProDashboard();
      } else {
        this.initHomePage();
      }
    } else if (path.includes('explore.html')) {
      this.initExplorePage();
    } else if (path.includes('book-service.html')) {
      this.initBookServicePage();
    } else if (path.includes('my-requests.html')) {
      this.initMyRequestsPage();
    } else if (path.includes('order-details.html')) {
      this.initOrderDetailsPage();
    } else if (path.includes('artisan-profile.html')) {
      this.initArtisanProfilePage();
    } else if (path.includes('service-details.html')) {
      this.initServiceDetailsPage();
    } else if (path.includes('chat.html')) {
      this.initChatPage();
    } else if (path.includes('favorites.html')) {
      this.initFavoritesPage();
    } else if (path.includes('profile.html')) {
      this.initProfilePage();
    } else if (path.includes('craftsmen.html')) {
      this.initAdminCraftsmenPage();
    } else if (path.includes('settings.html')) {
      this.initAdminSettingsPage();
    }
  },

  // ----------------------------------------------------------------------------
  // تحديث الهيدر وشريط التنقل العام
  // ----------------------------------------------------------------------------
  updateGlobalHeaderUI() {
    const authBtn = document.querySelector('header a[href*="login.html"]');
    if (authBtn && this.currentProfile) {
      const role = this.currentProfile.role;
      let targetHref = 'profile.html';
      let roleLabel = 'حسابي';

      if (role === 'super_admin' || role === 'admin') {
        targetHref = 'admin/index.html';
        roleLabel = 'لوحة الإدارة';
      } else if (role === 'craftsman') {
        targetHref = 'pro/index.html';
        roleLabel = 'لوحة المهني';
      }

      authBtn.href = targetHref;
      authBtn.innerHTML = `
        <span class="material-symbols-outlined text-[18px]">account_circle</span>
        <span class="hidden sm:inline">${this.escapeHtml(this.currentProfile.full_name?.split(' ')[0] || roleLabel)}</span>
      `;
    }
  },

  // ----------------------------------------------------------------------------
  // 1. الصفحة الرئيسية (index.html)
  // ----------------------------------------------------------------------------
  initHomePage() {
    const searchInput = document.querySelector('input[placeholder*="ابحث عن مهني"]');
    const searchBtn = searchInput?.parentElement?.querySelector('button');

    const handleSearch = () => {
      const q = searchInput?.value?.trim();
      if (q) {
        window.location.href = `explore.html?q=${encodeURIComponent(q)}`;
      } else {
        window.location.href = 'explore.html';
      }
    };

    searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSearch();
      }
    });

    searchBtn?.addEventListener('click', handleSearch);

    // ربط شرائح المدن الحضرمية
    document.querySelectorAll('.city-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const cityName = chip.textContent.trim();
        if (cityName.includes('كل حضرموت')) {
          window.location.href = 'explore.html';
        } else {
          window.location.href = `explore.html?city=${encodeURIComponent(cityName)}`;
        }
      });
    });

    // ربط بطاقات التصنيفات
    const categoryLinks = [
      { selector: 'a[href*="explore.html"]:has(span:contains("تكييف"))', category: 'تكييف وتبريد' },
      { selector: 'a[href*="explore.html"]:has(span:contains("سباكة"))', category: 'سباكة وصحي' },
      { selector: 'a[href*="explore.html"]:has(span:contains("كهرباء"))', category: 'كهرباء وتمديدات' }
    ];
  },

  // ----------------------------------------------------------------------------
  // 2. استكشاف المهن (explore.html)
  // ----------------------------------------------------------------------------
  async initExplorePage() {
    const params = new URLSearchParams(window.location.search);
    const categoryParam = params.get('category');
    const cityParam = params.get('city');
    const searchParam = params.get('q');

    const searchInput = document.getElementById('exploreSearchInput');
    if (searchInput && searchParam) {
      searchInput.value = searchParam;
    }

    if (searchInput) {
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const q = searchInput.value.trim();
          window.location.href = `explore.html?q=${encodeURIComponent(q)}` + (categoryParam ? `&category=${encodeURIComponent(categoryParam)}` : '');
        }
      });
    }

    // جلب الحرفيين المعتمدين من Supabase
    const { data: craftsmen, error } = await window.MirasAPI.craftsmen.list({
      category: categoryParam,
      city: cityParam,
      search: searchParam
    });

    const container = document.querySelector('.px-margin.py-2.flex.flex-col.gap-4') || document.querySelector('main .space-y-4');
    const countBadge = document.querySelector('p.font-label-md span.font-bold');

    if (craftsmen && craftsmen.length > 0) {
      if (countBadge) countBadge.textContent = craftsmen.length;
      if (container) {
        container.innerHTML = '';
        craftsmen.forEach(c => {
          const card = document.createElement('article');
          card.className = "bg-surface-container-lowest rounded-2xl p-4 shadow-sm flex flex-col gap-3 relative transition-all hover:shadow-md";
          card.innerHTML = `
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-center gap-3">
                <div class="relative w-14 h-14 rounded-2xl overflow-hidden bg-surface-container-high flex-shrink-0 shadow-sm">
                  <img class="w-full h-full object-cover" src="${c.user?.avatar_url || 'assets/logo.png'}" alt="${this.escapeHtml(c.user?.full_name)}"/>
                  <div class="absolute -bottom-1 -right-1 bg-surface-container-lowest p-0.5 rounded-full shadow-sm">
                    <span class="material-symbols-outlined text-[16px] text-tertiary-fixed-dim" style="font-variation-settings: 'FILL' 1;">verified</span>
                  </div>
                </div>
                <div class="flex flex-col min-w-0">
                  <h2 class="font-headline-sm text-headline-sm text-primary font-bold truncate">${this.escapeHtml(c.user?.full_name || 'حرفي مِـرَاس')}</h2>
                  <p class="font-label-sm text-label-sm text-on-surface-variant truncate">${this.escapeHtml(c.trade_category)}</p>
                  <div class="flex items-center gap-2 mt-0.5 text-on-surface-variant font-label-sm text-label-sm">
                    <span class="flex items-center gap-0.5">
                      <span class="material-symbols-outlined text-[14px] text-secondary">location_on</span>
                      حضرموت — ${this.escapeHtml(c.user?.city || 'المكلا')}
                    </span>
                    <span class="text-outline-variant">•</span>
                    <span class="text-emerald-700 font-semibold flex items-center gap-1">
                      <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      ${c.is_available ? 'متاح للطلب' : 'مشغول حالياً'}
                    </span>
                  </div>
                </div>
              </div>
              <div class="flex flex-col items-end gap-2 flex-shrink-0">
                <button type="button" class="w-8 h-8 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface-variant hover:text-error transition-colors" onclick="window.MirasApp.toggleFav('${c.id}', this)">
                  <span class="material-symbols-outlined text-[19px]">favorite_border</span>
                </button>
                <div class="flex items-center gap-1 bg-surface-container-low px-2 py-0.5 rounded-lg text-primary font-label-sm text-label-sm font-semibold">
                  <span class="material-symbols-outlined text-[14px] text-tertiary-fixed-dim" style="font-variation-settings: 'FILL' 1;">star</span>
                  <span>${c.rating || '5.0'}</span>
                  <span class="text-on-surface-variant text-[11px]">(${c.total_reviews || 0})</span>
                </div>
              </div>
            </div>
            <div class="pt-2 border-t border-surface-container flex items-center justify-between gap-2">
              <span class="text-xs text-on-surface-variant font-medium">الضمان الذهبي: 30 يوماً</span>
              <div class="flex items-center gap-2">
                <a href="artisan-profile.html?id=${c.id}" class="px-3 py-1.5 rounded-lg bg-surface-container text-primary font-bold text-xs hover:bg-surface-container-high transition-colors">
                  الملف والأسعار
                </a>
                <a href="book-service.html?craftsman_id=${c.id}" class="px-3.5 py-1.5 rounded-lg bg-primary text-white font-bold text-xs hover:bg-primary-container transition-colors shadow-xs">
                  حجز خدمة
                </a>
              </div>
            </div>
          `;
          container.appendChild(card);
        });
      }
    } else {
      if (countBadge) countBadge.textContent = '0';
      if (container) {
        container.innerHTML = `
          <div class="bg-surface-container-lowest rounded-2xl p-8 border border-surface-container text-center space-y-3 my-4">
            <div class="w-16 h-16 rounded-2xl bg-surface-container text-primary flex items-center justify-center mx-auto shadow-inner">
              <span class="material-symbols-outlined text-[36px]">engineering</span>
            </div>
            <h3 class="text-base font-bold text-primary">لا توجد كوادر معتمدة حالياً بهذا البحث</h3>
            <p class="text-xs text-on-surface-variant max-w-sm mx-auto leading-relaxed">
              منصة مِـرَاس في مرحلة التوسع بمحافظة حضرموت ونقوم بتدقيق هويات الحرفيين يدوياً. إذا كنت صاحب مهنة في هذا المجال، يسعدنا انضمامك لشبكتنا.
            </p>
            <div class="pt-3">
              <a href="join-pro.html" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-tertiary-fixed text-tertiary-container font-bold text-xs shadow-sm hover:bg-tertiary-fixed-dim transition-all">
                <span class="material-symbols-outlined text-[18px]">person_add</span>
                <span>سجل الآن كحرفي معتمد في حضرموت</span>
              </a>
            </div>
          </div>
        `;
      }
    }
  },

  // ----------------------------------------------------------------------------
  // 3. حجز خدمة مباشرة (book-service.html)
  // ----------------------------------------------------------------------------
  async initBookServicePage() {
    const params = new URLSearchParams(window.location.search);
    const craftsmanId = params.get('craftsman_id');

    if (!this.currentUser) {
      // إشعار المستخدم بالحاجة للدخول
      const confirmLogin = confirm('يرجى تسجيل الدخول أو إنشاء حساب عميل لمتابعة حجز الخدمة بضمان مِـرَاس.');
      if (confirmLogin) {
        window.location.href = `login.html?redirect=${encodeURIComponent(window.location.href)}`;
        return;
      }
    }

    // إذا وجد حرفي محدد
    if (craftsmanId) {
      const { data: craftsman } = await window.MirasAPI.craftsmen.getById(craftsmanId);
      if (craftsman) {
        const nameEl = document.querySelector('h2.font-headline-sm');
        if (nameEl) nameEl.textContent = craftsman.user?.full_name || 'صاحب مهنة معتمد';
      }
    }

    // ربط اختيار المدينة في حضرموت
    let selectedCity = 'المكلا';
    document.querySelectorAll('#city-chips button').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#city-chips button').forEach(b => {
          b.className = "px-4 py-2 rounded-full font-label-md text-label-md bg-surface-container text-on-surface-variant whitespace-nowrap active:bg-surface-container-high";
        });
        btn.className = "px-4 py-2 rounded-full font-label-md text-label-md bg-primary text-on-primary font-bold shadow-sm whitespace-nowrap";
        selectedCity = btn.textContent.trim();
      });
    });

    // استبدال دالة الإرسال window.submitOrderBooking
    window.submitOrderBooking = async () => {
      const notes = document.getElementById('problem-notes')?.value?.trim();
      const address = document.getElementById('address-input')?.value?.trim() || `${selectedCity} — حضرموت`;
      
      if (!notes) {
        alert('يرجى كتابة وصف المشكلة أو الخدمة المطلوبة.');
        document.getElementById('problem-notes')?.focus();
        return;
      }

      if (!this.currentUser) {
        alert('يجب تسجيل الدخول أولاً لإرسال الطلب.');
        window.location.href = 'login.html';
        return;
      }

      const submitBtn = document.querySelector('button[onclick*="submitOrderBooking"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="material-symbols-outlined animate-spin text-[20px]">progress_activity</span><span>جارِ إنشاء الطلب وتوثيقه...</span>';
      }

      const { data, error } = await window.MirasAPI.orders.create({
        client_id: this.currentUser.id,
        craftsman_id: craftsmanId || null,
        title: notes.substring(0, 45) + (notes.length > 45 ? '...' : ''),
        trade_category: 'صيانة وتشطيبات',
        description: notes,
        city: selectedCity,
        location_details: address,
        estimated_budget: 15000,
        clientName: this.currentProfile?.full_name || 'عميل مِـرَاس'
      });

      if (error) {
        alert('حدث خطأ أثناء إرسال الطلب: ' + error.message);
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span>تأكيد إرسال الطلب</span>';
        }
        return;
      }

      alert('✅ تم إرسال طلبك بنجاح! تم إشعار غرفة العمليات وسيتم التواصل معك لمتابعة الخدمة.');
      window.location.href = 'my-requests.html';
    };
  },

  // ----------------------------------------------------------------------------
  // 4. لوحة طلباتي للعميل (my-requests.html)
  // ----------------------------------------------------------------------------
  async initMyRequestsPage() {
    if (!this.currentUser) {
      return;
    }

    const { data: orders, error } = await window.MirasAPI.orders.list({
      client_id: this.currentUser.id
    });

    const activeTrackerSection = document.querySelector('section.mb-space-lg');
    const tabCounts = document.querySelectorAll('section.mt-space-sm button span.font-bold');

    if (orders && orders.length > 0) {
      if (tabCounts[0]) tabCounts[0].textContent = orders.length;

      if (activeTrackerSection) {
        activeTrackerSection.className = "space-y-4";
        activeTrackerSection.innerHTML = '';

        orders.forEach(ord => {
          const statusMap = window.MirasAPI.CONSTANTS.ORDER_STATUSES;
          const statusAr = statusMap[ord.status] || ord.status;
          const timeStr = ord.created_at ? new Date(ord.created_at).toLocaleDateString('ar-YE') : '';

          const card = document.createElement('div');
          card.className = "bg-surface-container-lowest rounded-2xl p-5 border border-surface-container shadow-xs space-y-3";
          card.innerHTML = `
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="w-8 h-8 rounded-lg bg-surface-container text-primary flex items-center justify-center font-bold text-xs">#${ord.id.substring(0, 4)}</span>
                <span class="font-bold text-sm text-primary">${this.escapeHtml(ord.title)}</span>
              </div>
              <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary-container text-white">${statusAr}</span>
            </div>
            <p class="text-xs text-on-surface-variant line-clamp-2">${this.escapeHtml(ord.description || '')}</p>
            <div class="flex items-center justify-between text-xs text-on-surface-variant pt-2 border-t border-surface-container">
              <span class="flex items-center gap-1">
                <span class="material-symbols-outlined text-[15px] text-secondary">location_on</span>
                حضرموت — ${this.escapeHtml(ord.city)} • ${timeStr}
              </span>
              <div class="flex items-center gap-2">
                <a href="order-details.html?id=${ord.id}" class="px-3 py-1.5 rounded-lg bg-surface-container text-primary font-bold hover:bg-surface-container-high transition-colors">
                  تفاصيل الطلب
                </a>
                <a href="chat.html?order_id=${ord.id}&craftsman_id=${ord.craftsman_id || ''}" class="px-3 py-1.5 rounded-lg bg-primary text-white font-bold hover:bg-primary-container transition-colors">
                  محادثة
                </a>
              </div>
            </div>
          `;
          activeTrackerSection.appendChild(card);
        });
      }
    }
  },

  // ----------------------------------------------------------------------------
  // 5. تفاصيل الطلب والفاتورة (order-details.html)
  // ----------------------------------------------------------------------------
  async initOrderDetailsPage() {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('id');

    if (!orderId) return;

    const { data: order, error } = await window.MirasAPI.orders.getById(orderId);
    if (!order) return;

    // تحديث البيانات المعروضة
    const idEl = document.querySelector('span.font-headline-sm');
    if (idEl) idEl.textContent = `MRS-${order.id.substring(0, 6)}#`;

    const statusPill = document.querySelector('span.font-label-md.text-primary.font-semibold');
    if (statusPill) {
      const statusMap = window.MirasAPI.CONSTANTS.ORDER_STATUSES;
      statusPill.textContent = statusMap[order.status] || order.status;
    }

    const clientNameEl = document.querySelector('span.font-label-md.text-on-surface.font-medium');
    if (clientNameEl && order.client) {
      clientNameEl.textContent = `${order.client.full_name} • ${order.city} (حضرموت)`;
    }

    // ربط هاتف وواتساب المهني في تفاصيل الطلب
    const craftsmanPhone = order.craftsman?.user?.phone_number || '';
    const proName = order.craftsman?.user?.full_name || 'المعلم';
    const orderCode = `MRS-${order.id.substring(0, 6)}#`;

    const cleanTel = window.MirasAPI.cleanPhoneForTel(craftsmanPhone);
    const cleanWa = window.MirasAPI.cleanPhoneForWhatsApp(craftsmanPhone);

    const callBtn = document.getElementById('orderCraftsmanCallBtn');
    if (callBtn) callBtn.href = `tel:${cleanTel}`;

    const waBtn = document.getElementById('orderCraftsmanWaBtn');
    if (waBtn) {
      waBtn.href = `https://wa.me/${cleanWa}?text=${encodeURIComponent('السلام عليكم ' + proName + '، بخصوص الطلب ' + orderCode + ' عبر منصة مِـرَاس.')}`;
    }
  },

  // ----------------------------------------------------------------------------
  // 5.1 الملف الشخصي للمهني والحرفي (artisan-profile.html)
  // ----------------------------------------------------------------------------
  async initArtisanProfilePage() {
    const params = new URLSearchParams(window.location.search);
    const craftsmanId = params.get('id') || params.get('pro_id') || params.get('craftsman_id');
    const phoneParam = params.get('phone');

    let proPhone = phoneParam || '';
    let proName = 'المعلم سعيد بن مخاشن';

    if (craftsmanId) {
      const { data: craftsman } = await window.MirasAPI.craftsmen.getById(craftsmanId);
      if (craftsman) {
        if (craftsman.user?.full_name) proName = craftsman.user.full_name;
        if (craftsman.user?.phone_number) proPhone = craftsman.user.phone_number;

        const nameEl = document.querySelector('h2.font-headline-sm, h1.font-headline-sm');
        if (nameEl && craftsman.user?.full_name) nameEl.textContent = craftsman.user.full_name;

        const tradeEl = document.querySelector('span.font-body-md.text-on-surface-variant');
        if (tradeEl && craftsman.trade_category) {
          tradeEl.textContent = `${craftsman.trade_category} • ${craftsman.city || 'حضرموت'}`;
        }
      }
    }

    if (!proPhone) {
      proPhone = sessionStorage.getItem('registered_phone') || localStorage.getItem('miras_registered_phone') || '+967770000000';
    }

    const cleanTel = window.MirasAPI.cleanPhoneForTel(proPhone);
    const cleanWa = window.MirasAPI.cleanPhoneForWhatsApp(proPhone);
    const displayPhone = window.MirasAPI.formatPhoneDisplay(proPhone);

    const callBtn = document.getElementById('artisanCallBtn');
    if (callBtn) callBtn.href = `tel:${cleanTel}`;

    const waBtn = document.getElementById('artisanWaBtn');
    if (waBtn) {
      waBtn.href = `https://wa.me/${cleanWa}?text=${encodeURIComponent('السلام عليكم ' + proName + '، وجدت ملفك على منصة مِـرَاس وأود طلب خدمة صيانة.')}`;
    }

    const phoneText = document.getElementById('artisanPhoneText');
    if (phoneText) phoneText.textContent = displayPhone;

    // ربط أزرار الحجز برقم المهني
    document.querySelectorAll('a[href*="book-service.html"]').forEach(btn => {
      btn.href = `book-service.html?craftsman_id=${craftsmanId || ''}`;
    });
  },

  // ----------------------------------------------------------------------------
  // 5.2 تفاصيل الخدمة (service-details.html)
  // ----------------------------------------------------------------------------
  async initServiceDetailsPage() {
    const params = new URLSearchParams(window.location.search);
    const serviceId = params.get('id') || params.get('service_id');
    const bookNowBtn = document.getElementById('bookNowBtn');
    if (bookNowBtn) {
      bookNowBtn.addEventListener('click', () => {
        window.location.href = `book-service.html?service_id=${serviceId || ''}`;
      });
    }
  },

  // ----------------------------------------------------------------------------
  // 6. المحادثات الفورية بين العميل والمهني (chat.html)
  // ----------------------------------------------------------------------------
  async initChatPage() {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('order_id');
    const craftsmanId = params.get('craftsman_id');

    if (!this.currentUser) {
      alert('يرجى تسجيل الدخول لمتابعة المحادثة.');
      window.location.href = 'login.html';
      return;
    }

    // ربط اتصال وواتساب المهني مباشرة في رأس الشات
    let proPhone = '';
    let proName = 'المعلم';
    if (craftsmanId) {
      const { data: craftsman } = await window.MirasAPI.craftsmen.getById(craftsmanId);
      if (craftsman?.user) {
        proPhone = craftsman.user.phone_number || '';
        proName = craftsman.user.full_name || 'المعلم';
      }
    }
    const cleanTel = window.MirasAPI.cleanPhoneForTel(proPhone);
    const cleanWa = window.MirasAPI.cleanPhoneForWhatsApp(proPhone);

    const callBtn = document.getElementById('chatCallBtn');
    if (callBtn) callBtn.href = `tel:${cleanTel}`;

    const waBtn = document.getElementById('chatWaBtn');
    if (waBtn) {
      waBtn.href = `https://wa.me/${cleanWa}?text=${encodeURIComponent('السلام عليكم ' + proName + '، بخصوص محادثتنا على منصة مِـرَاس.')}`;
    }

    // جلب أو إنشاء محادثة
    let convId = params.get('conversation_id');
    if (!convId && craftsmanId) {
      const { data: conv } = await window.MirasAPI.chat.getOrCreateConversation(
        orderId, 
        this.currentUser.id, 
        craftsmanId
      );
      if (conv) convId = conv.id;
    }

    const messagesContainer = document.querySelector('section.flex.flex-col.gap-space-sm') || document.querySelector('main .space-y-3');
    const sendBtn = document.querySelector('button[aria-label="إرسال الرسالة"]') || document.querySelector('button:has(span:contains("send"))');
    const messageInput = document.querySelector('input[placeholder*="اكتب"]') || document.querySelector('input[type="text"]');

    if (convId) {
      const { data: messages } = await window.MirasAPI.chat.getMessages(convId);
      if (messages && messagesContainer) {
        messagesContainer.innerHTML = '';
        messages.forEach(m => {
          this.appendChatMessageUI(messagesContainer, m);
        });
      }

      // اشتراك Realtime
      window.MirasAPI.chat.subscribeToMessages(convId, (newMsg) => {
        if (messagesContainer) this.appendChatMessageUI(messagesContainer, newMsg);
      });
    }

    const sendMsg = async () => {
      const content = messageInput?.value?.trim();
      if (!content || !convId) return;

      messageInput.value = '';
      await window.MirasAPI.chat.sendMessage({
        conversationId: convId,
        senderId: this.currentUser.id,
        receiverId: craftsmanId || this.currentUser.id,
        content: content
      });
    };

    sendBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      sendMsg();
    });

    messageInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendMsg();
      }
    });
  },

  appendChatMessageUI(container, msg) {
    const isMe = msg.sender_id === this.currentUser?.id;
    const timeStr = msg.created_at ? new Date(msg.created_at).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' }) : '';

    const div = document.createElement('div');
    div.className = isMe ? "flex flex-col items-end" : "flex items-start gap-2.5";
    div.innerHTML = isMe ? `
      <div class="flex items-center gap-1 mb-1">
        <span class="text-[11px] text-on-surface-variant">${timeStr}</span>
        <span class="text-xs font-bold text-primary">أنت</span>
      </div>
      <div class="bg-primary text-white p-3 rounded-2xl rounded-tl-sm shadow-xs max-w-[85%] text-xs leading-relaxed">
        ${this.escapeHtml(msg.content)}
      </div>
    ` : `
      <div class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center shrink-0 mt-1">
        <span class="material-symbols-outlined text-[18px] text-primary">handyman</span>
      </div>
      <div class="flex flex-col max-w-[85%]">
        <div class="flex items-center gap-1 mb-1">
          <span class="text-xs font-bold text-primary">المهني</span>
          <span class="text-[11px] text-on-surface-variant">${timeStr}</span>
        </div>
        <div class="bg-surface-container-lowest text-on-surface p-3 rounded-2xl rounded-tr-sm shadow-xs border border-surface-container text-xs leading-relaxed">
          ${this.escapeHtml(msg.content)}
        </div>
      </div>
    `;

    container.appendChild(div);
  },

  // ----------------------------------------------------------------------------
  // 7. لوحة تحكم صاحب المهنة (pro/index.html)
  // ----------------------------------------------------------------------------
  async initProDashboard() {
    // التحقق الصارم من حالة الاعتماد
    const status = localStorage.getItem('miras_current_pro_status') || sessionStorage.getItem('miras_craftsman_status') || 'pending';
    if (status !== 'verified') {
      alert('عذراً، حساب صاحب المهنة بانتظار المراجعة والاعتماد من قبل مالكة المنصة (Super Admin).\nلا يمكنك الدخول إلى لوحة الحرفيين حتى يتم تفعيل حسابك من الإدارة.');
      window.location.href = '../login.html?role=craftsman&pending=true';
      return;
    }

    if (this.currentProfile) {
      const nameEl = document.querySelector('h1.font-headline-sm');
      if (nameEl) nameEl.textContent = `أهلاً، المعلم ${this.currentProfile.full_name?.split(' ')[0] || ''} 👋`;

      const phone = this.currentProfile.phone_number || sessionStorage.getItem('registered_phone') || '+967 7XXXXXXXX';
      const cleanTel = window.MirasAPI.formatPhoneDisplay(phone);
      const phoneEl = document.getElementById('proPhoneBadge');
      if (phoneEl) phoneEl.textContent = cleanTel;
      const activeEl = document.getElementById('craftsmanActivePhone');
      if (activeEl) activeEl.textContent = cleanTel;
    }
  },

  // ----------------------------------------------------------------------------
  // 8. لوحة الإدارة العامة لمالكة المنصة (admin/index.html)
  // ----------------------------------------------------------------------------
  async initAdminDashboard() {
    const stats = await window.MirasAPI.admin.getStats();
    if (stats) {
      console.log('[AdminDashboard] إحصائيات المنصة الحية:', stats);
    }
  },

  // ----------------------------------------------------------------------------
  // 9. صفحة توثيق الحرفيين (admin/craftsmen.html)
  // ----------------------------------------------------------------------------
  async initAdminCraftsmenPage() {
    console.log('[AdminCraftsmen] تهيئة شاشة توثيق الحرفيين...');
  },

  // ----------------------------------------------------------------------------
  // 10. إعدادات الإدارة والدعم الحضرمي لمالكة المنصة (admin/settings.html)
  // ----------------------------------------------------------------------------
  async initAdminSettingsPage() {
    console.log('[AdminSettings] تهيئة شاشة الإعدادات وصندوق وارد الدعم الحضرمي...');
    this.renderSupportInboxInAdmin();
  },

  async renderSupportInboxInAdmin() {
    const container = document.getElementById('adminSupportInboxContainer');
    if (!container) return;

    const { data: tickets } = await window.MirasAPI.support.getAllTickets();
    if (!tickets || tickets.length === 0) {
      container.innerHTML = `
        <div class="p-6 text-center text-xs text-on-surface-variant bg-surface-container-low rounded-xl">
          لا توجد استفسارات دعم واردة حالياً.
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    tickets.forEach(t => {
      const card = document.createElement('div');
      card.className = "p-4 rounded-xl bg-surface-container-lowest border border-surface-container space-y-2 text-right";
      card.innerHTML = `
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span class="font-bold text-sm text-primary">${this.escapeHtml(t.subject)}</span>
          </div>
          <span class="text-xs px-2 py-0.5 rounded-full bg-surface-container text-secondary font-bold">${t.status}</span>
        </div>
        <p class="text-xs text-on-surface-variant">المرسل: ${this.escapeHtml(t.user_name)} (${t.user_role}) — هاتف: ${this.escapeHtml(t.user_phone || 'غير مسجل')}</p>
        <div class="pt-2 flex items-center justify-end gap-2">
          <button type="button" onclick="window.MirasApp.replyToSupportTicket('${t.id}')" class="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary-container transition-colors">
            الرد اليدوي كخدمة عملاء مِـرَاس
          </button>
        </div>
      `;
      container.appendChild(card);
    });
  },

  async replyToSupportTicket(ticketId) {
    const replyText = prompt('اكتبي ردك الرسمي لإرساله للمستخدم باسم «خدمة عملاء مِـرَاس»:');
    if (!replyText || !replyText.trim()) return;

    await window.MirasAPI.support.sendReply({
      ticketId: ticketId,
      senderId: this.currentUser?.id || null,
      senderType: 'admin',
      senderName: 'خدمة عملاء مِـرَاس',
      message: replyText.trim()
    });

    alert('✅ تم إرسال الرد بنجاح للمستخدم وتحديث حالة التذكرة.');
    this.renderSupportInboxInAdmin();
  },

  // ----------------------------------------------------------------------------
  // مساعد المفضلة
  // ----------------------------------------------------------------------------
  async toggleFav(craftsmanId, btn) {
    if (!this.currentUser) {
      alert('يرجى تسجيل الدخول لإضافة المهني إلى المفضلة.');
      return;
    }
    const { isFavorite } = await window.MirasAPI.favorites.toggle(this.currentUser.id, craftsmanId);
    if (btn) {
      const icon = btn.querySelector('.material-symbols-outlined');
      if (icon) {
        icon.textContent = isFavorite ? 'favorite' : 'favorite_border';
        icon.className = isFavorite ? 'material-symbols-outlined text-[19px] text-error' : 'material-symbols-outlined text-[19px]';
      }
    }
  },

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
};

document.addEventListener('DOMContentLoaded', () => {
  window.MirasApp.init();
});

