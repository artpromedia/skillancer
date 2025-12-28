import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://skillancer.com';

  const staticPages = [
    '',
    '/skillpod',
    '/smartmatch',
    '/cockpit',
    '/verify',
    '/for-freelancers',
    '/for-clients',
    '/enterprise',
    '/pricing',
    '/blog',
    '/help',
    '/terms',
    '/privacy',
    '/security',
    '/signup',
    '/login',
  ];

  const staticEntries: MetadataRoute.Sitemap = staticPages.map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: path === '' ? 'daily' : 'weekly',
    priority: path === '' ? 1 : path.includes('pricing') ? 0.9 : 0.8,
  }));

  // TODO: Add dynamic blog posts from CMS
  // const blogPosts = await getBlogPosts();
  // const blogEntries = blogPosts.map(post => ({
  //   url: `${baseUrl}/blog/${post.slug}`,
  //   lastModified: post.updatedAt,
  //   changeFrequency: 'monthly',
  //   priority: 0.6,
  // }));

  return [...staticEntries];
}
