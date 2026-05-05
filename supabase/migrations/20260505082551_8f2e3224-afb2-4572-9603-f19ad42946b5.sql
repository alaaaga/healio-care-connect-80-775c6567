
-- Allow doctors to update their own record
CREATE POLICY "Doctors can update own record"
ON public.doctors
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
