/**
 * Miras Supabase Client Configuration
 * إعدادات الاتصال المباشر بمنصة Supabase لمشروع مِـرَاس
 * 
 * قم بملء القيم أدناه من لوحة تحكم Supabase الخاصة بك:
 * Project Settings -> API -> Project URL & Project API Keys (anon public)
 */

window.MIRAS_ENV = {
  // عنوان المشروع في Supabase
  SUPABASE_URL: "https://dxutrykrxncuuyrtepgf.supabase.co/rest/v1/",

  // المفتاح العام المجهول (anon public key)
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsb_publishable_975LD8TQnFdx5CY2sDjbvw_6-PWXlsSsInR5cCI6IkpXVCJ9...",

  // وضع التطوير (فعّل true لعرض سجلات فحص الصلاحيات والاتصال في الـ Console)
  DEBUG_MODE: true
};

