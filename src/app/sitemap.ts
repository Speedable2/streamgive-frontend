import type { MetadataRoute } from 'next';

import { getNgos } from '@/lib/api';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001';

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/ngos`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/impact`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/apply`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];

  try {
    const list = await getNgos();
    const verifiedNgos = list.filter((ngo) => ngo.verified);

    const ngoPages: MetadataRoute.Sitemap = verifiedNgos.map((ngo) => ({
      url: `${baseUrl}/ngos/${ngo.id}`,
      lastModified: new Date(ngo.updatedAt),
      changeFrequency: 'daily',
      priority: 0.7,
    }));

    return [...staticPages, ...ngoPages];
  } catch {
    return staticPages;
  }
}
