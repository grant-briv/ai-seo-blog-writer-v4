

export interface SeoSettings {
  title: string; // This is for H1
  metaTitle: string; // This is for the HTML <title> tag
  focusKeywords: string;
  metaDescription: string;
  categories: string;
  tags: string;
  slug: string;
  blogPostUrl: string; // Base URL for the blog, e.g., https://yourdomain.com/blog/
  internalLinks: string[]; // Array for up to 4 internal links
  externalLinkKeywords: string[]; // For guiding the external link suggester
  minWordCount?: number;
  maxWordCount?: number;
}

export interface BlogInputs {
  transcripts: string;
  researchInfo: string;
  userInstructions: string;
}

export interface SuggestedSeoElements {
  suggestedTitle: string; // For H1
  suggestedMetaTitle: string; // For HTML <title> tag
  suggestedMetaDescription: string;
  suggestedSlug: string;
}

export interface KnowledgeDocument {
  id: string;
  name: string;
  type: 'text' | 'markdown' | 'pdf' | 'googledoc';
  content: string;
  originalUrl?: string; // For Google Docs
  uploadDate: number;
  size: number; // in characters
  metadata?: {
    title?: string;
    author?: string;
    pages?: number; // for PDFs
  };
}

export interface AiWriterProfile {
  id: string;
  ownerId: string; // ID of the user who created/owns it
  agentName: string;
  coreInstructions: string;
  knowledgeDocumentsText: string; // Legacy field for backward compatibility
  knowledgeDocuments?: KnowledgeDocument[]; // New enhanced knowledge base
  brandVoice: string;
  selectedModel?: string; // Added for model selection per profile
  selectedImageModel?: string; // Added for image model selection per profile
  imagePromptInstructions?: string; // For image generation guidelines
  sitemapPages?: { url: string; selected: boolean; }[];
  websiteContext?: string;
  websiteBlogUrl?: string; // Base URL for blog posts (e.g., https://domain.com/blog/, https://domain.com/news/)
  googleSearchConfig?: GoogleSearchConfig; // Profile-specific search configuration
  keywordsEverywhereConfig?: KeywordsEverywhereConfig; // Profile-specific keyword research configuration
  isPublic?: boolean; // Whether the profile is public (shareable) or private
}

// Google Search configuration for profiles
export interface GoogleSearchConfig {
  apiKey: string;
  searchEngineId: string;
  isEnabled: boolean;
}

// Keywords Everywhere configuration for profiles
export interface KeywordsEverywhereConfig {
  apiKey: string;
  isEnabled: boolean;
}

// Data structure for passing profile specifics to Gemini service
export interface WriterProfileData {
  coreInstructions?: string;
  knowledgeDocumentsText?: string;
  brandVoice?: string;
  selectedModel?: string; // Added for model selection
  selectedImageModel?: string; // Added for image model selection
  imagePromptInstructions?: string; // For image generation guidelines
  websiteContext?: string;
  websiteBlogUrl?: string; // Base URL for blog posts (e.g., https://domain.com/blog/, https://domain.com/news/)
  googleSearchConfig?: GoogleSearchConfig; // Profile-specific search configuration
  keywordsEverywhereConfig?: KeywordsEverywhereConfig; // Profile-specific keyword research configuration
}

// For Social Post Generator
export type SocialMediaPlatformSelection = 'twitter' | 'linkedin' | 'facebook' | 'instagram_caption';

export interface SocialMediaPlatform {
  id: SocialMediaPlatformSelection;
  name: string;
  charLimit?: number;
  notes?: string; // Specific notes for AI prompting for this platform
}

// For Keyword Volume Estimator
export interface KeywordAnalysis {
  keyword: string;
  estimatedVolume: string; // e.g., "Low", "Medium", "High", "Very High"
  notes?: string; // Optional notes for analyzed keywords
}

export interface SuggestedKeyword extends KeywordAnalysis {
  reason?: string; // Optional reason for suggestion
}

export interface KeywordVolumeAnalysisResult {
  analyzedKeywords: KeywordAnalysis[];
  suggestedKeywords: SuggestedKeyword[];
}

// For User Management
export interface User {
  id: string;
  username: string;
  password: string; // For demo purposes only. DO NOT use in production.
  role: 'admin' | 'general';
  assignedProfileIds: string[];
  email?: string; // Email address for invitations and password reset
  resetToken?: string; // Temporary password reset token
  isTemporaryPassword?: boolean; // Flag to indicate if password needs to be changed
}

// For the External Link Suggester
export interface ExternalLinkSuggestion {
  url: string;
  anchorText: string;
  context: string; // The exact sentence in the blog post for replacement
  title?: string; // Optional title from search result
  domain?: string; // Optional domain for display
  snippet?: string; // Optional snippet for context
}

// For Saved Blogs Feature
export interface SavedBlogState {
  seoSettings: SeoSettings;
  blogInputs: BlogInputs;
  mainContent: string;
  imagePrompt: string;
  imageRefinementInput: string;
  generatedImageUrl: string | null;
  selectedWriterProfileId: string | null;
  keywordAnalysisResult: KeywordVolumeAnalysisResult | null;
  socialPostSuggestions: { platform: string; posts: string[] }[];
  selectedSocialPlatforms: SocialMediaPlatformSelection[];
  externalLinkSuggestions: ExternalLinkSuggestion[];
}

export interface SavedBlogPost {
  id: string; // Unique ID for this saved instance
  userId: string; // The user who saved it
  savedAt: string; // ISO string timestamp
  blogTitle: string; // For easy display in the list
  appState: SavedBlogState;
}

// For Topic Finder
export interface ArticleStats {
  estimatedEngagementScore: number; // Score from 0 to 100
  sentiment: 'Positive' | 'Negative' | 'Neutral' | 'Mixed';
  keyTakeaways: string[];
  potentialAngles: string[];
}

export interface Article {
  title: string;
  link: string;
  snippet: string;
  stats?: ArticleStats;
  source?: string; // 'Google News', 'Reddit', 'Twitter', etc.
}

export interface GroundingSource {
  uri: string;
  title: string;
}

export interface GoogleNewsSearchResult {
  articles: Article[];
  groundingSources: GroundingSource[];
}

export interface TrendAnalysis {
  trendScore: number;
  trendDirection: 'rising' | 'declining' | 'stable';
  keyInsights: string[];
}

export interface EnhancedSearchResult {
  articles: Article[];
  groundingSources: GroundingSource[];
  trendAnalysis: TrendAnalysis;
  diverseSources: {
    reddit: Article[];
    twitter: Article[];
  };
}

// Content Structure Enhancement Types
export interface ContentStructureAnalysis {
  issues: string[];
  suggestions: string[];
  improvedStructure?: string;
}

export interface IntroductionOptimization {
  optimizedIntro: string;
  keywordsIncluded: number;
  hookType: 'statistic' | 'question' | 'bold_statement' | 'story';
}

export interface ConclusionWithCTA {
  conclusion: string;
  ctaType: 'engagement' | 'educational' | 'social' | 'action';
  keywordReinforcement: boolean;
}
