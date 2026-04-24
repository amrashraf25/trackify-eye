
CREATE TRIGGER on_behavior_record_inserted
  AFTER INSERT ON public.behavior_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_behavior_score();
