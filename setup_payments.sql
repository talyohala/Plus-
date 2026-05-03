ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS building_id uuid REFERENCES public.buildings(id);
