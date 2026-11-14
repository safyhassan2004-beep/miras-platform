/**
 * Miras Platform - PWA & Connectivity Helper
 * مساعد تثبيت التطبيق ومراقبة حالة الاتصال بالشبكة في حضرموت
 */

(function () {
  // 1. تسجيل Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      const swPath = window.location.pathname.includes('/admin/') || window.location.pathname.includes('/pro/') 
        ? '../sw.js' 
        : 'sw.js';

      navigator.serviceWorker.register(swPath)
        .then((reg) => {
          console.log('[Miras PWA] Service Worker مسجل بنجاح بنطاق:', reg.scope);
        })
        .catch((err) => {
          console.warn('[Miras PWA] تعذر تسجيل Service Worker:', err);
        });
    });
  }

  // 2. مؤشر حالة الشبكة في الواجهة (Online / Offline Toast)
  function createToastContainer() {
    let container = document.getElementById('miras-network-toast');
    if (!container) {
      container = document.createElement('div');
      container.id = 'miras-network-toast';
      container.className = 'fixed top-4 left-1/2 -translate-x-1/2 z-[9999] transition-all duration-300 pointer-events-none opacity-0 translate-y-[-20px]';
      document.body.appendChild(container);
    }
    return container;
  }

  function showNetworkToast(isOnline) {
    const container = createToastContainer();
    if (!isOnline) {
      container.innerHTML = `
        <div class="px-4 py-2.5 rounded-2xl bg-primary text-white shadow-xl flex items-center gap-2.5 text-xs font-semibold border border-primary-container/80 backdrop-blur-md">
          <span class="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping"></span>
          <span>انقطع الاتصال بالإنترنت — وضع التصفح دون اتصال مفعل</span>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="px-4 py-2.5 rounded-2xl bg-emerald-700 text-white shadow-xl flex items-center gap-2.5 text-xs font-semibold backdrop-blur-md">
          <span class="w-2.5 h-2.5 rounded-full bg-white"></span>
          <span>تم استعادة الاتصال بالإنترنت بنجاح 🟢</span>
        </div>
      `;
    }

    container.classList.remove('opacity-0', 'translate-y-[-20px]');
    container.classList.add('opacity-100', 'translate-y-0');

    setTimeout(() => {
      container.classList.remove('opacity-100', 'translate-y-0');
      container.classList.add('opacity-0', 'translate-y-[-20px]');
    }, 4000);
  }

  window.addEventListener('online', () => showNetworkToast(true));
  window.addEventListener('offline', () => showNetworkToast(false));

  // 3. دعم زر تثبيت التطبيق PWA (Install Prompt)
  let deferredPrompt;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const installBtn = document.getElementById('pwaInstallBtn');
    if (installBtn) {
      installBtn.classList.remove('hidden');
      installBtn.addEventListener('click', async () => {
        if (deferredPrompt) {
          deferredPrompt.prompt();
          const { outcome } = await deferredPrompt.userChoice;
          console.log('[Miras PWA] خيار المستخدم للتثبيت:', outcome);
          deferredPrompt = null;
          installBtn.classList.add('hidden');
        }
      });
    }
  });
})();

