import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type Bucket = "letterheads" | "signatures" | "incoming-letters";

/** Upload a file under the organisation's folder; returns the storage path. */
export async function uploadOrgFile(bucket: Bucket, orgId: string, file: File, prefix: string) {
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const path = `${orgId}/${prefix}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
  if (error) throw error;
  return path;
}

/** Short-lived URL for a private file. Stored values that are already URLs pass through. */
export function useSignedUrl(bucket: Bucket, path: string | null | undefined) {
  return (
    useQuery({
      queryKey: ["signed-url", bucket, path],
      enabled: !!path,
      staleTime: 50 * 60 * 1000,
      queryFn: async () => {
        if (!path) return null;
        if (/^https?:\/\//.test(path)) return path;
        const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
        if (error) return null;
        return data.signedUrl;
      },
    }).data ?? null
  );
}
