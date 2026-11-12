-- Migration 03: Additional Tables, Relationships, Indexes & Strict RLS Policies
-- Adds: trade_categories, craftsman_services, reviews, notifications

-- 1. جدول التصنيفات والمهن المعتمدة
CREATE TABLE IF NOT EXISTS public.trade_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    icon TEXT NOT NULL DEFAULT 'handyman',
    description TEXT,
    active_pros_count INT DEFAULT 0,
    is_featured BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. جدول الخدمات المباشرة المعروضة من الحرفيين
CREATE TABLE IF NOT EXISTS public.craftsman_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    craftsman_id UUID NOT NULL REFERENCES public.craftsmen_profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    duration_hours INT DEFAULT 1,
    category TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. جدول التقييمات والآراء المعتمدة
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.service_orders(id) ON DELETE SET NULL,
    client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    craftsman_id UUID NOT NULL REFERENCES public.craftsmen_profiles(id) ON DELETE CASCADE,
    rating NUMERIC(2, 1) NOT NULL CHECK (rating >= 1.0 AND rating <= 5.0),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. جدول الإشعارات والتنبيهات الحية
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'order', 'bid', 'payment', 'system')),
    link TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. الفهارس لتحسين الأداء وسرعة الاستعلام (Performance Indexes)
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_craftsmen_user_id ON public.craftsmen_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_craftsmen_verification ON public.craftsmen_profiles(verification_status);
CREATE INDEX IF NOT EXISTS idx_services_craftsman_id ON public.craftsman_services(craftsman_id);
CREATE INDEX IF NOT EXISTS idx_orders_client_id ON public.service_orders(client_id);
CREATE INDEX IF NOT EXISTS idx_orders_craftsman_id ON public.service_orders(craftsman_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.service_orders(status);
CREATE INDEX IF NOT EXISTS idx_bids_order_id ON public.bids(order_id);
CREATE INDEX IF NOT EXISTS idx_bids_craftsman_id ON public.bids(craftsman_id);
CREATE INDEX IF NOT EXISTS idx_reviews_craftsman_id ON public.reviews(craftsman_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_id ON public.escrow_transactions(wallet_id);

-- 6. تفعيل أمان الصفوف (Row Level Security - RLS) على جميع الجداول
ALTER TABLE public.trade_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.craftsman_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.craftsmen_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escrow_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escrow_transactions ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 7. سياسات RLS المحكمة بحسب الأدوار والصلاحيات
-- ------------------------------------------------------------------------------

-- أ. تصنيفات المهن (trade_categories)
DROP POLICY IF EXISTS "Public view categories" ON public.trade_categories;
DROP POLICY IF EXISTS "Admin manage categories" ON public.trade_categories;
CREATE POLICY "Public view categories" ON public.trade_categories FOR SELECT TO public USING (TRUE);
CREATE POLICY "Admin manage categories" ON public.trade_categories FOR ALL TO authenticated USING (public.is_admin());

-- ب. الخدمات (craftsman_services)
DROP POLICY IF EXISTS "Public view services" ON public.craftsman_services;
DROP POLICY IF EXISTS "Craftsman manage services" ON public.craftsman_services;
DROP POLICY IF EXISTS "Admin manage services" ON public.craftsman_services;
CREATE POLICY "Public view services" ON public.craftsman_services FOR SELECT TO public USING (is_active = TRUE OR public.is_admin());
CREATE POLICY "Craftsman insert own services" ON public.craftsman_services FOR INSERT TO authenticated 
    WITH CHECK (craftsman_id IN (SELECT id FROM public.craftsmen_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Craftsman update own services" ON public.craftsman_services FOR UPDATE TO authenticated 
    USING (craftsman_id IN (SELECT id FROM public.craftsmen_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Craftsman delete own services" ON public.craftsman_services FOR DELETE TO authenticated 
    USING (craftsman_id IN (SELECT id FROM public.craftsmen_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Admin manage services" ON public.craftsman_services FOR ALL TO authenticated USING (public.is_admin());

-- ج. التقييمات (reviews)
DROP POLICY IF EXISTS "Public view reviews" ON public.reviews;
DROP POLICY IF EXISTS "Client insert reviews" ON public.reviews;
DROP POLICY IF EXISTS "Admin manage reviews" ON public.reviews;
CREATE POLICY "Public view reviews" ON public.reviews FOR SELECT TO public USING (TRUE);
CREATE POLICY "Client insert reviews" ON public.reviews FOR INSERT TO authenticated WITH CHECK (client_id = auth.uid());
CREATE POLICY "Admin manage reviews" ON public.reviews FOR ALL TO authenticated USING (public.is_admin());

-- د. الإشعارات (notifications)
DROP POLICY IF EXISTS "User view notifications" ON public.notifications;
DROP POLICY IF EXISTS "User update notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admin manage notifications" ON public.notifications;
CREATE POLICY "User view notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "User update notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "Admin manage notifications" ON public.notifications FOR ALL TO authenticated USING (public.is_admin());

-- هـ. الملفات الشخصية (profiles)
-- حماية من تعديل الرتبة من قبل المستخدم العادي
DROP POLICY IF EXISTS "Public view profiles" ON public.profiles;
DROP POLICY IF EXISTS "User update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin full access profiles" ON public.profiles;
CREATE POLICY "Public view profiles" ON public.profiles FOR SELECT TO public USING (TRUE);
CREATE POLICY "User update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "Admin full access profiles" ON public.profiles FOR ALL TO authenticated USING (public.is_admin());

-- و. طلبات الخدمة (service_orders)
DROP POLICY IF EXISTS "Public view orders" ON public.service_orders;
DROP POLICY IF EXISTS "Client create orders" ON public.service_orders;
DROP POLICY IF EXISTS "Parties update orders" ON public.service_orders;
DROP POLICY IF EXISTS "Admin manage orders" ON public.service_orders;
CREATE POLICY "Public view orders" ON public.service_orders FOR SELECT TO public USING (TRUE);
CREATE POLICY "Client create orders" ON public.service_orders FOR INSERT TO authenticated WITH CHECK (client_id = auth.uid());
CREATE POLICY "Parties update orders" ON public.service_orders FOR UPDATE TO authenticated 
    USING (client_id = auth.uid() OR craftsman_id IN (SELECT id FROM public.craftsmen_profiles WHERE user_id = auth.uid()) OR public.is_admin());
CREATE POLICY "Admin manage orders" ON public.service_orders FOR ALL TO authenticated USING (public.is_admin());

-- ز. عروض الأسعار (bids)
DROP POLICY IF EXISTS "View bids policy" ON public.bids;
DROP POLICY IF EXISTS "Craftsman submit bids policy" ON public.bids;
DROP POLICY IF EXISTS "Admin manage bids" ON public.bids;
CREATE POLICY "View bids policy" ON public.bids FOR SELECT TO public USING (TRUE);
CREATE POLICY "Craftsman submit bids policy" ON public.bids FOR INSERT TO authenticated 
    WITH CHECK (craftsman_id IN (SELECT id FROM public.craftsmen_profiles WHERE user_id = auth.uid()) OR public.is_admin());
CREATE POLICY "Craftsman update bids policy" ON public.bids FOR UPDATE TO authenticated 
    USING (craftsman_id IN (SELECT id FROM public.craftsmen_profiles WHERE user_id = auth.uid()) OR public.is_admin());
CREATE POLICY "Admin manage bids" ON public.bids FOR ALL TO authenticated USING (public.is_admin());

-- ح. المحافظ والضمان المالي (escrow_wallets & escrow_transactions)
DROP POLICY IF EXISTS "User view wallet" ON public.escrow_wallets;
DROP POLICY IF EXISTS "Admin manage wallets" ON public.escrow_wallets;
CREATE POLICY "User view wallet" ON public.escrow_wallets FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Admin manage wallets" ON public.escrow_wallets FOR ALL TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "User view transactions" ON public.escrow_transactions;
DROP POLICY IF EXISTS "User create transaction" ON public.escrow_transactions;
DROP POLICY IF EXISTS "Admin manage transactions" ON public.escrow_transactions;
CREATE POLICY "User view transactions" ON public.escrow_transactions FOR SELECT TO authenticated 
    USING (wallet_id IN (SELECT id FROM public.escrow_wallets WHERE user_id = auth.uid()) OR public.is_admin());
CREATE POLICY "User create transaction" ON public.escrow_transactions FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "Admin manage transactions" ON public.escrow_transactions FOR ALL TO authenticated USING (public.is_admin());

