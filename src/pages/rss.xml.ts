import { getCollection } from "astro:content";
import rss from "@astrojs/rss";
import type { APIRoute } from "astro";

import { postPath, publishedPosts } from "@/lib/blog";
import { site } from "@/lib/site";

export const GET: APIRoute = async (context) => {
  const posts = publishedPosts(await getCollection("blog"));

  return rss({
    title: site.writing.feedTitle,
    description: site.writing.feedDescription,
    site: context.site ?? site.url,
    // Matches the `directory` build format: every page lives at `/path/`.
    trailingSlash: true,
    customData: "<language>en</language>",
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: postPath(post.id),
    })),
  });
};
