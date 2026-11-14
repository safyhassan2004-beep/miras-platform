-- ==============================================================================
-- مِـرَاس (Miras) — التحديث الشامل لتحويل المنصة إلى تطبيق حقيقي متكامل
-- Migration: 20261113000006_full_real_platform_system.sql
-- 
-- يشمل:
-- 1. جداول المحادثات الفورية (Conversations & Realtime Messages)
-- 2. مركز خدمة عملاء الدعم الحضرمي اليدوي (Support Tickets & Manual Admin Messages - NO BOTS)
-- 3. معرض الأعمال للحرفيين (Craftsman Portfolio)
-- 4. المفضلة (Favorites)
-- 5. الإشعارات وسجل النشاطات الإدارية لمالكة المنصة (Admin Logs & Notifications)
-- 6. تحديث حالات الطلبات واعتماد أصحاب المهن اليدوي من مالكة المنصة (Super Admin Gate)
-- 7. تفعيل Realtime على جميع الجداول الحيوية
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. تحديث جدول الملفات الشخصية وإعدادات حضرموت الافتراضية
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles 
    ADD COLUMN IF NOT EXISTS city TEXT DEFAULT 'المكلا',
    ADD COLUMN IF NOT EXISTS bio TEXT,
    ADD COLUMN IF NOT EXISTS address TEXT;

-- تحديث المدن الافتراضية لحضرموت
UPDATE public.profiles 
SET city = 'المكلا' 
WHERE city = 'صنعاء' OR city IS NULL;

-- ------------------------------------------------------------------------------
-- 2. تحديث جدول أصحاب المهن (Craftsmen Profiles)
-- الحرفي الجديد يبدأ بحالة 'pending' ولا يمكنه الدخول إلا بعد اعتماد مالكة المنصة
-- ------------------------------------------------------------------------------
ALTER TABLE public.craftsmen_profiles
    ADD COLUMN IF NOT EXISTS bio TEXT,
    ADD COLUMN IF NOT EXISTS national_id_photo TEXT,
    ADD COLUMN IF NOT EXISTS license_photo TEXT,
    ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(10, 2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS coverage_areas TEXT[] DEFAULT ARRAY['المكلا', 'سيئون', 'تريم', 'الشحر', 'غيل باوزير'];

-- التأكد من الحالات المسموحة لتوثيق الحرفيين
ALTER TABLE public.craftsmen_profiles 
    DROP CONSTRAINT IF EXISTS craftsmen_profiles_verification_status_check;
ALTER TABLE public.craftsmen_profiles 
    ADD CONSTRAINT craftsmen_profiles_verification_status_check 
    CHECK (verification_status IN ('pending', 'verified', 'rejected', 'suspended'));

-- ------------------------------------------------------------------------------
-- 3. جدول معرض أعمال الحرفيين (Craftsman Portfolio)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.craftsman_portfolio (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    craftsman_id UUID NOT NULL REFERENCES public.craftsmen_profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    image_url TEXT NOT NULL,
    completion_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portfolio_craftsman_id ON public.craftsman_portfolio(craftsman_id);

-- ------------------------------------------------------------------------------
-- 4. تحديث جدول طلبات الخدمات والمشاريع (Service Orders)
-- الحالات: new (جديد), pending_review (قيد المراجعة), accepted (مقبول), 
--         in_progress (جارٍ التنفيذ), completed (مكتمل), rejected (مرفوض), cancelled (ملغى)
-- ------------------------------------------------------------------------------
ALTER TABLE public.service_orders 
    ADD COLUMN IF NOT EXISTS attachment_url TEXT,
    ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
    ADD COLUMN IF NOT EXISTS completion_notes TEXT,
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

ALTER TABLE public.service_orders 
    DROP CONSTRAINT IF EXISTS service_orders_status_check;
ALTER TABLE public.service_orders 
    ADD CONSTRAINT service_orders_status_check 
    CHECK (status IN ('new', 'pending_review', 'accepted', 'in_progress', 'completed', 'rejected', 'cancelled', 'open', 'bidding'));

-- ------------------------------------------------------------------------------
-- 5. نظام المحادثات المباشرة بين العميل وصاحب المهنة (Realtime Conversations & Messages)
-- منفصل تماماً عن شات خدمة العملاء
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.service_orders(id) ON DELETE SET NULL,
    client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    craftsman_id UUID NOT NULL REFERENCES public.craftsmen_profiles(id) ON DELETE CASCADE,
    last_message TEXT,
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_conversation_order UNIQUE (order_id, client_id, craftsman_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_client ON public.conversations(client_id);
CREATE INDEX IF NOT EXISTS idx_conversations_craftsman ON public.conversations(craftsman_id);

CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    attachment_url TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON public.messages(receiver_id);

-- ------------------------------------------------------------------------------
-- 6. مركز خدمة عملاء الدعم الحضرمي (Hadrami Support Desk)
-- لا ردود آلية ولا روبوتات ذكاء اصطناعي إطلاقاً — مالكة المنصة ترد بنفسها
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    user_name TEXT NOT NULL,
    user_phone TEXT,
    user_role TEXT DEFAULT 'client',
    subject TEXT NOT NULL,
    category TEXT DEFAULT 'general' CHECK (category IN ('general', 'orders', 'payments', 'craftsmen', 'complaint', 'suggestion')),
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'waiting_user', 'closed')),
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'urgent')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);

CREATE TABLE IF NOT EXISTS public.support_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'admin')),
    sender_name TEXT NOT NULL DEFAULT 'خدمة عملاء مِـرَاس',
    message TEXT NOT NULL,
    attachment_url TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_messages_ticket ON public.support_messages(ticket_id);

-- ------------------------------------------------------------------------------
-- 7. جدول المفضلة (Favorites)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    craftsman_id UUID NOT NULL REFERENCES public.craftsmen_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_craftsman_fav UNIQUE (user_id, craftsman_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user ON public.favorites(user_id);

-- ------------------------------------------------------------------------------
-- 8. تحديث جدول الإشعارات وتحديد الإشعارات الإدارية الخاصة بـ Super Admin
-- ------------------------------------------------------------------------------
ALTER TABLE public.notifications
    ADD COLUMN IF NOT EXISTS target_role TEXT DEFAULT 'user' CHECK (target_role IN ('user', 'super_admin', 'craftsman', 'all')),
    ADD COLUMN IF NOT EXISTS actor_name TEXT,
    ADD COLUMN IF NOT EXISTS metadata JSONB;

-- ------------------------------------------------------------------------------
-- 9. سجل النشاطات الإدارية الموثقة لمالكة المنصة (Admin Activity Logs)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    actor_name TEXT,
    action_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON public.admin_activity_logs(created_at DESC);

-- ------------------------------------------------------------------------------
-- 10. تحديث المشغل التلقائي الآمن (handle_new_user)
-- يضمن بقاء الحرفي 'pending' وعدم دخوله إلا بعد موافقة مالكة المنصة
-- ------------------------------------------------------------------------------
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
        user_city := 'المكلا';
        user_country := 'Yemen';
    ELSE
        -- حماية الصلاحيات: منع أي تسجيل عام من إعطاء نفسه صلاحيات الإدارة
        IF raw_role = 'admin' OR raw_role = 'super_admin' THEN
            safe_role := 'client';
        ELSIF raw_role = 'craftsman' OR raw_role = 'pro' THEN
            safe_role := 'craftsman';
        ELSE
            safe_role := 'client';
        END IF;

        user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', 'مستخدم مِـرَاس');
        user_phone := public.normalize_yemen_phone(COALESCE(NEW.raw_user_meta_data->>'phone_number', NEW.phone, ''));
        user_city := COALESCE(NEW.raw_user_meta_data->>'city', 'المكلا');
        user_country := 'Yemen';
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
        city = COALESCE(EXCLUDED.city, public.profiles.city),
        updated_at = NOW();

    -- 2. إنشاء محفظة الضمان المالي
    INSERT INTO public.escrow_wallets (user_id, balance, escrow_held)
    VALUES (NEW.id, 0.00, 0.00)
    ON CONFLICT (user_id) DO NOTHING;

    -- 3. في حال كان صاحب مهنة: يبدأ معلقاً (pending) بانتظار موافقة مالكة المنصة
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
            'pending', -- معلق حتى توافق عليه مالكة المنصة
            FALSE,
            5.00,
            2
        )
        ON CONFLICT (user_id) DO NOTHING;

        -- إرسال إشعار إداري فوري لمالكة المنصة
        INSERT INTO public.notifications (
            user_id, target_role, title, message, type, link, actor_name
        ) VALUES (
            NEW.id,
            'super_admin',
            'طلب انضمام حرفي جديد',
            'سجل الحرفي ' || user_name || ' في تخصص (' || user_trade || ') وهو بانتظار مراجعتك واعتمادك.',
            'verification',
            'admin/craftsmen.html',
            user_name
        );
    ELSE
        -- إشعار تسجيل عميل جديد
        INSERT INTO public.notifications (
            user_id, target_role, title, message, type, link, actor_name
        ) VALUES (
            NEW.id,
            'super_admin',
            'تسجيل عميل جديد',
            'انضم العميل ' || user_name || ' إلى مِـرَاس من مدينة ' || user_city || '.',
            'system',
            'admin/index.html',
            user_name
        );
    END IF;

    RETURN NEW;
END;
$$;

-- ------------------------------------------------------------------------------
-- 11. سياسات الأمان والحماية (RLS) للجداول الجديدة
-- ------------------------------------------------------------------------------
ALTER TABLE public.craftsman_portfolio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_activity_logs ENABLE ROW LEVEL SECURITY;

-- Portfolio Policies
DROP POLICY IF EXISTS "Public view portfolio" ON public.craftsman_portfolio;
DROP POLICY IF EXISTS "Craftsman manage own portfolio" ON public.craftsman_portfolio;
CREATE POLICY "Public view portfolio" ON public.craftsman_portfolio FOR SELECT TO public USING (TRUE);
CREATE POLICY "Craftsman manage own portfolio" ON public.craftsman_portfolio FOR ALL TO authenticated 
    USING (craftsman_id IN (SELECT id FROM public.craftsmen_profiles WHERE user_id = auth.uid()) OR public.is_admin());

-- Conversations Policies
DROP POLICY IF EXISTS "Participants view conversation" ON public.conversations;
DROP POLICY IF EXISTS "Participants create conversation" ON public.conversations;
CREATE POLICY "Participants view conversation" ON public.conversations FOR SELECT TO authenticated
    USING (client_id = auth.uid() OR craftsman_id IN (SELECT id FROM public.craftsmen_profiles WHERE user_id = auth.uid()) OR public.is_admin());
CREATE POLICY "Participants create conversation" ON public.conversations FOR INSERT TO authenticated
    WITH CHECK (client_id = auth.uid() OR craftsman_id IN (SELECT id FROM public.craftsmen_profiles WHERE user_id = auth.uid()) OR public.is_admin());

-- Messages Policies
DROP POLICY IF EXISTS "Participants view messages" ON public.messages;
DROP POLICY IF EXISTS "Participants insert messages" ON public.messages;
CREATE POLICY "Participants view messages" ON public.messages FOR SELECT TO authenticated
    USING (sender_id = auth.uid() OR receiver_id = auth.uid() OR public.is_admin());
CREATE POLICY "Participants insert messages" ON public.messages FOR INSERT TO authenticated
    WITH CHECK (sender_id = auth.uid());

-- Support Tickets Policies
DROP POLICY IF EXISTS "User view own tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "User create support tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Admin full access tickets" ON public.support_tickets;
CREATE POLICY "User view own tickets" ON public.support_tickets FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "User create support tickets" ON public.support_tickets FOR INSERT TO public
    WITH CHECK (TRUE);
CREATE POLICY "Admin full access tickets" ON public.support_tickets FOR ALL TO authenticated
    USING (public.is_admin());

-- Support Messages Policies
DROP POLICY IF EXISTS "View ticket messages" ON public.support_messages;
DROP POLICY IF EXISTS "Insert ticket messages" ON public.support_messages;
CREATE POLICY "View ticket messages" ON public.support_messages FOR SELECT TO authenticated
    USING (ticket_id IN (SELECT id FROM public.support_tickets WHERE user_id = auth.uid()) OR public.is_admin());
CREATE POLICY "Insert ticket messages" ON public.support_messages FOR INSERT TO public
    WITH CHECK (TRUE);
CREATE POLICY "Admin full access support messages" ON public.support_messages FOR ALL TO authenticated
    USING (public.is_admin());

-- Favorites Policies
DROP POLICY IF EXISTS "User manage favorites" ON public.favorites;
CREATE POLICY "User manage favorites" ON public.favorites FOR ALL TO authenticated
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Admin Activity Logs Policies
DROP POLICY IF EXISTS "Admin view activity logs" ON public.admin_activity_logs;
DROP POLICY IF EXISTS "Authenticated insert activity logs" ON public.admin_activity_logs;
CREATE POLICY "Admin view activity logs" ON public.admin_activity_logs FOR SELECT TO authenticated
    USING (public.is_admin());
CREATE POLICY "Authenticated insert activity logs" ON public.admin_activity_logs FOR INSERT TO authenticated
    WITH CHECK (TRUE);

-- ------------------------------------------------------------------------------
-- 12. تفعيل Realtime على الجداول التفاعلية
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    -- إضافة الجداول إلى supabase_realtime publication إذا لم تكن مضافة
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.messages';
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

DO $$
BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages';
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

DO $$
BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets';
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

DO $$
BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

DO $$
BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.service_orders';
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

-- ------------------------------------------------------------------------------
-- 13. تهيئة حاويات التخزين (Storage Buckets Setup)
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES 
    ('avatars', 'avatars', true),
    ('portfolio', 'portfolio', true),
    ('request_attachments', 'request_attachments', true),
    ('support_attachments', 'support_attachments', true)
ON CONFLICT (id) DO NOTHING;

-- سياسات التخزين
DROP POLICY IF EXISTS "Public access to avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload avatars" ON storage.objects;
CREATE POLICY "Public access to avatars" ON storage.objects FOR SELECT TO public
    USING (bucket_id IN ('avatars', 'portfolio', 'request_attachments', 'support_attachments'));

CREATE POLICY "Authenticated upload files" ON storage.objects FOR INSERT TO public
    WITH CHECK (bucket_id IN ('avatars', 'portfolio', 'request_attachments', 'support_attachments'));

