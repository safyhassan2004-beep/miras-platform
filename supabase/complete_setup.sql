-- ==============================================================================
-- مِـرَاس (Miras) — الملف الشامل النهائي لتجهيز قاعدة بيانات Supabase بالكامل
-- Production Database Schema, Triggers, RLS Security, Categories & Admin Setup
-- 
-- طريقة الاستخدام:
-- 1. افتح Supabase Dashboard -> مشروعك
-- 2. اضغط على SQL Editor -> New query
-- 3. الصق هذا الملف كاملاً واضغط Run (تشغيل)
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. جدول الحسابات والملفات الشخصية (Profiles)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone_number TEXT UNIQUE,
    role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('client', 'craftsman', 'admin')),
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    avatar_url TEXT,
    city TEXT DEFAULT 'الرياض',
    national_id_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- تحديث وضمان وجود كافة الأعمدة في حال وجود جدول قديم
ALTER TABLE public.profiles 
    ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('client', 'craftsman', 'admin')),
    ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS phone_number TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS city TEXT DEFAULT 'الرياض',
    ADD COLUMN IF NOT EXISTS national_id_verified BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ------------------------------------------------------------------------------
-- 2. جدول بيانات وتراخيص أصحاب المهن (Craftsmen Profiles)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.craftsmen_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    trade_category TEXT NOT NULL,
    experience_years INT DEFAULT 1,
    commercial_register TEXT,
    is_available BOOLEAN DEFAULT TRUE,
    rating NUMERIC(3, 2) DEFAULT 5.00,
    total_reviews INT DEFAULT 0,
    completed_orders INT DEFAULT 0,
    active_orders_count INT DEFAULT 0,
    verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 3. جدول تصنيفات المهن والتخصصات (Trade Categories)
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 4. جدول الخدمات المباشرة المعروضة من الحرفيين (Craftsman Services)
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 5. جدول المحافظ المالية والضمان (Escrow Wallets)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.escrow_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    balance NUMERIC(12, 2) DEFAULT 0.00,
    escrow_held NUMERIC(12, 2) DEFAULT 0.00,
    total_earned NUMERIC(12, 2) DEFAULT 0.00,
    iban TEXT,
    bank_name TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 6. جدول طلبات العمل والمشاريع (Service Orders)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.service_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    craftsman_id UUID REFERENCES public.craftsmen_profiles(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    trade_category TEXT NOT NULL,
    description TEXT,
    city TEXT NOT NULL DEFAULT 'الرياض',
    location_details TEXT,
    estimated_budget NUMERIC(10, 2),
    final_amount NUMERIC(10, 2),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'bidding', 'in_progress', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 7. جدول عروض الأسعار والمناقصات (Bids)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
    craftsman_id UUID NOT NULL REFERENCES public.craftsmen_profiles(id) ON DELETE CASCADE,
    bid_amount NUMERIC(10, 2) NOT NULL,
    execution_days INT NOT NULL DEFAULT 1,
    proposal_notes TEXT,
    status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'accepted', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 8. جدول التقييمات والآراء (Reviews)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.service_orders(id) ON DELETE SET NULL,
    client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    craftsman_id UUID NOT NULL REFERENCES public.craftsmen_profiles(id) ON DELETE CASCADE,
    rating NUMERIC(2, 1) NOT NULL CHECK (rating >= 1.0 AND rating <= 5.0),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 9. جدول الإشعارات (Notifications)
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 10. جدول سجل حركات الضمان المالي (Escrow Transactions)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.escrow_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES public.escrow_wallets(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.service_orders(id) ON DELETE SET NULL,
    amount NUMERIC(10, 2) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('deposit', 'escrow_lock', 'escrow_release', 'withdrawal', 'platform_fee')),
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
    reference_code TEXT UNIQUE DEFAULT ('TX-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8))),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 11. الفهارس لتسريع الاستعلامات (Indexes)
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 12. دالة فحص صلاحيات المشرف (is_admin)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (role = 'admin' OR is_admin = TRUE)
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 13. المشغل التلقائي الآمن عند تسجيل أي مستخدم (handle_new_user)
-- يمنع تماماً إنشاء حساب كمدير من التسجيل العام لمنع اختراق الصلاحيات
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    raw_role TEXT;
    safe_role TEXT;
    user_name TEXT;
    user_phone TEXT;
    user_city TEXT;
    user_trade TEXT;
BEGIN
    raw_role := LOWER(COALESCE(NEW.raw_user_meta_data->>'role', 'client'));
    
    -- حماية أمنية: منع التسجيل كمدير من الواجهة العامة
    IF raw_role = 'admin' THEN
        safe_role := 'client';
    ELSIF raw_role = 'craftsman' OR raw_role = 'pro' THEN
        safe_role := 'craftsman';
    ELSE
        safe_role := 'client';
    END IF;

    user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', 'مستخدم مِـرَاس');
    user_phone := COALESCE(NEW.raw_user_meta_data->>'phone_number', NEW.phone, '');
    user_city := COALESCE(NEW.raw_user_meta_data->>'city', 'الرياض');
    user_trade := COALESCE(NEW.raw_user_meta_data->>'trade_category', 'صيانة وتشطيبات عامة');

    -- 1. إدراج/تحديث الملف الشخصي
    INSERT INTO public.profiles (id, full_name, phone_number, role, is_admin, city, updated_at)
    VALUES (
        NEW.id,
        user_name,
        NULLIF(user_phone, ''),
        safe_role,
        FALSE,
        user_city,
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        phone_number = COALESCE(EXCLUDED.phone_number, public.profiles.phone_number),
        city = EXCLUDED.city,
        updated_at = NOW();

    -- 2. إنشاء محفظة الضمان المالي
    INSERT INTO public.escrow_wallets (user_id, balance, escrow_held)
    VALUES (NEW.id, 0.00, 0.00)
    ON CONFLICT (user_id) DO NOTHING;

    -- 3. في حال كان صاحب مهنة، إنشاء ملف مهني
    IF safe_role = 'craftsman' THEN
        INSERT INTO public.craftsmen_profiles (
            user_id, 
            trade_category, 
            verification_status,
            is_available,
            rating,
            experience_years
        )
        VALUES (
            NEW.id,
            user_trade,
            'verified',
            TRUE,
            5.00,
            2
        )
        ON CONFLICT (user_id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 14. تفعيل سياسات الأمان والحماية (Row Level Security - RLS)
-- ------------------------------------------------------------------------------
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

-- إعادة كتابة السياسات بدقة
DROP POLICY IF EXISTS "Public view categories" ON public.trade_categories;
DROP POLICY IF EXISTS "Admin manage categories" ON public.trade_categories;
CREATE POLICY "Public view categories" ON public.trade_categories FOR SELECT TO public USING (TRUE);
CREATE POLICY "Admin manage categories" ON public.trade_categories FOR ALL TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Public view services" ON public.craftsman_services;
DROP POLICY IF EXISTS "Craftsman insert own services" ON public.craftsman_services;
DROP POLICY IF EXISTS "Craftsman update own services" ON public.craftsman_services;
DROP POLICY IF EXISTS "Craftsman delete own services" ON public.craftsman_services;
DROP POLICY IF EXISTS "Admin manage services" ON public.craftsman_services;
CREATE POLICY "Public view services" ON public.craftsman_services FOR SELECT TO public USING (is_active = TRUE OR public.is_admin());
CREATE POLICY "Craftsman insert own services" ON public.craftsman_services FOR INSERT TO authenticated 
    WITH CHECK (craftsman_id IN (SELECT id FROM public.craftsmen_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Craftsman update own services" ON public.craftsman_services FOR UPDATE TO authenticated 
    USING (craftsman_id IN (SELECT id FROM public.craftsmen_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Craftsman delete own services" ON public.craftsman_services FOR DELETE TO authenticated 
    USING (craftsman_id IN (SELECT id FROM public.craftsmen_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Admin manage services" ON public.craftsman_services FOR ALL TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Public view reviews" ON public.reviews;
DROP POLICY IF EXISTS "Client insert reviews" ON public.reviews;
DROP POLICY IF EXISTS "Admin manage reviews" ON public.reviews;
CREATE POLICY "Public view reviews" ON public.reviews FOR SELECT TO public USING (TRUE);
CREATE POLICY "Client insert reviews" ON public.reviews FOR INSERT TO authenticated WITH CHECK (client_id = auth.uid());
CREATE POLICY "Admin manage reviews" ON public.reviews FOR ALL TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "User view notifications" ON public.notifications;
DROP POLICY IF EXISTS "User update notifications" ON public.notifications;
DROP POLICY IF EXISTS "Insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admin manage notifications" ON public.notifications;
CREATE POLICY "User view notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "User update notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "Admin manage notifications" ON public.notifications FOR ALL TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Public view profiles" ON public.profiles;
DROP POLICY IF EXISTS "User update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin full access profiles" ON public.profiles;
CREATE POLICY "Public view profiles" ON public.profiles FOR SELECT TO public USING (TRUE);
CREATE POLICY "User update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "Admin full access profiles" ON public.profiles FOR ALL TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Public view verified craftsmen" ON public.craftsmen_profiles;
DROP POLICY IF EXISTS "Update own craftsman profile" ON public.craftsmen_profiles;
DROP POLICY IF EXISTS "Admin full access craftsmen" ON public.craftsmen_profiles;
CREATE POLICY "Public view verified craftsmen" ON public.craftsmen_profiles FOR SELECT TO public USING (TRUE);
CREATE POLICY "Update own craftsman profile" ON public.craftsmen_profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admin full access craftsmen" ON public.craftsmen_profiles FOR ALL TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Public view orders" ON public.service_orders;
DROP POLICY IF EXISTS "Client create orders" ON public.service_orders;
DROP POLICY IF EXISTS "Parties update orders" ON public.service_orders;
DROP POLICY IF EXISTS "Admin manage orders" ON public.service_orders;
CREATE POLICY "Public view orders" ON public.service_orders FOR SELECT TO public USING (TRUE);
CREATE POLICY "Client create orders" ON public.service_orders FOR INSERT TO authenticated WITH CHECK (client_id = auth.uid());
CREATE POLICY "Parties update orders" ON public.service_orders FOR UPDATE TO authenticated 
    USING (client_id = auth.uid() OR craftsman_id IN (SELECT id FROM public.craftsmen_profiles WHERE user_id = auth.uid()) OR public.is_admin());
CREATE POLICY "Admin manage orders" ON public.service_orders FOR ALL TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "View bids policy" ON public.bids;
DROP POLICY IF EXISTS "Craftsman submit bids policy" ON public.bids;
DROP POLICY IF EXISTS "Craftsman update bids policy" ON public.bids;
DROP POLICY IF EXISTS "Admin manage bids" ON public.bids;
CREATE POLICY "View bids policy" ON public.bids FOR SELECT TO public USING (TRUE);
CREATE POLICY "Craftsman submit bids policy" ON public.bids FOR INSERT TO authenticated 
    WITH CHECK (craftsman_id IN (SELECT id FROM public.craftsmen_profiles WHERE user_id = auth.uid()) OR public.is_admin());
CREATE POLICY "Craftsman update bids policy" ON public.bids FOR UPDATE TO authenticated 
    USING (craftsman_id IN (SELECT id FROM public.craftsmen_profiles WHERE user_id = auth.uid()) OR public.is_admin());
CREATE POLICY "Admin manage bids" ON public.bids FOR ALL TO authenticated USING (public.is_admin());

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

-- ------------------------------------------------------------------------------
-- 15. البيانات التأسيسية للتصنيفات ودالة ترقية المدير
-- ------------------------------------------------------------------------------
INSERT INTO public.trade_categories (name, slug, icon, description, active_pros_count, is_featured)
VALUES 
    ('أعمال الكهرباء والتمديدات', 'electrical', 'bolt', 'تمديدات كهربائية، صيانة قواطع، وتأسيس شبكات إنارة ذكية', 420, TRUE),
    ('السباكة والشبكات المائية', 'plumbing', 'plumbing', 'تأسيس شبكات المياه والصرف الصحي، صيانة مضخات وفلاتر', 380, TRUE),
    ('التكييف والتبريد المعتمد', 'hvac', 'ac_unit', 'صيانة وتركيب مكيفات سبليت، كونسيلد، وأنظمة تكييف مركزي', 510, TRUE),
    ('النجارة والديكور الخشبي', 'carpentry', 'carpenter', 'تصنيع وصيانة أبواب، خزائن جدارية، وديكورات خشبية عصرية', 290, TRUE),
    ('الدهانات والتشطيبات الحديثة', 'painting', 'format_paint', 'تنفيذ دهانات داخلية وخارجية، بديل رخام وخشب، وورق جدران', 340, TRUE),
    ('المقاولات العامة والترميم', 'construction', 'handyman', 'ترميم منازل ومباني، لياسة، بناء ملاحق، وأعمال تشطيب متكاملة', 620, TRUE),
    ('الألمنيوم والزجاج والواجهات', 'aluminum', 'window', 'تركيب واجهات استركشر، نوافذ دبل جلاس، وشاورات زجاجية', 180, TRUE),
    ('عزل الأسطح وكشف التسربات', 'insulation', 'water_drop', 'عزل مائي وحراري للأسطح والخزانات بتقنيات كشف معتمدة', 240, TRUE)
ON CONFLICT (name) DO UPDATE SET
    icon = EXCLUDED.icon,
    description = EXCLUDED.description,
    is_featured = EXCLUDED.is_featured;

CREATE OR REPLACE FUNCTION public.make_user_admin(target_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    target_id UUID;
BEGIN
    SELECT id INTO target_id FROM auth.users WHERE email = target_email;
    IF target_id IS NULL THEN
        RETURN 'المستخدم غير موجود في auth.users بهذا البريد';
    END IF;

    UPDATE public.profiles
    SET role = 'admin', is_admin = TRUE, updated_at = NOW()
    WHERE id = target_id;

    RETURN 'تمت ترقية الحساب بنجاح إلى مدير نظام (Admin)';
END;
$$;

