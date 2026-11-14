/**
 * Miras Interactive Hadramout Map Engine
 * منصة مِـرَاس - خريطة كوادر ومهنيي حضرموت التفاعلية
 */

const MirasMap = {
  leafletLoaded: false,
  mapInstance: null,
  markers: [],

  // المواقع المعتمدة في حضرموت
  CITIES: {
    mukalla: { name: 'المكلا', coords: [14.5425, 49.1242], zoom: 13 },
    seiyun: { name: 'سيئون', coords: [15.9328, 48.7891], zoom: 13 },
    tarim: { name: 'تريم', coords: [16.0560, 48.9950], zoom: 13 },
    shihr: { name: 'الشحر', coords: [14.7580, 49.6050], zoom: 13 },
    ghayl: { name: 'غيل باوزير', coords: [14.7780, 49.3680], zoom: 13 },
    doan: { name: 'وادي دوعن', coords: [15.1500, 48.3300], zoom: 12 }
  },

  // الكوادر المحددة على الخريطة
  CRAFTSMEN_PINS: [
    {
      id: '1',
      name: 'المعلم سعيد بن مخاشن',
      trade: 'فني تكييف وتبريد معتمد',
      city: 'المكلا - حي فوة',
      coords: [14.5312, 49.0987],
      rating: '4.9 ★',
      price: 'كشف وصيانة: 12,000 ر.ي',
      phone: '+967781125928',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAo_sGOwgiy2SLIEuzYnLAVbAT1SqhbWskKmEJ1N5J_ZbU43QH2vyWghadkgbtXD5jUJU6MfkrPs0zQv83kpoUHFdwodNpzimFwwsYOLy6j3hpLCLdyD9d32Kafddv_qCe7CIqcOe3MBNAuzic6SlfYORAngjWmEorfuoCjzuqXrmN6tsdhMuWbhkiHP-ogNLYYraMYsUMv7P5PGBbb0-GqGW4C5bzkWxp6sWnvJSY'
    },
    {
      id: '2',
      name: 'المهندس عمر بكران',
      trade: 'كهربائي وتمديدات معتمد',
      city: 'تريم - الخليف وعيديد',
      coords: [16.0560, 48.9950],
      rating: '4.8 ★',
      price: 'تأسيس وفحص: 7,000 ر.ي',
      phone: '+967781125928',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCNLPGmNqjGAsAk4Dvogaec_6J9yRrTBsBJmUzFpvfcml6CrX6ZvGXLBnDOlgaXaOY5RxZvlGqJ1Ng7mH4XwT2YYGwji6LmhhMh3nystJiC-wxusZI-p48fb9rIfQbkE23HYDr-jA4t7ITQ9aXk8P1BBahZAg16e-QQch9FsQdgF6jzzXQyegCBCNqIO4AtAVqyQzRjOAV-snXBrOWifmfJBpzH-ISIXm8x8zRZz2A'
    },
    {
      id: '3',
      name: 'المعلم ياسر الجابري',
      trade: 'سباكة وكشف تسريبات',
      city: 'سيئون - السحيل والغرفة',
      coords: [15.9328, 48.7891],
      rating: '4.95 ★',
      price: 'كشف أولي: 6,000 ر.ي',
      phone: '+967781125928',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD9IXmgNxrVWqbblFigI3IAccYpGaEMxGPNYRwcGANonWO2lk5wcGp0Fg0OFwu7UkV4U8RKgu6VhbG6_Q9Zn4L0-3FG7gFM8dNAH0U2pdTUjBXDfE2m4dp6GrFx2RNdfhV2DEUckSJwqTlX9IsqGnwXhqUHqCfA7kQvsnaYkrBaYFyFXLzYCB9DnAnVtrVsAKccrZjtP8Xu0WgaTE70sB4xPV1hyeEfw7mwrR0zQFY'
    },
    {
      id: '4',
      name: 'مؤسسة الأحقاف للنجارة',
      trade: 'أبواب ونوافذ تراثية وديكور',
      city: 'الشحر - حي المحط',
      coords: [14.7580, 49.6050],
      rating: '4.7 ★',
      price: 'مقايسة وتفصيل: 25,000 ر.ي',
      phone: '+967781125928',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCzZIhEZFtbh3gYcwwjo5Icei_-7BkUHceUJc_5jHtkvWXCe_LfsdVr2jKj8gARek6HWx4i9q3ADWBt_tO2NXgTLKNInM20ihVLU2zT6SNoQfd5tW-KV1RgQ-0eV3e00PqaDKZDN3Evd8EgIUFv_wVUrPoN5rupM7mXd1QpSY8KQg-HeRHj_7zv7XyiI9miqkQD4K8ubAI7rSiB1U2FH6wpU8qG1-TGSNVcFvLbhJQ'
    },
    {
      id: '5',
      name: 'المعلّم عوض باحيدرة',
      trade: 'عمارة طينية وبناء تقليدي',
      city: 'المكلا - الديس والشرج',
      coords: [14.5490, 49.1350],
      rating: '5.0 ★',
      price: 'استشارة وترميم: 20,000 ر.ي',
      phone: '+967781125928',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBeBJRumuvpNF3WuFQi2nEyx3EijDYwM3sLvqH13Qbn28muLmP-S5K8UKhO46ydp8AY2oqbgiq0q0DhaX5f2Xow1IktUHg0nqGJeYF9-IL-xRVLBtNFgbUN-8Y4-hT9wB7pB2YwLOySI5OC8qdnbGTEeA5MqV86QLIi5PCu5-YoOJ7AiaJ1rMIHVqoo47NUtMUwvTqCppmffep6tXP9bHwE5HREILUPflbo-MHr_QY'
    }
  ],

  // تحميل Leaflet ديناميكياً بدون أي مكتبات مدفوعة
  loadLeaflet() {
    return new Promise((resolve) => {
      if (window.L) {
        this.leafletLoaded = true;
        resolve();
        return;
      }

      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(css);

      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => {
        this.leafletLoaded = true;
        resolve();
      };
      document.body.appendChild(script);
    });
  },

  // فتح نافذة الخريطة التفاعلية
  async openMapModal(mode = 'browse', onLocationSelected = null) {
    await this.loadLeaflet();

    let modal = document.getElementById('mirasMapModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'mirasMapModal';
      modal.className = 'fixed inset-0 z-[9999] bg-primary/70 backdrop-blur-md flex flex-col items-center justify-center p-2 sm:p-4';
      modal.innerHTML = `
        <div class="bg-surface rounded-2xl w-full max-w-4xl h-[92vh] sm:h-[85vh] flex flex-col overflow-hidden shadow-2xl border border-surface-container relative text-right">
          
          <!-- Header Bar -->
          <div class="p-3 sm:p-4 bg-primary text-white flex items-center justify-between shadow-sm">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-tertiary-fixed text-[24px]">map</span>
              <div>
                <h3 class="font-bold text-sm sm:text-base text-tertiary-fixed" id="mirasMapTitle">خريطة كوادر ومهنيي حضرموت الحية</h3>
                <span class="text-[11px] text-white/80">المكلا • سيئون • تريم • الشحر • دوعن</span>
              </div>
            </div>
            <button type="button" onclick="MirasMap.closeMapModal()" class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors" title="إغلاق الخريطة">
              <span class="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <!-- Quick Cities Filter Strip -->
          <div class="bg-surface-container-low px-3 py-2 flex items-center gap-1.5 overflow-x-auto border-b border-surface-container text-xs">
            <span class="text-primary font-bold whitespace-nowrap pl-2">انتقال سريع:</span>
            <button type="button" onclick="MirasMap.flyToCity('mukalla')" class="px-2.5 py-1 rounded-lg bg-surface hover:bg-surface-container font-semibold text-primary shadow-xs whitespace-nowrap transition-colors">🏙️ المكلا</button>
            <button type="button" onclick="MirasMap.flyToCity('seiyun')" class="px-2.5 py-1 rounded-lg bg-surface hover:bg-surface-container font-semibold text-primary shadow-xs whitespace-nowrap transition-colors">🏛️ سيئون</button>
            <button type="button" onclick="MirasMap.flyToCity('tarim')" class="px-2.5 py-1 rounded-lg bg-surface hover:bg-surface-container font-semibold text-primary shadow-xs whitespace-nowrap transition-colors">🕌 تريم</button>
            <button type="button" onclick="MirasMap.flyToCity('shihr')" class="px-2.5 py-1 rounded-lg bg-surface hover:bg-surface-container font-semibold text-primary shadow-xs whitespace-nowrap transition-colors">⚓ الشحر</button>
            <button type="button" onclick="MirasMap.flyToCity('ghayl')" class="px-2.5 py-1 rounded-lg bg-surface hover:bg-surface-container font-semibold text-primary shadow-xs whitespace-nowrap transition-colors">🌴 غيل باوزير</button>
            <button type="button" onclick="MirasMap.flyToCity('doan')" class="px-2.5 py-1 rounded-lg bg-surface hover:bg-surface-container font-semibold text-primary shadow-xs whitespace-nowrap transition-colors">🏜️ وادي دوعن</button>
          </div>

          <!-- Map Container -->
          <div id="mirasLeafletMap" class="flex-1 w-full relative bg-surface-container"></div>

          <!-- Map Footer Status -->
          <div class="p-2.5 bg-surface-container-lowest border-t border-surface-container flex items-center justify-between text-xs text-on-surface-variant">
            <span class="flex items-center gap-1 text-[11px]">
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>انقر على أي علامة لعرض ملف المهني والاتصال المباشر برقم هاتفه.</span>
            </span>
            <span class="font-bold text-primary font-mono hidden sm:inline">حضرموت — شبكة مِـرَاس</span>
          </div>

        </div>
      `;
      document.body.appendChild(modal);
    }

    modal.classList.remove('hidden');

    // تهيئة خريطة Leaflet
    setTimeout(() => {
      this.initMap(mode, onLocationSelected);
    }, 150);
  },

  // إغلاق نافذة الخريطة
  closeMapModal() {
    const modal = document.getElementById('mirasMapModal');
    if (modal) modal.classList.add('hidden');
  },

  // تهيئة الخريطة
  initMap(mode, onLocationSelected) {
    const mapEl = document.getElementById('mirasLeafletMap');
    if (!mapEl || !window.L) return;

    if (this.mapInstance) {
      this.mapInstance.remove();
      this.mapInstance = null;
    }

    // مركز الخريطة الافتراضي: حضرموت — المكلا
    this.mapInstance = L.map('mirasLeafletMap', {
      zoomControl: true,
      attributionControl: false
    }).setView(this.CITIES.mukalla.coords, 12);

    // بلاطات OpenStreetMap المجانية والسريعة
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
    }).addTo(this.mapInstance);

    // إضافة علامات الكوادر
    this.markers = [];
    this.CRAFTSMEN_PINS.forEach(c => {
      const customIcon = L.divIcon({
        className: 'custom-pro-pin',
        html: `
          <div class="relative w-10 h-10 rounded-full border-2 border-white shadow-lg bg-primary overflow-hidden flex items-center justify-center transform hover:scale-110 transition-transform cursor-pointer">
            <img src="${c.image}" class="w-full h-full object-cover" onerror="this.src='https://lh3.googleusercontent.com/aida-public/AB6AXuAo_sGOwgiy2SLIEuzYnLAVbAT1SqhbWskKmEJ1N5J_ZbU43QH2vyWghadkgbtXD5jUJU6MfkrPs0zQv83kpoUHFdwodNpzimFwwsYOLy6j3hpLCLdyD9d32Kafddv_qCe7CIqcOe3MBNAuzic6SlfYORAngjWmEorfuoCjzuqXrmN6tsdhMuWbhkiHP-ogNLYYraMYsUMv7P5PGBbb0-GqGW4C5bzkWxp6sWnvJSY'"/>
            <span class="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full ring-1 ring-white"></span>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });

      const cleanTel = c.phone;
      const cleanWa = '967' + c.phone.replace(/[^0-9]/g, '').replace(/^(\+967|00967|967|0)/, '');

      const popupContent = `
        <div style="font-family: inherit; direction: rtl; text-align: right; min-width: 200px; padding: 4px;">
          <div style="font-weight: bold; color: #00173b; font-size: 14px; margin-bottom: 2px;">${c.name}</div>
          <div style="font-size: 11px; color: #3755c3; font-weight: 600;">${c.trade}</div>
          <div style="font-size: 11px; color: #666; margin: 3px 0;">📍 ${c.city}</div>
          <div style="font-size: 11px; color: #b45309; font-weight: bold;">${c.price}</div>
          <div style="display: flex; gap: 6px; margin-top: 8px;">
            <a href="tel:${cleanTel}" style="flex: 1; text-align: center; background: #00173b; color: white; padding: 6px; border-radius: 8px; font-size: 11px; font-weight: bold; text-decoration: none;">اتصال</a>
            <a href="https://wa.me/${cleanWa}?text=${encodeURIComponent('السلام عليكم ' + c.name + '، رأيت موقعك على خريطة مِـرَاس وأود طلب خدمة.')}" target="_blank" style="flex: 1; text-align: center; background: #16a34a; color: white; padding: 6px; border-radius: 8px; font-size: 11px; font-weight: bold; text-decoration: none;">واتساب</a>
            <a href="book-service.html?craftsman_id=${c.id}" style="flex: 1; text-align: center; background: #e2e8f0; color: #00173b; padding: 6px; border-radius: 8px; font-size: 11px; font-weight: bold; text-decoration: none;">حجز</a>
          </div>
        </div>
      `;

      const marker = L.marker(c.coords, { icon: customIcon }).addTo(this.mapInstance);
      marker.bindPopup(popupContent);
      this.markers.push(marker);
    });

    // إذا كان في وضع تحديد الموقع (من صفحة الحجز)
    if (mode === 'picker' && onLocationSelected) {
      let tempPin = null;
      this.mapInstance.on('click', (e) => {
        if (tempPin) this.mapInstance.removeLayer(tempPin);
        tempPin = L.marker(e.latlng).addTo(this.mapInstance);
        tempPin.bindPopup('📍 موقع منزلك المحدد بدقة').openPopup();
        onLocationSelected(e.latlng);
      });
    }

    this.mapInstance.invalidateSize();
  },

  // الانتقال السريع للمدينة
  flyToCity(cityKey) {
    const city = this.CITIES[cityKey];
    if (city && this.mapInstance) {
      this.mapInstance.flyTo(city.coords, city.zoom, { duration: 1.2 });
    }
  }
};

window.MirasMap = MirasMap;

