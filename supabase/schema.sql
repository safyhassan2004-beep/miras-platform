-- ==============================================================================
-- مِـرَاس (Miras) — مخطط قاعدة البيانات ونظام الصلاحيات في Supabase
-- Database Schema & Row Level Security (RLS) for Supabase
-- ==============================================================================

-- 1. جدول الحسابات والملفات الشخصية الأساسية (Profiles)
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

-- 2. جدول بيانات وتراخيص أصحاب المهن (Craftsmen Profiles)
CREATE TABLE IF NOT EXISTS public.craftsmen_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    trade_category TEXT NOT NULL, -- مثل: نجارة، سباكة، كهرباء، تكييف، تشطيبات
    experience_years INT DEFAULT 1,
    commercial_register TEXT, -- رقم السجل التجاري أو وثيقة العمل الحر
    is_available BOOLEAN DEFAULT TRUE, -- حالة الجاهزية الميدانية (متاح الآن)
    rating NUMERIC(3, 2) DEFAULT 5.00,
    total_reviews INT DEFAULT 0,
    completed_orders INT DEFAULT 0,
    verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. جدول المحافظ المالية والضمان (Escrow Wallets)
CREATE TABLE IF NOT EXISTS public.escrow_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    balance NUMERIC(12, 2) DEFAULT 0.00, -- الرصيد المتاح للسحب
    escrow_held NUMERIC(12, 2) DEFAULT 0.00, -- المبالغ المعلقة تحت الضمان
    total_earned NUMERIC(12, 2) DEFAULT 0.00, -- إجمالي الأرباح التاريخية
    iban TEXT,
    bank_name TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. جدول طلبات العمل والمشاريع (Service Orders & Projects)
CREATE TABLE IF NOT EXISTS public.service_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    craftsman_id UUID REFERENCES public.craftsmen_profiles(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    trade_category TEXT NOT NULL,
    description TEXT,
    city TEXT NOT NULL,
    estimated_budget NUMERIC(10, 2),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'bidding', 'in_progress', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. جدول عروض الأسعار والمناقصات (Bids)
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

-- 6. جدول المعاملات وسجل الضمان المالي (Escrow Transactions)
CREATE TABLE IF NOT EXISTS public.escrow_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES public.escrow_wallets(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.service_orders(id) ON DELETE SET NULL,
    amount NUMERIC(10, 2) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('deposit', 'escrow_lock', 'escrow_release', 'withdrawal', 'commission')),
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
    reference_code TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- سياسات حماية البيانات والأمان (Row Level Security - RLS)
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.craftsmen_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escrow_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escrow_transactions ENABLE ROW LEVEL SECURITY;

-- دوال مساعدة للتحقق من الأدوار (Helper Functions)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (role = 'admin' OR is_admin = TRUE)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 🛡️ سياسات المشرفين (Admin Policies - وصول كامل لكافة الجداول)
CREATE POLICY "Admins have full access to profiles" ON public.profiles FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Admins have full access to craftsmen_profiles" ON public.craftsmen_profiles FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Admins have full access to escrow_wallets" ON public.escrow_wallets FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Admins have full access to service_orders" ON public.service_orders FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Admins have full access to bids" ON public.bids FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Admins have full access to escrow_transactions" ON public.escrow_transactions FOR ALL TO authenticated USING (public.is_admin());

-- 🛠️ سياسات أصحاب المهن (Craftsmen Policies - وصول لبيانات حسابه فقط)
CREATE POLICY "Craftsmen can view their own profile" ON public.craftsmen_profiles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Craftsmen can update their own profile" ON public.craftsmen_profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Craftsmen can view their own wallet" ON public.escrow_wallets FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Craftsmen can view their own bids" ON public.bids FOR SELECT TO authenticated USING (craftsman_id IN (SELECT id FROM public.craftsmen_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Craftsmen can submit bids" ON public.bids FOR INSERT TO authenticated WITH CHECK (craftsman_id IN (SELECT id FROM public.craftsmen_profiles WHERE user_id = auth.uid()));

-- 👤 سياسات عامة للعملاء والملفات الشخصية
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "Anyone can view open service orders" ON public.service_orders FOR SELECT TO authenticated USING (status = 'open' OR client_id = auth.uid() OR public.is_admin());
