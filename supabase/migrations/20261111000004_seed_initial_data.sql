-- Migration 04: Seed Initial Official Categories & Admin Helper Procedure

-- 1. إضافة التصنيفات المهنية الأساسية لمنصة مِـرَاس
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

-- 2. دالة مساعدة لترقية أي بريد إلكتروني إلى مدير نظام (Admin) من قبل مالك المشروع
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
