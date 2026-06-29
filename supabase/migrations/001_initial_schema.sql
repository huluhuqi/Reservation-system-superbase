-- ============================================
-- 科研仪器预约系统 - V4 生产级数据库初始化脚本
-- 幂等设计：可重复执行，不会报错
-- ============================================

-- ============================================
-- 清理旧表（幂等：先删后建）
-- ============================================
DROP TABLE IF EXISTS public.booking CASCADE;
DROP TABLE IF EXISTS public.lock CASCADE;
DROP TABLE IF EXISTS public.time_slot CASCADE;
DROP TABLE IF EXISTS public.instrument CASCADE;
DROP TABLE IF EXISTS public.category CASCADE;
DROP TABLE IF EXISTS public.settings CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- ============================================
-- 1. users 表（关联 auth.users，生产级标准）
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
-- 2. category 表
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
-- 3. instrument 表
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
-- 4. time_slot 表
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
-- 5. booking 表（核心表）
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

  status TEXT DEFAULT 'pending',
  remark TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE (instrument_id, booking_date, slot_start)
);

-- ============================================
-- 6. lock 表（时段锁定）
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
-- 7. settings 表
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
-- 自动同步用户（触发器，必须）
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, username, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
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
      username = COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1))
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF email, raw_user_meta_data ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_update();

-- ============================================
-- 插入初始数据
-- ============================================

-- 默认设置
INSERT INTO public.settings (admin_password) VALUES ('admin123');

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
-- 启用 RLS（行级安全）+ FORCE RLS
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
-- RLS 策略（V4 最终版）
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

-- ---------- booking 表（V4 核心策略） ----------
-- 所有登录用户都可以查看预约（用户需要知道哪些时段被占用）
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
-- 创建索引（优化查询性能）
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
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
-- V4 生产级架构完成
-- ============================================
