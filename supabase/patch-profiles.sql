-- ==============================================================================
-- مِـرَاس (Miras) — سكريبت التحديث والتفعيل النهائي (Patch & Alignment Script)
-- قم بنسخ هذا الكود بالكامل ولصقه في SQL Editor داخل لوحة تحكم Supabase والضغط على Run
-- ==============================================================================

-- 1. إضافة الأعمدة الناقصة لجدول profiles (التي تسببت في خطأ 500 أثناء التسجيل)
ALTER TABLE public.profiles 
    ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('client', 'craftsman', 'admin')),
    ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS phone_number TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS city TEXT DEFAULT 'الرياض',
    ADD COLUMN IF NOT EXISTS national_id_verified BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. تحديث دالة فحص صلاحيات المشرف مع عزل search_path للأمان العالي
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

-- 3. تحديث دالة المشغل التلقائي (Trigger) عند تسجيل أي مستخدم جديد عبر Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_role TEXT;
    user_name TEXT;
    user_phone TEXT;
    user_city TEXT;
    user_trade TEXT;
BEGIN
    -- قراءة البيانات الإضافية المرسلة أثناء التسجيل
    user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'client');
    user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', 'مستخدم مِـرَاس');
    user_phone := COALESCE(NEW.raw_user_meta_data->>'phone_number', NEW.phone, '');
    user_city := COALESCE(NEW.raw_user_meta_data->>'city', 'الرياض');
    user_trade := COALESCE(NEW.raw_user_meta_data->>'trade_category', 'صيانة وتشطيبات عامة');

    -- 1. إدراج أو تحديث الملف الشخصي
    INSERT INTO public.profiles (id, full_name, phone_number, role, is_admin, city, updated_at)
    VALUES (
        NEW.id,
        user_name,
        NULLIF(user_phone, ''),
        user_role,
        (user_role = 'admin'),
        user_city,
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        phone_number = COALESCE(EXCLUDED.phone_number, public.profiles.phone_number),
        role = EXCLUDED.role,
        is_admin = EXCLUDED.is_admin,
        city = EXCLUDED.city,
        updated_at = NOW();

    -- 2. إنشاء المحفظة المالية والضمان إن لم تكن موجودة
    INSERT INTO public.escrow_wallets (user_id, balance, escrow_held)
    VALUES (NEW.id, 0.00, 0.00)
    ON CONFLICT (user_id) DO NOTHING;

    -- 3. إذا كان المسجل صاحب مهنة، ننشئ له ملفاً مهنياً
    IF user_role = 'craftsman' THEN
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
            'verified', -- اعتماده للظهور المباشر
            TRUE,
            5.00,
            3
        )
        ON CONFLICT (user_id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$;

-- إعادة ربط المشغل على auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. ضبط سياسات أمان الجداول (RLS Policies) لتسمح بالاستعراض السلس
-- أ. سياسات جدول profiles
DROP POLICY IF EXISTS "Public view profiles" ON public.profiles;
DROP POLICY IF EXISTS "View own profile" ON public.profiles;
DROP POLICY IF EXISTS "Update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin full access profiles" ON public.profiles;

CREATE POLICY "Public view profiles" ON public.profiles FOR SELECT TO public USING (TRUE);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "Admin full access profiles" ON public.profiles FOR ALL TO authenticated USING (public.is_admin());

-- ب. سياسات جدول craftsmen_profiles
DROP POLICY IF EXISTS "Public view verified craftsmen" ON public.craftsmen_profiles;
DROP POLICY IF EXISTS "View verified craftsmen" ON public.craftsmen_profiles;
DROP POLICY IF EXISTS "Update own craftsman profile" ON public.craftsmen_profiles;
DROP POLICY IF EXISTS "Admin full access craftsmen" ON public.craftsmen_profiles;

CREATE POLICY "Public view verified craftsmen" ON public.craftsmen_profiles FOR SELECT TO public USING (TRUE);
CREATE POLICY "Update own craftsman profile" ON public.craftsmen_profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admin full access craftsmen" ON public.craftsmen_profiles FOR ALL TO authenticated USING (public.is_admin());

-- ج. سياسات المحفظة والضمان escrow_wallets
DROP POLICY IF EXISTS "View own wallet" ON public.escrow_wallets;
DROP POLICY IF EXISTS "Admin full access wallets" ON public.escrow_wallets;

CREATE POLICY "View own wallet" ON public.escrow_wallets FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Update own wallet" ON public.escrow_wallets FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Admin full access wallets" ON public.escrow_wallets FOR ALL TO authenticated USING (public.is_admin());

-- د. سياسات طلبات الخدمة والمشاريع service_orders
DROP POLICY IF EXISTS "View orders" ON public.service_orders;
DROP POLICY IF EXISTS "Create orders" ON public.service_orders;
DROP POLICY IF EXISTS "Update own orders" ON public.service_orders;
DROP POLICY IF EXISTS "Admin full access orders" ON public.service_orders;

CREATE POLICY "View orders" ON public.service_orders FOR SELECT TO public USING (TRUE);
CREATE POLICY "Create orders" ON public.service_orders FOR INSERT TO authenticated WITH CHECK (client_id = auth.uid());
CREATE POLICY "Update own orders" ON public.service_orders FOR UPDATE TO authenticated USING (client_id = auth.uid() OR public.is_admin());
CREATE POLICY "Admin full access orders" ON public.service_orders FOR ALL TO authenticated USING (public.is_admin());

-- هـ. سياسات العروض bids
DROP POLICY IF EXISTS "View bids" ON public.bids;
DROP POLICY IF EXISTS "Craftsmen submit bids" ON public.bids;
DROP POLICY IF EXISTS "Admin full access bids" ON public.bids;

CREATE POLICY "View bids" ON public.bids FOR SELECT TO public USING (TRUE);
CREATE POLICY "Craftsmen submit bids" ON public.bids FOR INSERT TO authenticated WITH CHECK (
    craftsman_id IN (SELECT id FROM public.craftsmen_profiles WHERE user_id = auth.uid()) OR public.is_admin()
);
CREATE POLICY "Admin full access bids" ON public.bids FOR ALL TO authenticated USING (public.is_admin());

-- و. سياسات المعاملات escrow_transactions
DROP POLICY IF EXISTS "Admin full access transactions" ON public.escrow_transactions;
CREATE POLICY "View own transactions" ON public.escrow_transactions FOR SELECT TO authenticated USING (
    wallet_id IN (SELECT id FROM public.escrow_wallets WHERE user_id = auth.uid()) OR public.is_admin()
);
CREATE POLICY "Admin full access transactions" ON public.escrow_transactions FOR ALL TO authenticated USING (public.is_admin());

