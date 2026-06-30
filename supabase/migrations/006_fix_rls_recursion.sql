-- ============================================
-- RLS 递归问题修复脚本（V2 - 使用 auth.users）
-- ============================================

-- 1. 删除可能存在的旧函数
DROP FUNCTION IF EXISTS public.is_admin_check();

-- 2. 创建新的管理员检查函数（完全基于 auth.users，不依赖 public.users）
CREATE OR REPLACE FUNCTION public.is_admin_check()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  -- 只检查 auth.users 中的邮箱是否是 admin@admin.com
  SELECT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND email = 'admin@admin.com'
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_admin_check() TO authenticated,anon;

-- 3. 更新 users 表的 admin 策略
DROP POLICY IF EXISTS "admin all users" ON public.users;
CREATE POLICY "admin all users" ON public.users FOR ALL
USING (public.is_admin_check())
WITH CHECK (public.is_admin_check());

-- 4. 更新其他表的 admin 策略
DROP POLICY IF EXISTS "admin write category" ON public.category;
CREATE POLICY "admin write category" ON public.category FOR ALL
USING (public.is_admin_check())
WITH CHECK (public.is_admin_check());

DROP POLICY IF EXISTS "admin write instrument" ON public.instrument;
CREATE POLICY "admin write instrument" ON public.instrument FOR ALL
USING (public.is_admin_check())
WITH CHECK (public.is_admin_check());

DROP POLICY IF EXISTS "admin write time_slot" ON public.time_slot;
CREATE POLICY "admin write time_slot" ON public.time_slot FOR ALL
USING (public.is_admin_check())
WITH CHECK (public.is_admin_check());

DROP POLICY IF EXISTS "admin all booking" ON public.booking;
CREATE POLICY "admin all booking" ON public.booking FOR ALL
USING (public.is_admin_check())
WITH CHECK (public.is_admin_check());

DROP POLICY IF EXISTS "admin write lock" ON public.lock;
CREATE POLICY "admin write lock" ON public.lock FOR ALL
USING (public.is_admin_check())
WITH CHECK (public.is_admin_check());

DROP POLICY IF EXISTS "admin write settings" ON public.settings;
CREATE POLICY "admin write settings" ON public.settings FOR ALL
USING (public.is_admin_check())
WITH CHECK (public.is_admin_check());

-- 5. 刷新 schema cache
NOTIFY pgrst, 'reload schema';

-- 6. 验证函数是否正常工作
SELECT 
  'is_admin_check() function exists: ' || 
  CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_admin_check') THEN 'YES' ELSE 'NO' END
  AS status;
