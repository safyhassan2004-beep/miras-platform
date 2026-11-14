/**
 * منصة مِـرَاس (Miras) - محرك تصنيفات المهن والتخصصات
 * Miras Trade Categories Engine - Dynamic JS Rendering, Standalone Boxes & Routing
 */

(function (global) {
  'use strict';
  const window = global;
  const document = global.document;

  const MIRAS_TRADES = [
    {
      id: 'hvac',
      name: 'تكييف وتبريد',
      subtitle: 'صيانة، تنظيف وتركيب المكيفات',
      count: '38 خبير معتمد',
      badge: 'الأعلى طلباً',
      badgeClass: 'bg-amber-100 text-amber-900 border-amber-200',
      icon: 'ac_unit',
      iconBg: 'bg-blue-50 text-blue-700 border-blue-200 group-hover:bg-blue-600 group-hover:text-white',
      accentColor: 'blue'
    },
    {
      id: 'plumbing',
      name: 'سباكة وصحي',
      subtitle: 'تأسيس وصيانة شبكات المياه',
      count: '45 فني معتمد',
      badge: 'طوارئ 24/7',
      badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-200',
      icon: 'plumbing',
      iconBg: 'bg-cyan-50 text-cyan-700 border-cyan-200 group-hover:bg-cyan-600 group-hover:text-white',
      accentColor: 'cyan'
    },
    {
      id: 'electrical',
      name: 'كهرباء وتمديدات',
      subtitle: 'شبكات منزلية وتجارية وطاقة',
      count: '52 مهني معتمد',
      badge: 'معتمد رسمياً',
      badgeClass: 'bg-blue-100 text-blue-900 border-blue-200',
      icon: 'electrical_services',
      iconBg: 'bg-amber-50 text-amber-700 border-amber-200 group-hover:bg-amber-500 group-hover:text-white',
      accentColor: 'amber'
    },
    {
      id: 'carpentry',
      name: 'نجارة وألمنيوم',
      subtitle: 'أبواب، مطابخ وديكورات خشبية',
      count: '29 معلم معتمد',
      badge: 'حرفي متمرس',
      badgeClass: 'bg-orange-100 text-orange-900 border-orange-200',
      icon: 'carpenter',
      iconBg: 'bg-orange-50 text-orange-700 border-orange-200 group-hover:bg-orange-600 group-hover:text-white',
      accentColor: 'orange'
    },
    {
      id: 'painting',
      name: 'دهان وديكور',
      subtitle: 'دهانات داخلية وخارجية وتشطيب',
      count: '34 حرفي معتمد',
      badge: 'تشطيب راقٍ',
      badgeClass: 'bg-teal-100 text-teal-900 border-teal-200',
      icon: 'format_paint',
      iconBg: 'bg-emerald-50 text-emerald-700 border-emerald-200 group-hover:bg-emerald-600 group-hover:text-white',
      accentColor: 'emerald'
    },
    {
      id: 'construction',
      name: 'بناء وطين حضرمي',
      subtitle: 'عمارة الطين، نورة وتراث أصيل',
      count: '22 مقاول معتمد',
      badge: 'تراث حضرمي',
      badgeClass: 'bg-yellow-100 text-yellow-900 border-yellow-300',
      icon: 'foundation',
      iconBg: 'bg-yellow-50 text-yellow-800 border-yellow-200 group-hover:bg-yellow-600 group-hover:text-white',
      accentColor: 'yellow'
    },
    {
      id: 'auto',
      name: 'صيانة سيارات',
      subtitle: 'ميكانيكا، كهرباء وفحص كمبيوتر',
      count: '19 ورشة معتمدة',
      badge: 'فحص فوري',
      badgeClass: 'bg-rose-100 text-rose-900 border-rose-200',
      icon: 'car_repair',
      iconBg: 'bg-rose-50 text-rose-700 border-rose-200 group-hover:bg-rose-600 group-hover:text-white',
      accentColor: 'rose'
    },
    {
      id: 'tailoring',
      name: 'خياطة وتطريز',
      subtitle: 'تفصيل ثياب وتطريز حضرمي',
      count: '31 معمل معتمد',
      badge: 'أصالة حضرمية',
      badgeClass: 'bg-purple-100 text-purple-900 border-purple-200',
      icon: 'content_cut',
      iconBg: 'bg-purple-50 text-purple-700 border-purple-200 group-hover:bg-purple-600 group-hover:text-white',
      accentColor: 'purple'
    },
    {
      id: 'tech',
      name: 'خدمات تقنية',
      subtitle: 'شبكات، كاميرات وحلول ذكية',
      count: '17 مختص معتمد',
      badge: 'حلول ذكية',
      badgeClass: 'bg-indigo-100 text-indigo-900 border-indigo-200',
      icon: 'terminal',
      iconBg: 'bg-indigo-50 text-indigo-700 border-indigo-200 group-hover:bg-indigo-600 group-hover:text-white',
      accentColor: 'indigo'
    },
    {
      id: 'all',
      name: 'كافة التخصصات',
      subtitle: 'استعراض جميع المهن والكوادر',
      count: '285+ مهني وكادر',
      badge: 'دليل شامل',
      badgeClass: 'bg-primary/10 text-primary border-primary/20',
      icon: 'grid_view',
      iconBg: 'bg-primary/10 text-primary border-primary/20 group-hover:bg-primary group-hover:text-white',
      accentColor: 'primary'
    }
  ];

  const MirasTrades = {
    trades: MIRAS_TRADES,

    getTrade: function (id) {
      return MIRAS_TRADES.find(function (t) { return t.id === id; }) || null;
    },

    navigate: function (tradeId) {
      if (!tradeId || tradeId === 'all') {
        window.location.href = 'explore.html';
      } else {
        window.location.href = 'explore.html?category=' + encodeURIComponent(tradeId);
      }
    },

    buildCardHTML: function (trade) {
      const targetUrl = trade.id === 'all' ? 'explore.html' : 'explore.html?category=' + encodeURIComponent(trade.id);
      return (
        '<a href="' + targetUrl + '" ' +
        'onclick="event.preventDefault(); window.MirasTrades.navigate(\'' + trade.id + '\');" ' +
        'data-trade-id="' + trade.id + '" ' +
        'class="trade-specialty-card group relative flex flex-col items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-surface-container-lowest border border-surface-container-high hover:border-primary/40 shadow-xs hover:shadow-md transition-all duration-200 active:scale-95 cursor-pointer text-center select-none overflow-hidden min-h-[160px] sm:min-h-[180px]" ' +
        'title="' + trade.name + ' - ' + trade.subtitle + '">' +
          '<!-- Top Trade Badge -->' +
          '<div class="w-full flex items-center justify-between gap-1 mb-2">' +
            '<span class="text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full border ' + trade.badgeClass + '">' +
              trade.badge +
            '</span>' +
            '<span class="material-symbols-outlined text-surface-container-highest group-hover:text-primary transition-colors text-[18px]">' +
              'north_west' +
            '</span>' +
          '</div>' +
          '<!-- Specialty Icon Container (Distinct Square Box) -->' +
          '<div class="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl border flex items-center justify-center mb-2 transition-all duration-200 shadow-xs ' + trade.iconBg + '">' +
            '<span class="material-symbols-outlined text-[26px] sm:text-[28px]">' + trade.icon + '</span>' +
          '</div>' +
          '<!-- Trade Name & Description -->' +
          '<div class="w-full my-auto">' +
            '<h3 class="font-bold text-on-surface text-xs sm:text-sm md:text-base group-hover:text-primary transition-colors truncate">' +
              trade.name +
            '</h3>' +
            '<p class="text-[10px] sm:text-xs text-on-surface-variant line-clamp-1 mt-0.5 font-normal">' +
              trade.subtitle +
            '</p>' +
          '</div>' +
          '<!-- Verified Count Chip -->' +
          '<div class="mt-2.5 w-full pt-2 border-t border-surface-container-low flex items-center justify-center gap-1 text-[10px] sm:text-[11px] font-semibold text-secondary">' +
            '<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>' +
            '<span>' + trade.count + '</span>' +
          '</div>' +
        '</a>'
      );
    },

    render: function (containerId) {
      const container = document.getElementById(containerId || 'tradesCategoriesGrid');
      if (!container) return;

      const html = MIRAS_TRADES.map(function (t) {
        return MirasTrades.buildCardHTML(t);
      }).join('');
      container.innerHTML = html;
    },

    init: function (containerId) {
      const targetId = containerId || 'tradesCategoriesGrid';
      const container = document.getElementById(targetId);
      if (!container) return;

      this.render(targetId);
    }
  };

  // Expose to global window
  window.MirasTrades = MirasTrades;

  // Auto-init on DOMContentLoaded or immediately if ready
  if (typeof document !== 'undefined' && document) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        MirasTrades.init();
      });
    } else {
      MirasTrades.init();
    }
  }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
