
-- Add banned_until to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned_until timestamptz DEFAULT NULL;

-- Re-attach triggers that are missing (db-triggers shows none)
-- Attach handle_new_user trigger
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Attach assign_queue_position trigger
DROP TRIGGER IF EXISTS assign_queue_position_trigger ON public.bookings;
CREATE TRIGGER assign_queue_position_trigger
  BEFORE INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_queue_position();

-- Attach recalculate_queue_positions trigger  
DROP TRIGGER IF EXISTS recalculate_queue_trigger ON public.bookings;
CREATE TRIGGER recalculate_queue_trigger
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_queue_positions();

-- Attach booking notification triggers
DROP TRIGGER IF EXISTS notify_new_booking_trigger ON public.bookings;
CREATE TRIGGER notify_new_booking_trigger
  AFTER INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_booking();

DROP TRIGGER IF EXISTS notify_booking_status_trigger ON public.bookings;
CREATE TRIGGER notify_booking_status_trigger
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_booking_status_change();

-- Update recalculate_queue_positions to also notify patients
CREATE OR REPLACE FUNCTION public.recalculate_queue_positions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  avg_wait INTEGER := 15;
  rec RECORD;
  pos INTEGER := 0;
  doctor_name TEXT;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('cancelled', 'completed') THEN
    SELECT name INTO doctor_name FROM public.doctors WHERE id = NEW.doctor_id;

    FOR rec IN
      SELECT id, user_id
      FROM public.bookings
      WHERE doctor_id = NEW.doctor_id
        AND booking_date = NEW.booking_date
        AND booking_time = NEW.booking_time
        AND status NOT IN ('cancelled', 'completed')
      ORDER BY created_at ASC
    LOOP
      pos := pos + 1;
      UPDATE public.bookings
      SET queue_position = pos,
          estimated_wait = CASE WHEN pos > 1 THEN (pos - 1) * avg_wait || ' دقيقة' ELSE NULL END
      WHERE id = rec.id;

      -- Notify patient of updated queue position
      INSERT INTO public.notifications (user_id, message, type)
      VALUES (
        rec.user_id,
        'تم تحديث دورك في الطابور مع ' || COALESCE(doctor_name, 'الطبيب') || ' — موقعك الآن: ' || pos,
        'info'
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;
