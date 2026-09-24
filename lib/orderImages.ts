import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/** An order line as stored in orders.items (written by the payment backend; its shape varies). */
type Line = { id?: string; imageUrl?: string; image?: string; image_url?: string; image_urls?: string[] };

/** The image saved on the order line itself, when the backend stored one. */
export function lineImage(line: Line): string | undefined {
  return line.imageUrl ?? line.image ?? line.image_url ?? line.image_urls?.[0] ?? undefined;
}

/**
 * Order lines don't reliably carry an image, so look the products up by id
 * (one batched query, cached) and fall back to the catalogue's first photo.
 * Returns a resolver: `image(line)` → url | undefined.
 */
export function useOrderImages(lines: Line[]) {
  const ids = useMemo(
    () => [...new Set(lines.filter((l) => l.id && !lineImage(l)).map((l) => l.id as string))].sort(),
    [lines]
  );

  const { data } = useQuery({
    queryKey: ['order-item-images', ids],
    enabled: ids.length > 0,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('id, image_urls').in('id', ids);
      if (error) throw error;
      return new Map((data ?? []).map((p) => [p.id, p.image_urls?.[0] as string | undefined]));
    },
  });

  return (line: Line) => lineImage(line) ?? (line.id ? data?.get(line.id) : undefined);
}
