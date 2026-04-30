-- Clean empty phone strings → NULL so unique index can be applied
UPDATE public.profiles SET phone = NULL WHERE phone IS NOT NULL AND length(trim(phone)) = 0;

-- Helpers
CREATE OR REPLACE FUNCTION public.is_doctor_for_booking(_booking_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bookings b
    JOIN public.doctors d ON d.id = b.doctor_id
    WHERE b.id = _booking_id AND d.user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.is_doctor_owner(_doctor_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = _doctor_id AND d.user_id = auth.uid())
$$;

-- Bookings policies for doctors
DROP POLICY IF EXISTS "Doctors can view their bookings" ON public.bookings;
CREATE POLICY "Doctors can view their bookings" ON public.bookings
FOR SELECT TO authenticated USING (public.is_doctor_owner(doctor_id));

DROP POLICY IF EXISTS "Doctors can update their bookings" ON public.bookings;
CREATE POLICY "Doctors can update their bookings" ON public.bookings
FOR UPDATE TO authenticated
USING (public.is_doctor_owner(doctor_id))
WITH CHECK (public.is_doctor_owner(doctor_id));

-- Prescriptions policies
DROP POLICY IF EXISTS "Doctors can view their prescriptions" ON public.prescriptions;
CREATE POLICY "Doctors can view their prescriptions" ON public.prescriptions
FOR SELECT TO authenticated USING (public.is_doctor_owner(doctor_id));

DROP POLICY IF EXISTS "Doctors can create prescriptions" ON public.prescriptions;
CREATE POLICY "Doctors can create prescriptions" ON public.prescriptions
FOR INSERT TO authenticated
WITH CHECK (public.is_doctor_owner(doctor_id) AND public.is_doctor_for_booking(booking_id));

DROP POLICY IF EXISTS "Doctors can update their prescriptions" ON public.prescriptions;
CREATE POLICY "Doctors can update their prescriptions" ON public.prescriptions
FOR UPDATE TO authenticated
USING (public.is_doctor_owner(doctor_id))
WITH CHECK (public.is_doctor_owner(doctor_id));

DROP POLICY IF EXISTS "Doctors can delete their prescriptions" ON public.prescriptions;
CREATE POLICY "Doctors can delete their prescriptions" ON public.prescriptions
FOR DELETE TO authenticated USING (public.is_doctor_owner(doctor_id));

DROP POLICY IF EXISTS "Patients can view their prescriptions" ON public.prescriptions;
CREATE POLICY "Patients can view their prescriptions" ON public.prescriptions
FOR SELECT TO authenticated USING (auth.uid() = patient_id);

-- Unique phone (partial)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique_idx
  ON public.profiles (phone) WHERE phone IS NOT NULL;

-- Update handle_new_user to capture phone
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone), '')
  )
  ON CONFLICT (user_id) DO UPDATE
    SET full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
        phone = COALESCE(EXCLUDED.phone, public.profiles.phone);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();