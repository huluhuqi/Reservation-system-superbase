-- ============================================
-- V5: 管理员用户管理函数
-- 功能：管理员可创建、批量创建、删除用户
-- 登录方式：工号 + 虚拟邮箱（employee_no@system.local）
-- ============================================

-- ============================================
-- 1. 确保 users 表有 employee_no 字段（幂等）
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'employee_no'
  ) THEN
    ALTER TABLE public.users ADD COLUMN employee_no TEXT;
  END IF;
END $$;

-- ============================================
-- 2. 创建用户函数（单个）
-- ============================================
CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_employee_no TEXT,
  p_username TEXT,
  p_password TEXT DEFAULT '123456',
  p_role TEXT DEFAULT 'user'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_user_id UUID;
  v_result JSONB;
BEGIN
  -- 权限检查：只有管理员可以操作
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION '无权限执行此操作';
  END IF;

  -- 参数校验
  IF p_employee_no IS NULL OR TRIM(p_employee_no) = '' THEN
    RAISE EXCEPTION '工号不能为空';
  END IF;
  IF p_username IS NULL OR TRIM(p_username) = '' THEN
    RAISE EXCEPTION '姓名不能为空';
  END IF;
  IF p_password IS NULL OR LENGTH(p_password) < 6 THEN
    RAISE EXCEPTION '密码至少6位';
  END IF;
  IF p_role NOT IN ('user', 'admin') THEN
    RAISE EXCEPTION '角色不合法';
  END IF;

  v_email := LOWER(TRIM(p_employee_no)) || '@system.local';

  -- 检查工号是否已存在
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    RAISE EXCEPTION '工号已存在';
  END IF;
  IF EXISTS (SELECT 1 FROM public.users WHERE employee_no = TRIM(p_employee_no)) THEN
    RAISE EXCEPTION '工号已存在';
  END IF;

  -- 在 auth.users 中创建用户
  INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_user_meta_data,
    aud,
    role,
    instance_id
  )
  VALUES (
    gen_random_uuid(),
    v_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    now(),
    now(),
    jsonb_build_object('username', TRIM(p_username), 'employee_no', TRIM(p_employee_no)),
    'authenticated',
    'authenticated',
    '00000000-0000-0000-0000-000000000000'::uuid
  )
  RETURNING id INTO v_user_id;

  -- 在 public.users 中同步数据
  INSERT INTO public.users (id, email, username, employee_no, role)
  VALUES (v_user_id, v_email, TRIM(p_username), TRIM(p_employee_no), p_role);

  v_result := jsonb_build_object(
    'id', v_user_id,
    'email', v_email,
    'username', TRIM(p_username),
    'employee_no', TRIM(p_employee_no),
    'role', p_role
  );

  RETURN v_result;
END;
$$;

-- ============================================
-- 3. 批量创建用户函数
-- ============================================
CREATE OR REPLACE FUNCTION public.admin_batch_create_users(
  p_users JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user JSONB;
  v_count INTEGER := 0;
  v_failed INTEGER := 0;
  v_errors TEXT[] := ARRAY[]::TEXT[];
  v_email TEXT;
  v_user_id UUID;
  v_employee_no TEXT;
  v_username TEXT;
  v_password TEXT;
  v_role TEXT;
  i INTEGER;
BEGIN
  -- 权限检查
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION '无权限执行此操作';
  END IF;

  IF p_users IS NULL OR jsonb_array_length(p_users) = 0 THEN
    RAISE EXCEPTION '用户列表不能为空';
  END IF;

  FOR i IN 0..jsonb_array_length(p_users)-1 LOOP
    v_user := p_users->i;
    v_employee_no := TRIM(COALESCE(v_user->>'employee_no', ''));
    v_username := TRIM(COALESCE(v_user->>'username', ''));
    v_password := COALESCE(v_user->>'password', '123456');
    v_role := COALESCE(v_user->>'role', 'user');

    BEGIN
      IF v_employee_no = '' THEN
        RAISE EXCEPTION '工号不能为空';
      END IF;
      IF v_username = '' THEN
        RAISE EXCEPTION '姓名不能为空';
      END IF;
      IF LENGTH(v_password) < 6 THEN
        v_password := '123456';
      END IF;
      IF v_role NOT IN ('user', 'admin') THEN
        v_role := 'user';
      END IF;

      v_email := LOWER(v_employee_no) || '@system.local';

      -- 检查是否已存在
      IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
        RAISE EXCEPTION '工号已存在';
      END IF;

      -- 创建 auth 用户
      INSERT INTO auth.users (
        id, email, encrypted_password, email_confirmed_at,
        created_at, updated_at, raw_user_meta_data, aud, role, instance_id
      )
      VALUES (
        gen_random_uuid(),
        v_email,
        crypt(v_password, gen_salt('bf')),
        now(), now(), now(),
        jsonb_build_object('username', v_username, 'employee_no', v_employee_no),
        'authenticated', 'authenticated',
        '00000000-0000-0000-0000-000000000000'::uuid
      )
      RETURNING id INTO v_user_id;

      -- 同步到 public.users
      INSERT INTO public.users (id, email, username, employee_no, role)
      VALUES (v_user_id, v_email, v_username, v_employee_no, v_role);

      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      v_errors := array_append(v_errors, v_employee_no || ': ' || SQLERRM);
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', v_count,
    'failed', v_failed,
    'errors', v_errors
  );
END;
$$;

-- ============================================
-- 4. 删除用户函数（单个）
-- ============================================
CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION '无权限执行此操作';
  END IF;

  -- 不能删除自己
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION '不能删除当前登录的管理员账号';
  END IF;

  -- 检查是否存在
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION '用户不存在';
  END IF;

  -- 从 auth.users 删除（会级联删除 public.users 和 booking）
  DELETE FROM auth.users WHERE id = p_user_id;

  RETURN TRUE;
END;
$$;

-- ============================================
-- 5. 批量删除用户函数
-- ============================================
CREATE OR REPLACE FUNCTION public.admin_batch_delete_users(p_user_ids UUID[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  v_failed INTEGER := 0;
  v_errors TEXT[] := ARRAY[]::TEXT[];
  v_id UUID;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION '无权限执行此操作';
  END IF;

  IF p_user_ids IS NULL OR array_length(p_user_ids, 1) = 0 THEN
    RAISE EXCEPTION '用户ID列表不能为空';
  END IF;

  FOREACH v_id IN ARRAY p_user_ids LOOP
    BEGIN
      IF v_id = auth.uid() THEN
        RAISE EXCEPTION '不能删除当前登录的管理员账号';
      END IF;

      DELETE FROM auth.users WHERE id = v_id;
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      v_errors := array_append(v_errors, v_id::TEXT || ': ' || SQLERRM);
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', v_count,
    'failed', v_failed,
    'errors', v_errors
  );
END;
$$;

-- ============================================
-- 6. 授权函数执行权限
-- ============================================
GRANT EXECUTE ON FUNCTION public.admin_create_user(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_batch_create_users(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_batch_delete_users(UUID[]) TO authenticated;

-- ============================================
-- 7. 重新同步现有用户的 employee_no
-- ============================================
UPDATE public.users u
SET employee_no = COALESCE(
  NULLIF(au.raw_user_meta_data->>'employee_no', ''),
  SPLIT_PART(au.email, '@', 1)
)
FROM auth.users au
WHERE u.id = au.id
  AND (u.employee_no IS NULL OR u.employee_no = '');
