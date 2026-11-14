/**
 * Miras Favorites Management Engine
 * منصة مِـرَاس - محرك إدارة الكوادر والمهنيين المفضلين
 */

const MirasFavorites = {
  STORAGE_KEY: 'miras_favorites',

  // جلب قائمة المفضلات من التخزين المحلي
  getFavorites() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('[MirasFavorites] خطأ في قراءة المفضلة:', e);
    }
    return [];
  },

  // حفظ القائمة
  saveFavorites(list) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list));
      window.dispatchEvent(new CustomEvent('miras:favorites_updated', { detail: { count: list.length, list } }));
    } catch (e) {
      console.error('[MirasFavorites] خطأ في حفظ المفضلة:', e);
    }
  },

  // فحص هل المهني موجود في المفضلة
  isFavorite(id) {
    if (!id) return false;
    const strId = String(id);
    return this.getFavorites().some(item => String(item.id) === strId);
  },

  // إضافة أو إزالة المهني من المفضلة
  toggle(craftsman) {
    if (!craftsman || !craftsman.id) return { isFavorite: false, count: 0 };
    const strId = String(craftsman.id);
    let list = this.getFavorites();
    const index = list.findIndex(item => String(item.id) === strId);

    let isFav = false;
    if (index >= 0) {
      // إزالة من المفضلة
      list.splice(index, 1);
      isFav = false;
    } else {
      // إضافة إلى المفضلة
      const newItem = {
        id: strId,
        name: craftsman.name || 'مهني معتمد',
        trade: craftsman.trade || 'صيانة وتشطيبات',
        category: craftsman.category || craftsman.trade || 'صيانة',
        city: craftsman.city || 'حضرموت — المكلا',
        rating: craftsman.rating || '4.9',
        reviewsCount: craftsman.reviewsCount || craftsman.reviews || '86',
        price: craftsman.price || 'يبدأ من 10,000 ر.ي',
        image: craftsman.image || craftsman.avatar_url || 'https://lh3.googleusercontent.com/aida-public/AB6AXuAo_sGOwgiy2SLIEuzYnLAVbAT1SqhbWskKmEJ1N5J_ZbU43QH2vyWghadkgbtXD5jUJU6MfkrPs0zQv83kpoUHFdwodNpzimFwwsYOLy6j3hpLCLdyD9d32Kafddv_qCe7CIqcOe3MBNAuzic6SlfYORAngjWmEorfuoCjzuqXrmN6tsdhMuWbhkiHP-ogNLYYraMYsUMv7P5PGBbb0-GqGW4C5bzkWxp6sWnvJSY',
        phone: craftsman.phone || '+967770000001',
        added_at: new Date().toISOString()
      };
      list.unshift(newItem);
      isFav = true;
    }

    this.saveFavorites(list);

    // محاولة المزامنة مع Supabase إذا كان هناك حساب مسجل
    try {
      if (window.MirasAPI && window.MirasAPI.favorites && window.MirasAPI.auth) {
        window.MirasAPI.auth.getCurrentUser().then(user => {
          if (user?.id) {
            window.MirasAPI.favorites.toggle(user.id, strId).catch(() => {});
          }
        });
      }
    } catch (err) {}

    // إشعار المستخدم
    this.showToast(isFav ? `تمت إضافة «${craftsman.name || 'المهني'}» إلى المفضلة ❤️` : `تمت إزالة المهني من المفضلة`);

    return { isFavorite: isFav, count: list.length };
  },

  // إشعار منبثق سريع
  showToast(message) {
    let toast = document.getElementById('mirasFavToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'mirasFavToast';
      toast.className = 'fixed bottom-20 left-1/2 -translate-x-1/2 z-[9999] bg-primary text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-xs font-semibold transition-all duration-300 opacity-0 pointer-events-none transform translate-y-4';
      document.body.appendChild(toast);
    }

    toast.innerHTML = `<span class="material-symbols-outlined text-[18px] text-tertiary-fixed">favorite</span><span>${message}</span>`;
    toast.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-4');
    toast.classList.add('opacity-100', 'translate-y-0');

    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.classList.remove('opacity-100', 'translate-y-0');
      toast.classList.add('opacity-0', 'pointer-events-none', 'translate-y-4');
    }, 2800);
  }
};

window.MirasFavorites = MirasFavorites;
