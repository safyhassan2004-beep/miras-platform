-- Migration 02: Patch Profiles & Strict Role Assignment Trigger
-- Ensures all columns exist on public.profiles and strictly blocks public admin self-assignment

ALTER TABLE public.profiles 
    ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('client', 'craftsman', 'admin')),
    ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS phone_number TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS city TEXT DEFAULT 'الرياض',
    ADD COLUMN IF NOT EXISTS national_id_verified BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Function to check admin status securely
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

-- Secure User Creation Trigger
-- Note: If metadata requests role='admin', it is forcibly overridden to 'client' for security!
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
    
    -- Security Rule: NEVER allow admin creation through public signup
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

    -- 1. Insert/Update Profile
    INSERT INTO public.profiles (id, full_name, phone_number, role, is_admin, city, updated_at)
    VALUES (
        NEW.id,
        user_name,
        NULLIF(user_phone, ''),
        safe_role,
        FALSE, -- is_admin is strictly false on public signup
        user_city,
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        phone_number = COALESCE(EXCLUDED.phone_number, public.profiles.phone_number),
        city = EXCLUDED.city,
        updated_at = NOW();

    -- 2. Create Escrow Wallet
    INSERT INTO public.escrow_wallets (user_id, balance, escrow_held)
    VALUES (NEW.id, 0.00, 0.00)
    ON CONFLICT (user_id) DO NOTHING;

    -- 3. If registered as Craftsman, create craftsman profile
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
