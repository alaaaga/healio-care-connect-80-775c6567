CREATE TABLE public.user_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  name TEXT NOT NULL,
  email TEXT,
  question TEXT NOT NULL,
  answer TEXT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  answered_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.user_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a question"
ON public.user_questions FOR INSERT
WITH CHECK (true);

CREATE POLICY "Published questions visible to everyone"
ON public.user_questions FOR SELECT
USING (is_published = true);

CREATE POLICY "Admins can view all questions"
ON public.user_questions FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update questions"
ON public.user_questions FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete questions"
ON public.user_questions FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));