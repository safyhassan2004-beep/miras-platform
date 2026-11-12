-- ============================================================================
-- Migration 05: Super Admin Account Setup & Yemen Defaults Transition
-- إعداد حساب مالكة المنصة (Super Admin) والتحويل الشامل إلى الجمهورية اليمنية (+967 / YER)
-- ============================================================================

-- 1. تحديث جدول الملفات الشخصية (profiles) لدعم دور super_admin واليمن كدولة افتراضية
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles 
    ADD CONSTRAINT profiles_role_check 
    CHECK (role IN ('client', 'craftsman', 'admin', 'super_admin'));

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'Yemen',
    ALTER COLUMN city SET DEFAULT 'صنعاء';

-- 2. دوال التحقق الأمنية من الصلاحيات (Security Definer Functions)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (role IN ('admin', 'super_admin') OR is_admin = TRUE OR is_super_admin = TRUE)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (role = 'super_admin' OR is_super_admin = TRUE)
  );
END;
$$;

-- 3. دالة توحيد وتنسيق أرقام الهواتف اليمنية إلى صيغة E.164 الدولية (+967XXXXXXXXX)
CREATE OR REPLACE FUNCTION public.normalize_yemen_phone(raw_phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    cleaned TEXT;
BEGIN
    IF raw_phone IS NULL OR trim(raw_phone) = '' THEN
        RETURN NULL;
    END IF;

    -- إزالة كافة المسافات والرموز غير الرقمية ما عدا +
    cleaned := regexp_replace(raw_phone, '[^\+0-9]', '', 'g');

    -- إذا كان الرقم يبدأ بـ +967
    IF cleaned LIKE '+967%' THEN
        RETURN cleaned;
    END IF;

    -- إذا كان يبدأ بـ 00967
    IF cleaned LIKE '00967%' THEN
        RETURN '+' || substring(cleaned from 3);
    END IF;

    -- إذا كان يبدأ بـ 967
    IF cleaned LIKE '967%' THEN
        RETURN '+' || cleaned;
    END IF;

    -- إذا كان يبدأ بـ 0 (محلي) مثل 0781125928
    IF cleaned LIKE '0%' AND length(cleaned) = 10 THEN
        RETURN '+967' || substring(cleaned from 2);
    END IF;

    -- إذا كان 9 أرقام تبدأ بـ 7 (مثل 781125928)
    IF length(cleaned) = 9 AND cleaned ~ '^7[0-9]{8}$' THEN
        RETURN '+967' || cleaned;
    END IF;

    RETURN cleaned;
END;
$$;

-- 4. تحديث التريجر الأمني لإنشاء المستخدمين: حماية الصلاحيات وتعيين مالكة المنصة تلقائياً
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_email TEXT;
    raw_role TEXT;
    safe_role TEXT;
    is_super_admin_account BOOLEAN := FALSE;
    user_name TEXT;
    user_phone TEXT;
    user_city TEXT;
    user_country TEXT;
    user_trade TEXT;
BEGIN
    user_email := LOWER(COALESCE(NEW.email, ''));
    raw_role := LOWER(COALESCE(NEW.raw_user_meta_data->>'role', 'client'));

    -- التحقق الصارم: هل الحساب هو حساب مالكة المنصة المعتمد؟
    IF user_email = 'safyhassan2004@gmail.com' THEN
        is_super_admin_account := TRUE;
        safe_role := 'super_admin';
        user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', 'مالكة المنصة (Super Admin)');
        user_phone := '+967781125928';
        user_city := 'صنعاء';
        user_country := 'Yemen';
    ELSE
        -- قاعدة الأمان: منع أي تسجيل عام من إعطاء نفسه صلاحيات Admin أو Super Admin
        IF raw_role = 'admin' OR raw_role = 'super_admin' THEN
            safe_role := 'client';
        ELSIF raw_role = 'craftsman' OR raw_role = 'pro' THEN
            safe_role := 'craftsman';
        ELSE
            safe_role := 'client';
        END IF;

        user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', 'مستخدم مِـرَاس');
        user_phone := public.normalize_yemen_phone(COALESCE(NEW.raw_user_meta_data->>'phone_number', NEW.phone, ''));
        user_city := COALESCE(NEW.raw_user_meta_data->>'city', 'صنعاء');
        user_country := COALESCE(NEW.raw_user_meta_data->>'country', 'Yemen');
    END IF;

    user_trade := COALESCE(NEW.raw_user_meta_data->>'trade_category', 'صيانة وتشطيبات عامة');

    -- 1. إدراج أو تحديث الملف الشخصي
    INSERT INTO public.profiles (
        id, 
        full_name, 
        phone_number, 
        role, 
        is_admin, 
        is_super_admin, 
        city, 
        country, 
        national_id_verified,
        updated_at
    )
    VALUES (
        NEW.id,
        user_name,
        NULLIF(user_phone, ''),
        safe_role,
        CASE WHEN is_super_admin_account THEN TRUE ELSE FALSE END,
        CASE WHEN is_super_admin_account THEN TRUE ELSE FALSE END,
        user_city,
        user_country,
        CASE WHEN is_super_admin_account THEN TRUE ELSE FALSE END,
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        role = CASE WHEN user_email = 'safyhassan2004@gmail.com' THEN 'super_admin' ELSE public.profiles.role END,
        is_admin = CASE WHEN user_email = 'safyhassan2004@gmail.com' THEN TRUE ELSE public.profiles.is_admin END,
        is_super_admin = CASE WHEN user_email = 'safyhassan2004@gmail.com' THEN TRUE ELSE public.profiles.is_super_admin END,
        phone_number = COALESCE(EXCLUDED.phone_number, public.profiles.phone_number),
        country = 'Yemen',
        updated_at = NOW();

    -- 2. إنشاء محفظة مالية
    INSERT INTO public.escrow_wallets (user_id, balance, escrow_held)
    VALUES (NEW.id, 0.00, 0.00)
    ON CONFLICT (user_id) DO NOTHING;

    -- 3. في حال كان صاحب مهنة
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

-- إعادة ربط التريجر للتأكد من فاعليته
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. تحديث فوري لحساب مالكة المنصة إذا كان مسجلاً مسبقاً في auth.users
DO $$
DECLARE
    owner_user_id UUID;
BEGIN
    SELECT id INTO owner_user_id 
    FROM auth.users 
    WHERE LOWER(email) = 'safyhassan2004@gmail.com'
    LIMIT 1;

    IF owner_user_id IS NOT NULL THEN
        INSERT INTO public.profiles (
            id, full_name, phone_number, role, is_admin, is_super_admin, city, country, national_id_verified, updated_at
        ) VALUES (
            owner_user_id, 'مالكة المنصة (Super Admin)', '+967781125928', 'super_admin', TRUE, TRUE, 'صنعاء', 'Yemen', TRUE, NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
            full_name = 'مالكة المنصة (Super Admin)',
            phone_number = '+967781125928',
            role = 'super_admin',
            is_admin = TRUE,
            is_super_admin = TRUE,
            city = 'صنعاء',
            country = 'Yemen',
            national_id_verified = TRUE,
            updated_at = NOW();

        INSERT INTO public.escrow_wallets (user_id, balance, escrow_held)
        VALUES (owner_user_id, 0.00, 0.00)
        ON CONFLICT (user_id) DO NOTHING;

        RAISE NOTICE '✅ تم ترقية وتأكيد حساب مالكة المنصة safyhassan2004@gmail.com كـ Super Admin بنجاح.';
    ELSE
        RAISE NOTICE 'ℹ️ حساب safyhassan2004@gmail.com غير موجود بعد في auth.users. سيتم ترقيته تلقائياً بمجرد إتمام تسجيله.';
    END IF;
END $$;

-- 6. جدول إعدادات النظام المركزي (System Settings)
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view settings" ON public.system_settings;
CREATE POLICY "Public can view settings" ON public.system_settings
    FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Only admin or super_admin can manage settings" ON public.system_settings;
CREATE POLICY "Only admin or super_admin can manage settings" ON public.system_settings
    FOR ALL TO authenticated USING (public.is_admin());

-- حقن الإعدادات الافتراضية لمنصة مِـرَاس (الجمهورية اليمنية)
INSERT INTO public.system_settings (key, value, description)
VALUES 
    ('platform_country', '{"code": "YE", "name_ar": "اليمن", "name_en": "Yemen", "dial_code": "+967"}'::jsonb, 'الدولة الافتراضية للمنصة ومفتاح الاتصال الدولي'),
    ('platform_currency', '{"code": "YER", "symbol_ar": "ر.ي", "symbol_en": "YER", "name_ar": "ريال يمني"}'::jsonb, 'العملة الافتراضية لعرض الأسعار والضمان المالي'),
    ('platform_owner', '{"email": "safyhassan2004@gmail.com", "phone": "+967781125928", "role": "Super Admin", "name": "مالكة المنصة"}'::jsonb, 'بيانات حساب مالكة المنصة والإدارة العليا'),
    ('platform_commission', '{"percentage": 5.0, "vat_percentage": 0.0}'::jsonb, 'عمولة منصة مِـرَاس للوساطة والضمان')
ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = NOW();

-- 7. تحديث سياسات RLS عبر الجداول لمنح super_admin و admin الصلاحية الكاملة
-- جدول الملفات الشخصية (profiles)
DROP POLICY IF EXISTS "Admins can view and manage all profiles" ON public.profiles;
CREATE POLICY "Admins can view and manage all profiles" ON public.profiles
    FOR ALL TO authenticated USING (public.is_admin());

-- جدول المشاريع وطلبات الخدمة (service_orders)
DROP POLICY IF EXISTS "Admins can view and manage all orders" ON public.service_orders;
CREATE POLICY "Admins can view and manage all orders" ON public.service_orders
    FOR ALL TO authenticated USING (public.is_admin());

-- جدول الكوادر الحرفية (craftsmen_profiles)
DROP POLICY IF EXISTS "Admins can view and manage all craftsmen" ON public.craftsmen_profiles;
CREATE POLICY "Admins can view and manage all craftsmen" ON public.craftsmen_profiles
    FOR ALL TO authenticated USING (public.is_admin());

-- جدول عروض الأسعار (bids)
DROP POLICY IF EXISTS "Admins can view and manage all bids" ON public.bids;
CREATE POLICY "Admins can view and manage all bids" ON public.bids
    FOR ALL TO authenticated USING (public.is_admin());

-- جدول محافظ الضمان المالي (escrow_wallets)
DROP POLICY IF EXISTS "Admins can view and manage all wallets" ON public.escrow_wallets;
CREATE POLICY "Admins can view and manage all wallets" ON public.escrow_wallets
    FOR ALL TO authenticated USING (public.is_admin());

-- جدول العمليات المالية (wallet_transactions)
DROP POLICY IF EXISTS "Admins can view and manage all transactions" ON public.wallet_transactions;
CREATE POLICY "Admins can view and manage all transactions" ON public.wallet_transactions
    FOR ALL TO authenticated USING (public.is_admin());

-- جدول تذاكر الدعم والنزاعات (support_tickets)
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_number TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    role TEXT DEFAULT 'client',
    category TEXT NOT NULL,
    reference_order TEXT,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'open',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert support tickets" ON public.support_tickets;
CREATE POLICY "Anyone can insert support tickets" ON public.support_tickets
    FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can manage all support tickets" ON public.support_tickets;
CREATE POLICY "Admins can manage all support tickets" ON public.support_tickets
    FOR ALL TO authenticated USING (public.is_admin());
