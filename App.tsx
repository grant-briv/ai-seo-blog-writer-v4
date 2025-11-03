



import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { TextInput } from './components/TextInput';
import { TextAreaInput } from './components/TextAreaInput';
import { Button } from './components/Button';
import { SectionCard } from './components/SectionCard';
import { BlogPreview } from './components/BlogPreview';
import { ContentEnhancementUI } from './components/ContentEnhancementUI';
import { KeywordResearch } from './components/KeywordResearch';
import PasswordResetForm from './components/PasswordResetForm';
import {
  generateBlogPost,
  generateImprovedHeadline,
  generateMetaAndSlug,
  generateImagePromptIdea,
  refineGeneratedImagePrompt,
  generateImageFromFinalPrompt,
  generateSocialMediaPosts,
  estimateKeywordVolumeAndSuggest,
  improveKeywordDensity,
  suggestInternalLinks,
  suggestExternalLinks,
  generateCategoriesAndTags,
  RateLimitError, // Import the custom error
} from './services/geminiService';
import { LoadingSpinner } from './components/LoadingSpinner';
import {
  WordpressIcon, CopyIcon, SparklesIcon, LightBulbIcon, DocumentTextIcon,
  SearchCircleIcon, CogIcon, UserCircleIcon, ArrowLeftIcon, ImageIcon, DownloadIcon,
  ShareIcon, LinkIcon, ChartBarIcon, TrendingUpIcon,
  DocumentDuplicateIcon, ArrowUpCircleIcon, BookmarkSquareIcon,
  GlobeAltIcon,
  ArrowTopRightOnSquareIcon
} from './components/Icons';
import type {
  SeoSettings, BlogInputs, SuggestedSeoElements, AiWriterProfile,
  WriterProfileData, SocialMediaPlatformSelection, KeywordVolumeAnalysisResult,
  User, SavedBlogPost, SavedBlogState, ExternalLinkSuggestion
} from './types';
import { AdminPage } from './components/AdminPage';
import { WriterProfileSelector } from './components/WriterProfileSelector';
import { DEFAULT_TEXT_MODEL, SOCIAL_MEDIA_PLATFORMS, TITLE_MAX_LENGTH, META_TITLE_MAX_LENGTH, META_DESCRIPTION_MAX_LENGTH } from './constants';
import { validatePasswordStrength } from './services/passwordValidation';
import { apiClient } from './services/apiClient';
// Removed migration imports - using API backend now
// No longer using IndexedDB for API keys - using environment variables
import { saveBlogPost, deleteBlogPost } from './services/blogStorageService';
import { getWriterProfiles, saveWriterProfiles, getSelectedWriterProfileId, setSelectedWriterProfileId } from './services/writerProfileService';
import { TopicFinder } from './components/TopicFinder';
import { WriterProfileManager } from './components/WriterProfileManager';
import { SavedBlogsManager } from './components/SavedBlogsManager';


// --- Helper Functions ---

const stripHtml = (html: string): string => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || "";
};

const generateSlug = (title: string): string => {
  if (!title) return '';
  return title
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/-+/g, '-')
    .substring(0, 75);
};


// --- Login Page Component ---

const LoginPage: React.FC<{ onLogin: (user: User) => void; }> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetResult, setResetResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const result = await apiClient.login(username, password);
      if (result.success && result.user && result.token) {
        // Token is automatically stored by apiClient.login()
        onLogin(result.user);
      } else {
        setError('Invalid username or password.');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('An error occurred during login. Please try again.');
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      setResetResult({ success: false, message: 'Please enter your email address' });
      return;
    }

    setIsResetting(true);
    setResetResult(null);

    try {
      // Import emailApiService dynamically
      const { emailApiService } = await import('./services/emailApiService');
      
      // For password reset, backend will get email config from admin settings
      const result = await emailApiService.sendPasswordReset({
        email: resetEmail.trim()
      });

      setResetResult(result);
      
      // Log detailed error for debugging
      if (!result.success) {
        console.error('Password reset failed:', result);
      }
    } catch (error: any) {
      console.error('Password reset error:', error);
      setResetResult({
        success: false,
        message: error.message || 'Failed to send password reset email'
      });
    } finally {
      setIsResetting(false);
    }
  };

  if (showForgotPassword) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 font-montserrat">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-place-teal mb-4">Password Reset</h1>
            <p className="text-gray-600">Enter your email address to receive a password reset link</p>
          </div>
          
          <form onSubmit={handlePasswordReset} className="space-y-4">
            <div>
              <label htmlFor="resetEmail" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                id="resetEmail"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="Enter your email address"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-place-teal focus:border-place-teal"
                disabled={isResetting}
                required
              />
            </div>
            
            {resetResult && (
              <div className={`p-3 rounded-md text-sm ${
                resetResult.success 
                  ? 'bg-green-50 border border-green-200 text-green-800' 
                  : 'bg-red-50 border border-red-200 text-red-800'
              }`}>
                {resetResult.message}
              </div>
            )}
            
            <div className="space-y-3">
              <Button 
                type="submit" 
                disabled={isResetting || !resetEmail.trim()}
                className="w-full btn btn-primary"
              >
                {isResetting ? 'Sending Reset Link...' : 'Send Reset Link'}
              </Button>
              
              <Button 
                type="button" 
                onClick={() => {
                  setShowForgotPassword(false);
                  setResetEmail('');
                  setResetResult(null);
                }} 
                className="w-full btn btn-secondary"
              >
                Back to Login
              </Button>
            </div>
          </form>
          
          <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg text-sm">
            <p><strong>Security Note:</strong> Password reset links expire in 1 hour. If you don't receive the email, check your spam folder or contact your administrator.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 font-montserrat">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 space-y-6">
        <div className="text-center">
          <div className="text-center mb-4">
            <h1 className="text-3xl font-bold text-gray-900">
              PLACE
            </h1>
          </div>
          <p className="text-gray-600">Please sign in to continue</p>
        </div>
        <div className="bg-teal-50 border border-place-teal text-teal-800 px-4 py-3 rounded-lg text-sm" role="alert">
          <p><strong className="font-bold">Production Authentication:</strong> Uses bcrypt password hashing and secure session management.</p>
          <p className="mt-1">Default Admin: <code>admin</code> / <code>SecureAdmin123!</code></p>
          <p className="mt-1 text-xs"><strong>Important:</strong> Change the default password after first login.</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-6">
          <TextInput
            label="Username"
            name="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g., admin"
            isRequired
          />
          <TextInput
            label="Password"
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            isRequired
          />
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <Button type="submit" className="w-full btn btn-primary text-base">
            Sign In
          </Button>
        </form>
        <div className="text-center">
          <button
            type="button"
            onClick={() => setShowForgotPassword(true)}
            className="text-sm text-place-teal hover:text-place-teal-dark underline"
          >
            Forgot your password?
          </button>
        </div>
      </div>
    </div>
  );
};


// --- Main Application Component ---
const MainApplication: React.FC<{ currentUser: User; onLogout: () => void }> = ({ currentUser, onLogout }) => {
  // Main state
  const [seoSettings, setSeoSettings] = useState<SeoSettings>({
    title: '',
    metaTitle: '',
    focusKeywords: '',
    metaDescription: '',
    categories: '',
    tags: '',
    slug: '',
    blogPostUrl: '',
    internalLinks: ['', '', '', ''],
    externalLinkKeywords: ['', '', ''],
    minWordCount: undefined,
    maxWordCount: undefined,
  });
  const [blogInputs, setBlogInputs] = useState<BlogInputs>({
    transcripts: '',
    researchInfo: '',
    userInstructions: '',
  });
  const [mainContent, setMainContent] = useState<string>('');
  
  const [wordCount, setWordCount] = useState<number>(0);
  const [keywordDensity, setKeywordDensity] = useState<{ keyword: string; density: string; numericDensity: number; } | null>(null);
  
  // Loading states
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isGeneratingHeadline, setIsGeneratingHeadline] = useState<boolean>(false);
  const [isGeneratingMeta, setIsGeneratingMeta] = useState<boolean>(false);
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState<boolean>(false);
  const [isRefiningPrompt, setIsRefiningPrompt] = useState<boolean>(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState<boolean>(false);
  const [isGeneratingSocial, setIsGeneratingSocial] = useState<boolean>(false);
  const [isEstimatingKeywords, setIsEstimatingKeywords] = useState<boolean>(false);
  const [isImprovingDensity, setIsImprovingDensity] = useState<boolean>(false);
  const [isSuggestingLinks, setIsSuggestingLinks] = useState<boolean>(false);
  const [isSuggestingExternalLinks, setIsSuggestingExternalLinks] = useState<boolean>(false);

  const [error, setError] = useState<string | null>(null);

  // Navigation state
  const [currentView, setCurrentView] = useState<'main' | 'admin'>('main');
  const [activeTab, setActiveTab] = useState<'write' | 'topics' | 'keywords' | 'profiles' | 'blogs'>('profiles');

  // Profiles state
  const [writerProfiles, setWriterProfiles] = useState<AiWriterProfile[]>([]);
  const [lastSaveTimestamp, setLastSaveTimestamp] = useState(0);
  const [selectedWriterProfileId, setSelectedWriterProfileId] = useState<string | null>(null);

  // Feature-specific state
  const [imagePrompt, setImagePrompt] = useState<string>('');
  const [imageRefinementInput, setImageRefinementInput] = useState<string>('');
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [imageGenError, setImageGenError] = useState<string | null>(null);

  const [selectedSocialPlatforms, setSelectedSocialPlatforms] = useState<SocialMediaPlatformSelection[]>([]);
  const [socialPostSuggestions, setSocialPostSuggestions] = useState<{ platform: string; posts: string[] }[]>([]);
  const [socialPostError, setSocialPostError] = useState<string | null>(null);

  const [keywordAnalysisResult, setKeywordAnalysisResult] = useState<KeywordVolumeAnalysisResult | null>(null);
  const [keywordAnalysisError, setKeywordAnalysisError] = useState<string | null>(null);
  const [selectedKeywordForTopic, setSelectedKeywordForTopic] = useState<string>('');
  
  const [externalLinkSuggestions, setExternalLinkSuggestions] = useState<ExternalLinkSuggestion[]>([]);
  const [externalLinkError, setExternalLinkError] = useState<string | null>(null);

  // Saved blog state
  const [savedBlogId, setSavedBlogId] = useState<string | null>(null);


  useEffect(() => {
    const loadProfiles = async () => {
      try {
        console.log('🔄 Loading writer profiles for authenticated user...');
        const profiles = await getWriterProfiles();
        const updatedProfiles = profiles.map(p => ({
          ...p,
          selectedModel: p.selectedModel || DEFAULT_TEXT_MODEL,
          imagePromptInstructions: p.imagePromptInstructions || '',
          ownerId: p.ownerId || 'admin-001',
          sitemapPages: p.sitemapPages || [],
          websiteContext: p.websiteContext || '',
          websiteBlogUrl: p.websiteBlogUrl || '',
        }));
        setWriterProfiles(updatedProfiles);
        console.log(`✅ Loaded ${updatedProfiles.length} writer profiles`);
        
        const selectedId = await getSelectedWriterProfileId();
        if (selectedId) {
          setSelectedWriterProfileId(selectedId);
        }
        
        // Clear any previous errors
        setError(null);
      } catch (e) {
        console.error("Error loading profiles from database:", e);
        if (e.message && e.message.includes('not authenticated')) {
          setError("Session expired. Please log in again to access writer profiles.");
        } else {
          setError("Could not load writer profiles. Please check your connection and try again.");
        }
      }
    };
    
    // Only load profiles if we have a current user (authenticated)
    if (currentUser) {
      loadProfiles();
    } else {
      console.log('⏳ Waiting for user authentication before loading profiles...');
    }
  }, [currentUser]); // Depend on currentUser instead of empty array

  // Removed problematic auto-save useEffect that was causing duplicate profiles
  // Writer profiles are now saved explicitly when users create/edit them in WriterProfileManager

  useEffect(() => {
    const saveSelectedProfile = async () => {
      try {
        await setSelectedWriterProfileId(selectedWriterProfileId);
      } catch (e) {
        console.error("Error saving selected profile to database:", e);
      }
    };
    saveSelectedProfile();
  }, [selectedWriterProfileId]);

    const visibleWriterProfiles = useMemo(() => {
      if (currentUser.role === 'admin') {
          return writerProfiles;
      }
      const assignedIds = Array.isArray(currentUser.assignedProfileIds) ? currentUser.assignedProfileIds : [];
      return writerProfiles.filter(p => {
          const isOwner = p.ownerId === currentUser.id;
          const isAssigned = assignedIds.includes(p.id);
          const isPublic = p.isPublic === true;
          return isOwner || isAssigned || isPublic;
      });
  }, [currentUser, writerProfiles]);

  const activeWriterProfile = useMemo(() => {
    if (!selectedWriterProfileId) return null;
    return writerProfiles.find(p => p.id === selectedWriterProfileId) || null;
  }, [selectedWriterProfileId, writerProfiles]);

  const getActiveProfileData = useCallback((): WriterProfileData | undefined => {
    if (!activeWriterProfile) return undefined;
    return {
      coreInstructions: activeWriterProfile.coreInstructions,
      knowledgeDocumentsText: activeWriterProfile.knowledgeDocumentsText,
      brandVoice: activeWriterProfile.brandVoice,
      selectedModel: activeWriterProfile.selectedModel || DEFAULT_TEXT_MODEL,
      imagePromptInstructions: activeWriterProfile.imagePromptInstructions,
      websiteContext: activeWriterProfile.websiteContext,
      websiteBlogUrl: activeWriterProfile.websiteBlogUrl,
      googleSearchConfig: activeWriterProfile.googleSearchConfig,
      keywordsEverywhereConfig: activeWriterProfile.keywordsEverywhereConfig,
    };
  }, [activeWriterProfile]);


  const handleSeoInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setSeoSettings(prev => {
      let newFieldValue: string | number | undefined = value;
      if (type === 'number') {
        newFieldValue = value === '' ? undefined : parseInt(value, 10);
        if (isNaN(newFieldValue as number)) {
            newFieldValue = undefined;
        }
      }

      const newState = { ...prev, [name]: newFieldValue };
      if (name === 'title') {
        newState.slug = generateSlug(value);
      }
      return newState;
    });
  }, []);

  const handleLinkChange = useCallback((index: number, type: 'internalLinks', value: string) => {
    setSeoSettings(prev => {
      const newLinks = [...prev[type]];
      newLinks[index] = value;
      return {
        ...prev,
        [type]: newLinks
      };
    });
  }, []);
  
  const handleExternalKeywordChange = useCallback((index: number, value: string) => {
    setSeoSettings(prev => {
      const newKeywords = [...prev.externalLinkKeywords];
      newKeywords[index] = value;
      return {
        ...prev,
        externalLinkKeywords: newKeywords
      };
    });
  }, []);

  const handleBlogInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setBlogInputs(prev => ({ ...prev, [name]: value }));
  }, []);
  
  const handleMainContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMainContent(e.target.value);
  }, []);

  useEffect(() => {
    if (!mainContent) {
      setWordCount(0);
      setKeywordDensity(null);
    } else {
      const plainText = stripHtml(mainContent);
      const contentWords = plainText.split(/\s+/).filter(Boolean);
      const currentWordCount = contentWords.length;
      setWordCount(currentWordCount);

      const firstFocusKeywordOriginalCase = seoSettings.focusKeywords.split(',')[0]?.trim();

      if (firstFocusKeywordOriginalCase && currentWordCount > 0) {
        const lowercasedPlainText = plainText.toLowerCase();
        const lowercasedFirstFocusKeyword = firstFocusKeywordOriginalCase.toLowerCase();
        
        const escapeRegExp = (string: string): string => {
          return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        };

        try {
          const keywordRegex = new RegExp(`\\b${escapeRegExp(lowercasedFirstFocusKeyword)}\\b`, 'gi');
          const matches = lowercasedPlainText.match(keywordRegex);
          const keywordOccurrences = matches ? matches.length : 0;
          
          let rawDensity = (keywordOccurrences / currentWordCount) * 100;
          let cappedDensity = rawDensity > 1.5 ? 1.5 : rawDensity;
          let densityDisplayValue = rawDensity > 1.5 ? '1.50% (capped)' : rawDensity.toFixed(2) + '%';
          setKeywordDensity({ keyword: firstFocusKeywordOriginalCase, density: densityDisplayValue, numericDensity: cappedDensity });

        } catch (regexError) {
            console.error("Error creating regex for keyword density:", regexError);
            setKeywordDensity(null);
        }
      } else {
        setKeywordDensity(null);
      }
    }
  }, [mainContent, seoSettings.focusKeywords]);


  // Helper function to generate category and tag suggestions
  const generateCategoryTagSuggestions = useCallback(async (content: string, focusKeywords: string, profileData: WriterProfileData) => {
    try {
      console.log('🏷️ Calling generateCategoriesAndTags API...');
      const suggestions = await generateCategoriesAndTags(content, focusKeywords, profileData);
      console.log('🏷️ Received suggestions:', suggestions);
      
      setSeoSettings(prev => ({
        ...prev,
        categories: prev.categories?.trim() || suggestions.categories,
        tags: prev.tags?.trim() || suggestions.tags
      }));
      console.log('🏷️ Updated SEO settings with suggestions');
    } catch (error) {
      console.error('❌ Error generating category/tag suggestions:', error);
      // Fail silently - this is just a convenience feature
    }
  }, []);

  const handleGeneratePost = useCallback(async () => {
    if (!seoSettings.title || !seoSettings.focusKeywords) {
      setError("Please provide at least a Blog Post Title (H1) and Focus Keywords.");
      return;
    }
    if (!selectedWriterProfileId || !activeWriterProfile) {
      setError("Please select an Active AI Writer Profile before generating a blog post.");
      return;
    }
    if (seoSettings.minWordCount && seoSettings.maxWordCount && seoSettings.minWordCount > seoSettings.maxWordCount) {
      setError("Minimum word count cannot be greater than maximum word count.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setSavedBlogId(null); // New generation is a new blog
    try {
      const profileData = getActiveProfileData();
      const content = await generateBlogPost(seoSettings, blogInputs, profileData);
      setMainContent(content);

      // Auto-populate Blog Post Base URL from Profile
      if (activeWriterProfile?.websiteBlogUrl && !seoSettings.blogPostUrl) {
        setSeoSettings(prev => ({
          ...prev,
          blogPostUrl: activeWriterProfile.websiteBlogUrl
        }));
      }
      
      // Generate AI suggestions for categories and tags if not already filled
      if (profileData && (!seoSettings.categories?.trim() || !seoSettings.tags?.trim())) {
        console.log('🏷️ Generating categories and tags suggestions...');
        generateCategoryTagSuggestions(content, seoSettings.focusKeywords, profileData);
      }
    } catch (err) {
      if (err instanceof RateLimitError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to generate blog post.');
      }
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [seoSettings, blogInputs, getActiveProfileData]);

  const handleGenerateHeadline = useCallback(async () => {
    if (!mainContent) {
        setError("Please generate blog content first to create a headline from.");
        return;
    }
    setIsGeneratingHeadline(true);
    setError(null);
    try {
        const profileData = getActiveProfileData();
        const newHeadline = await generateImprovedHeadline(mainContent, seoSettings.title, profileData);
        setSeoSettings(prev => ({
            ...prev,
            title: newHeadline,
            slug: generateSlug(newHeadline)
        }));
    } catch (err) {
        if (err instanceof RateLimitError) {
          setError(err.message);
        } else {
          setError(err instanceof Error ? err.message : 'Failed to generate improved headline.');
        }
        console.error(err);
    } finally {
        setIsGeneratingHeadline(false);
    }
  }, [mainContent, seoSettings.title, getActiveProfileData]);

  const handleGenerateMeta = useCallback(async () => {
    if (!mainContent || !seoSettings.focusKeywords) {
      setError("Please generate or write blog content and provide Focus Keywords first.");
      return;
    }
    if (!seoSettings.title && !seoSettings.metaTitle) {
      setError("Please provide at least a Blog Post Title (H1) or Meta Title before suggesting meta information.");
      return;
    }
    setIsGeneratingMeta(true);
    setError(null);
    try {
      const profileData = getActiveProfileData();
      const suggestions: SuggestedSeoElements = await generateMetaAndSlug(
        mainContent,
        seoSettings.title,
        seoSettings.metaTitle,
        seoSettings.focusKeywords,
        profileData
      );
      setSeoSettings(prev => ({
        ...prev,
        metaTitle: suggestions.suggestedMetaTitle || prev.metaTitle,
        metaDescription: suggestions.suggestedMetaDescription,
        slug: suggestions.suggestedSlug || generateSlug(suggestions.suggestedTitle || prev.title)
      }));
    } catch (err) {
      if (err instanceof RateLimitError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to generate meta description, titles, and slug.');
      }
      console.error(err);
    } finally {
      setIsGeneratingMeta(false);
    }
  }, [mainContent, seoSettings.focusKeywords, seoSettings.title, seoSettings.metaTitle, getActiveProfileData]);
  
  const copyToClipboard = useCallback((text: string, typeForAlert: string) => {
    navigator.clipboard.writeText(text)
      .then(() => alert(`${typeForAlert} copied to clipboard!`))
      .catch(err => {
        console.error(`Failed to copy ${typeForAlert}: `, err);
        alert(`Failed to copy ${typeForAlert}. See console for details.`);
      });
  }, []);

  const handleCopyToGoogleDocs = useCallback(async () => {
    if (!mainContent) {
        alert("No content to copy.");
        return;
    }

    // Sanitize the HTML for export. This is less restrictive than the preview sanitization
    // to allow for more flexible pasting into Google Docs, which has its own sanitizer.
    const finalHtmlForGDocs = DOMPurify.sanitize(mainContent, { USE_PROFILES: { html: true } });

    try {
        // Check for ClipboardItem support for robustness.
        if (typeof ClipboardItem === "undefined") {
            throw new Error("ClipboardItem API is not supported in this browser.");
        }

        const blobHtml = new Blob([finalHtmlForGDocs], { type: 'text/html' });
        const plainText = stripHtml(finalHtmlForGDocs);
        const blobText = new Blob([plainText], { type: 'text/plain' });

        const clipboardItem = new ClipboardItem({
            'text/html': blobHtml,
            'text/plain': blobText,
        });

        await navigator.clipboard.write([clipboardItem]);

        alert('Content copied for Google Docs! You can now paste it with formatting.');
    } catch (err) {
        console.error('Failed to copy for Google Docs: ', err);
        alert('Failed to copy content with formatting. This feature may not be supported by your browser. See console for details.');
    }
  }, [mainContent]);

  const handleGenerateImagePromptIdea = useCallback(async () => {
    if (!mainContent) {
      setImageGenError("Please generate or write blog content first to base the image prompt on.");
      return;
    }
    setIsGeneratingPrompt(true);
    setImageGenError(null);
    setGeneratedImageUrl(null);
    try {
      const profileData = getActiveProfileData();
      const idea = await generateImagePromptIdea(mainContent, profileData);
      setImagePrompt(idea);
    } catch (err) {
      if (err instanceof RateLimitError) {
        setImageGenError(err.message);
      } else {
        setImageGenError(err instanceof Error ? err.message : 'Failed to generate image prompt idea.');
      }
      console.error(err);
    } finally {
      setIsGeneratingPrompt(false);
    }
  }, [mainContent, getActiveProfileData]);

  const handleRefineImagePrompt = useCallback(async () => {
    if (!imagePrompt || !imageRefinementInput) {
      setImageGenError("Please generate an initial prompt and provide refinement instructions.");
      return;
    }
    setIsRefiningPrompt(true);
    setImageGenError(null);
    try {
      const profileData = getActiveProfileData();
      const refined = await refineGeneratedImagePrompt(imagePrompt, imageRefinementInput, profileData);
      setImagePrompt(refined);
      setImageRefinementInput('');
    } catch (err) {
      if (err instanceof RateLimitError) {
        setImageGenError(err.message);
      } else {
        setImageGenError(err instanceof Error ? err.message : 'Failed to refine image prompt.');
      }
      console.error(err);
    } finally {
      setIsRefiningPrompt(false);
    }
  }, [imagePrompt, imageRefinementInput, getActiveProfileData]);

  const handleGenerateFinalImage = useCallback(async () => {
    if (!imagePrompt) {
      setImageGenError("Please generate or write an image prompt first.");
      return;
    }
    setIsGeneratingImage(true);
    setImageGenError(null);
    setGeneratedImageUrl(null);
    try {
      const base64Image = await generateImageFromFinalPrompt(imagePrompt);
      setGeneratedImageUrl(`data:image/jpeg;base64,${base64Image}`);
    } catch (err) {
      if (err instanceof RateLimitError) {
        setImageGenError(err.message);
      } else {
        setImageGenError(err instanceof Error ? err.message : 'Failed to generate image.');
      }
      console.error(err);
    } finally {
      setIsGeneratingImage(false);
    }
  }, [imagePrompt]);
  
  const handleDownloadImage = useCallback(() => {
    if (!generatedImageUrl) return;
    const link = document.createElement('a');
    link.href = generatedImageUrl;
    const filename = seoSettings.slug ? seoSettings.slug + '_feature.jpg' : 'generated_image.jpg';
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [generatedImageUrl, seoSettings.slug]);

  const handleGenerateSocialPosts = useCallback(async () => {
    if (!mainContent) {
      setSocialPostError("Please generate or write blog content first.");
      return;
    }
    if (!seoSettings.title) {
      setSocialPostError("Please provide a Blog Post Title (H1) first.");
      return;
    }
    if (!seoSettings.blogPostUrl) {
      setSocialPostError("Please provide the Blog Post Base URL in SEO Settings.");
      return;
    }
    if (!seoSettings.slug) {
      setSocialPostError("Please ensure a Slug (URL part) is set or generated in SEO Settings.");
      return;
    }
    if (selectedSocialPlatforms.length === 0) {
      setSocialPostError("Please select at least one social media platform.");
      return;
    }
    setIsGeneratingSocial(true);
    setSocialPostError(null);
    setSocialPostSuggestions([]);
    try {
      const profileData = getActiveProfileData();
      const allPlatformPosts: { platform: string; posts: string[] }[] = [];

      // Generate posts for each selected platform
      for (const platformId of selectedSocialPlatforms) {
        const platformInfo = SOCIAL_MEDIA_PLATFORMS.find(p => p.id === platformId);
        if (platformInfo) {
          const posts = await generateSocialMediaPosts(
            mainContent,
            seoSettings,
            platformInfo,
            profileData
          );
          allPlatformPosts.push({
            platform: platformInfo.name,
            posts
          });
        }
      }

      setSocialPostSuggestions(allPlatformPosts);
    } catch (err) {
      if (err instanceof RateLimitError) {
        setSocialPostError(err.message);
      } else {
        setSocialPostError(err instanceof Error ? err.message : 'Failed to generate social media posts.');
      }
      console.error(err);
    } finally {
      setIsGeneratingSocial(false);
    }
  }, [mainContent, seoSettings, selectedSocialPlatforms, getActiveProfileData]);

  const handleEstimateKeywordVolume = useCallback(async () => {
    if (!seoSettings.focusKeywords) {
      setKeywordAnalysisError("Please enter some focus keywords to analyze.");
      return;
    }
    setIsEstimatingKeywords(true);
    setKeywordAnalysisError(null);
    setKeywordAnalysisResult(null);
    try {
      const profileData = getActiveProfileData();
      const result = await estimateKeywordVolumeAndSuggest(seoSettings.focusKeywords, profileData);
      setKeywordAnalysisResult(result);
    } catch (err) {
      if (err instanceof RateLimitError) {
        setKeywordAnalysisError(err.message);
      } else {
        setKeywordAnalysisError(err instanceof Error ? err.message : 'Failed to estimate keyword volume.');
      }
      console.error(err);
    } finally {
      setIsEstimatingKeywords(false);
    }
  }, [seoSettings.focusKeywords, getActiveProfileData]);

  const handleReplaceKeyword = useCallback((newKeyword: string, isAddition: boolean = false) => {
    setSeoSettings(prev => {
      let newFocusKeywords: string;
      
      if (isAddition) {
        // Add to existing keywords
        const existingKeywords = prev.focusKeywords.split(',').map(k => k.trim()).filter(Boolean);
        if (!existingKeywords.includes(newKeyword)) {
          newFocusKeywords = [...existingKeywords, newKeyword].join(', ');
        } else {
          // Keyword already exists
          return prev;
        }
      } else {
        // Replace the first keyword (primary focus keyword)
        const keywordList = prev.focusKeywords.split(',').map(k => k.trim()).filter(Boolean);
        keywordList[0] = newKeyword;
        newFocusKeywords = keywordList.join(', ');
      }

      return {
        ...prev,
        focusKeywords: newFocusKeywords
      };
    });
    
    // Show confirmation message
    const action = isAddition ? 'added to' : 'replaced in';
    alert(`"${newKeyword}" has been ${action} your focus keywords!`);
  }, []);

  const handleImproveKeywordDensity = useCallback(async () => {
    if (!mainContent || !keywordDensity || !seoSettings.focusKeywords) {
      setError("Cannot improve density without content, focus keyword, and current density calculation.");
      return;
    }
    const primaryKeyword = seoSettings.focusKeywords.split(',')[0]?.trim();
    if (!primaryKeyword) {
        setError("Primary focus keyword is not defined.");
        return;
    }

    setIsImprovingDensity(true);
    setError(null);
    try {
      const profileData = getActiveProfileData();
      const revisedContent = await improveKeywordDensity(
        mainContent,
        primaryKeyword,
        wordCount,
        profileData,
        { minWordCount: seoSettings.minWordCount, maxWordCount: seoSettings.maxWordCount }
      );
      setMainContent(revisedContent);
    } catch (err) {
      if (err instanceof RateLimitError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to improve keyword density.');
      }
      console.error(err);
    } finally {
      setIsImprovingDensity(false);
    }
  }, [mainContent, keywordDensity, seoSettings.focusKeywords, wordCount, getActiveProfileData, seoSettings.minWordCount, seoSettings.maxWordCount]);

  const handleSaveBlog = useCallback(() => {
    if (!mainContent && !seoSettings.title) {
        alert("Please generate content or add a title before saving.");
        return;
    }
    const appStateToSave: SavedBlogState = {
        seoSettings,
        blogInputs,
        mainContent,
        imagePrompt,
        imageRefinementInput,
        generatedImageUrl,
        selectedWriterProfileId,
        keywordAnalysisResult,
        socialPostSuggestions,
        selectedSocialPlatforms,
        externalLinkSuggestions,
    };

    const blogPostToSave: SavedBlogPost = {
        id: savedBlogId || crypto.randomUUID(),
        userId: currentUser.id,
        savedAt: new Date().toISOString(),
        blogTitle: seoSettings.title || "Untitled Blog Post",
        appState: appStateToSave,
    };

    saveBlogPost(blogPostToSave);
    setSavedBlogId(blogPostToSave.id);
    alert('Blog saved successfully!');
  }, [
    currentUser.id, savedBlogId, seoSettings, blogInputs, mainContent,
    imagePrompt, imageRefinementInput, generatedImageUrl, selectedWriterProfileId,
    keywordAnalysisResult, socialPostSuggestions, selectedSocialPlatforms, externalLinkSuggestions
  ]);

  const handleLoadBlog = useCallback((blogToLoad: SavedBlogPost) => {
    const { appState } = blogToLoad;

    // Ensure backward compatibility for externalLinkKeywords
    const finalSeoSettings = {
        ...appState.seoSettings,
        externalLinkKeywords: appState.seoSettings.externalLinkKeywords || ['', '', '']
    };

    setSeoSettings(finalSeoSettings);
    setBlogInputs(appState.blogInputs);
    setMainContent(appState.mainContent);
    setImagePrompt(appState.imagePrompt);
    setImageRefinementInput(appState.imageRefinementInput);
    setGeneratedImageUrl(appState.generatedImageUrl);
    setSelectedWriterProfileId(appState.selectedWriterProfileId);
    setKeywordAnalysisResult(appState.keywordAnalysisResult);

    // Ensure backward compatibility for social post suggestions
    // Old format: string[] -> New format: { platform: string; posts: string[] }[]
    if (appState.socialPostSuggestions && Array.isArray(appState.socialPostSuggestions)) {
      if (appState.socialPostSuggestions.length > 0 && typeof appState.socialPostSuggestions[0] === 'string') {
        // Old format - convert to new format
        setSocialPostSuggestions([{
          platform: 'Legacy Posts',
          posts: appState.socialPostSuggestions as string[]
        }]);
      } else {
        // New format
        setSocialPostSuggestions(appState.socialPostSuggestions as { platform: string; posts: string[] }[]);
      }
    } else {
      setSocialPostSuggestions([]);
    }

    // Ensure backward compatibility for selected platforms
    // Old format: single string -> New format: string[]
    if ('selectedSocialPlatform' in appState && appState.selectedSocialPlatform) {
      setSelectedSocialPlatforms([appState.selectedSocialPlatform as SocialMediaPlatformSelection]);
    } else if ('selectedSocialPlatforms' in appState && appState.selectedSocialPlatforms) {
      setSelectedSocialPlatforms(appState.selectedSocialPlatforms);
    } else {
      setSelectedSocialPlatforms([]);
    }

    setExternalLinkSuggestions(appState.externalLinkSuggestions || []);

    setSavedBlogId(blogToLoad.id);
    setActiveTab('write');
    alert(`Blog "${blogToLoad.blogTitle}" loaded successfully.`);
  }, []);

  const handleDeleteBlog = useCallback((blogId: string) => {
    deleteBlogPost(blogId);
    // If the currently loaded blog is the one being deleted, reset the ID
    if (savedBlogId === blogId) {
        setSavedBlogId(null);
    }
  }, [savedBlogId]);

  const handleSetDeepResearchInfo = useCallback((info: string) => {
    setBlogInputs(prev => ({
        ...prev,
        researchInfo: `## Topic Research Summary (Generated on ${new Date().toLocaleDateString()})\n\n${info}` + 
                      (prev.researchInfo ? `\n\n---\n\n${prev.researchInfo}` : '')
    }));
    setActiveTab('write');
    alert("Deep research has been added to the 'Deep Research Info' field in the Content Inputs section.");
  }, []);

  const handleHeadlineResearchComplete = useCallback((data: { researchInfo: string; headline: string; topic: string }) => {
    const { researchInfo, headline, topic } = data;

    // Update research info
    setBlogInputs(prev => ({
      ...prev,
      researchInfo: `## Topic Research Summary (Generated on ${new Date().toLocaleDateString()})\n\n${researchInfo}` +
                    (prev.researchInfo ? `\n\n---\n\n${prev.researchInfo}` : '')
    }));

    // Update SEO settings
    setSeoSettings(prev => ({
      ...prev,
      title: headline,
      focusKeywords: topic,
      slug: generateSlug(headline)
    }));

    // Switch tab and alert user
    setActiveTab('write');
    alert("Deep research, blog title, and focus keywords have been populated in the 'Write Blog' tab.");
  }, []);
  
  const handleSuggestInternalLinks = useCallback(async () => {
    if (!mainContent || !activeWriterProfile?.websiteContext) {
      setError("Cannot suggest links without blog content and a profile with website context.");
      return;
    }
    setIsSuggestingLinks(true);
    setError(null);
    try {
      const profileData = getActiveProfileData();
      const suggestedLinks = await suggestInternalLinks(mainContent, profileData);
      
      setSeoSettings(prev => {
        const newInternalLinks = [...prev.internalLinks];
        for(let i=0; i<Math.min(suggestedLinks.length, 4); i++) {
          newInternalLinks[i] = suggestedLinks[i];
        }
        return { ...prev, internalLinks: newInternalLinks };
      });

    } catch (err) {
      if (err instanceof RateLimitError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to suggest internal links.');
      }
      console.error(err);
    } finally {
      setIsSuggestingLinks(false);
    }
  }, [mainContent, activeWriterProfile, getActiveProfileData]);
  
  const handleSuggestExternalLinks = useCallback(async () => {
    if (!mainContent) {
      setExternalLinkError("Please generate or write blog content first.");
      return;
    }
    setIsSuggestingExternalLinks(true);
    setExternalLinkError(null);
    setExternalLinkSuggestions([]);
    try {
      const profileData = getActiveProfileData();
      const keywords = seoSettings.externalLinkKeywords.filter(k => k.trim() !== '');
      const suggestions = await suggestExternalLinks(mainContent, keywords, profileData);
      setExternalLinkSuggestions(suggestions);
    } catch (err) {
      if (err instanceof RateLimitError) {
        setExternalLinkError(err.message);
      } else {
        const errorMessage = err instanceof Error ? err.message : 'Failed to suggest external links.';
        
        // Handle Google API rate limit errors specifically
        if (errorMessage.includes('quota') || errorMessage.includes('Quota') || errorMessage.includes('429')) {
          setExternalLinkError('Google Search API quota exceeded. You can: (1) Wait a few minutes and try again, (2) Use fewer keywords, or (3) The system will automatically fall back to basic search results.');
        } else {
          setExternalLinkError(errorMessage);
        }
      }
      console.error(err);
    } finally {
      setIsSuggestingExternalLinks(false);
    }
  }, [mainContent, getActiveProfileData, seoSettings.externalLinkKeywords]);

  const handleAddExternalLink = useCallback((suggestion: ExternalLinkSuggestion) => {
    console.log('🔗 Adding external link:', { 
      url: suggestion.url, 
      anchorText: suggestion.anchorText,
      context: suggestion.context?.substring(0, 100) + '...',
      mainContentLength: mainContent.length 
    });
    
    // Debug: Let's check what's in the content
    const plainContent = mainContent.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    console.log('🔍 Searching for anchor text in content...');
    console.log('Anchor text:', `"${suggestion.anchorText}"`);
    console.log('Context:', `"${suggestion.context?.substring(0, 150)}..."`);
    
    // Check if the anchor text already exists as a link
    const alreadyLinked = mainContent.includes(`<a href=`) && 
                         mainContent.includes(`>${suggestion.anchorText}</a>`);
    
    if (alreadyLinked) {
        console.log('⚠️ Anchor text already appears to be linked');
        alert(`The text "${suggestion.anchorText}" appears to already be a link. Please check your content.`);
        setExternalLinkSuggestions(prev => prev.filter(s => s.url !== suggestion.url));
        return;
    }
    
    // Check both HTML and plain content for anchor text
    const anchorInHTML = mainContent.includes(suggestion.anchorText);
    const anchorInPlain = plainContent.includes(suggestion.anchorText);
    const contextInHTML = suggestion.context ? mainContent.includes(suggestion.context.trim()) : false;
    
    console.log('Content has anchor text (HTML)?', anchorInHTML);
    console.log('Content has anchor text (plain)?', anchorInPlain);
    console.log('Content has context (HTML)?', contextInHTML);
    
    // Create the link HTML
    const linkHtml = `<a href="${suggestion.url}" target="_blank" rel="noopener noreferrer">${suggestion.anchorText}</a>`;
    
    // Strategy 1: Direct anchor text replacement in HTML
    if (anchorInHTML) {
        console.log('✅ Found anchor text in HTML content, replacing...');
        
        // Use a more precise regex replacement to avoid replacing partial matches
        const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(`\\b${escapeRegex(suggestion.anchorText)}\\b`, 'i');
        
        if (pattern.test(mainContent)) {
            const newContent = mainContent.replace(pattern, linkHtml);
            
            if (newContent !== mainContent) {
                setMainContent(newContent);
                console.log('✅ Successfully added external link via regex');
                setExternalLinkSuggestions(prev => prev.filter(s => s.url !== suggestion.url));
                return;
            }
        }
        
        // Fallback to simple string replacement
        const newContent = mainContent.replace(suggestion.anchorText, linkHtml);
        if (newContent !== mainContent) {
            setMainContent(newContent);
            console.log('✅ Successfully added external link via simple replace');
            setExternalLinkSuggestions(prev => prev.filter(s => s.url !== suggestion.url));
            return;
        }
    }
    
    // Strategy 2: Context-based replacement
    if (suggestion.context && contextInHTML) {
        console.log('✅ Found context in HTML content, replacing within context...');
        const contextTrimmed = suggestion.context.trim();
        
        // Try to replace within the context
        if (contextTrimmed.includes(suggestion.anchorText)) {
            const newContext = contextTrimmed.replace(suggestion.anchorText, linkHtml);
            const newContent = mainContent.replace(contextTrimmed, newContext);
            
            if (newContent !== mainContent) {
                setMainContent(newContent);
                console.log('✅ Successfully added external link via context');
                setExternalLinkSuggestions(prev => prev.filter(s => s.url !== suggestion.url));
                return;
            }
        }
    }
    
    // Strategy 3: Try finding in plain text but replacing in HTML
    if (anchorInPlain && !anchorInHTML) {
        console.log('🔍 Found in plain text, attempting HTML replacement...');
        // This means the text exists but might be split across HTML tags
        // Let's try a more sophisticated approach
        
        const words = suggestion.anchorText.split(' ');
        if (words.length > 1) {
            // Try to find and replace each word boundary
            let tempContent = mainContent;
            const firstWord = words[0];
            const lastWord = words[words.length - 1];
            
            if (tempContent.includes(firstWord) && tempContent.includes(lastWord)) {
                console.log('🔍 Found first and last words, attempting replacement...');
                // This is a complex case that might need manual intervention
            }
        }
    }
    
    // Final fallback - show helpful error message
    console.log('❌ Could not add link automatically');
    console.log('Debug info:', {
      anchorTextLength: suggestion.anchorText.length,
      contentSample: mainContent.substring(0, 200) + '...',
      plainContentSample: plainContent.substring(0, 200) + '...'
    });
    
    if (anchorInPlain && !anchorInHTML) {
        alert(`Found the text "${suggestion.anchorText}" in content but it may be split across HTML tags. Please add the link manually or try regenerating the content.`);
    } else if (!anchorInPlain && !anchorInHTML) {
        alert(`Could not find anchor text "${suggestion.anchorText}" in content. The content may have been modified. Please add the link manually.`);
    } else {
        alert(`Unexpected error adding link. Please try again or add manually.`);
    }
    
    // Don't remove the suggestion if we couldn't add it - let user try again
    console.log('Link addition failed, keeping suggestion in list for retry');
  }, [mainContent]);

  if (currentView === 'admin') {
    return (
      <AdminPage
        profiles={writerProfiles}
        setCurrentView={setCurrentView}
        currentUser={currentUser}
      />
    );
  }

  const anyLoading = isLoading || isGeneratingHeadline || isGeneratingMeta || isGeneratingPrompt || isRefiningPrompt || isGeneratingImage || isGeneratingSocial || isEstimatingKeywords || isImprovingDensity || isSuggestingLinks || isSuggestingExternalLinks;
  
  const TabButton: React.FC<{ tabId: typeof activeTab; icon: React.ReactNode; label: string; onClick: () => void }> = ({ tabId, icon, label, onClick }) => (
    <button
      onClick={onClick}
      className={`flex items-center space-x-2 px-4 py-2 text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors
        ${activeTab === tabId ? 'bg-white text-black font-bold border-2 border-gray-300 shadow' : 'text-gray-600 font-medium hover:bg-gray-200 hover:text-gray-800'}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 p-4 md:p-8 font-montserrat">
      <header className="mb-6 text-center relative">
        <div className="text-center mb-2">
          <h1 className="text-4xl font-bold text-gray-900">
            PLACE
          </h1>
        </div>
        <p className="text-lg text-gray-600 font-roboto">Modern real estate technology platform.</p>
        <div className="absolute top-0 right-0 flex items-center space-x-4">
            <div className="text-right">
                <p className="text-sm text-gray-700">Welcome, <strong className="font-semibold">{currentUser.username}</strong></p>
                <p className="text-xs text-gray-500 capitalize">{currentUser.role} Access</p>
            </div>
            {currentUser.role === 'admin' && (
              <Button 
                  onClick={() => setCurrentView('admin')} 
                  className="btn btn-outline !p-2"
                  aria-label="Open Settings"
              >
                  <CogIcon className="w-6 h-6" />
              </Button>
            )}
             <Button onClick={onLogout} variant="secondary" className="text-sm !py-2 !px-3">Logout</Button>
        </div>
      </header>
      
      <nav className="flex flex-wrap items-center justify-center gap-2 mb-8 border-b border-gray-300 pb-4">
          <TabButton tabId="profiles" onClick={() => setActiveTab('profiles')} icon={<UserCircleIcon className="w-5 h-5" />} label="AI Writer Profiles" />
          <TabButton tabId="keywords" onClick={() => setActiveTab('keywords')} icon={<LightBulbIcon className="w-5 h-5" />} label="Keyword Research" />
          <TabButton tabId="topics" onClick={() => setActiveTab('topics')} icon={<GlobeAltIcon className="w-5 h-5" />} label="Find Topic" />
          <TabButton tabId="write" onClick={() => setActiveTab('write')} icon={<DocumentTextIcon className="w-5 h-5" />} label="Write Blog" />
          <TabButton tabId="blogs" onClick={() => setActiveTab('blogs')} icon={<BookmarkSquareIcon className="w-5 h-5" />} label="Saved Blogs" />
      </nav>

      {anyLoading && <LoadingSpinner />}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-6 shadow-lg max-w-7xl mx-auto" role="alert">
          <strong className="font-bold">Main Error:</strong>
          <span className="block sm:inline ml-2">{error}</span>
          <button
            onClick={() => setError(null)}
            className="absolute top-0 bottom-0 right-0 px-4 py-3 text-red-500 hover:text-red-700"
            aria-label="Close error message"
          >
            <span className="text-2xl" aria-hidden="true">&times;</span>
          </button>
        </div>
      )}

      {activeTab === 'write' && (
        <div className="space-y-6 max-w-4xl mx-auto">
          <SectionCard title="SEO & Post Settings" icon={<LightBulbIcon className="w-6 h-6 text-place-teal"/>}>
            <WriterProfileSelector
              profiles={visibleWriterProfiles}
              selectedProfileId={selectedWriterProfileId}
              onSelectProfile={setSelectedWriterProfileId}
            />
            <TextInput 
              label="Blog Post Title (H1)" 
              name="title" 
              value={seoSettings.title} 
              onChange={handleSeoInputChange} 
              placeholder="e.g., The Ultimate Guide to..." 
              isRequired 
              maxLength={TITLE_MAX_LENGTH}
            />
            <div className="mt-[-0.5rem] mb-4">
              <Button
                onClick={handleGenerateHeadline}
                disabled={anyLoading || !mainContent}
                className="w-full text-sm py-2 btn btn-primary"
                aria-label={!mainContent ? "Generate post content first to improve headline" : "Improve Headline with AI"}
              >
                <SparklesIcon className="w-5 h-5 mr-2" />
                {isGeneratingHeadline ? 'Improving...' : 'Improve Headline with AI'}
              </Button>
            </div>

            <div className="mb-4">
              <TextInput
                label="Focus Keyword(s)"
                name="focusKeywords"
                value={seoSettings.focusKeywords}
                onChange={handleSeoInputChange}
                placeholder="e.g., content marketing, SEO tips (comma-separated)"
                isRequired
                className="!mb-2"
              />
              <Button
                onClick={handleEstimateKeywordVolume}
                disabled={anyLoading || !seoSettings.focusKeywords.trim()}
                className="w-full text-sm py-2 btn btn-primary"
                variant="primary"
                aria-label={!seoSettings.focusKeywords.trim() ? "Enter focus keywords to estimate volume" : "Estimate Volume & Get Keyword Suggestions"}
              >
                <TrendingUpIcon className="w-5 h-5 mr-2"/> {isEstimatingKeywords ? 'Estimating...' : 'Estimate Volume & Get Suggestions'}
              </Button>
            </div>
            {keywordAnalysisResult && (
                <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <h3 className="text-md font-semibold text-place-teal mb-3 flex items-center">
                        <TrendingUpIcon className="w-5 h-5 mr-2 text-place-teal" />
                        Keyword Estimation & Suggestions
                    </h3>
                    <div className="space-y-4 text-sm">
                        <div>
                            <h4 className="font-semibold text-gray-800 mb-2">Analysis of Your Keywords:</h4>
                            {keywordAnalysisResult.analyzedKeywords.length > 0 ? (
                                <div className="space-y-2">
                                {keywordAnalysisResult.analyzedKeywords.map((item, index) => (
                                    <div key={`analyzed-${index}`} className="p-2 bg-gray-50 border border-gray-100 rounded-md">
                                        <div className="text-gray-700">
                                            <strong className="text-gray-900">{item.keyword}</strong>:
                                            Est. Volume: <span className="font-medium text-place-teal">{item.estimatedVolume}</span>
                                        </div>
                                        {item.notes && (
                                            <p className="text-xs text-gray-500 italic mt-1">{item.notes}</p>
                                        )}
                                    </div>
                                ))}
                                </div>
                            ) : <p className="text-gray-500">No specific analysis provided.</p>}
                        </div>
                        <div className="mt-3">
                            <h4 className="font-semibold text-gray-800 mb-2">Suggested Alternative Keywords:</h4>
                            <p className="text-xs text-place-teal mb-3"><strong>Tip:</strong> Click "Replace" to swap your primary keyword, or "Add" to include it in your focus keywords list.</p>
                            {keywordAnalysisResult.suggestedKeywords.length > 0 ? (
                                <div className="space-y-3">
                                {keywordAnalysisResult.suggestedKeywords.map((item, index) => (
                                    <div key={`suggested-${index}`} className="p-3 bg-white border border-gray-200 rounded-lg hover:border-place-teal transition-colors">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-grow">
                                                <div className="text-gray-700">
                                                    <strong className="text-gray-900">{item.keyword}</strong>:
                                                    Est. Volume: <span className="font-medium text-place-teal">{item.estimatedVolume}</span>
                                                </div>
                                                {item.reason && (
                                                    <p className="text-xs text-gray-500 italic mt-1">{item.reason}</p>
                                                )}
                                            </div>
                                            <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
                                                <Button
                                                    onClick={() => handleReplaceKeyword(item.keyword, false)}
                                                    className="!py-1 !px-2 text-xs btn btn-primary"
                                                    title="Replace primary focus keyword"
                                                >
                                                    Replace
                                                </Button>
                                                <Button
                                                    onClick={() => handleReplaceKeyword(item.keyword, true)}
                                                    className="!py-1 !px-2 text-xs btn btn-primary"
                                                    title="Add to focus keywords list"
                                                >
                                                    Add
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                </div>
                            ) : <p className="text-gray-500">No alternative keywords suggested.</p>}
                        </div>
                        <p className="text-xs text-gray-400 mt-3 italic">
                            Note: Search volumes are estimations based on AI's general knowledge and not real-time data.
                        </p>
                    </div>
                </div>
            )}
              {keywordAnalysisError && (
              <div className="bg-red-100 border border-red-300 text-red-700 px-3 py-2 rounded-md my-2 text-sm" role="alert">
                <strong className="font-bold">Keyword Analysis Error:</strong> {keywordAnalysisError}
                <button onClick={() => setKeywordAnalysisError(null)} className="ml-2 text-red-500 hover:text-red-700 font-bold" aria-label="Clear keyword analysis error">&times;</button>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Content Inputs" icon={<DocumentTextIcon className="w-6 h-6 text-place-teal"/>}>
            <div className="flex flex-col sm:flex-row sm:space-x-4">
              <div className="flex-1">
                <TextInput
                  label="Minimum Word Count (Optional)"
                  name="minWordCount"
                  value={seoSettings.minWordCount?.toString() || ''}
                  onChange={handleSeoInputChange}
                  placeholder="e.g., 800"
                  type="number"
                />
              </div>
              <div className="flex-1">
                <TextInput
                  label="Maximum Word Count (Optional)"
                  name="maxWordCount"
                  value={seoSettings.maxWordCount?.toString() || ''}
                  onChange={handleSeoInputChange}
                  placeholder="e.g., 1200"
                  type="number"
                />
              </div>
            </div>
            <TextAreaInput label="Transcripts" name="transcripts" value={blogInputs.transcripts} onChange={handleBlogInputChange} placeholder="Paste interview transcripts or audio-to-text output..." rows={6} />
            <TextAreaInput label="Deep Research Info" name="researchInfo" value={blogInputs.researchInfo} onChange={handleBlogInputChange} placeholder="Paste notes, facts, data, URLs, or key insights..." rows={6} />
            <TextAreaInput label="Additional Instructions for AI (General)" name="userInstructions" value={blogInputs.userInstructions} onChange={handleBlogInputChange} placeholder="e.g., Write in a formal tone, target beginners, include a call to action for a newsletter." rows={3} />
            <div className="space-y-4">
              {/* Show requirement message when button is disabled */}
              {(anyLoading || !seoSettings.title || !seoSettings.focusKeywords || !selectedWriterProfileId) && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-2 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span className="font-medium">
                      {anyLoading ? "Generation in progress..." :
                       !seoSettings.title ? "Please enter a Blog Post Title (H1) first" :
                       !seoSettings.focusKeywords ? "Please enter Focus Keywords first" :
                       !selectedWriterProfileId ? "Please select an Active AI Writer Profile first" : ""}
                    </span>
                  </div>
                </div>
              )}
              
              <Button 
                onClick={handleGeneratePost} 
                disabled={anyLoading || !seoSettings.title || !seoSettings.focusKeywords || !selectedWriterProfileId} 
                className="w-full btn btn-primary"
              >
                <SparklesIcon className="w-5 h-5 mr-2"/> {isLoading ? 'Generating Post...' : 'Generate Draft Blog Post'}
              </Button>
            </div>
          </SectionCard>
          
          <SectionCard title="Blog Content Editor" icon={<SparklesIcon className="w-6 h-6 text-place-teal"/>}>
            <TextAreaInput
              label="Main Blog Post Content (HTML)"
              name="mainContent"
              value={mainContent}
              onChange={handleMainContentChange}
              placeholder="AI will generate content here, or you can write/paste HTML directly..."
              rows={20}
              className="text-sm leading-relaxed font-mono bg-gray-50 border-gray-300 focus:ring-pink-500 focus:border-pink-500 text-gray-900"
            />
            {mainContent && (
              <div className="mt-2 p-3 bg-gray-100 rounded-md border border-gray-200 text-sm text-gray-700">
                <div className="flex flex-wrap items-center space-x-4">
                    <div className="flex items-center">
                        <ChartBarIcon className="w-5 h-5 text-place-teal flex-shrink-0 mr-1.5" />
                        <span>Word Count: <strong className="text-gray-900">{wordCount}</strong></span>
                    </div>
                    {keywordDensity && (
                    <div className="flex items-center">
                        <span className="hidden sm:inline ml-2 mr-1 text-place-teal">&#8226;</span>
                        <span>
                        Density ({keywordDensity.keyword}): <strong className="text-gray-900">{keywordDensity.density}</strong>
                        </span>
                    </div>
                    )}
                </div>
                {keywordDensity && keywordDensity.numericDensity < 1.0 && seoSettings.focusKeywords && mainContent && (
                  <Button
                    onClick={handleImproveKeywordDensity}
                    disabled={anyLoading}
                    className="w-full mt-3 text-sm py-2 btn btn-secondary"
                    aria-label="Improve keyword density to approximately 1%"
                  >
                    <ArrowUpCircleIcon className="w-5 h-5 mr-2"/>
                    {isImprovingDensity ? 'Improving Density...' : 'Improve Density to ~1%'}
                  </Button>
                )}
              </div>
            )}
            <div className="mt-4 space-y-4">
                <div className="space-y-2">
                    <Button
                        onClick={handleSaveBlog}
                        disabled={anyLoading || (!mainContent && !seoSettings.title)}
                        className="w-full mb-2 btn btn-primary"
                    >
                        <BookmarkSquareIcon className="w-5 h-5 mr-2"/> {savedBlogId ? 'Update Saved Blog' : 'Save Blog'}
                    </Button>
                    <div className="flex space-x-3">
                        <Button
                            onClick={() => copyToClipboard(mainContent, 'HTML Content')}
                            disabled={!mainContent}
                            className="flex-1 bg-gray-600 hover:bg-gray-700 text-white"
                            aria-label="Copy HTML Content"
                        >
                            <CopyIcon className="w-5 h-5 mr-2"/> Copy HTML
                        </Button>
                        <Button
                            onClick={handleCopyToGoogleDocs}
                            disabled={!mainContent}
                            className="flex-1 btn btn-primary"
                            aria-label="Copy for Google Docs"
                        >
                            <DocumentDuplicateIcon className="w-5 h-5 mr-2"/> Copy for GDocs
                        </Button>
                    </div>
                </div>
            </div>
          </SectionCard>
          
          <SectionCard title="Meta & SEO Details" icon={<SearchCircleIcon className="w-6 h-6 text-place-teal"/>}>
            <div className="mb-4">
              <Button
                onClick={handleGenerateMeta}
                disabled={anyLoading || !mainContent || (!seoSettings.title && !seoSettings.metaTitle) || !seoSettings.focusKeywords}
                className="w-full btn btn-primary"
                aria-label={
                  (!mainContent || (!seoSettings.title && !seoSettings.metaTitle) || !seoSettings.focusKeywords)
                  ? "First generate post content and set title/keywords"
                  : "Generate Meta Title, Description & Slug"
                }
              >
                <LightBulbIcon className="w-5 h-5 mr-2"/> {isGeneratingMeta ? 'Generating...' : 'Generate Meta Title, Description & Slug'}
              </Button>
              <p className="text-xs text-gray-500 mt-2 text-center">Requires generated blog content, a title, and focus keywords.</p>
            </div>

            <TextInput 
              label="Meta Title (for <title> tag)" 
              name="metaTitle" 
              value={seoSettings.metaTitle} 
              onChange={handleSeoInputChange} 
              placeholder="e.g., Ultimate Guide | SEO Tips (Max 60 chars)" 
              maxLength={META_TITLE_MAX_LENGTH}
            />
            <TextAreaInput 
              label="Meta Description" 
              name="metaDescription" 
              value={seoSettings.metaDescription} 
              onChange={handleSeoInputChange} 
              placeholder="Max 160 chars. AI can help generate this." 
              rows={3} 
              maxLength={META_DESCRIPTION_MAX_LENGTH}
            />
            <TextInput label="Slug (URL part)" name="slug" value={seoSettings.slug} onChange={handleSeoInputChange} placeholder="Auto-generated from H1, or use AI Suggest" />
            <TextInput
              label="Blog Post Base URL (for Social Posts)"
              name="blogPostUrl"
              value={seoSettings.blogPostUrl}
              onChange={handleSeoInputChange}
              placeholder="e.g., https://yourdomain.com/blog/"
              type="url"
            />
            <TextInput label="Categories" name="categories" value={seoSettings.categories} onChange={handleSeoInputChange} placeholder="e.g., Marketing, Technology (comma-separated)" />
            <TextInput label="Tags" name="tags" value={seoSettings.tags} onChange={handleSeoInputChange} placeholder="e.g., blogging, AI, SEO (comma-separated)" />
          </SectionCard>

          <SectionCard title="Link Integration (Optional)" icon={<LinkIcon className="w-6 h-6 text-place-teal"/>} startOpen={false}>
              <p className="text-xs text-gray-500 mb-3">AI will attempt to contextually integrate these links into the blog content.</p>
              
              <div className="mb-4 border-b border-gray-200 pb-4">
                  <Button
                      onClick={handleSuggestInternalLinks}
                      disabled={anyLoading || !mainContent || !activeWriterProfile?.websiteContext}
                      className="w-full btn btn-primary"
                      aria-label={!activeWriterProfile?.websiteContext ? "Requires an active profile with Website Context Engine setup" : "Suggest Internal Links with AI"}
                  >
                      <SparklesIcon className="w-5 h-5 mr-2" />
                      {isSuggestingLinks ? 'Suggesting Links...' : 'Suggest Internal Links with AI'}
                  </Button>
                  {(!mainContent || !activeWriterProfile?.websiteContext) && (
                      <p className="text-xs text-gray-500 mt-2 text-center">Requires blog content and a profile with Website Context.</p>
                  )}
              </div>

              <p className="text-sm font-medium text-gray-700 mb-1 mt-3">Internal Links (up to 4)</p>
              {seoSettings.internalLinks.map((link, index) => (
                <TextInput
                  key={`internal-link-${index}`}
                  label={`Internal Link ${index + 1}`}
                  name={`internalLink${index}`}
                  value={link}
                  onChange={(e) => handleLinkChange(index, 'internalLinks', e.target.value)}
                  placeholder="https://yourdomain.com/related-post"
                  type="url"
                  className="mb-2"
                />
              ))}
          </SectionCard>
          
          <SectionCard title="External Link Suggester" icon={<ArrowTopRightOnSquareIcon className="w-6 h-6 text-place-teal"/>} startOpen={false}>
              {externalLinkError && (
                  <div className="bg-red-100 border border-red-300 text-red-700 px-3 py-2 rounded-md mb-4 text-sm" role="alert">
                      {externalLinkError}
                      <button onClick={() => setExternalLinkError(null)} className="ml-2 text-red-500 hover:text-red-700 font-bold" aria-label="Clear external link error">&times;</button>
                  </div>
              )}
              <p className="text-sm text-gray-600 mb-4">Optionally, provide up to 3 keyword phrases to guide the AI's search for better, more relevant links.</p>
              <div className="space-y-2 mb-4">
                  {seoSettings.externalLinkKeywords.map((keyword, index) => (
                      <TextInput
                          key={`ext-keyword-${index}`}
                          label={`Keyword Phrase ${index + 1} (Optional)`}
                          name={`externalLinkKeyword${index}`}
                          value={keyword}
                          onChange={(e) => handleExternalKeywordChange(index, e.target.value)}
                          placeholder="e.g., how to stage an open house"
                      />
                  ))}
              </div>
              <Button
                  onClick={handleSuggestExternalLinks}
                  disabled={anyLoading || !mainContent}
                  className="w-full btn btn-primary"
              >
                  <SparklesIcon className="w-5 h-5 mr-2" />
                  {isSuggestingExternalLinks ? 'Finding Links...' : 'Find External Link Opportunities'}
              </Button>
              {!mainContent && <p className="text-xs text-center text-gray-500 mt-2">Requires generated blog content.</p>}

              {externalLinkSuggestions.length > 0 && (
                  <div className="mt-4 space-y-4">
                      <h4 className="text-md font-semibold text-gray-800">Suggested External Links:</h4>
                      <p className="text-xs text-gray-600 bg-yellow-50 border border-yellow-200 p-2 rounded-md">
                          <strong>Note:</strong> Please verify each link opens correctly and comes from an authoritative source before adding it to your post.
                      </p>
                      <ul className="space-y-3">
                          {externalLinkSuggestions.map((suggestion, index) => (
                              <li key={index} className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                                  <p className="text-sm text-gray-600 mb-2 italic" dangerouslySetInnerHTML={{ __html: `Context: "${suggestion.context.replace(suggestion.anchorText, `<strong>${suggestion.anchorText}</strong>`)}"` }} />
                                  <p className="text-sm text-gray-800 mb-1">
                                      <strong>Anchor:</strong> <span className="font-medium text-place-teal">{suggestion.anchorText}</span>
                                  </p>
                                  <p className="text-sm text-gray-800 mb-3 break-words">
                                      <strong>URL:</strong> <a href={suggestion.url} target="_blank" rel="noopener noreferrer" className="text-place-teal hover:underline">{suggestion.url}</a>
                                  </p>
                                  <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 mt-3">
                                      <Button
                                          onClick={() => handleAddExternalLink(suggestion)}
                                          className="w-full text-xs py-1.5 btn btn-success"
                                      >
                                          Add to Post
                                      </Button>
                                      <a
                                          href={suggestion.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="w-full text-xs py-1.5 btn btn-secondary"
                                      >
                                          Verify Link <ArrowTopRightOnSquareIcon className="w-4 h-4 ml-1.5"/>
                                      </a>
                                  </div>
                              </li>
                          ))}
                      </ul>
                  </div>
              )}
          </SectionCard>

          {mainContent && (
            <ContentEnhancementUI
              content={mainContent}
              profileData={getActiveProfileData()}
              onContentImproved={(improvedContent) => setMainContent(improvedContent)}
            />
          )}

          <SectionCard title="Live Blog Preview" icon={<DocumentTextIcon className="w-6 h-6 text-place-teal"/>} >
            <div className="bg-white p-6 rounded-md shadow-lg min-h-[600px] text-gray-800 overflow-y-auto max-h-[calc(100vh-150px)] border border-gray-200">
              {seoSettings.title && <h1 className="text-3xl font-bold mb-4 text-gray-900">{seoSettings.title}</h1>}
              <BlogPreview content={mainContent} />
            </div>
          </SectionCard>

          
          <SectionCard title="Feature Image Generator" icon={<ImageIcon className="w-6 h-6 text-place-teal"/>} startOpen={false}>
            {imageGenError && (
              <div className="bg-red-100 border border-red-300 text-red-700 px-3 py-2 rounded-md mb-4 text-sm" role="alert">
                {imageGenError}
                <button onClick={() => setImageGenError(null)} className="ml-2 text-red-500 hover:text-red-700 font-bold" aria-label="Clear image error">&times;</button>
              </div>
            )}
            <Button
              onClick={handleGenerateImagePromptIdea}
              disabled={anyLoading || !mainContent}
              className="w-full mb-3 btn btn-primary"
              aria-label="Suggest Image Prompt Idea"
            >
              {isGeneratingPrompt ? 'Generating Idea...' : 'Suggest Image Prompt Idea'}
            </Button>
            <TextAreaInput
              label="Image Prompt (Edit or Refine)"
              name="imagePrompt"
              value={imagePrompt}
              onChange={(e) => setImagePrompt(e.target.value)}
              placeholder="AI will suggest a prompt here, or write your own. Describe the desired image..."
              rows={4}
              className="mb-1 text-sm bg-gray-50 border-gray-300 focus:ring-teal-500 focus:border-teal-500 text-gray-900"
            />
            <TextInput
              label="Refinement Instructions"
              name="imageRefinementInput"
              value={imageRefinementInput}
              onChange={(e) => setImageRefinementInput(e.target.value)}
              placeholder="e.g., make it more vibrant, add a cat, change style to cartoon"
              className="mb-3 text-sm bg-gray-50 border-gray-300 focus:ring-teal-500 focus:border-teal-500 text-gray-900"
            />
            <Button
              onClick={handleRefineImagePrompt}
              disabled={anyLoading || !imagePrompt || !imageRefinementInput}
              className="w-full mb-4 btn btn-primary text-sm py-2"
              aria-label="Refine Prompt with AI"
            >
              {isRefiningPrompt ? 'Refining...' : 'Refine Prompt with AI'}
            </Button>
            <Button
              onClick={handleGenerateFinalImage}
              disabled={anyLoading || !imagePrompt}
              className="w-full btn btn-primary"
              aria-label="Generate Feature Image"
            >
              <ImageIcon className="w-5 h-5 mr-2"/> {isGeneratingImage ? 'Generating Image...' : 'Generate Feature Image'}
            </Button>
            {generatedImageUrl && (
              <div className="mt-4 p-3 bg-gray-100 rounded-md border border-gray-200">
                <img
                  src={generatedImageUrl}
                  alt={seoSettings.slug ? `${seoSettings.slug} feature image` : "Generated feature image"}
                  className="w-full h-auto rounded-md shadow-lg mb-3 border border-gray-300"
                />
                <Button
                  onClick={handleDownloadImage}
                  className="w-full btn btn-success"
                >
                  <DownloadIcon className="w-5 h-5 mr-2"/> Download Image
                </Button>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Social Post Generator" icon={<ShareIcon className="w-6 h-6 text-place-teal"/>} startOpen={false}>
            {socialPostError && (
              <div className="bg-red-100 border border-red-300 text-red-700 px-3 py-2 rounded-md mb-4 text-sm" role="alert">
                {socialPostError}
                <button onClick={() => setSocialPostError(null)} className="ml-2 text-red-500 hover:text-red-700 font-bold" aria-label="Clear social post error">&times;</button>
              </div>
            )}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Select Social Media Platforms
                </label>
                <Button
                  onClick={() => {
                    if (selectedSocialPlatforms.length === SOCIAL_MEDIA_PLATFORMS.length) {
                      setSelectedSocialPlatforms([]);
                    } else {
                      setSelectedSocialPlatforms(SOCIAL_MEDIA_PLATFORMS.map(p => p.id));
                    }
                  }}
                  className="text-xs !py-1 !px-2 btn btn-secondary"
                  variant="secondary"
                >
                  {selectedSocialPlatforms.length === SOCIAL_MEDIA_PLATFORMS.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
              <div className="space-y-2 bg-gray-50 p-3 rounded-md border border-gray-300">
                {SOCIAL_MEDIA_PLATFORMS.map(platform => (
                  <label key={platform.id} className="flex items-start space-x-3 cursor-pointer hover:bg-gray-100 p-2 rounded">
                    <input
                      type="checkbox"
                      checked={selectedSocialPlatforms.includes(platform.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedSocialPlatforms([...selectedSocialPlatforms, platform.id]);
                        } else {
                          setSelectedSocialPlatforms(selectedSocialPlatforms.filter(id => id !== platform.id));
                        }
                      }}
                      className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">
                        {platform.name} {platform.charLimit ? `(${platform.charLimit} chars)` : ''}
                      </div>
                      {platform.notes && (
                        <div className="text-xs text-gray-500 mt-0.5">{platform.notes}</div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <Button
              onClick={handleGenerateSocialPosts}
              disabled={anyLoading || !mainContent || !seoSettings.title || !seoSettings.blogPostUrl || !seoSettings.slug}
              className="w-full btn btn-primary"
              aria-label={
                (!mainContent || !seoSettings.title || !seoSettings.blogPostUrl || !seoSettings.slug)
                ? "Please provide Main Content, Blog Title, Base URL, and Slug for social posts"
                : "Generate Social Posts"
              }
            >
              <ShareIcon className="w-5 h-5 mr-2"/> {isGeneratingSocial ? 'Generating Posts...' : 'Generate Social Posts'}
            </Button>

            {socialPostSuggestions.length > 0 && (
              <div className="mt-4 space-y-4">
                <h4 className="text-md font-semibold text-gray-700">Generated Suggestions:</h4>
                {socialPostSuggestions.map((platformData, platformIndex) => (
                  <div key={platformIndex} className="border border-gray-300 rounded-lg overflow-hidden">
                    <div className="bg-indigo-50 px-4 py-2 border-b border-gray-300">
                      <h5 className="text-sm font-semibold text-indigo-900">{platformData.platform}</h5>
                    </div>
                    <div className="p-3 space-y-3">
                      {platformData.posts.map((post, postIndex) => (
                        <div key={postIndex} className="p-3 bg-gray-100 rounded-md border border-gray-200">
                          <p className="text-sm whitespace-pre-wrap mb-2 text-gray-800">{post}</p>
                          <Button
                            onClick={() => copyToClipboard(post, `${platformData.platform} post ${postIndex + 1}`)}
                            className="w-full text-xs py-1.5 btn btn-secondary"
                            variant="secondary"
                          >
                            <CopyIcon className="w-4 h-4 mr-1.5"/> Copy {platformData.platform} Post {postIndex + 1}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {activeTab === 'topics' && (
        <div className="max-w-4xl mx-auto">
          <SectionCard title="Topic Finder & Research" icon={<GlobeAltIcon className="w-6 h-6 text-place-teal"/>}>
            <TopicFinder
              onSetDeepResearchInfo={handleSetDeepResearchInfo}
              onHeadlineResearchComplete={handleHeadlineResearchComplete}
              selectedKeyword={selectedKeywordForTopic}
            />
          </SectionCard>
        </div>
      )}

      {activeTab === 'keywords' && (
        <div className="max-w-6xl mx-auto">
          <KeywordResearch 
            profileData={getActiveProfileData()}
            onKeywordSelect={(keyword, data) => {
              // Set the selected keyword as focus keyword and switch to Find Topic tab
              setSeoSettings(prev => ({
                ...prev,
                focusKeywords: keyword
              }));
              setSelectedKeywordForTopic(keyword);
              setActiveTab('topics');
            }}
          />
        </div>
      )}

      {activeTab === 'profiles' && (
        <div className="max-w-4xl mx-auto">
          <SectionCard title="AI Writer Profile Management" icon={<UserCircleIcon className="w-6 h-6 text-place-teal"/>}>
            <WriterProfileManager
              profiles={writerProfiles}
              setProfiles={setWriterProfiles}
              currentUser={currentUser}
            />
          </SectionCard>
        </div>
      )}

      {activeTab === 'blogs' && (
        <div className="max-w-4xl mx-auto">
          <SectionCard title="Saved Blog Posts" icon={<BookmarkSquareIcon className="w-6 h-6 text-place-teal"/>}>
            <SavedBlogsManager
              currentUser={currentUser}
              onLoadBlog={handleLoadBlog}
              onDeleteBlog={handleDeleteBlog}
            />
          </SectionCard>
        </div>
      )}


      <footer className="text-center mt-12 py-6 border-t border-gray-300">
        <p className="text-gray-500 text-sm">Powered by Gemini API & React. Crafted for content creators.</p>
      </footer>
    </div>
  );
};


export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    // Check if we have both a stored user and a valid token
    try {
      const storedUser = sessionStorage.getItem('currentUser');
      const token = localStorage.getItem('auth_token');
      
      if (storedUser && token) {
        // Token exists, verify it's still valid (this will be done in useEffect)
        return JSON.parse(storedUser);
      }
    } catch {
      // If anything fails, clear both storage items
      sessionStorage.removeItem('currentUser');
      localStorage.removeItem('auth_token');
    }
    return null;
  });
  

  // Token verification and app initialization
  React.useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('Initializing app with API backend...');
        
        // If we have a stored user, verify the token is still valid
        if (currentUser && apiClient.isAuthenticated()) {
          try {
            console.log('🔐 Verifying stored authentication token...');
            await apiClient.verifyToken();
            console.log('✅ Token verified successfully');
          } catch (tokenError) {
            console.warn('❌ Token verification failed, logging out:', tokenError);
            // Token is invalid, clear user session
            setCurrentUser(null);
            sessionStorage.removeItem('currentUser');
            apiClient.logout(); // This will clear localStorage token
          }
        }
        
        // API keys are now handled via environment variables - no initialization needed
        
        console.log('App initialization completed');
      } catch (error) {
        console.error('App initialization failed:', error);
      }
    };
    
    initializeApp();
  }, [currentUser]); // Re-run when currentUser changes

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    sessionStorage.setItem('currentUser', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    sessionStorage.removeItem('currentUser');
    apiClient.logout(); // Clear API client token
  };

  return (
    <Routes>
      <Route path="/reset-password" element={<PasswordResetForm onResetComplete={() => setCurrentUser(null)} />} />
      <Route path="/*" element={
        !currentUser ? (
          <LoginPage onLogin={handleLogin} />
        ) : (
          <MainApplication currentUser={currentUser} onLogout={handleLogout} />
        )
      } />
    </Routes>
  );
}
