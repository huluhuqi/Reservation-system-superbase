-- ============================================
-- 科研仪器预约系统 - 完整数据库初始化脚本（最终版）
-- 幂等设计：可重复执行，不会报错
-- 执行方式：在 Supabase Dashboard SQL Editor 中一次性执行
-- ============================================

-- ============================================
-- 0. 启用必要扩展
-- ============================================
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ============================================
-- 1. 清理旧表（幂等：先删后建）
-- ============================================
DROP TABLE IF EXISTS public.booking CASCADE;
DROP TABLE IF EXISTS public.lock CASCADE;
DROP TABLE IF EXISTS public.time_slot CASCADE;
DROP TABLE IF EXISTS public.instrument CASCADE;
DROP TABLE IF EXISTS public.category CASCADE;
DROP TABLE IF EXISTS public.settings CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- ============================================
-- 2. users 表（关联 auth.users）
-- ============================================
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  username TEXT,
  employee_no TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 3. category 表
-- ============================================
CREATE TABLE public.category (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT,
  sort_order INTEGER DEFAULT 0,
  custom_slots JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 4. instrument 表
-- ============================================
CREATE TABLE public.instrument (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  category_id BIGINT REFERENCES public.category(id) ON DELETE CASCADE,
  description TEXT,
  status TEXT DEFAULT 'active',
  location TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 5. time_slot 表
-- ============================================
CREATE TABLE public.time_slot (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category_id BIGINT REFERENCES public.category(id) ON DELETE CASCADE,
  slot_start TEXT NOT NULL,
  slot_end TEXT NOT NULL,
  slot_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 6. booking 表（核心表）
-- ============================================
CREATE TABLE public.booking (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  instrument_id BIGINT REFERENCES public.instrument(id) ON DELETE CASCADE,
  category_id BIGINT REFERENCES public.category(id) ON DELETE CASCADE,

  booking_date DATE NOT NULL,
  slot_start TEXT NOT NULL,
  slot_end TEXT NOT NULL,
  slot_index INTEGER NOT NULL DEFAULT 0,

  instrument_name TEXT,
  user_name TEXT,
  user_email TEXT,

  status TEXT DEFAULT 'pending',
  remark TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE (instrument_id, booking_date, slot_start)
);

-- ============================================
-- 7. lock 表（时段锁定）
-- ============================================
CREATE TABLE public.lock (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  category_id BIGINT REFERENCES public.category(id) ON DELETE CASCADE,
  instrument_id BIGINT REFERENCES public.instrument(id) ON DELETE CASCADE,

  lock_date DATE,
  lock_type TEXT NOT NULL CHECK (lock_type IN ('day', 'slot')),
  slot_index INTEGER,
  scope_type TEXT DEFAULT 'daily' CHECK (scope_type IN ('daily', 'long_term')),

  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 8. settings 表
-- ============================================
CREATE TABLE public.settings (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admin_password TEXT DEFAULT 'admin123',
  custom_slots JSONB DEFAULT '[]',
  booking_advance_days INTEGER DEFAULT 7,
  booking_open_time TEXT DEFAULT '09:00',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 9. 用户同步触发器
-- ============================================

-- 新用户创建时同步
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, username, employee_no, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'employee_no', ''),
    CASE 
      WHEN NEW.email = 'admin@admin.com' THEN 'admin'
      ELSE 'user'
    END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 用户更新时同步
CREATE OR REPLACE FUNCTION public.handle_user_update()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.users
  SET email = NEW.email,
      username = COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
      employee_no = COALESCE(NEW.raw_user_meta_data->>'employee_no', employee_no)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF email, raw_user_meta_data ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_update();

-- ============================================
-- 10. 辅助函数
-- ============================================

-- 获取 auth instance_id
CREATE OR REPLACE FUNCTION public.get_auth_instance_id()
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_instance_id UUID;
BEGIN
  SELECT instance_id INTO v_instance_id
  FROM auth.users
  WHERE instance_id IS NOT NULL
  LIMIT 1;
  
  RETURN v_instance_id;
END;
$$;

-- 判断当前用户是否为管理员
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
      OR EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'admin@admin.com');
END;
$$;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- 生成 Supabase 兼容的 bcrypt 哈希（$2b$ 前缀）
CREATE OR REPLACE FUNCTION public.supabase_crypt(p_password TEXT)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_hash TEXT;
BEGIN
  v_hash := extensions.crypt(p_password, extensions.gen_salt('bf', 10));
  RETURN REPLACE(v_hash, '$2a$', '$2b$');
END;
$$;
GRANT EXECUTE ON FUNCTION public.supabase_crypt(TEXT) TO authenticated;

-- ============================================
-- 11. 管理员用户管理函数
-- ============================================

-- 11.1 创建单个用户
CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_employee_no TEXT, p_username TEXT,
  p_password TEXT DEFAULT '123456', p_role TEXT DEFAULT 'user'
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_user_id UUID;
  v_encrypted_pw TEXT;
  v_instance_id UUID;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION '无权限执行此操作'; END IF;
  IF p_employee_no IS NULL OR TRIM(p_employee_no) = '' THEN RAISE EXCEPTION '工号不能为空'; END IF;
  IF p_username IS NULL OR TRIM(p_username) = '' THEN RAISE EXCEPTION '姓名不能为空'; END IF;

  v_email := LOWER(TRIM(p_employee_no)) || '@system.local';
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN RAISE EXCEPTION '工号已存在'; END IF;

  v_instance_id := public.get_auth_instance_id();
  v_encrypted_pw := public.supabase_crypt(p_password);

  INSERT INTO auth.users (
    id, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_user_meta_data,
    raw_app_meta_data, aud, role, instance_id
  ) VALUES (
    gen_random_uuid(),
    v_email,
    v_encrypted_pw,
    now(), now(), now(),
    jsonb_build_object('username', TRIM(p_username), 'employee_no', TRIM(p_employee_no)),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    'authenticated',
    'authenticated',
    v_instance_id
  ) RETURNING id INTO v_user_id;

  INSERT INTO public.users (id, email, username, employee_no, role)
  VALUES (v_user_id, v_email, TRIM(p_username), TRIM(p_employee_no), p_role)
  ON CONFLICT (id) DO UPDATE SET
    employee_no = EXCLUDED.employee_no,
    role = EXCLUDED.role,
    username = EXCLUDED.username,
    email = EXCLUDED.email;

  RETURN jsonb_build_object(
    'id', v_user_id, 'email', v_email,
    'username', TRIM(p_username), 'employee_no', TRIM(p_employee_no), 'role', p_role
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_create_user(TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- 11.2 批量创建用户
CREATE OR REPLACE FUNCTION public.admin_batch_create_users(p_users JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_success_count INTEGER := 0;
  v_failed_count INTEGER := 0;
  v_errors JSONB := '[]'::jsonb;
  v_user JSONB; v_idx INTEGER;
  v_employee_no TEXT; v_username TEXT; v_password TEXT; v_role TEXT;
  v_email TEXT; v_user_id UUID;
  v_instance_id UUID;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION '无权限执行此操作'; END IF;

  v_instance_id := public.get_auth_instance_id();

  FOR v_idx IN 0..jsonb_array_length(p_users) - 1 LOOP
    v_user := p_users -> v_idx;
    v_employee_no := TRIM(COALESCE(v_user ->> 'employee_no', ''));
    v_username := TRIM(COALESCE(v_user ->> 'username', ''));
    v_password := COALESCE(v_user ->> 'password', '123456');
    v_role := COALESCE(v_user ->> 'role', 'user');

    BEGIN
      IF v_employee_no = '' OR v_username = '' THEN
        v_failed_count := v_failed_count + 1;
        v_errors := v_errors || jsonb_build_object('employee_no', v_employee_no, 'error', '工号或姓名为空');
        CONTINUE;
      END IF;

      v_email := LOWER(v_employee_no) || '@system.local';
      IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
        v_failed_count := v_failed_count + 1;
        v_errors := v_errors || jsonb_build_object('employee_no', v_employee_no, 'error', '工号已存在');
        CONTINUE;
      END IF;

      INSERT INTO auth.users (
        id, email, encrypted_password, email_confirmed_at,
        created_at, updated_at, raw_user_meta_data,
        raw_app_meta_data, aud, role, instance_id
      ) VALUES (
        gen_random_uuid(),
        v_email,
        public.supabase_crypt(v_password),
        now(), now(), now(),
        jsonb_build_object('username', v_username, 'employee_no', v_employee_no),
        jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
        'authenticated', 'authenticated',
        v_instance_id
      ) RETURNING id INTO v_user_id;

      INSERT INTO public.users (id, email, username, employee_no, role)
      VALUES (v_user_id, v_email, v_username, v_employee_no, v_role)
      ON CONFLICT (id) DO UPDATE SET
        employee_no = EXCLUDED.employee_no,
        role = EXCLUDED.role,
        username = EXCLUDED.username,
        email = EXCLUDED.email;

      v_success_count := v_success_count + 1;
    EXCEPTION WHEN OTHERS THEN
      v_failed_count := v_failed_count + 1;
      v_errors := v_errors || jsonb_build_object('employee_no', v_employee_no, 'error', SQLERRM);
    END;
  END LOOP;

  RETURN jsonb_build_object('success', v_success_count, 'failed', v_failed_count, 'errors', v_errors);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_batch_create_users(JSONB) TO authenticated;

-- 11.3 删除单个用户
CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION '无权限执行此操作'; END IF;
  IF p_user_id = auth.uid() THEN RAISE EXCEPTION '不能删除当前登录的管理员账号'; END IF;
  DELETE FROM auth.users WHERE id = p_user_id;
  RETURN TRUE;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated;

-- 11.4 批量删除用户
CREATE OR REPLACE FUNCTION public.admin_batch_delete_users(p_user_ids UUID[])
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_success_count INTEGER := 0;
  v_failed_count INTEGER := 0;
  v_errors JSONB := '[]'::jsonb;
  v_user_id UUID;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION '无权限执行此操作'; END IF;

  FOREACH v_user_id IN ARRAY p_user_ids LOOP
    BEGIN
      IF v_user_id = auth.uid() THEN
        v_failed_count := v_failed_count + 1;
        v_errors := v_errors || jsonb_build_object('user_id', v_user_id::text, 'error', '不能删除当前登录的管理员账号');
        CONTINUE;
      END IF;
      DELETE FROM auth.users WHERE id = v_user_id;
      v_success_count := v_success_count + 1;
    EXCEPTION WHEN OTHERS THEN
      v_failed_count := v_failed_count + 1;
      v_errors := v_errors || jsonb_build_object('user_id', v_user_id::text, 'error', SQLERRM);
    END;
  END LOOP;

  RETURN jsonb_build_object('success', v_success_count, 'failed', v_failed_count, 'errors', v_errors);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_batch_delete_users(UUID[]) TO authenticated;

-- ============================================
-- 12. 插入初始数据
-- ============================================

-- 默认设置
INSERT INTO public.settings (admin_password, booking_advance_days, booking_open_time)
VALUES ('admin123', 7, '09:00');

-- 默认时段
INSERT INTO public.time_slot (slot_start, slot_end, slot_index) 
VALUES 
  ('09:00', '10:00', 0),
  ('10:00', '11:00', 1),
  ('11:00', '12:00', 2),
  ('13:00', '14:00', 3),
  ('14:00', '15:00', 4),
  ('15:00', '16:00', 5),
  ('16:00', '17:00', 6),
  ('17:00', '18:00', 7);

-- 示例类别
INSERT INTO public.category (name, icon, sort_order) 
VALUES 
  ('高效液相色谱仪', '🔬', 1),
  ('气相色谱仪', '⚗️', 2),
  ('紫外可见分光光度计', '🔍', 3),
  ('傅里叶红外光谱仪', '📊', 4);

-- 示例仪器
INSERT INTO public.instrument (name, category_id, description, status)
VALUES 
  ('HPLC-1', 1, '高效液相色谱仪 1号', 'active'),
  ('HPLC-2', 1, '高效液相色谱仪 2号', 'active'),
  ('GC-1', 2, '气相色谱仪 1号', 'active'),
  ('UV-1', 3, '紫外可见分光光度计 1号', 'active'),
  ('FTIR-1', 4, '傅里叶红外光谱仪 1号', 'active');

-- ============================================
-- 13. 同步已有 auth.users 到 public.users
-- ============================================
INSERT INTO public.users (id, email, username, employee_no, role)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'username', SPLIT_PART(au.email, '@', 1)),
  COALESCE(au.raw_user_meta_data->>'employee_no', ''),
  CASE
    WHEN au.email = 'admin@admin.com' THEN 'admin'
    ELSE 'user'
  END
FROM auth.users au
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 14. 启用 RLS（行级安全）+ FORCE RLS
-- ============================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;

ALTER TABLE public.category ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category FORCE ROW LEVEL SECURITY;

ALTER TABLE public.instrument ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instrument FORCE ROW LEVEL SECURITY;

ALTER TABLE public.time_slot ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_slot FORCE ROW LEVEL SECURITY;

ALTER TABLE public.booking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking FORCE ROW LEVEL SECURITY;

ALTER TABLE public.lock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lock FORCE ROW LEVEL SECURITY;

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings FORCE ROW LEVEL SECURITY;

-- ============================================
-- 15. RLS 策略
-- ============================================

-- ---------- users 表 ----------
DROP POLICY IF EXISTS "user self read" ON public.users;
CREATE POLICY "user self read"
ON public.users FOR SELECT
USING (auth.uid() = id);

DROP POLICY IF EXISTS "user self update" ON public.users;
CREATE POLICY "user self update"
ON public.users FOR UPDATE
USING (auth.uid() = id);

DROP POLICY IF EXISTS "admin all users" ON public.users;
CREATE POLICY "admin all users"
ON public.users FOR ALL
USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- ---------- category 表（公开读） ----------
DROP POLICY IF EXISTS "public read category" ON public.category;
CREATE POLICY "public read category"
ON public.category FOR SELECT USING (true);

DROP POLICY IF EXISTS "admin write category" ON public.category;
CREATE POLICY "admin write category"
ON public.category FOR ALL
USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- ---------- instrument 表（公开读） ----------
DROP POLICY IF EXISTS "public read instrument" ON public.instrument;
CREATE POLICY "public read instrument"
ON public.instrument FOR SELECT USING (true);

DROP POLICY IF EXISTS "admin write instrument" ON public.instrument;
CREATE POLICY "admin write instrument"
ON public.instrument FOR ALL
USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- ---------- time_slot 表 ----------
DROP POLICY IF EXISTS "public read time_slot" ON public.time_slot;
CREATE POLICY "public read time_slot"
ON public.time_slot FOR SELECT USING (true);

DROP POLICY IF EXISTS "admin write time_slot" ON public.time_slot;
CREATE POLICY "admin write time_slot"
ON public.time_slot FOR ALL
USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- ---------- booking 表 ----------
-- 所有登录用户都可以查看预约
DROP POLICY IF EXISTS "auth read all booking" ON public.booking;
CREATE POLICY "auth read all booking"
ON public.booking FOR SELECT
USING (auth.uid() IS NOT NULL);

-- 只能插入自己的预约
DROP POLICY IF EXISTS "insert own booking" ON public.booking;
CREATE POLICY "insert own booking"
ON public.booking FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 只能更新/删除自己的预约
DROP POLICY IF EXISTS "update own booking" ON public.booking;
CREATE POLICY "update own booking"
ON public.booking FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete own booking" ON public.booking;
CREATE POLICY "delete own booking"
ON public.booking FOR DELETE
USING (auth.uid() = user_id);

-- admin 可以管理所有 booking
DROP POLICY IF EXISTS "admin all booking" ON public.booking;
CREATE POLICY "admin all booking"
ON public.booking FOR ALL
USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- ---------- lock 表 ----------
DROP POLICY IF EXISTS "public read lock" ON public.lock;
CREATE POLICY "public read lock"
ON public.lock FOR SELECT USING (true);

DROP POLICY IF EXISTS "admin write lock" ON public.lock;
CREATE POLICY "admin write lock"
ON public.lock FOR ALL
USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- ---------- settings 表 ----------
DROP POLICY IF EXISTS "public read settings" ON public.settings;
CREATE POLICY "public read settings"
ON public.settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "admin write settings" ON public.settings;
CREATE POLICY "admin write settings"
ON public.settings FOR ALL
USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- ============================================
-- 16. 创建索引
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_employee_no ON public.users(employee_no);
CREATE INDEX IF NOT EXISTS idx_instrument_category ON public.instrument(category_id);
CREATE INDEX IF NOT EXISTS idx_instrument_status ON public.instrument(status);
CREATE INDEX IF NOT EXISTS idx_time_slot_category ON public.time_slot(category_id);
CREATE INDEX IF NOT EXISTS idx_booking_user_id ON public.booking(user_id);
CREATE INDEX IF NOT EXISTS idx_booking_instrument ON public.booking(instrument_id);
CREATE INDEX IF NOT EXISTS idx_booking_date ON public.booking(booking_date);
CREATE INDEX IF NOT EXISTS idx_booking_status ON public.booking(status);
CREATE INDEX IF NOT EXISTS idx_booking_category ON public.booking(category_id);
CREATE INDEX IF NOT EXISTS idx_booking_instrument_date ON public.booking(instrument_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_lock_category ON public.lock(category_id);
CREATE INDEX IF NOT EXISTS idx_lock_instrument ON public.lock(instrument_id);
CREATE INDEX IF NOT EXISTS idx_lock_date ON public.lock(lock_date);

-- ============================================
-- 17. 刷新 schema cache
-- ============================================
NOTIFY pgrst, 'reload schema';

-- ============================================
-- 数据库初始化完成
-- ============================================
-- 注意：
-- 1. 执行完此脚本后，需要通过 admin@admin.com 邮箱注册一个管理员账号
--    （或者使用下面的 SQL 手动创建管理员工号账号，需确保数据库中已有至少一个用户）
-- 2. 管理员工号账号创建 SQL（取消下面的注释后执行）：
--
-- DO $$
-- DECLARE
--   v_admin_email TEXT := 'admin@system.local';
--   v_admin_password TEXT := 'admin123';
--   v_admin_username TEXT := '管理员';
--   v_admin_employee_no TEXT := 'admin';
--   v_instance_id UUID;
--   v_encrypted_pw TEXT;
--   v_user_id UUID;
--   v_existing_id UUID;
-- BEGIN
--   SELECT id INTO v_existing_id FROM auth.users WHERE email = v_admin_email;
--   IF v_existing_id IS NOT NULL THEN
--     RAISE NOTICE '管理员工号账号已存在，跳过创建';
--     RETURN;
--   END IF;
--   v_instance_id := public.get_auth_instance_id();
--   IF v_instance_id IS NULL THEN
--     RAISE EXCEPTION '无法获取 instance_id，请先注册至少一个用户';
--   END IF;
--   v_encrypted_pw := public.supabase_crypt(v_admin_password);
--   INSERT INTO auth.users (
--     id, email, encrypted_password, email_confirmed_at,
--     created_at, updated_at, raw_user_meta_data,
--     raw_app_meta_data, aud, role, instance_id
--   ) VALUES (
--     gen_random_uuid(), v_admin_email, v_encrypted_pw,
--     now(), now(), now(),
--     jsonb_build_object('username', v_admin_username, 'employee_no', v_admin_employee_no),
--     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
--     'authenticated', 'authenticated', v_instance_id
--   ) RETURNING id INTO v_user_id;
--
--   INSERT INTO public.users (id, email, username, employee_no, role)
--   VALUES (v_user_id, v_admin_email, v_admin_username, v_admin_employee_no, 'admin')
--   ON CONFLICT (id) DO UPDATE SET
--     employee_no = EXCLUDED.employee_no, role = EXCLUDED.role,
--     username = EXCLUDED.username, email = EXCLUDED.email;
--
--   RAISE NOTICE '管理员工号账号创建成功：工号=%, 姓名=%, 密码=%', v_admin_employee_no, v_admin_username, v_admin_password;
-- END $$;
-- NOTIFY pgrst, 'reload schema';
