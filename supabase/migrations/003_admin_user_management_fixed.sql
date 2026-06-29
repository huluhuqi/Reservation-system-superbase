-- ============================================================
-- 管理员用户管理函数（修复版 V3 - 修复 instance_id 和 bcrypt）
-- ============================================================

-- 确保 pgcrypto 扩展已启用
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ============================================================
-- 辅助函数：获取正确的 instance_id
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_auth_instance_id()
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_instance_id UUID;
BEGIN
  -- 从已有用户获取 instance_id
  SELECT instance_id INTO v_instance_id
  FROM auth.users
  WHERE instance_id IS NOT NULL
  LIMIT 1;
  
  RETURN v_instance_id;
END;
$$;

-- ============================================================
-- 辅助函数：判断当前用户是否为管理员
-- ============================================================
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

-- ============================================================
-- 1. 管理员创建单个用户
-- ============================================================
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

  -- 获取正确的 instance_id
  v_instance_id := public.get_auth_instance_id();

  -- bcrypt 哈希
  -- 注意：Supabase Auth 使用 bcrypt cost factor = 10，且使用 $2a$ 前缀
  v_encrypted_pw := extensions.crypt(p_password, extensions.gen_salt('bf', 10));

  -- 创建 auth 用户
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

  -- 同步到 public.users（ON CONFLICT 处理触发器重复插入）
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

-- ============================================================
-- 2. 管理员批量创建用户
-- ============================================================
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
        extensions.crypt(v_password, extensions.gen_salt('bf', 10)),
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

-- ============================================================
-- 3. 管理员删除单个用户
-- ============================================================
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

-- ============================================================
-- 4. 管理员批量删除用户
-- ============================================================
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

-- 刷新 schema cache
NOTIFY pgrst, 'reload schema';