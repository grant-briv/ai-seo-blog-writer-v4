
import React from 'react';
import DOMPurify from 'dompurify';

interface BlogPreviewProps {
  content: string;
}

export const BlogPreview: React.FC<BlogPreviewProps> = ({ content }) => {
  const sanitizedContent = DOMPurify.sanitize(content, {
    USE_PROFILES: { html: true }, 
    ADD_TAGS: ['iframe'], 
    ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling'] 
  });

  // By relying on the Tailwind 'prose' classes, we get consistent and beautiful
  // typography styling for the generated HTML. We've removed `max-w-none` to
  // restore the default readable content width, which is key for a good blog layout.
  // We also customize the link color to match the application's theme.
  return (
    <div 
      className="prose prose-lg prose-a:text-sky-700 hover:prose-a:text-sky-800" 
      dangerouslySetInnerHTML={{ __html: sanitizedContent }}
    />
  );
};
