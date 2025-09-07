



import React, { useState, useCallback, useEffect, useMemo } from 'react';
import DOMPurify from 'dompurify';
import { TextInput } from './components/TextInput';
import { TextAreaInput } from './components/TextAreaInput';
import { Button } from './components/Button';
import { SectionCard } from './components/SectionCard';
import { BlogPreview } from './components/BlogPreview';
import { ContentEnhancementUI } from './components/ContentEnhancementUI';
import { KeywordResearch } from './components/KeywordResearch';
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
  RateLimitError, // Import the custom error
} from './services/geminiService';
import { LoadingSpinner } from './components/LoadingSpinner';
import {
  WordpressIcon, CopyIcon, SparklesIcon, LightBulbIcon, DocumentTextIcon,
  SearchCircleIcon, CogIcon, UserCircleIcon, ArrowLeftIcon, ImageIcon, DownloadIcon,
  ShareIcon, LinkIcon, ChartBarIcon, TrendingUpIcon,
  ShieldCheckIcon, CheckCircleIcon, XCircleIcon, DocumentDuplicateIcon, ArrowUpCircleIcon, BookmarkSquareIcon,
  GlobeAltIcon,
  ArrowTopRightOnSquareIcon
} from './components/Icons';
import type {
  SeoSettings, BlogInputs, SuggestedSeoElements, AiWriterProfile,
  WriterProfileData, SocialMediaPlatformSelection, KeywordVolumeAnalysisResult,
  ApprovalStatus, User, SavedBlogPost, SavedBlogState, ExternalLinkSuggestion
} from './types';
import { AdminPage } from './components/AdminPage';
import { WriterProfileSelector } from './components/WriterProfileSelector';
import { DEFAULT_TEXT_MODEL, SOCIAL_MEDIA_PLATFORMS, TITLE_MAX_LENGTH, META_TITLE_MAX_LENGTH, META_DESCRIPTION_MAX_LENGTH } from './constants';
import { authenticateUser } from './services/userService';
import { validatePasswordStrength } from './services/authService';
import { migrateUsersToHashedPasswords, ensureAdminUser } from './services/migrationService';
import { initializeApiKeys } from './services/apiKeyService';
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const result = await authenticateUser(username, password);
      if (result.success && result.user && result.token) {
        // Store secure session token
        sessionStorage.setItem('authToken', result.token);
        onLogin(result.user);
      } else {
        if (result.lockedUntil) {
          const lockoutMinutes = Math.ceil((result.lockedUntil - Date.now()) / (1000 * 60));
          setError(`Account temporarily locked. Try again in ${lockoutMinutes} minutes.`);
        } else {
          setError(result.error || 'Invalid username or password.');
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('An error occurred during login. Please try again.');
    }
  };

  if (showForgotPassword) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-sky-600 mb-4">Password Reset</h1>
            <p className="text-gray-600">Contact your system administrator to reset your password</p>
          </div>
          <div className="bg-blue-50 border border-blue-300 text-blue-800 px-4 py-3 rounded-lg text-sm" role="alert">
            <p><strong>For Security:</strong> Password resets must be performed by an administrator.</p>
            <p className="mt-2">Please contact your system administrator with:</p>
            <ul className="mt-2 ml-4 list-disc text-xs">
              <li>Your username</li>
              <li>Reason for password reset</li>
              <li>Identity verification information</li>
            </ul>
          </div>
          <div className="space-y-4">
            <div className="text-center text-sm text-gray-600">
              <p><strong>Admin Contact Methods:</strong></p>
              <p className="mt-2">• Internal support ticket system</p>
              <p>• Direct communication with IT department</p>
              <p>• Secure authentication via existing channels</p>
            </div>
            <Button 
              type="button" 
              onClick={() => setShowForgotPassword(false)} 
              className="w-full bg-sky-600 hover:bg-sky-700 text-white"
            >
              Back to Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 space-y-6">
        <div className="text-center">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <WordpressIcon className="w-12 h-12 text-sky-600" />
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-600 to-cyan-500">
              AI SEO Blog Writer
            </h1>
          </div>
          <p className="text-gray-600">Please sign in to continue</p>
        </div>
        <div className="bg-green-50 border border-green-300 text-green-800 px-4 py-3 rounded-lg text-sm" role="alert">
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
          <Button type="submit" className="w-full bg-sky-600 hover:bg-sky-700 text-white text-base">
            Sign In
          </Button>
        </form>
        <div className="text-center">
          <button
            type="button"
            onClick={() => setShowForgotPassword(true)}
            className="text-sm text-sky-600 hover:text-sky-800 underline"
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
  const [activeTab, setActiveTab] = useState<'write' | 'topics' | 'keywords' | 'profiles' | 'blogs'>('write');

  // Profiles state
  const [writerProfiles, setWriterProfiles] = useState<AiWriterProfile[]>([]);
  const [selectedWriterProfileId, setSelectedWriterProfileId] = useState<string | null>(null);

  // Feature-specific state
  const [imagePrompt, setImagePrompt] = useState<string>('');
  const [imageRefinementInput, setImageRefinementInput] = useState<string>('');
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [imageGenError, setImageGenError] = useState<string | null>(null);

  const [selectedSocialPlatform, setSelectedSocialPlatform] = useState<SocialMediaPlatformSelection>(SOCIAL_MEDIA_PLATFORMS[0].id);
  const [socialPostSuggestions, setSocialPostSuggestions] = useState<string[]>([]);
  const [socialPostError, setSocialPostError] = useState<string | null>(null);

  const [keywordAnalysisResult, setKeywordAnalysisResult] = useState<KeywordVolumeAnalysisResult | null>(null);
  const [keywordAnalysisError, setKeywordAnalysisError] = useState<string | null>(null);
  const [selectedKeywordForTopic, setSelectedKeywordForTopic] = useState<string>('');
  
  const [externalLinkSuggestions, setExternalLinkSuggestions] = useState<ExternalLinkSuggestion[]>([]);
  const [externalLinkError, setExternalLinkError] = useState<string | null>(null);

  // Approval state
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus>('pending');
  const [approvalTimestamp, setApprovalTimestamp] = useState<string | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState<string>('');
  const [currentRejectionReason, setCurrentRejectionReason] = useState<string | null>(null);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [previousMainContentForApproval, setPreviousMainContentForApproval] = useState<string>('');

  // Saved blog state
  const [savedBlogId, setSavedBlogId] = useState<string | null>(null);


  useEffect(() => {
    const loadProfiles = async () => {
      try {
        const profiles = await getWriterProfiles();
        const updatedProfiles = profiles.map(p => ({
          ...p,
          selectedModel: p.selectedModel || DEFAULT_TEXT_MODEL,
          imagePromptInstructions: p.imagePromptInstructions || '',
          ownerId: p.ownerId || 'admin-001',
          sitemapPages: p.sitemapPages || [],
          websiteContext: p.websiteContext || '',
        }));
        setWriterProfiles(updatedProfiles);
        
        const selectedId = await getSelectedWriterProfileId();
        if (selectedId) {
          setSelectedWriterProfileId(selectedId);
        }
      } catch (e) {
        console.error("Error loading profiles from database:", e);
        setError("Could not load writer profiles from database. Data might be corrupted.");
      }
    };
    loadProfiles();
  }, []);

  useEffect(() => {
    const saveProfiles = async () => {
      try {
        await saveWriterProfiles(writerProfiles);
      } catch (e) {
        console.error("Error saving profiles to database:", e);
        setError("Could not save writer profiles to database. Changes might not persist.");
      }
    };
    if (writerProfiles.length > 0) {
      saveProfiles();
    }
  }, [writerProfiles]);

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
      return writerProfiles.filter(p => 
          p.ownerId === currentUser.id || 
          (currentUser.assignedProfileIds && currentUser.assignedProfileIds.includes(p.id))
      );
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

    if (mainContent !== previousMainContentForApproval) {
        if (approvalStatus === 'approved') {
            setApprovalStatus('pending');
            setApprovalTimestamp(null);
            setCurrentRejectionReason(null);
            setApprovalError("Content has changed since last approval. Re-approval required.");
        }
        setPreviousMainContentForApproval(mainContent);
    }
  }, [mainContent, seoSettings.focusKeywords, approvalStatus, previousMainContentForApproval]);

  const handleGeneratePost = useCallback(async () => {
    if (!seoSettings.title || !seoSettings.focusKeywords) {
      setError("Please provide at least a Blog Post Title (H1) and Focus Keywords.");
      return;
    }
    if (seoSettings.minWordCount && seoSettings.maxWordCount && seoSettings.minWordCount > seoSettings.maxWordCount) {
      setError("Minimum word count cannot be greater than maximum word count.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setApprovalStatus('pending');
    setApprovalTimestamp(null);
    setCurrentRejectionReason(null);
    setApprovalError(null);
    setRejectionReasonInput('');
    setSavedBlogId(null); // New generation is a new blog
    try {
      const profileData = getActiveProfileData();
      const content = await generateBlogPost(seoSettings, blogInputs, profileData);
      setMainContent(content);
      setPreviousMainContentForApproval(content);
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
  
  const copyToClipboard = useCallback((text: string, typeForAlert: string, requiresApproval: boolean = false) => {
    if (requiresApproval && approvalStatus !== 'approved') {
        alert("Content must be approved by a manager before copying this item.");
        return;
    }
    navigator.clipboard.writeText(text)
      .then(() => alert(`${typeForAlert} copied to clipboard!`))
      .catch(err => {
        console.error(`Failed to copy ${typeForAlert}: `, err);
        alert(`Failed to copy ${typeForAlert}. See console for details.`);
      });
  }, [approvalStatus]);

  const handleCopyToGoogleDocs = useCallback(async () => {
    if (approvalStatus !== 'approved') {
        alert("Content must be approved by a manager before copying for Google Docs.");
        return;
    }
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
  }, [mainContent, approvalStatus]);

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
    if (approvalStatus !== 'approved') {
        setSocialPostError("Blog content must be approved by a manager before generating social posts.");
        return;
    }
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
    setIsGeneratingSocial(true);
    setSocialPostError(null);
    setSocialPostSuggestions([]);
    try {
      const profileData = getActiveProfileData();
      const platformInfo = SOCIAL_MEDIA_PLATFORMS.find(p => p.id === selectedSocialPlatform);
      const posts = await generateSocialMediaPosts(
        mainContent,
        seoSettings,
        platformInfo || SOCIAL_MEDIA_PLATFORMS[0],
        profileData
      );
      setSocialPostSuggestions(posts);
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
  }, [mainContent, seoSettings, selectedSocialPlatform, getActiveProfileData, approvalStatus]);

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

  const handleApproveAttempt = useCallback(() => {
    setApprovalError(null);
    setApprovalStatus('approved');
    setApprovalTimestamp(new Date().toLocaleString());
    setCurrentRejectionReason(null);
    setRejectionReasonInput('');
  }, []);

  const handleRejectContent = useCallback(() => {
    if (!rejectionReasonInput.trim()){
        setApprovalError("Please provide a reason for rejection.");
        return;
    }
    setApprovalStatus('rejected');
    setCurrentRejectionReason(rejectionReasonInput);
    setApprovalTimestamp(null);
    setApprovalError(null);
  }, [rejectionReasonInput]);

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
        approvalStatus,
        currentRejectionReason,
        rejectionReasonInput,
        approvalTimestamp,
        selectedWriterProfileId,
        keywordAnalysisResult,
        socialPostSuggestions,
        selectedSocialPlatform,
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
    imagePrompt, imageRefinementInput, generatedImageUrl, approvalStatus,
    currentRejectionReason, rejectionReasonInput, approvalTimestamp, selectedWriterProfileId,
    keywordAnalysisResult, socialPostSuggestions, selectedSocialPlatform, externalLinkSuggestions
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
    setApprovalStatus(appState.approvalStatus);
    setCurrentRejectionReason(appState.currentRejectionReason);
    setRejectionReasonInput(appState.rejectionReasonInput);
    setApprovalTimestamp(appState.approvalTimestamp);
    setSelectedWriterProfileId(appState.selectedWriterProfileId);
    setKeywordAnalysisResult(appState.keywordAnalysisResult);
    setSocialPostSuggestions(appState.socialPostSuggestions);
    setSelectedSocialPlatform(appState.selectedSocialPlatform);
    setExternalLinkSuggestions(appState.externalLinkSuggestions || []);
    
    setSavedBlogId(blogToLoad.id);
    setActiveTab('write');
    alert(`Blog "${blogToLoad.blogTitle}" loaded successfully.`);
  }, []);

  const handleDeleteBlog = useCallback((blogId: string) => {
    deleteBlogPost(blogId, currentUser.id);
    // If the currently loaded blog is the one being deleted, reset the ID
    if (savedBlogId === blogId) {
        setSavedBlogId(null);
    }
  }, [currentUser.id, savedBlogId]);

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
      className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition-colors
        ${activeTab === tabId ? 'bg-sky-600 text-white shadow' : 'text-gray-600 hover:bg-gray-200 hover:text-gray-800'}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 p-4 md:p-8 font-sans">
      <header className="mb-6 text-center relative">
        <div className="flex items-center justify-center space-x-3 mb-2">
          <WordpressIcon className="w-10 h-10 text-sky-600" />
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-600 to-cyan-500">
            AI SEO Blog Writer
          </h1>
        </div>
        <p className="text-lg text-gray-600">Your complete content creation toolkit.</p>
        <div className="absolute top-0 right-0 flex items-center space-x-4">
            <div className="text-right">
                <p className="text-sm text-gray-700">Welcome, <strong className="font-semibold">{currentUser.username}</strong></p>
                <p className="text-xs text-gray-500 capitalize">{currentUser.role} Access</p>
            </div>
            <Button 
                onClick={() => setCurrentView('admin')} 
                className="text-sky-700 bg-white border border-sky-600 hover:bg-sky-50 !p-2"
                aria-label="Open Settings"
            >
                <CogIcon className="w-6 h-6" />
            </Button>
             <Button onClick={onLogout} variant="secondary" className="text-sm !py-2 !px-3">Logout</Button>
        </div>
      </header>
      
      <nav className="flex flex-wrap items-center justify-center gap-2 mb-8 border-b border-gray-300 pb-4">
          <TabButton tabId="write" onClick={() => setActiveTab('write')} icon={<DocumentTextIcon className="w-5 h-5" />} label="Write Blog" />
          <TabButton tabId="topics" onClick={() => setActiveTab('topics')} icon={<GlobeAltIcon className="w-5 h-5" />} label="Find Topic" />
          <TabButton tabId="keywords" onClick={() => setActiveTab('keywords')} icon={<LightBulbIcon className="w-5 h-5" />} label="Keyword Research" />
          <TabButton tabId="profiles" onClick={() => setActiveTab('profiles')} icon={<UserCircleIcon className="w-5 h-5" />} label="AI Writer Profiles" />
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
          <SectionCard title="SEO & Post Settings" icon={<LightBulbIcon className="w-6 h-6 text-yellow-500"/>}>
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
                className="w-full text-sm py-2 bg-pink-500 hover:bg-pink-600 text-white"
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
                className="w-full text-sm py-2 bg-teal-500 hover:bg-teal-600 text-white"
                variant="primary"
                aria-label={!seoSettings.focusKeywords.trim() ? "Enter focus keywords to estimate volume" : "Estimate Volume & Get Keyword Suggestions"}
              >
                <TrendingUpIcon className="w-5 h-5 mr-2"/> {isEstimatingKeywords ? 'Estimating...' : 'Estimate Volume & Get Suggestions'}
              </Button>
            </div>
            {keywordAnalysisResult && (
                <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <h3 className="text-md font-semibold text-sky-700 mb-3 flex items-center">
                        <TrendingUpIcon className="w-5 h-5 mr-2 text-teal-600" />
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
                                            Est. Volume: <span className="font-medium text-teal-600">{item.estimatedVolume}</span>
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
                            <p className="text-xs text-sky-600 mb-3"><strong>Tip:</strong> Click "Replace" to swap your primary keyword, or "Add" to include it in your focus keywords list.</p>
                            {keywordAnalysisResult.suggestedKeywords.length > 0 ? (
                                <div className="space-y-3">
                                {keywordAnalysisResult.suggestedKeywords.map((item, index) => (
                                    <div key={`suggested-${index}`} className="p-3 bg-white border border-gray-200 rounded-lg hover:border-teal-300 transition-colors">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-grow">
                                                <div className="text-gray-700">
                                                    <strong className="text-gray-900">{item.keyword}</strong>:
                                                    Est. Volume: <span className="font-medium text-teal-600">{item.estimatedVolume}</span>
                                                </div>
                                                {item.reason && (
                                                    <p className="text-xs text-gray-500 italic mt-1">{item.reason}</p>
                                                )}
                                            </div>
                                            <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
                                                <Button
                                                    onClick={() => handleReplaceKeyword(item.keyword, false)}
                                                    className="!py-1 !px-2 text-xs bg-teal-600 hover:bg-teal-700 text-white"
                                                    title="Replace primary focus keyword"
                                                >
                                                    Replace
                                                </Button>
                                                <Button
                                                    onClick={() => handleReplaceKeyword(item.keyword, true)}
                                                    className="!py-1 !px-2 text-xs bg-sky-600 hover:bg-sky-700 text-white"
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

          <SectionCard title="Content Inputs" icon={<DocumentTextIcon className="w-6 h-6 text-green-600"/>}>
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
              <Button onClick={handleGeneratePost} disabled={anyLoading || !seoSettings.title || !seoSettings.focusKeywords} className="w-full text-white bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600">
                <SparklesIcon className="w-5 h-5 mr-2"/> {isLoading ? 'Generating Post...' : 'Generate Draft Blog Post'}
              </Button>
            </div>
          </SectionCard>
          
          <SectionCard title="Blog Content Editor" icon={<SparklesIcon className="w-6 h-6 text-pink-600"/>}>
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
                        <ChartBarIcon className="w-5 h-5 text-teal-600 flex-shrink-0 mr-1.5" />
                        <span>Word Count: <strong className="text-gray-900">{wordCount}</strong></span>
                    </div>
                    {keywordDensity && (
                    <div className="flex items-center">
                        <span className="hidden sm:inline ml-2 mr-1 text-teal-600">&#8226;</span>
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
                    className="w-full mt-3 text-sm py-2 bg-orange-500 hover:bg-orange-600 text-white"
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
                        className="w-full mb-2 bg-sky-500 hover:bg-sky-600 text-white"
                    >
                        <BookmarkSquareIcon className="w-5 h-5 mr-2"/> {savedBlogId ? 'Update Saved Blog' : 'Save Blog'}
                    </Button>
                    <div className="flex space-x-3">
                        <Button
                            onClick={() => copyToClipboard(mainContent, 'HTML Content', true)}
                            disabled={!mainContent || approvalStatus !== 'approved'}
                            className="flex-1 bg-gray-600 hover:bg-gray-700 text-white"
                            aria-label={approvalStatus !== 'approved' ? "Content must be approved by manager to copy HTML" : "Copy HTML Content"}
                        >
                            <CopyIcon className="w-5 h-5 mr-2"/> Copy HTML
                        </Button>
                        <Button
                            onClick={handleCopyToGoogleDocs}
                            disabled={!mainContent || approvalStatus !== 'approved'}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                            aria-label={approvalStatus !== 'approved' ? "Content must be approved by manager to copy for Google Docs" : "Copy for Google Docs"}
                        >
                            <DocumentDuplicateIcon className="w-5 h-5 mr-2"/> Copy for GDocs
                        </Button>
                    </div>
                    {approvalStatus !== 'approved' && mainContent && (
                        <p className="text-xs text-yellow-600 text-center">Manager approval required to copy content.</p>
                    )}
                </div>
            </div>
          </SectionCard>
          
          <SectionCard title="Meta & SEO Details" icon={<SearchCircleIcon className="w-6 h-6 text-purple-600"/>}>
            <div className="mb-4">
              <Button
                onClick={handleGenerateMeta}
                disabled={anyLoading || !mainContent || (!seoSettings.title && !seoSettings.metaTitle) || !seoSettings.focusKeywords}
                className="w-full text-white bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600"
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

          <SectionCard title="Link Integration (Optional)" icon={<LinkIcon className="w-6 h-6 text-sky-600"/>} startOpen={false}>
              <p className="text-xs text-gray-500 mb-3">AI will attempt to contextually integrate these links into the blog content.</p>
              
              <div className="mb-4 border-b border-gray-200 pb-4">
                  <Button
                      onClick={handleSuggestInternalLinks}
                      disabled={anyLoading || !mainContent || !activeWriterProfile?.websiteContext}
                      className="w-full text-white bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600"
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
          
          <SectionCard title="External Link Suggester" icon={<ArrowTopRightOnSquareIcon className="w-6 h-6 text-blue-600"/>} startOpen={false}>
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
                  className="w-full text-white bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600"
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
                                      <strong>Anchor:</strong> <span className="font-medium text-blue-700">{suggestion.anchorText}</span>
                                  </p>
                                  <p className="text-sm text-gray-800 mb-3 break-words">
                                      <strong>URL:</strong> <a href={suggestion.url} target="_blank" rel="noopener noreferrer" className="text-sky-600 hover:underline">{suggestion.url}</a>
                                  </p>
                                  <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 mt-3">
                                      <Button
                                          onClick={() => handleAddExternalLink(suggestion)}
                                          className="w-full text-xs py-1.5 bg-green-500 hover:bg-green-600 text-white"
                                      >
                                          Add to Post
                                      </Button>
                                      <a
                                          href={suggestion.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="w-full text-xs py-1.5 bg-gray-500 hover:bg-gray-600 text-white px-4 font-semibold rounded-md shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white transition-all duration-150 ease-in-out flex items-center justify-center"
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

          <SectionCard title="Live WordPress-Style Preview" icon={<WordpressIcon className="w-6 h-6 text-sky-600"/>} >
            <div className="bg-white p-6 rounded-md shadow-lg min-h-[600px] text-gray-800 overflow-y-auto max-h-[calc(100vh-150px)] border border-gray-200">
              {seoSettings.title && <h1 className="text-3xl font-bold mb-4 text-gray-900">{seoSettings.title}</h1>}
              <BlogPreview content={mainContent} />
            </div>
          </SectionCard>

          <SectionCard title="Manager Approval" icon={<ShieldCheckIcon className="w-6 h-6 text-amber-600"/>}>
            <div className="mb-3">
                {approvalStatus === 'pending' && (
                    <p className="text-amber-700 flex items-center"><UserCircleIcon className="w-5 h-5 mr-2 text-amber-600"/>Status: Pending Review & Approval.</p>
                )}
                {approvalStatus === 'approved' && approvalTimestamp && (
                    <p className="text-green-600 flex items-center"><CheckCircleIcon className="w-5 h-5 mr-2 text-green-600"/>Status: Approved on {approvalTimestamp}.</p>
                )}
                {approvalStatus === 'rejected' && (
                    <p className="text-red-600 flex items-center"><XCircleIcon className="w-5 h-5 mr-2 text-red-600"/>Status: Rejected. {currentRejectionReason && `Reason: ${currentRejectionReason}`}</p>
                )}
            </div>

            {approvalError && (
              <div className="bg-red-100 border border-red-300 text-red-700 px-3 py-2 rounded-md my-3 text-sm" role="alert">
                {approvalError}
                <button onClick={() => setApprovalError(null)} className="ml-2 text-red-500 hover:text-red-700 font-bold" aria-label="Clear approval error">&times;</button>
              </div>
            )}

            {currentUser.role !== 'admin' && (approvalStatus === 'pending' || approvalStatus === 'rejected') && mainContent && (
              <div className="text-sm text-center text-gray-600 bg-gray-100 p-4 rounded-md border">
                Approval must be performed by an Administrator. Please ask an admin to log in and review the content.
              </div>
            )}

            {currentUser.role === 'admin' && (approvalStatus === 'pending' || approvalStatus === 'rejected') && (
              <div className="space-y-4 mt-4 border-t border-gray-300 pt-4">
                <TextAreaInput
                  label="Reason for Rejection (Required if rejecting)"
                  name="rejectionReasonInput"
                  value={rejectionReasonInput}
                  onChange={(e) => setRejectionReasonInput(e.target.value)}
                  placeholder="Provide feedback for rejection..."
                  rows={3}
                />
                <div className="flex space-x-3">
                  <Button
                    onClick={handleApproveAttempt}
                    disabled={anyLoading}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                    aria-label="Approve Content"
                  >
                    <CheckCircleIcon className="w-5 h-5 mr-2"/> Approve Content
                  </Button>
                  <Button
                    onClick={handleRejectContent}
                    disabled={anyLoading || !rejectionReasonInput.trim()}
                    variant="danger"
                    className="flex-1"
                    aria-label="Reject Content"
                  >
                    <XCircleIcon className="w-5 h-5 mr-2"/> Reject Content
                  </Button>
                </div>
              </div>
            )}
              {approvalStatus === 'approved' && mainContent && (
                  <p className="text-xs text-gray-500 mt-2">Content is approved. You can now copy the HTML or for Google Docs.</p>
              )}
          </SectionCard>
          
          <SectionCard title="Feature Image Generator" icon={<ImageIcon className="w-6 h-6 text-teal-600"/>} startOpen={false}>
            {imageGenError && (
              <div className="bg-red-100 border border-red-300 text-red-700 px-3 py-2 rounded-md mb-4 text-sm" role="alert">
                {imageGenError}
                <button onClick={() => setImageGenError(null)} className="ml-2 text-red-500 hover:text-red-700 font-bold" aria-label="Clear image error">&times;</button>
              </div>
            )}
            <Button
              onClick={handleGenerateImagePromptIdea}
              disabled={anyLoading || !mainContent || approvalStatus !== 'approved'}
              className="w-full mb-3 bg-teal-500 hover:bg-teal-600 text-white"
              aria-label={approvalStatus !== 'approved' ? "Content must be approved by manager to generate image prompt" : "Suggest Image Prompt Idea"}
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
              disabled={approvalStatus !== 'approved'}
            />
            <TextInput
              label="Refinement Instructions"
              name="imageRefinementInput"
              value={imageRefinementInput}
              onChange={(e) => setImageRefinementInput(e.target.value)}
              placeholder="e.g., make it more vibrant, add a cat, change style to cartoon"
              className="mb-3 text-sm bg-gray-50 border-gray-300 focus:ring-teal-500 focus:border-teal-500 text-gray-900"
              disabled={approvalStatus !== 'approved'}
            />
            <Button
              onClick={handleRefineImagePrompt}
              disabled={anyLoading || !imagePrompt || !imageRefinementInput || approvalStatus !== 'approved'}
              className="w-full mb-4 bg-sky-500 hover:bg-sky-600 text-white text-sm py-2"
              aria-label={approvalStatus !== 'approved' ? "Content must be approved by manager to refine prompt" : "Refine Prompt with AI"}
            >
              {isRefiningPrompt ? 'Refining...' : 'Refine Prompt with AI'}
            </Button>
            <Button
              onClick={handleGenerateFinalImage}
              disabled={anyLoading || !imagePrompt || approvalStatus !== 'approved'}
              className="w-full bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white"
              aria-label={approvalStatus !== 'approved' ? "Content must be approved by manager to generate image" : "Generate Feature Image"}
            >
              <ImageIcon className="w-5 h-5 mr-2"/> {isGeneratingImage ? 'Generating Image...' : 'Generate Feature Image'}
            </Button>
            {approvalStatus !== 'approved' && !generatedImageUrl && (
                <p className="text-xs text-yellow-600 text-center mt-2">Manager approval required to use image generator.</p>
            )}
            {generatedImageUrl && (
              <div className="mt-4 p-3 bg-gray-100 rounded-md border border-gray-200">
                <img
                  src={generatedImageUrl}
                  alt={seoSettings.slug ? `${seoSettings.slug} feature image` : "Generated feature image"}
                  className="w-full h-auto rounded-md shadow-lg mb-3 border border-gray-300"
                />
                <Button
                  onClick={handleDownloadImage}
                  className="w-full bg-green-500 hover:bg-green-600 text-white"
                >
                  <DownloadIcon className="w-5 h-5 mr-2"/> Download Image
                </Button>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Social Post Generator" icon={<ShareIcon className="w-6 h-6 text-indigo-600"/>} startOpen={false}>
            {socialPostError && (
              <div className="bg-red-100 border border-red-300 text-red-700 px-3 py-2 rounded-md mb-4 text-sm" role="alert">
                {socialPostError}
                <button onClick={() => setSocialPostError(null)} className="ml-2 text-red-500 hover:text-red-700 font-bold" aria-label="Clear social post error">&times;</button>
              </div>
            )}
            <div className="mb-3">
              <label htmlFor="socialPlatform" className="block text-sm font-medium text-gray-700 mb-1">
                Select Social Media Platform
              </label>
              <select
                id="socialPlatform"
                name="socialPlatform"
                value={selectedSocialPlatform}
                onChange={(e) => setSelectedSocialPlatform(e.target.value as SocialMediaPlatformSelection)}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-md shadow-sm
                            focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                disabled={approvalStatus !== 'approved'}
              >
                {SOCIAL_MEDIA_PLATFORMS.map(platform => (
                  <option key={platform.id} value={platform.id}>
                    {platform.name} {platform.charLimit ? `(${platform.charLimit} chars)` : ''}
                  </option>
                ))}
              </select>
            </div>
            <Button
              onClick={handleGenerateSocialPosts}
              disabled={anyLoading || !mainContent || !seoSettings.title || !seoSettings.blogPostUrl || !seoSettings.slug || approvalStatus !== 'approved'}
              className="w-full bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white"
              aria-label={
                approvalStatus !== 'approved' ? "Content must be approved by manager to generate social posts" :
                (!mainContent || !seoSettings.title || !seoSettings.blogPostUrl || !seoSettings.slug)
                ? "Please provide Main Content, Blog Title, Base URL, and Slug for social posts"
                : "Generate Social Posts"
              }
            >
              <ShareIcon className="w-5 h-5 mr-2"/> {isGeneratingSocial ? 'Generating Posts...' : 'Generate Social Posts'}
            </Button>
            {approvalStatus !== 'approved' && !socialPostSuggestions.length && (
                <p className="text-xs text-yellow-600 text-center mt-2">Manager approval required to use social post generator.</p>
            )}

            {socialPostSuggestions.length > 0 && (
              <div className="mt-4 space-y-3">
                <h4 className="text-md font-semibold text-gray-700">Generated Suggestions:</h4>
                {socialPostSuggestions.map((post, index) => (
                  <div key={index} className="p-3 bg-gray-100 rounded-md border border-gray-200">
                    <p className="text-sm whitespace-pre-wrap mb-2 text-gray-800">{post}</p>
                    <Button
                      onClick={() => copyToClipboard(post, `Social post suggestion ${index + 1}`)}
                      className="w-full text-xs py-1.5 bg-gray-500 hover:bg-gray-600 text-white"
                      variant="secondary"
                    >
                      <CopyIcon className="w-4 h-4 mr-1.5"/> Copy Suggestion {index + 1}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {activeTab === 'topics' && (
        <div className="max-w-4xl mx-auto">
          <SectionCard title="Topic Finder & Research" icon={<GlobeAltIcon className="w-6 h-6 text-sky-600"/>}>
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
          <SectionCard title="AI Writer Profile Management" icon={<UserCircleIcon className="w-6 h-6 text-sky-600"/>}>
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
          <SectionCard title="Saved Blog Posts" icon={<BookmarkSquareIcon className="w-6 h-6 text-sky-600"/>}>
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
    // Check session storage for a logged-in user to persist across reloads
    try {
      const storedUser = sessionStorage.getItem('currentUser');
      return storedUser ? JSON.parse(storedUser) : null;
    } catch {
      return null;
    }
  });

  // Run migration on app startup
  React.useEffect(() => {
    const runMigration = async () => {
      try {
        console.log('Running authentication migration...');
        await migrateUsersToHashedPasswords();
        await ensureAdminUser();
        console.log('Migration completed');
        
        console.log('Initializing API keys...');
        await initializeApiKeys();
        console.log('API keys initialized');
      } catch (error) {
        console.error('Migration failed:', error);
      }
    };
    
    runMigration();
  }, []);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    sessionStorage.setItem('currentUser', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    sessionStorage.removeItem('currentUser');
  };

  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return <MainApplication currentUser={currentUser} onLogout={handleLogout} />;
}