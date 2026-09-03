-- ==============================================================================
-- RecoverAI: Role-Based Access Control (RBAC) Schema Migration
-- Authoritative profiles table, PostgreSQL RLS policies, and Auth Trigger
-- ==============================================================================

-- 1. Create public.profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id VARCHAR(64) PRIMARY KEY,
    full_name TEXT,
    email TEXT,
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'operator',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT role_check CHECK (role IN ('admin', 'operator'))
);


-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policy: Users can view their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (auth.uid()::text = id::text);

-- 4. RLS Policy: Users can update their own profile (display fields only)
DROP POLICY IF EXISTS "Users can update own profile display fields" ON public.profiles;
CREATE POLICY "Users can update own profile display fields"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid()::text = id::text)
    WITH CHECK (auth.uid()::text = id::text);


-- 5. Trigger Function to protect role from direct browser updates
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER AS $$
BEGIN
    -- Block role or ID changes from direct client authenticated connections
    IF (NEW.role IS DISTINCT FROM OLD.role OR NEW.id IS DISTINCT FROM OLD.id) THEN
        IF (auth.role() = 'authenticated') AND NOT (coalesce(current_setting('request.jwt.claims', true)::jsonb->>'role', '') = 'service_role') THEN
            RAISE EXCEPTION 'Role and ID modification is strictly restricted to server administration.';
        END IF;
    END IF;
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_protect_profile_role ON public.profiles;
CREATE TRIGGER trigger_protect_profile_role
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_profile_role();

-- 6. New User Trigger: Automatically provision public.profiles as 'operator'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        avatar_url,
        role,
        created_at,
        updated_at
    )
    VALUES (
        NEW.id,
        NEW.email,
        coalesce(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        coalesce(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
        'operator', -- ALWAYS operator, never admin on signup
        now(),
        now()
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- 7. Backfill existing auth.users without profiles as 'operator'
INSERT INTO public.profiles (id, email, full_name, avatar_url, role, created_at, updated_at)
SELECT
    u.id,
    u.email,
    coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
    coalesce(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture'),
    'operator',
    coalesce(u.created_at, now()),
    now()
FROM auth.users u
ON CONFLICT (id) DO NOTHING;
