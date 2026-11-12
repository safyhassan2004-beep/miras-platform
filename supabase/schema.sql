-- ==============================================================================
-- مِـرَاس (Miras) — مخطط قاعدة البيانات الشامل ونظام الصلاحيات في Supabase
-- Complete Production Database Schema, Triggers & Row Level Security (RLS)
-- ==============================================================================

-- تفعيل الامتدادات المطلوبة
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
    city TEXT DEFAULT 'صنعاء',
    national_id_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 2. جدول بيانات وتراخيص أصحاب المهن (Craftsmen Profiles)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.craftsmen_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    trade_category TEXT NOT NULL, -- صيانة وتشطيبات، كهرباء، سباكة، برمجة، إلخ
    experience_years INT DEFAULT 1,
    commercial_register TEXT, -- رقم السجل التجاري أو وثيقة العمل الحر
    is_available BOOLEAN DEFAULT TRUE, -- متاح لاستقبال المهام الفورية
    rating NUMERIC(3, 2) DEFAULT 5.00,
    total_reviews INT DEFAULT 0,
    completed_orders INT DEFAULT 0,
    active_orders_count INT DEFAULT 0,
    verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 3. جدول المحافظ المالية والضمان (Escrow Wallets)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.escrow_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    balance NUMERIC(12, 2) DEFAULT 0.00, -- الرصيد المتاح للسحب الفوري
    escrow_held NUMERIC(12, 2) DEFAULT 0.00, -- المبالغ المحجوزة تحت الضمان حتى إتمام الخدمة
    total_earned NUMERIC(12, 2) DEFAULT 0.00, -- إجمالي الأرباح التاريخية
    iban TEXT,
    bank_name TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 4. جدول طلبات العمل والمشاريع (Service Orders & Projects)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.service_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    craftsman_id UUID REFERENCES public.craftsmen_profiles(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    trade_category TEXT NOT NULL,
    description TEXT,
    city TEXT NOT NULL DEFAULT 'صنعاء',
    location_details TEXT,
    estimated_budget NUMERIC(10, 2),
    final_amount NUMERIC(10, 2),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'bidding', 'in_progress', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 5. جدول عروض الأسعار والمناقصات المباشرة (Bids)
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
-- 6. جدول سجل العمليات والضمان المالي (Escrow Transactions)
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
-- 7. مشغل تلقائي (Trigger): إنشاء Profile والمحفظة آلياً عند تسجيل أي مستخدم
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    user_role TEXT;
    user_name TEXT;
    user_phone TEXT;
BEGIN
    user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'client');
    user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', 'مستخدم مِـرَاس');
    user_phone := COALESCE(NEW.raw_user_meta_data->>'phone_number', NEW.phone, '');

    -- 1. إدراج الملف الشخصي
    INSERT INTO public.profiles (id, full_name, phone_number, role, is_admin)
    VALUES (
        NEW.id,
        user_name,
        NULLIF(user_phone, ''),
        user_role,
        (user_role = 'admin')
    );

    -- 2. إنشاء المحفظة المالية
    INSERT INTO public.escrow_wallets (user_id, balance, escrow_held)
    VALUES (NEW.id, 0.00, 0.00);

    -- 3. إذا كان المسجل حرفياً، ننشئ له ملفاً مهنياً مبدئياً
    IF user_role = 'craftsman' THEN
        INSERT INTO public.craftsmen_profiles (user_id, trade_category, verification_status)
        VALUES (
            NEW.id,
            COALESCE(NEW.raw_user_meta_data->>'trade_category', 'عام'),
            'pending'
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ربط المشغل مع auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 8. سياسات حماية البيانات (Row Level Security - RLS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.craftsmen_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escrow_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escrow_transactions ENABLE ROW LEVEL SECURITY;

-- دالة فحص صلاحية المشرف
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (role = 'admin' OR is_admin = TRUE)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- سياسات المشرف (Admins): وصول كامل
CREATE POLICY "Admin full access profiles" ON public.profiles FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Admin full access craftsmen" ON public.craftsmen_profiles FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Admin full access wallets" ON public.escrow_wallets FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Admin full access orders" ON public.service_orders FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Admin full access bids" ON public.bids FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Admin full access transactions" ON public.escrow_transactions FOR ALL TO authenticated USING (public.is_admin());

-- سياسات المستخدمين العاديين والحرفيين
CREATE POLICY "View own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_admin());
CREATE POLICY "Update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

CREATE POLICY "View verified craftsmen" ON public.craftsmen_profiles FOR SELECT TO authenticated USING (verification_status = 'verified' OR user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Update own craftsman profile" ON public.craftsmen_profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "View own wallet" ON public.escrow_wallets FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "View orders" ON public.service_orders FOR SELECT TO authenticated USING (status = 'open' OR client_id = auth.uid() OR public.is_admin());
CREATE POLICY "Create orders" ON public.service_orders FOR INSERT TO authenticated WITH CHECK (client_id = auth.uid());
CREATE POLICY "Update own orders" ON public.service_orders FOR UPDATE TO authenticated USING (client_id = auth.uid() OR public.is_admin());

CREATE POLICY "View bids" ON public.bids FOR SELECT TO authenticated USING (
    craftsman_id IN (SELECT id FROM public.craftsmen_profiles WHERE user_id = auth.uid()) 
    OR order_id IN (SELECT id FROM public.service_orders WHERE client_id = auth.uid())
    OR public.is_admin()
);
CREATE POLICY "Craftsmen submit bids" ON public.bids FOR INSERT TO authenticated WITH CHECK (
    craftsman_id IN (SELECT id FROM public.craftsmen_profiles WHERE user_id = auth.uid())
);
