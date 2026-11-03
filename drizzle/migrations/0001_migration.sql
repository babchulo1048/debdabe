
create policy "org files read" on storage.objects for select to authenticated
  using (bucket_id in ('letterheads','signatures','incoming-letters') and (storage.foldername(name))[1] = public.current_org()::text);
create policy "org files insert" on storage.objects for insert to authenticated
  with check (bucket_id in ('letterheads','signatures','incoming-letters') and (storage.foldername(name))[1] = public.current_org()::text);
create policy "org files update" on storage.objects for update to authenticated
  using (bucket_id in ('letterheads','signatures','incoming-letters') and (storage.foldername(name))[1] = public.current_org()::text);
create policy "org files delete" on storage.objects for delete to authenticated
  using (bucket_id in ('letterheads','signatures','incoming-letters') and (storage.foldername(name))[1] = public.current_org()::text);
