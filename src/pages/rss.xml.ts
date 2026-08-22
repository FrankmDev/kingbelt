import type { APIRoute } from 'astro';
import { siteUrl } from '@config/site';
import { blogPage, blogPosts, getBlogPostPath } from '@content/blog';
import { toCanonicalUrl } from '@shared/url';

export const prerender = true;

const escapeXml = (value: string): string =>
  value.replace(/[<>&'"]/g, (character) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;',
  }[character] ?? character));

export const GET: APIRoute = () => {
  const channelUrl = toCanonicalUrl(siteUrl, '/blog');
  const items = blogPosts
    .map((post) => {
      const url = toCanonicalUrl(siteUrl, getBlogPostPath(post));
      const pubDate = new Date(`${post.date}T00:00:00.000Z`).toUTCString();
      return [
        '<item>',
        `<title>${escapeXml(post.title)}</title>`,
        `<link>${escapeXml(url)}</link>`,
        `<guid isPermaLink="true">${escapeXml(url)}</guid>`,
        `<pubDate>${pubDate}</pubDate>`,
        `<category>${escapeXml(post.category)}</category>`,
        `<description>${escapeXml(post.excerpt)}</description>`,
        '</item>',
      ].join('');
    })
    .join('');

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '<channel>',
    `<title>${escapeXml(blogPage.meta.title)}</title>`,
    `<link>${escapeXml(channelUrl)}</link>`,
    `<description>${escapeXml(blogPage.meta.description)}</description>`,
    `<language>es-ES</language>`,
    `<atom:link href="${escapeXml(toCanonicalUrl(siteUrl, '/rss.xml'))}" rel="self" type="application/rss+xml"/>`,
    items,
    '</channel>',
    '</rss>',
  ].join('');

  return new Response(body, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=600, s-maxage=3600',
    },
  });
};
