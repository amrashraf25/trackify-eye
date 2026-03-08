
-- Create doctor behavior records table
CREATE TABLE public.doctor_behavior_records (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    doctor_id uuid NOT NULL,
    recorded_by uuid NOT NULL,
    action_name text NOT NULL,
    action_type text NOT NULL,
    score_change integer NOT NULL,
    notes text,
    week_number integer,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.doctor_behavior_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dean can manage doctor behavior records"
ON public.doctor_behavior_records
FOR ALL
USING (has_role(auth.uid(), 'dean'::app_role))
WITH CHECK (has_role(auth.uid(), 'dean'::app_role));

CREATE POLICY "Admin can view doctor behavior records"
ON public.doctor_behavior_records
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create doctor behavior scores table
CREATE TABLE public.doctor_behavior_scores (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    doctor_id uuid NOT NULL UNIQUE,
    score integer NOT NULL DEFAULT 100,
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.doctor_behavior_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dean can manage doctor behavior scores"
ON public.doctor_behavior_scores
FOR ALL
USING (has_role(auth.uid(), 'dean'::app_role))
WITH CHECK (has_role(auth.uid(), 'dean'::app_role));

CREATE POLICY "Admin can view doctor behavior scores"
ON public.doctor_behavior_scores
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger to auto-update doctor behavior score
CREATE OR REPLACE FUNCTION public.update_doctor_behavior_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_score INTEGER;
  new_score INTEGER;
BEGIN
  SELECT score INTO current_score FROM doctor_behavior_scores WHERE doctor_id = NEW.doctor_id;
  
  IF current_score IS NULL THEN
    INSERT INTO doctor_behavior_scores (doctor_id, score) VALUES (NEW.doctor_id, 100);
    current_score := 100;
  END IF;
  
  new_score := GREATEST(0, LEAST(100, current_score + NEW.score_change));
  UPDATE doctor_behavior_scores SET score = new_score, updated_at = now() WHERE doctor_id = NEW.doctor_id;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_doctor_behavior_score_trigger
AFTER INSERT ON public.doctor_behavior_records
FOR EACH ROW
EXECUTE FUNCTION public.update_doctor_behavior_score();
