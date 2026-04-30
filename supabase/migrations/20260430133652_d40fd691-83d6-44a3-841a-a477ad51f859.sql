-- Phone OTP table (dev/test only)
CREATE TABLE IF NOT EXISTS public.phone_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS phone_otps_phone_idx ON public.phone_otps(phone);

ALTER TABLE public.phone_otps ENABLE ROW LEVEL SECURITY;
-- No direct policies; access only via SECURITY DEFINER functions

-- Request OTP: generates a 6-digit code, valid for 5 minutes
CREATE OR REPLACE FUNCTION public.request_phone_otp(_phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
BEGIN
  IF _phone IS NULL OR length(trim(_phone)) < 6 THEN
    RAISE EXCEPTION 'Invalid phone number';
  END IF;

  -- Invalidate previous unused codes for this phone
  UPDATE public.phone_otps
    SET used = true
    WHERE phone = _phone AND used = false;

  -- Generate 6-digit code
  v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');

  INSERT INTO public.phone_otps (phone, code, expires_at)
  VALUES (_phone, v_code, now() + interval '5 minutes');

  RETURN v_code;
END;
$$;

-- Verify OTP
CREATE OR REPLACE FUNCTION public.verify_phone_otp(_phone TEXT, _code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id
  FROM public.phone_otps
  WHERE phone = _phone
    AND code = _code
    AND used = false
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.phone_otps SET used = true WHERE id = v_id;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_phone_otp(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_phone_otp(TEXT, TEXT) TO anon, authenticated;