-- ============================================
-- V6: 初始化管理员工号账号
-- 功能：为管理员创建工号账号，支持姓名+工号+密码登录
-- 默认：工号 admin，姓名 管理员，密码 admin123
-- ============================================

-- 确保 pgcrypto 扩展已启用
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ============================================
-- 辅助函数：获取正确的 instance_id
-- ============================================
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

-- ============================================
-- 创建管理员工号账号
-- ============================================
DO $$
DECLARE
  v_admin_email TEXT := 'admin@system.local';
  v_admin_password TEXT := 'admin123';
  v_admin_username TEXT := '管理员';
  v_admin_employee_no TEXT := 'admin';
  v_instance_id UUID;
  v_encrypted_pw TEXT;
  v_user_id UUID;
  v_existing_id UUID;
BEGIN
  -- 检查是否已存在工号为 admin 的用户
  SELECT id INTO v_existing_id FROM auth.users WHERE email = v_admin_email;
  
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE '管理员工号账号已存在，跳过创建';
    RETURN;
  END IF;

  -- 获取 instance_id
  v_instance_id := public.get_auth_instance_id();
  
  IF v_instance_id IS NULL THEN
    RAISE EXCEPTION '无法获取 instance_id，请先注册至少一个用户';
  END IF;

  -- 生成 bcrypt 哈希 (cost factor = 10)
  -- 将 $2a$ 前缀替换为 $2b$ 以兼容 Supabase Auth
  v_encrypted_pw := REPLACE(extensions.crypt(v_admin_password, extensions.gen_salt('bf', 10)), '$2a$', '$2b$');

  -- 在 auth.users 中创建管理员账号
  INSERT INTO auth.users (
    id, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_user_meta_data,
    raw_app_meta_data, aud, role, instance_id
  ) VALUES (
    gen_random_uuid(),
    v_admin_email,
    v_encrypted_pw,
    now(), now(), now(),
    jsonb_build_object('username', v_admin_username, 'employee_no', v_admin_employee_no),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    'authenticated',
    'authenticated',
    v_instance_id
  ) RETURNING id INTO v_user_id;

  -- 在 public.users 中同步数据
  INSERT INTO public.users (id, email, username, employee_no, role)
  VALUES (v_user_id, v_admin_email, v_admin_username, v_admin_employee_no, 'admin')
  ON CONFLICT (id) DO UPDATE SET
    employee_no = EXCLUDED.employee_no,
    role = EXCLUDED.role,
    username = EXCLUDED.username,
    email = EXCLUDED.email;

  RAISE NOTICE '管理员工号账号创建成功：工号=%, 姓名=%, 密码=%', v_admin_employee_no, v_admin_username, v_admin_password;
END $$;

-- ============================================
-- 更新现有管理员账号(admin@admin.com)的 employee_no
-- ============================================
DO $$
BEGIN
  -- 如果 admin@admin.com 在 public.users 中有记录，更新其 employee_no
  UPDATE public.users
  SET employee_no = COALESCE(employee_no, 'admin_old')
  WHERE email = 'admin@admin.com' AND (employee_no IS NULL OR employee_no = '');
  
  -- 同时更新 raw_user_meta_data
  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) 
                           || jsonb_build_object('employee_no', COALESCE(raw_user_meta_data->>'employee_no', 'admin_old'))
  WHERE email = 'admin@admin.com';
END $$;

-- 刷新 schema cache
NOTIFY pgrst, 'reload schema';
