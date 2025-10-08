-- Fix search_path for security
create or replace function public.set_updated_at()
returns trigger 
language plpgsql 
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end$$;
