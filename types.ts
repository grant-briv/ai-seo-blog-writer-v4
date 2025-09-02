


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

export interface AiWriterProfile {
  id: string;
  ownerId: string; // ID of the user who created/owns it
  agentName: string;
  coreInstructions: string;
  knowledgeDocumentsText: string; // For pasted text or URLs
  brandVoice: string;
  selectedModel?: string; // Added for model selection per profile
  imagePromptInstructions?: string; // For image generation guidelines
  sitemapPages?: { url: string; selected: boolean; }[];
  websiteContext?: string;
}

// Data structure for passing profile specifics to Gemini service
export interface WriterProfileData {
  coreInstructions?: string;
  knowledgeDocumentsText?: string;
  brandVoice?: string;
  selectedModel?: string; // Added for model selection
  imagePromptInstructions?: string; // For image generation guidelines
  websiteContext?: string;
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

// For Manager Approval Workflow
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

// For User Management
export interface User {
  id: string;
  username: string;
  password: string; // For demo purposes only. DO NOT use in production.
  role: 'admin' | 'general';
  assignedProfileIds: string[];
}

// For the External Link Suggester
export interface ExternalLinkSuggestion {
  url: string;
  anchorText: string;
  context: string; // The exact sentence in the blog post for replacement
}

// For Saved Blogs Feature
export interface SavedBlogState {
  seoSettings: SeoSettings;
  blogInputs: BlogInputs;
  mainContent: string;
  imagePrompt: string;
  imageRefinementInput: string;
  generatedImageUrl: string | null;
  approvalStatus: ApprovalStatus;
  currentRejectionReason: string | null;
  rejectionReasonInput: string;
  approvalTimestamp: string | null;
  selectedWriterProfileId: string | null;
  keywordAnalysisResult: KeywordVolumeAnalysisResult | null;
  socialPostSuggestions: string[];
  selectedSocialPlatform: SocialMediaPlatformSelection;
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
}

export interface GroundingSource {
  uri: string;
  title: string;
}

export interface GoogleNewsSearchResult {
  articles: Article[];
  groundingSources: GroundingSource[];
}
