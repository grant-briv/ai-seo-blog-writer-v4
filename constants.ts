
import type { SocialMediaPlatform } from './types';

// Example constant (not strictly needed for this app yet, but good practice to have the file)
export const APP_VERSION = "1.0.0";

// Model names could be constants if used in multiple places and might change
export const DEFAULT_TEXT_MODEL = 'gemini-2.5-flash'; 
export const GEMINI_TEXT_MODEL = DEFAULT_TEXT_MODEL; 
export const IMAGE_GENERATION_MODEL = 'imagen-3.0-generate-002';


// SEO Length Constraints
export const META_DESCRIPTION_MAX_LENGTH = 160;
export const META_DESCRIPTION_MIN_LENGTH = 120;

export const TITLE_MAX_LENGTH = 70; // For H1
export const TITLE_MIN_LENGTH = 30; // For H1

export const META_TITLE_MAX_LENGTH = 60; // For HTML <title> tag
export const META_TITLE_MIN_LENGTH = 30; // For HTML <title> tag

// Knowledge Base Limits
export const KNOWLEDGE_BASE_MAX_CHARS = 300000; 
export const CHARS_PER_TOKEN_ESTIMATE = 4; 
export const KNOWLEDGE_BASE_MAX_TOKENS_ESTIMATE = Math.ceil(KNOWLEDGE_BASE_MAX_CHARS / CHARS_PER_TOKEN_ESTIMATE);

// Image Prompt Instructions Limits
export const IMAGE_PROMPT_INSTRUCTIONS_MAX_CHARS = 10000; 
export const IMAGE_PROMPT_INSTRUCTIONS_MAX_TOKENS_ESTIMATE = Math.ceil(IMAGE_PROMPT_INSTRUCTIONS_MAX_CHARS / CHARS_PER_TOKEN_ESTIMATE);


// Available Models for Writer Profiles
export const AVAILABLE_TEXT_MODELS = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
];

// Social Media Platforms for Social Post Generator
export const SOCIAL_MEDIA_PLATFORMS: SocialMediaPlatform[] = [
  { 
    id: 'twitter', 
    name: 'Twitter / X', 
    charLimit: 280, 
    notes: "Keep posts concise, use relevant hashtags, and aim for high engagement. Emojis are common." 
  },
  { 
    id: 'linkedin', 
    name: 'LinkedIn', 
    notes: "Professional tone, focus on insights, industry news, or career advice. Longer posts are acceptable. Use professional hashtags." 
  },
  { 
    id: 'facebook', 
    name: 'Facebook', 
    notes: "Versatile platform. Can be informal or informative. Visuals are important. Encourage discussion and sharing." 
  },
  {
    id: 'instagram_caption',
    name: 'Instagram Caption',
    notes: "Focus on a compelling caption to accompany an image (image will be separate). Use relevant hashtags, emojis, and a call to action if appropriate."
  }
];

// Add more constants as your application grows.