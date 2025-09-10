import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import type { 
  SeoSettings, BlogInputs, SuggestedSeoElements, WriterProfileData, 
  SocialMediaPlatform, KeywordVolumeAnalysisResult, GoogleNewsSearchResult, Article, GroundingSource,
  ArticleStats,
  ExternalLinkSuggestion
} from '../types';
import { 
  META_DESCRIPTION_MAX_LENGTH, META_DESCRIPTION_MIN_LENGTH, 
  TITLE_MAX_LENGTH, TITLE_MIN_LENGTH,
  META_TITLE_MAX_LENGTH, META_TITLE_MIN_LENGTH,
  DEFAULT_TEXT_MODEL,
  IMAGE_GENERATION_MODEL
} from '../constants';
import { getGeminiApiKey } from './apiKeyService';
import { googleSearchService } from './googleSearchService';

// Initialize AI client - will be set when API key is retrieved
let ai: GoogleGenAI | null = null;

export const initializeAI = async (): Promise<GoogleGenAI> => {
  if (ai) return ai;
  
  const apiKey = await getGeminiApiKey();
  if (!apiKey) {
    throw new Error("Gemini API key not configured. Please set it in the admin settings.");
  }
  
  ai = new GoogleGenAI({ apiKey });
  return ai;
}; 

// Custom error for rate limiting
export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

// Centralized API error handler
const handleApiError = (error: unknown, context: string): never => {
  console.error(`Error in ${context}:`, error);
  const errorMessage = error instanceof Error ? error.message : String(error);

  if (errorMessage.includes('429') || /quota|rate limit/i.test(errorMessage)) {
      throw new RateLimitError("You've sent too many requests in a short period. Please wait a moment before trying again.");
  }
  
  throw new Error(`Gemini API error in ${context}: ${errorMessage}`);
};


// Helper function to handle JSON parsing from AI response
const parseJsonResponse = <T>(text: string | undefined, fallback: T): T => {
  if (!text) {
    return fallback;
  }
  let jsonStr = text.trim();
  
  // First, try to find a JSON block within markdown fences
  const fenceRegex = /^```(?:\w*)?\s*\n?(.*?)\n?\s*```$/s;
  const match = jsonStr.match(fenceRegex);
  
  if (match && match[1]) {
    jsonStr = match[1].trim();
  }
  
  // After potentially removing markdown fences, find the main JSON object/array
  // by locating the first opening bracket and the last closing bracket.
  // This helps trim any leading/trailing conversational text.
  const firstBrace = jsonStr.indexOf('{');
  const firstBracket = jsonStr.indexOf('[');
  
  let jsonStart = -1;
  
  if (firstBrace === -1) {
      jsonStart = firstBracket;
  } else if (firstBracket === -1) {
      jsonStart = firstBrace;
  } else {
      jsonStart = Math.min(firstBrace, firstBracket);
  }

  if (jsonStart !== -1) {
      const lastBrace = jsonStr.lastIndexOf('}');
      const lastBracket = jsonStr.lastIndexOf(']');
      const jsonEnd = Math.max(lastBrace, lastBracket);
      
      if (jsonEnd > jsonStart) {
          jsonStr = jsonStr.substring(jsonStart, jsonEnd + 1);
      }
  }

  if (!jsonStr) {
    return fallback;
  }

  try {
    // Attempt to parse the cleaned string
    return JSON.parse(jsonStr) as T;
  } catch (e) {
    console.error("Failed to parse JSON response:", e, "Processed string:", jsonStr, "Raw text:", text);
    return fallback;
  }
};


function buildPromptWithProfile(
  baseSystemInstruction: string,
  userRequest: string,
  profileData?: WriterProfileData,
  context?: 'text' | 'imagePrompt' | 'social' | 'keywordAnalysis' | 'seo' | 'headline' | 'internalLinking' | 'externalLinking'
): string {
  let fullPrompt = baseSystemInstruction;

  if (profileData?.coreInstructions) {
    fullPrompt += `\n\n**AI Agent Core Instructions (Overall Persona):**\n${profileData.coreInstructions}`;
  }
  if (profileData?.brandVoice && (context === 'text' || context === 'social' || context === 'keywordAnalysis' || context === 'seo' || context === 'headline' || context === 'internalLinking' || context === 'externalLinking')) {
    fullPrompt += `\n\n**Brand Voice Guidelines:**\n${profileData.brandVoice}`;
  }
  if (profileData && (context === 'text' || context === 'keywordAnalysis' || context === 'seo')) {
    // Use legacy text field for knowledge base (maintain backward compatibility)
    let knowledgeContent = profileData.knowledgeDocumentsText || '';
    
    // If we have enhanced knowledge documents, combine them
    if (profileData.knowledgeDocuments && profileData.knowledgeDocuments.length > 0) {
      const documentsContent = profileData.knowledgeDocuments
        .map(doc => `--- ${doc.name} (${doc.type.toUpperCase()}) ---\n${doc.content}`)
        .join('\n\n');
      
      if (knowledgeContent.trim()) {
        knowledgeContent = knowledgeContent.trim() + '\n\n' + documentsContent;
      } else {
        knowledgeContent = documentsContent;
      }
    }
    
    if (knowledgeContent.trim()) {
      fullPrompt += `\n\n**Relevant Knowledge Base (Use this information to inform your response if relevant):**\n${knowledgeContent}`;
    }
  }
   if (profileData?.websiteContext && (context === 'text' || context === 'internalLinking')) {
    fullPrompt += `\n\n**INTERNAL LINKING CONTEXT (Available Website Pages for reference):**\n${profileData.websiteContext}`;
  }
  if (profileData?.imagePromptInstructions && context === 'imagePrompt') {
     fullPrompt += `\n\n**Image Style & Content Guidelines (From Profile):**\n${profileData.imagePromptInstructions}`;
  }
  
  fullPrompt += `\n\n---\n\n**User Request:**\n${userRequest}`;
  return fullPrompt;
}


export async function generateBlogPost(
  seo: SeoSettings, 
  inputs: BlogInputs, 
  profileData?: WriterProfileData
): Promise<string> {
  const aiClient = await initializeAI();
  const selectedModel = profileData?.selectedModel || DEFAULT_TEXT_MODEL;

  let wordCountSystemRule = '';
  let wordCountUserReminder = '';
  let wordCountChecklistItem = '';
  const minSet = seo.minWordCount !== undefined && seo.minWordCount > 0;
  const maxSet = seo.maxWordCount !== undefined && seo.maxWordCount > 0;

  if (minSet && maxSet) {
    wordCountSystemRule = `IMPORTANT RULE: The total word count of your generated blog post response MUST ABSOLUTELY be between ${seo.minWordCount} and ${seo.maxWordCount} words. This is a strict range. Plan your content carefully. Falling outside this range means the task is failed.`;
    wordCountUserReminder = `Before you start writing, remember the STRICT word count range: BETWEEN ${seo.minWordCount} AND ${seo.maxWordCount} words. Plan your headings and content sections to ensure you stay well within this range.`;
    wordCountChecklistItem = `ABSOLUTELY STAYS WITHIN the word count range of ${seo.minWordCount} to ${seo.maxWordCount} words.`;
  } else if (minSet) {
    wordCountSystemRule = `IMPORTANT RULE: The total word count of your generated blog post response MUST ABSOLUTELY be AT LEAST ${seo.minWordCount} words. This is a strict minimum. Plan your content carefully to meet this minimum. Falling below this minimum means the task is failed.`;
    wordCountUserReminder = `Before you start writing, remember the STRICT minimum word count: AT LEAST ${seo.minWordCount} words. Plan your headings and content sections to ensure you meet this minimum.`;
    wordCountChecklistItem = `ABSOLUTELY MEETS the minimum word count of ${seo.minWordCount} words.`;
  } else if (maxSet) {
    wordCountSystemRule = `IMPORTANT RULE: The total word count of your generated blog post response MUST ABSOLUTELY NOT EXCEED ${seo.maxWordCount} words. This is a strict limit. Plan your content carefully to stay under this limit. Exceeding this limit means the task is failed.`;
    wordCountUserReminder = `Before you start writing, remember the STRICT word count limit: NO MORE THAN ${seo.maxWordCount} words. Plan your headings and content sections to ensure you stay well within this limit.`;
    wordCountChecklistItem = `ABSOLUTELY STAYS UNDER the maximum word count of ${seo.maxWordCount} words.`;
  }

  const baseSystemInstruction = `${wordCountSystemRule ? wordCountSystemRule + '\n\n' : ''}You are an expert SEO content writer specializing in creating engaging and well-structured blog posts formatted for WordPress. 
Use HTML for structure (headings H2, H3, H4, paragraphs <p>, lists <ul><li> and <ol><li>, bold <strong>, italic <em>, blockquotes <blockquote>, and links <a href="URL">anchor text</a>). 
Do NOT include <html>, <head>, or <body> tags. 
The main blog post title (H1) and HTML <title> tag will be handled by the user in WordPress/SEO settings, so do not include them in your generated HTML. Start directly with the first H2 heading or a paragraph.
`;

  const internalLinksList = seo.internalLinks && seo.internalLinks.filter(link => link.trim() !== '');

  const primaryKeyword = seo.focusKeywords.split(',')[0]?.trim();

  const keywordDensityInstruction = primaryKeyword 
    ? `3. **Keyword Density (CRITICAL):** Naturally incorporate the primary keyword, **"${primaryKeyword}"**, to achieve a density between 0.75% and 1.0%. Distribute it evenly in headings and body text where it feels natural. This is a strict requirement for the success of the task.`
    : `3. Naturally incorporates the focus keyword(s) throughout the content, including in headings where appropriate.`;

  const userRequest = `
${wordCountUserReminder ? wordCountUserReminder + '\n\n' : ''}
Blog Post Title (H1 - for context): ${seo.title}
HTML Meta Title (<title> tag - for context): ${seo.metaTitle}
Focus Keyword(s): ${seo.focusKeywords}
${seo.metaDescription ? `Meta Description (for context): ${seo.metaDescription}` : ''}

**INTERNAL LINKING RULES (CRITICAL):**
The total number of internal links in the entire article MUST NOT EXCEED 6. This is a strict maximum.

**Link Integration Strategy:**
1.  **Mandatory Links First:** You MUST first integrate any links provided in the list below. These are the highest priority.
    ${(internalLinksList && internalLinksList.length > 0) ? `**Links to Integrate:**\n${internalLinksList.map(link => `- ${link}`).join('\n')}` : `**Links to Integrate:** None provided.`}
2.  **Proactive Links (If Space Allows):** After integrating the mandatory links, if the total internal link count is still below 6, you MAY proactively add more relevant links. These additional links MUST come from the "INTERNAL LINKING CONTEXT" provided in the system instructions. Add links until you have a good distribution, but do not exceed the hard limit of 6 total internal links.
3.  **General Rules for ALL Links:**
    *   Use descriptive, natural-sounding anchor text. Avoid generic phrases like "click here."
    *   Ensure links are contextually relevant and add value to the reader.
    *   Do NOT invent or guess URLs. Only use URLs from the lists provided. If no relevant link exists for a certain point, do not add one.

Content to be based on:
Transcripts:
${inputs.transcripts || "No transcripts provided."}

Research Information:
${inputs.researchInfo || "No research information provided."}

Additional Instructions from User (General - apply these alongside any AI Agent specific instructions):
${inputs.userInstructions || "No additional general instructions."}

Please generate a comprehensive blog post based on all the provided information (including any AI Agent instructions, brand voice, and knowledge base sections above if present).

**COMPLETION REQUIREMENTS:**
- The article MUST be complete from introduction to conclusion
- End with a strong conclusion that summarizes key points
- Include a natural call-to-action in the conclusion
- Do NOT stop mid-sentence or leave sections incomplete
- If approaching token limits, prioritize completing the article over adding extra content

Ensure the blog post:
1. Is directly usable in a WordPress HTML editor.
2. Is well-structured with appropriate H2, H3, and H4 headings.
${keywordDensityInstruction}
4. CRITICALLY IMPORTANT: Adheres strictly to the INTERNAL LINKING RULES, integrating a maximum of 6 total internal links.
5. Is written in an engaging and informative tone, consistent with any specified brand voice.
6. Consists of paragraphs, and lists where suitable.
${wordCountChecklistItem ? `7. ${wordCountChecklistItem}` : ''}
8. **MUST BE COMPLETE:** Always finish with a proper conclusion, never leave the article incomplete.

Output only the HTML content for the blog body.
`;

  const prompt = buildPromptWithProfile(baseSystemInstruction, userRequest, profileData, 'text');

  try {
    const response: GenerateContentResponse = await aiClient.models.generateContent({
      model: selectedModel,
      contents: prompt,
       config: {
        temperature: 0.7, 
        topP: 0.95,
        topK: 64,
        maxOutputTokens: 8000, // Ensure enough tokens for complete articles
      }
    });
    const text = response.text;
    if (!text) {
        throw new Error("Failed to generate blog post content, response was empty.");
    }
    
    // Check if the article appears to be incomplete (doesn't end properly)
    const trimmedText = text.trim();
    const hasProperEnding = trimmedText.includes('</p>') || trimmedText.includes('</li>') || trimmedText.includes('</ol>') || trimmedText.includes('</ul>');
    const endsAbruptly = !trimmedText.endsWith('>') && !trimmedText.endsWith('.');
    
    if (endsAbruptly || !hasProperEnding) {
        console.warn('Generated content may be incomplete, attempting to complete...');
        
        // Try to generate a conclusion if the article seems incomplete
        try {
          const conclusionResponse = await aiClient.models.generateContent({
            model: selectedModel,
            contents: `Complete this blog post with a proper conclusion. The current content ends here:

${trimmedText.substring(-500)}

Add a conclusion that:
- Summarizes the key points
- Includes a call-to-action
- Properly closes the article
- Uses proper HTML formatting

Return only the conclusion HTML to append to the article.`,
            config: {
              temperature: 0.6,
              maxOutputTokens: 1000,
            }
          });
          
          if (conclusionResponse.text) {
            return trimmedText + '\n\n' + conclusionResponse.text.trim();
          }
        } catch (conclusionError) {
          console.warn('Failed to generate completion:', conclusionError);
        }
    }
    
    return trimmedText;
  } catch (error) {
    handleApiError(error, `generateBlogPost with model ${selectedModel}`);
  }
}

export async function generateImprovedHeadline(
  mainContent: string,
  currentTitle: string,
  profileData?: WriterProfileData
): Promise<string> {
  const aiClient = await initializeAI();

  const selectedModel = profileData?.selectedModel || DEFAULT_TEXT_MODEL;

  const baseSystemInstruction = `You are an expert SEO copywriter and headline creator. Your task is to analyze the provided blog post content and the current headline, then generate a single, more compelling, and SEO-optimized headline (H1). The headline should be engaging, accurately reflect the content, and be optimized for click-through rate.`;
  
  const userRequest = `
Current Headline (H1): "${currentTitle}"

Blog Post Content (first 2000 characters for context):
${mainContent.substring(0, 2000)}

Based on the content and the current headline, provide one new, improved headline.

Follow these rules for the new headline:
- Target length: ${TITLE_MIN_LENGTH}-${TITLE_MAX_LENGTH} characters.
- Must be compelling and create curiosity.
- Should include the primary keyword/topic if obvious from the content.
- Do NOT wrap the output in quotes or any other formatting. Just return the raw text of the headline.
`;

  const prompt = buildPromptWithProfile(baseSystemInstruction, userRequest, profileData, 'headline');

  try {
    const response: GenerateContentResponse = await aiClient.models.generateContent({
      model: selectedModel,
      contents: prompt,
      config: {
        temperature: 0.8,
        topP: 0.95,
        topK: 64,
        maxOutputTokens: 150,
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    const text = response.text;
    if (text) {
        return text.trim().replace(/^"|"$/g, '');
    } else {
        const finishReason = response.candidates?.[0]?.finishReason;
        
        let errorMessage = "AI did not return a new headline. The response may have been blocked or empty.";
        if (finishReason === 'SAFETY') {
          errorMessage = "The request was blocked for safety reasons. Please adjust the content and try again.";
        } else if (finishReason === 'MAX_TOKENS') {
          errorMessage = "The AI response was cut off because it reached the maximum length. This is often temporary, please try again.";
        }
        
        throw new Error(errorMessage);
    }
  } catch (error) {
    handleApiError(error, 'generateImprovedHeadline');
  }
}


export async function generateMetaAndSlug(
  mainContent: string,
  currentTitle: string,
  currentMetaTitle: string,
  focusKeywords: string,
  profileData?: WriterProfileData
): Promise<SuggestedSeoElements> {
    const aiClient = await initializeAI();
    const selectedModel = profileData?.selectedModel || DEFAULT_TEXT_MODEL;

    const baseSystemInstruction = `You are an SEO expert. Your task is to generate SEO elements for a blog post based on its content.
You must return a single JSON object with the following keys: "suggestedTitle", "suggestedMetaTitle", "suggestedMetaDescription", "suggestedSlug".
Each field has STRICT length requirements.
- suggestedTitle: A compelling H1 title. Must be between ${TITLE_MIN_LENGTH} and ${TITLE_MAX_LENGTH} characters.
- suggestedMetaTitle: A concise and keyword-rich HTML title tag. Must be between ${META_TITLE_MIN_LENGTH} and ${META_TITLE_MAX_LENGTH} characters.
- suggestedMetaDescription: An enticing meta description. MUST be between ${META_DESCRIPTION_MIN_LENGTH} and ${META_DESCRIPTION_MAX_LENGTH} characters INCLUDING SPACES. It ABSOLUTELY MUST NOT exceed ${META_DESCRIPTION_MAX_LENGTH} characters. Aim for around 140-150 characters to be safe.
- suggestedSlug: A URL-friendly slug, based on the suggested title. Lowercase, hyphen-separated.`;

    const userRequest = `
Focus Keywords: ${focusKeywords}
Current H1 Title: "${currentTitle}"
Current Meta Title: "${currentMetaTitle}"

Blog Post Content (first 3000 characters for context):
${mainContent.substring(0, 3000)}

Generate the JSON object with the specified SEO elements based on the content and keywords. Ensure all length constraints are met, especially for the meta description.
`;

    const prompt = buildPromptWithProfile(baseSystemInstruction, userRequest, profileData, 'seo');

    try {
        const response: GenerateContentResponse = await aiClient.models.generateContent({
            model: selectedModel,
            contents: prompt,
            config: {
                temperature: 0.5,
                responseMimeType: "application/json",
            }
        });

        return parseJsonResponse<SuggestedSeoElements>(response.text, {
            suggestedTitle: '',
            suggestedMetaTitle: '',
            suggestedMetaDescription: '',
            suggestedSlug: ''
        });
    } catch (error) {
        handleApiError(error, 'generateMetaAndSlug');
    }
}

export async function generateImagePromptIdea(
  mainContent: string,
  profileData?: WriterProfileData
): Promise<string> {
  const aiClient = await initializeAI();
  const selectedModel = profileData?.selectedModel || DEFAULT_TEXT_MODEL;
  const baseSystemInstruction = `You are a creative assistant. Your task is to read a blog post and suggest a single, detailed, and visually interesting image prompt for a text-to-image model. The prompt should capture the essence of the blog post.`;
  const userRequest = `
Blog Content (first 2000 characters for context):
${mainContent.substring(0, 2000)}

Based on the content, generate one creative prompt for a feature image. The prompt should be descriptive and ready to be used by an image generation AI.
`;
  const prompt = buildPromptWithProfile(baseSystemInstruction, userRequest, profileData, 'imagePrompt');
  try {
    const response = await aiClient.models.generateContent({ model: selectedModel, contents: prompt });
    const text = response.text;
    if (!text) {
        throw new Error("Failed to generate image prompt idea, response was empty.");
    }
    return text.trim();
  } catch (error) {
    handleApiError(error, 'generateImagePromptIdea');
  }
}

export async function refineGeneratedImagePrompt(
  currentPrompt: string,
  refinementInstructions: string,
  profileData?: WriterProfileData
): Promise<string> {
  const aiClient = await initializeAI();
  const selectedModel = profileData?.selectedModel || DEFAULT_TEXT_MODEL;
  const baseSystemInstruction = `You are a prompt engineer. Your task is to refine an existing image generation prompt based on user instructions. You must return only the new, updated prompt.`;
  const userRequest = `
Current Image Prompt: "${currentPrompt}"

User's Refinement Instructions: "${refinementInstructions}"

Rewrite the prompt to incorporate the user's instructions. Output only the final, complete prompt.
`;
  const prompt = buildPromptWithProfile(baseSystemInstruction, userRequest, profileData, 'imagePrompt');
  try {
    const response = await aiClient.models.generateContent({ model: selectedModel, contents: prompt });
    const text = response.text;
    if (!text) {
        throw new Error("Failed to refine image prompt, response was empty.");
    }
    return text.trim();
  } catch (error) {
    handleApiError(error, 'refineGeneratedImagePrompt');
  }
}

export async function generateImageFromFinalPrompt(prompt: string): Promise<string> {
  const aiClient = await initializeAI();
  try {
    const response = await aiClient.models.generateImages({
      model: IMAGE_GENERATION_MODEL,
      prompt,
      config: { numberOfImages: 1, outputMimeType: 'image/jpeg' }
    });
    if (response.generatedImages && response.generatedImages.length > 0) {
      return response.generatedImages[0].image.imageBytes;
    }
    throw new Error("No image was generated by the API.");
  } catch (error) {
    handleApiError(error, 'generateImageFromFinalPrompt');
  }
}

export async function generateSocialMediaPosts(
  mainContent: string,
  seo: SeoSettings,
  platform: SocialMediaPlatform,
  profileData?: WriterProfileData
): Promise<string[]> {
  const aiClient = await initializeAI();
  const selectedModel = profileData?.selectedModel || DEFAULT_TEXT_MODEL;
  const fullUrl = (seo.blogPostUrl.endsWith('/') ? seo.blogPostUrl : seo.blogPostUrl + '/') + seo.slug;

  const baseSystemInstruction = `You are a social media manager. Your task is to create 3 distinct social media posts to promote a blog article.
You must return a JSON array of strings, where each string is a social media post. Example: ["Post 1 text...", "Post 2 text...", "Post 3 text..."].
The posts should be tailored for the specified platform and include the blog post URL.`;

  const userRequest = `
Platform: ${platform.name}
${platform.charLimit ? `Character Limit: ${platform.charLimit}` : ''}
Platform Notes: ${platform.notes}

Blog Title: ${seo.title}
Blog URL: ${fullUrl}

Blog Content (first 2000 characters for context):
${mainContent.substring(0, 2000)}

Generate a JSON array with 3 distinct posts for ${platform.name}, following the platform's best practices and notes.
`;

  const prompt = buildPromptWithProfile(baseSystemInstruction, userRequest, profileData, 'social');
  try {
    const response = await aiClient.models.generateContent({
      model: selectedModel,
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    return parseJsonResponse<string[]>(response.text, []);
  } catch (error) {
    handleApiError(error, 'generateSocialMediaPosts');
  }
}

export async function estimateKeywordVolumeAndSuggest(
  keywords: string,
  profileData?: WriterProfileData
): Promise<KeywordVolumeAnalysisResult> {
  const aiClient = await initializeAI();
  const selectedModel = profileData?.selectedModel || DEFAULT_TEXT_MODEL;
  const baseSystemInstruction = `You are an SEO keyword research tool. Analyze the user's keywords and suggest alternatives.
You MUST return a single, clean JSON object and nothing else. Do not add any conversational text, explanations, or markdown formatting like \`\`\`json. The entire response must be only the raw JSON.
The JSON object must have this exact format:
{
  "analyzedKeywords": [{ "keyword": string, "estimatedVolume": string, "notes": string }],
  "suggestedKeywords": [{ "keyword": string, "estimatedVolume": string, "reason": string }]
}
- "estimatedVolume" should be one of: "Very High", "High", "Medium", "Low", "Very Low". This is an estimation based on general knowledge, not real-time data.`;

  const userRequest = `
User's Keywords (comma-separated): "${keywords}"

Please perform the following tasks:
1.  For each keyword provided by the user, provide an estimated search volume.
2.  Suggest 3-5 alternative or related keywords, including long-tail variations, with their estimated search volumes and a brief reason for the suggestion.

Return the result as a single JSON object in the specified format.
`;
  const prompt = buildPromptWithProfile(baseSystemInstruction, userRequest, profileData, 'keywordAnalysis');
  try {
    const response = await aiClient.models.generateContent({
      model: selectedModel,
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    return parseJsonResponse<KeywordVolumeAnalysisResult>(response.text, { analyzedKeywords: [], suggestedKeywords: [] });
  } catch (error) {
    handleApiError(error, 'estimateKeywordVolumeAndSuggest');
  }
}


export async function improveKeywordDensity(
  mainContent: string,
  primaryKeyword: string,
  currentWordCount: number,
  profileData?: WriterProfileData,
  wordCountSettings?: { minWordCount?: number; maxWordCount?: number; }
): Promise<string> {
    const aiClient = await initializeAI();
    const selectedModel = profileData?.selectedModel || DEFAULT_TEXT_MODEL;

    let wordCountConstraint = '';
    if (wordCountSettings) {
        const { minWordCount, maxWordCount } = wordCountSettings;
        if (minWordCount && maxWordCount) {
            wordCountConstraint = `The revised text must remain between ${minWordCount} and ${maxWordCount} words. The current word count is ${currentWordCount}.`;
        } else if (minWordCount) {
            wordCountConstraint = `The revised text must be at least ${minWordCount} words. The current word count is ${currentWordCount}.`;
        } else if (maxWordCount) {
            wordCountConstraint = `The revised text must not exceed ${maxWordCount} words. The current word count is ${currentWordCount}.`;
        }
    }


    const baseSystemInstruction = `You are an expert SEO editor and HTML specialist. Your task is to revise a blog post's HTML content to improve its keyword density for a specific keyword.

**CRITICAL INSTRUCTIONS:**
1.  **Preserve HTML Integrity:** The HTML you return MUST be perfectly valid. Do not add unclosed tags, malformed attributes, or break the existing structure. Your primary goal is to edit the text *inside* existing tags like \`<p>\`, \`<li>\`, \`<h2>\`, etc.
2.  **Natural Integration:** Increase the occurrences of the primary keyword to achieve a density of approximately 1-1.5%. The integration must be natural and contextually appropriate. Do not force keywords where they don't belong.
3.  **Return Full Content:** You must return the full, revised HTML content of the blog post. Do not add any commentary, explanations, or markdown fences around the code. The output should be pure HTML.
${wordCountConstraint}`;

    const userRequest = `
Primary Keyword to improve: "${primaryKeyword}"
Current Word Count: ${currentWordCount}

Revise the following HTML content to naturally increase the density of "${primaryKeyword}".
Integrate the keyword into paragraphs, and if possible, into subheadings (H2, H3, etc.) where it makes sense.
Do not change the overall meaning or structure of the text drastically. The changes should be subtle and improve SEO.

**Original HTML Content:**
${mainContent}
`;

    const prompt = buildPromptWithProfile(baseSystemInstruction, userRequest, profileData, 'text');
    try {
        const response: GenerateContentResponse = await aiClient.models.generateContent({
            model: selectedModel,
            contents: prompt
        });
        const text = response.text;
        if (!text) {
            throw new Error("Failed to improve keyword density, response was empty.");
        }
        return text.trim();
    } catch (error) {
        handleApiError(error, 'improveKeywordDensity');
    }
}


export async function searchGoogleNews(query: string): Promise<GoogleNewsSearchResult> {
  const aiClient = await initializeAI();
  try {
    const response = await aiClient.models.generateContent({
      model: DEFAULT_TEXT_MODEL,
      contents: `Find recent news articles and reliable sources about "${query}".
First, provide a brief overall summary.
Then, list the top 3-5 articles. For each article, you MUST provide the title, link, and a brief snippet.
You MUST format each article entry EXACTLY like this, with "ARTICLE_START", "TITLE:", "LINK:", "SNIPPET:", and "ARTICLE_END" markers:

ARTICLE_START
TITLE: [The full article title]
LINK: [The full, valid URL]
SNIPPET: [A one or two sentence summary of the article]
ARTICLE_END
`,
      config: {
        tools: [{googleSearch: {}}],
      },
    });

    const metadata = response.candidates?.[0]?.groundingMetadata;
    const groundingSources: GroundingSource[] = metadata?.groundingChunks
        ?.map(c => c.web)
        .filter((web): web is GroundingSource => !!web && !!web.uri && !!web.title) || [];
    
    const textResponse = response.text;
    const articles: Article[] = [];
    
    if (textResponse) {
        const articleBlockRegex = /ARTICLE_START([\s\S]*?)ARTICLE_END/g;
        let blockMatch;
        while ((blockMatch = articleBlockRegex.exec(textResponse)) !== null) {
            const block = blockMatch[1];
            const titleMatch = block.match(/TITLE:\s*([\s\S]*?)\s*LINK:/);
            const linkMatch = block.match(/LINK:\s*([\s\S]*?)\s*SNIPPET:/);
            const snippetMatch = block.match(/SNIPPET:\s*([\s\S]*)/);

            const title = titleMatch?.[1]?.trim();
            const link = linkMatch?.[1]?.trim();
            const snippet = snippetMatch?.[1]?.trim();

            if (title && link && snippet) {
                articles.push({
                    title,
                    link,
                    snippet,
                });
            }
        }
    }


    // If parsing fails, fall back to grounding sources as a last resort
    if (articles.length === 0 && groundingSources.length > 0) {
      groundingSources.forEach(source => {
        articles.push({
          title: source.title || 'Untitled Source',
          link: source.uri,
          snippet: `Source from Google Search. Visit the link for more information.`
        });
      });
    }

    return { articles, groundingSources };
  } catch (error) {
    handleApiError(error, 'searchGoogleNews');
  }
}


export async function deepResearchOnTopic(title: string, link: string, snippet: string): Promise<string> {
    const aiClient = await initializeAI();
    try {
        const response = await aiClient.models.generateContent({
            model: DEFAULT_TEXT_MODEL,
            contents: `You are a professional research analyst. Conduct comprehensive research on the article titled "${title}" from ${link}. 

Initial snippet: "${snippet}"

Provide a detailed analysis following this structure:

## Executive Summary
[2-3 sentence summary of the main points]

## Search Intent Analysis
[Primary intent: Informational/Navigational/Commercial/Transactional]
[Top user questions identified from search data]
[Related search queries people are making]

## Key Findings
[Bullet points of the most important discoveries, facts, or conclusions]

## Supporting Data & Statistics
[Any numbers, percentages, study results, or quantitative data mentioned]

## Expert Opinions & Quotes
[Notable quotes from experts, officials, or key stakeholders]

## Common Questions & Topics
[Questions from "People Also Ask" sections]
[Forum/community questions found on this topic]
[Question-based search queries related to the topic]

## Implications & Impact
[What this means for the industry/topic, potential consequences]

## Actionable Insights
[Practical takeaways that could be used in blog content]

## Related Topics to Explore
[2-3 related areas that could be investigated further]

Use markdown formatting throughout. If specific sections have no relevant information, note "No relevant data found" rather than omitting the section.`,
            config: {
                tools: [{ googleSearch: {} }]
            }
        });

        const researchSummary = response.text || "[No detailed summary could be generated from the source.]";
        
        return `# Deep Research Analysis\n\n**Article:** ${title}\n**Source:** ${link}\n**Original Snippet:** ${snippet}\n\n---\n\n${researchSummary}\n\n---\n\n*Research completed: ${new Date().toISOString().split('T')[0]}*`;
    } catch (error) {
        handleApiError(error, 'deepResearchOnTopic');
    }
}

export async function analyzeArticleViralPotential(article: Article): Promise<ArticleStats> {
  const aiClient = await initializeAI();
  const selectedModel = DEFAULT_TEXT_MODEL;

  const baseSystemInstruction = `You are a viral content analyst. Your task is to analyze an article's title, snippet, and link to predict its potential for going viral. You must respond with a single, clean JSON object. Do not add any commentary before or after the JSON.

  const JSON object must have this exact structure:
  {
    "estimatedEngagementScore": number, // An integer score from 0 (no engagement) to 100 (extremely high viral potential).
    "sentiment": "Positive" | "Negative" | "Neutral" | "Mixed", // The overall sentiment of the topic.
    "keyTakeaways": string[], // An array of 2-3 brief, impactful bullet points summarizing the core message.
    "potentialAngles": string[] // An array of 2-3 creative angles to make a blog post on this topic more shareable and viral.
  }`;

  const userRequest = `
  Analyze the following article for its viral potential.

  **Article Title:** ${article.title}
  **Article Snippet:** ${article.snippet}
  **Article Link:** ${article.link}

  Provide your analysis in the specified JSON format. Consider factors like emotional impact, controversy, timeliness, and broad appeal when generating the engagement score and angles.
  `;
  
  const prompt = baseSystemInstruction + "\n\n" + userRequest;

  try {
    const response = await aiClient.models.generateContent({
      model: selectedModel,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.4
      }
    });

    return parseJsonResponse<ArticleStats>(response.text, {
      estimatedEngagementScore: 0,
      sentiment: 'Neutral',
      keyTakeaways: [],
      potentialAngles: []
    });
  } catch (error) {
    handleApiError(error, 'analyzeArticleViralPotential');
  }
}

export async function generateTrendingQuestions(
  topic: string,
  profileData?: WriterProfileData
): Promise<string[]> {
  const aiClient = await initializeAI();
  const selectedModel = profileData?.selectedModel || DEFAULT_TEXT_MODEL;

  const baseSystemInstruction = `You are a content strategy expert specializing in SEO and viral content. Your task is to generate a list of 15 trending questions and headline ideas that consumers are asking related to a given topic.
  These should be phrased as engaging headlines for blog posts.
  You MUST respond with a single, clean JSON array of strings. Example: ["Headline 1", "Headline 2", ...].
  Do not add any commentary before or after the JSON. The array should contain exactly 15 strings.`;

  const userRequest = `
  Topic: "${topic}"

  Generate 15 trending questions and headline ideas. The ideas should cover a range of formats, such as "how-to" guides, listicles (e.g., "7 Ways to..."), comparison posts, and "why" explanations.
  The headlines should be compelling and designed to attract clicks.
  
  For example, if the topic is "real estate CRM", a related subtopic might be "How these 10 lead follow-up ideas can produce a 25% increase in closed sales".

  Return your suggestions as a JSON array of 15 strings.
  `;

  const prompt = buildPromptWithProfile(baseSystemInstruction, userRequest, profileData, 'keywordAnalysis');
  
  try {
    const response = await aiClient.models.generateContent({
      model: selectedModel,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.8
      }
    });

    return parseJsonResponse<string[]>(response.text, []);
  } catch (error) {
    handleApiError(error, 'generateTrendingQuestions');
  }
}

export async function researchHeadlineIdea(headline: string): Promise<string> {
    const aiClient = await initializeAI();
    try {
        const response = await aiClient.models.generateContent({
            model: DEFAULT_TEXT_MODEL,
            contents: `You are a strategic content researcher. Analyze the headline "${headline}" and provide comprehensive research that will serve as the foundation for creating high-quality blog content.

**Research Framework:**

## Topic Validation & Market Analysis
- Is this topic currently relevant and trending?
- What's the search interest and audience demand?
- Who is the target audience for this topic?

## Current Landscape Analysis
- Latest developments and news in this area
- Key players, companies, or experts involved
- Recent changes or updates to consider

## Content Angle Opportunities
- Unique perspectives not widely covered
- Controversial or debatable aspects
- Personal stories or case studies available
- Data-driven insights possible

## Supporting Evidence & Data
- Statistics, research studies, surveys
- Expert quotes and authoritative sources
- Industry reports or market data
- Real-world examples and success stories

## Content Strategy Recommendations
- Best content format (how-to, listicle, analysis, etc.)
- Optimal content length and depth
- Key SEO keywords to target
- Internal/external linking opportunities

## Competitive Intelligence
- What content already exists on this topic?
- Content gaps in existing coverage
- Ways to differentiate and add unique value

Use detailed research and provide specific, actionable insights. Structure with clear markdown formatting.

**CRITICAL:** If insufficient information exists for meaningful analysis, respond only with: "Research was inconclusive."`,
            config: {
                tools: [{ googleSearch: {} }]
            }
        });

        const researchSummary = response.text;

        if (!researchSummary) {
            throw new Error("No detailed summary could be generated for this topic. The AI response was empty.");
        }

        if (researchSummary.trim() === "Research was inconclusive.") {
            throw new Error("Deep research was inconclusive. The topic may be too niche or no relevant results were found by the AI.");
        }
        
        return `# Strategic Content Research\n\n**Headline Analysis:** ${headline}\n\n---\n\n${researchSummary}\n\n---\n\n*Strategic analysis completed: ${new Date().toISOString().split('T')[0]}*`;
    } catch (error) {
      if (error instanceof Error && (error.message.includes('429') || /quota|rate limit/i.test(error.message))) {
        handleApiError(error, 'researchHeadlineIdea');
      }
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during deep research.";
      throw new Error(errorMessage);
    }
}

export async function generateWebsiteContext(urls: string[]): Promise<string> {
  const aiClient = await initializeAI();
  const model = aiClient.models.generateContent;

  const summaryPromises = urls.map(url =>
    model({
      model: DEFAULT_TEXT_MODEL,
      contents: `Please provide a concise, one to two-sentence summary of the content at the following URL: ${url}. 
      Focus on the main topic and purpose of the page. This summary will be used to help an AI decide when to create an internal link to this page.`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    }),
  );

  const results = await Promise.allSettled(summaryPromises);

  const summaries: string[] = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const url = urls[i]; // Get the corresponding URL

    if (result.status === 'fulfilled') {
      const summaryText = result.value.text;
      if (summaryText) {
        summaries.push(`URL: ${url}\nSummary: ${summaryText.trim().replace(/\n/g, ' ')}`);
      }
    } else {
      if (result.reason instanceof RateLimitError) {
        // A single rate limit error will fail the whole batch for now.
        // The UI will catch this and show the error.
        throw result.reason;
      }
      // For other errors, log them and add a failure message for that specific URL.
      console.warn(`Could not generate summary for URL ${url}:`, result.reason);
      summaries.push(`URL: ${url}\nSummary: Could not retrieve summary for this page.`);
    }
  }

  return summaries.join('\n\n');
}

export async function suggestInternalLinks(
  mainContent: string,
  profileData?: WriterProfileData
): Promise<string[]> {
  const aiClient = await initializeAI();
  const selectedModel = profileData?.selectedModel || DEFAULT_TEXT_MODEL;

  const baseSystemInstruction = `You are an expert SEO strategist specializing in internal linking. Your task is to analyze blog post content and suggest relevant internal links from a provided list of available website pages. This list of pages is provided under the heading "INTERNAL LINKING CONTEXT".
You MUST return a single, clean JSON array of strings, where each string is a URL from the provided context.
Example: ["https://yourdomain.com/page-1", "https://yourdomain.com/page-2"]
Do not return more than 4 links. Do not add any commentary or text outside of the JSON array.`;

  const userRequest = `
Based on the blog content below, analyze the available pages (provided in the system instructions) and select up to 4 of the most relevant URLs for internal linking. The links should add value to the reader and be contextually appropriate.
Return your suggestions as a JSON array of URL strings.

Blog Post Content (for analysis):
${mainContent.substring(0, 8000)}
`;
  
  const prompt = buildPromptWithProfile(baseSystemInstruction, userRequest, profileData, 'internalLinking');

  try {
    const response = await aiClient.models.generateContent({
      model: selectedModel,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.3,
      },
    });
    return parseJsonResponse<string[]>(response.text, []);
  } catch (error) {
    handleApiError(error, 'suggestInternalLinks');
  }
}

// Link verification utility function
async function verifyLinkQuality(url: string): Promise<{ isValid: boolean; statusCode?: number; error?: string }> {
  try {
    // Basic URL format validation
    const urlObj = new URL(url);
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return { isValid: false, error: 'Invalid protocol' };
    }

    // Check if it looks like a valid, specific article URL (not just a homepage)
    const path = urlObj.pathname;
    const hasSpecificPath = path.length > 1 && path !== '/';
    
    // Allow paths that end with '/' if they have substantial content before it
    const pathWithoutSlash = path.replace(/\/$/, '');
    const pathSegments = pathWithoutSlash.split('/').filter(segment => segment.length > 0);
    
    if (!hasSpecificPath || pathSegments.length < 2) {
      return { isValid: false, error: 'URL appears to be a homepage or invalid path' };
    }

    // Due to CORS restrictions, we can't actually verify URLs in the browser
    // The AI must do proper verification through Google Search
    // We'll rely on domain reputation and URL structure for now
    return { isValid: true, statusCode: 200 };
    
  } catch (error) {
    return { isValid: false, error: error instanceof Error ? error.message : 'Invalid URL format' };
  }
}

// Helper function to detect placeholder URLs that the AI might generate
function isPlaceholderUrl(url: string): boolean {
  const placeholderPatterns = [
    /^URL_TO_/i,
    /^https?:\/\/example\./i,
    /^https?:\/\/your-website\./i,
    /^https?:\/\/placeholder\./i,
    /\[URL\]/i,
    /INSERT_URL/i,
    /REPLACE_WITH_URL/i,
    /^https?:\/\/\[/i, // URLs starting with https://[
  ];
  
  return placeholderPatterns.some(pattern => pattern.test(url));
}

// Helper function to validate URL format
function isValidUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    // Must have http or https protocol
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return false;
    }
    // Must have a valid hostname
    if (!urlObj.hostname || urlObj.hostname.length < 3) {
      return false;
    }
    // Must have a valid TLD
    if (!urlObj.hostname.includes('.') || urlObj.hostname.endsWith('.')) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// Domain reputation checker
function isReputableDomain(url: string): boolean {
  try {
    const domain = new URL(url).hostname.toLowerCase();
    
    // High-authority domains (government, education, major organizations)
    const highAuthorityDomains = [
      // Government
      '.gov', '.edu',
      // Major news and business
      'reuters.com', 'bloomberg.com', 'wsj.com', 'forbes.com', 'fortune.com',
      'harvard.edu', 'stanford.edu', 'mit.edu', 'cnn.com', 'bbc.com',
      'nytimes.com', 'washingtonpost.com', 'economist.com',
      // Research and academic
      'ncbi.nlm.nih.gov', 'scholar.google.com', 'pubmed.ncbi.nlm.nih.gov',
      'nature.com', 'science.org', 'cell.com', 'sciencedirect.com',
      // Major organizations
      'who.int', 'worldbank.org', 'un.org', 'unesco.org',
      // Tech authorities  
      'mozilla.org', 'w3.org', 'ietf.org', 'stackoverflow.com',
      // Business authorities
      'mckinsey.com', 'bcg.com', 'deloitte.com', 'pwc.com',
      // Industry-specific authorities
      // Real Estate
      'nar.realtor', 'realtor.com', 'zillow.com', 'housingwire.com',
      'theclose.com', 'homelight.com', 'inman.com', 'realtrends.com',
      // Home improvement
      'hgtv.com', 'thisoldhouse.com', 'bobvila.com', 'familyhandyman.com',
      // Health
      'mayoclinic.org', 'webmd.com', 'healthline.com', 'medicalnewstoday.com',
      // Finance
      'investopedia.com', 'morningstar.com', 'sec.gov', 'federalreserve.gov',
      'nerdwallet.com', 'bankrate.com', 'creditkarma.com', 'mint.com', 'marketwatch.com',
      // Technology
      'techcrunch.com', 'wired.com', 'arstechnica.com', 'zdnet.com',
      // Marketing/Business
      'hubspot.com', 'salesforce.com', 'marketingland.com',
      // Training and Professional Development
      'setsail.training', 'thepaperlessagent.com', 'avenuehq.com'
    ];

    // Check if domain ends with high-authority TLD or is in our list
    const isHighAuthority = highAuthorityDomains.some(auth => 
      domain.endsWith(auth) || domain.includes(auth)
    );

    // Avoid clearly low-quality domains (more permissive now)
    const lowQualityPatterns = [
      'blogspot.com', 'wordpress.com', 
      'quora.com', 'reddit.com', 'facebook.com', 'twitter.com',
      'linkedin.com/pulse', 'youtube.com',
      'scam', 'spam', 'fake'
    ];

    const isLowQuality = lowQualityPatterns.some(pattern => 
      domain.includes(pattern)
    );

    // Be more permissive - if it's not explicitly low quality, allow it
    // unless we're specifically looking for high authority
    return isHighAuthority || !isLowQuality;
  } catch {
    return false;
  }
}

export async function suggestExternalLinks(
  mainContent: string,
  keywords: string[],
  profileData?: WriterProfileData
): Promise<ExternalLinkSuggestion[]> {
  // Check if Google Custom Search is configured for this profile
  if (profileData?.googleSearchConfig && googleSearchService.isConfigured(profileData.googleSearchConfig)) {
    console.log('🔍 Using Google Custom Search API for external links...');
    return await suggestExternalLinksWithCustomSearch(mainContent, keywords, profileData);
  } else {
    console.log('🔍 Using fallback Gemini search for external links...');
    return await suggestExternalLinksWithGemini(mainContent, keywords, profileData);
  }
}

async function suggestExternalLinksWithCustomSearch(
  mainContent: string,
  keywords: string[],
  profileData?: WriterProfileData
): Promise<ExternalLinkSuggestion[]> {
  try {
    // Extract key topics from the content and keywords
    const topics = [...keywords];
    
    // Add extracted topics from content (basic extraction)  
    const sentences = mainContent.replace(/<[^>]*>/g, '').split(/[.!?]+/);
    // Extract additional topics from important sentences
    const importantSentences = sentences
      .filter(sentence => sentence.length > 50 && sentence.length < 200)
      .slice(0, 3);
    
    // Add key phrases from important sentences to topics
    importantSentences.forEach(sentence => {
      const words = sentence.toLowerCase().split(/\s+/);
      // Look for potential key phrases (2-3 word combinations)
      for (let i = 0; i < words.length - 1; i++) {
        const phrase = words.slice(i, i + 2).join(' ');
        if (phrase.length > 8 && !topics.some(t => t.toLowerCase().includes(phrase))) {
          topics.push(phrase);
        }
      }
    });
    
    // Use Google Custom Search to find authoritative links
    const suggestions = await googleSearchService.findAuthoritativeLinks(topics, profileData.googleSearchConfig!, [], mainContent);
    
    console.log(`📊 Google Custom Search found ${suggestions.length} relevant links with proper anchor text`);
    return suggestions.slice(0, 5); // Limit to 5 suggestions
    
  } catch (error) {
    console.error('💥 Error with Google Custom Search, falling back to Gemini:', error);
    // If it's a rate limit error, show a helpful message
    if (error instanceof Error && (error.message.includes('429') || error.message.includes('quota') || error.message.includes('Quota'))) {
      console.warn('🚫 Google Custom Search API quota exceeded. Falling back to Gemini search.');
    }
    return await suggestExternalLinksWithGemini(mainContent, keywords, profileData);
  }
}

async function suggestExternalLinksWithGemini(
  mainContent: string,
  keywords: string[],
  profileData?: WriterProfileData
): Promise<ExternalLinkSuggestion[]> {
  const aiClient = await initializeAI();
  const selectedModel = profileData?.selectedModel || DEFAULT_TEXT_MODEL;

  const baseSystemInstruction = `You are a meticulous SEO expert and research analyst with a focus on sourcing high-quality, authoritative, and **currently live** external links. Your reputation depends on the quality and validity of the links you suggest. Every link you provide must lead to a valid, working webpage.

**CRITICAL RULES for Link Sourcing & Verification:**

⚠️ **MANDATORY SEARCH REQUIREMENT:** You MUST use the Google Search tool for EVERY SINGLE LINK you suggest. DO NOT use any URLs from your training data or memory. Every URL must come from a fresh Google search.

**STEP-BY-STEP PROCESS YOU MUST FOLLOW:**
1. **Search First:** For each potential link opportunity, perform a Google search using relevant keywords
2. **Verify Domain Authority:** Only select results from these high-authority domains:
   - **Tier 1:** Government (.gov), Educational (.edu), Major research (ncbi.nlm.nih.gov, nature.com, science.org)  
   - **Tier 2:** Major news & finance (reuters.com, bloomberg.com, wsj.com, forbes.com, cnn.com, nytimes.com, marketwatch.com)
   - **Tier 3:** Industry publications & organizations (realtor.com, zillow.com, nar.realtor, investopedia.com, nerdwallet.com, bankrate.com)
   - **Tier 4:** Educational institutions (harvard.edu, mit.edu, stanford.edu) and reputable consulting (mckinsey.com, deloitte.com)
3. **Check Recency:** Prioritize articles from 2022-2024 (expanded range)
4. **Verify Specificity:** Ensure links go to specific articles, not homepages  
5. **CRITICAL - Verify URL Exists:** You MUST click on each URL in your search results to confirm it leads to a real, accessible page. DO NOT suggest URLs that return 404 errors or access denied pages.
6. **Double-Check with Additional Search:** Search for the exact URL to confirm it appears in Google's index

**SEARCH STRATEGY:**
- Use queries like: "site:realtor.com [topic] 2024"
- Use queries like: "site:investopedia.com [topic] 2023"  
- Use queries like: "site:nerdwallet.com [topic] 2024"
- Use queries like: "[topic] site:zillow.com OR site:bankrate.com"
- Always include recent year (2022-2024) in searches

**ABSOLUTELY FORBIDDEN:**
- Suggesting URLs without searching first
- Using links from your training knowledge
- Linking to personal blogs, WordPress.com, or content farms
- Suggesting homepage URLs or broken links
- Using placeholder URLs like "URL_TO_TOPIC" or "https://example.com/article"
- Generating fake or non-existent URLs

🚨 **CRITICAL JSON REQUIREMENT:** 
You MUST return ONLY a valid JSON array. NO explanatory text, NO commentary, NO reasoning. 
If you cannot find any suitable links, return an empty array: []

The array should contain up to 5 suggestion objects. Each object must have this exact structure:
{
  "url": string, // The full, verified, and working URL found through Google search
  "anchorText": string, // The specific text within the 'context' sentence that should become the hyperlink.
  "context": string // The complete, original sentence from the blog post where the link should be placed. This must be an exact match.
}

REMEMBER: Return ONLY the JSON array, nothing else.`;

  const keywordGuidance = keywords && keywords.length > 0
    ? `**Guiding Keywords:** Use these keyword phrases to focus your search for relevant sources. Find articles that discuss these topics:\n- ${keywords.join('\n- ')}\n`
    : '';

  const userRequest = `
🔍 **TASK: Find 5 External Link Opportunities Using Google Search**

**MANDATORY REQUIREMENTS:**
1. You MUST use Google Search tool before suggesting any URL
2. Search for recent (2023-2024) articles on authoritative domains only  
3. Verify each URL exists by searching for it directly
4. Only suggest URLs that appear in current Google search results

**PROCESS:**
1. Analyze the blog content below
2. Identify 5 places where external links would add value
3. For each opportunity:
   - Perform a Google search for relevant, recent articles
   - Select only results from high-authority domains
   - Verify the specific URL exists in search results
   - Extract the exact sentence from the blog content

${keywordGuidance}

**Blog Content to Analyze:**
${mainContent}

🚨 **CRITICAL RESPONSE FORMAT:** 
- Every URL MUST come from a Google search you perform AND be verified as working
- You MUST test each URL by clicking it in search results before suggesting it
- Return ONLY a JSON array - no explanation, no text, no reasoning
- If no suitable links found, return: []
- Example format: [{"url": "https://...", "anchorText": "...", "context": "..."}]
- QUALITY OVER QUANTITY: Better to return 1-2 working links than 5 broken ones
`;

  const prompt = buildPromptWithProfile(baseSystemInstruction, userRequest, profileData, 'externalLinking');

  try {
    console.log('🔍 Starting external link suggestion process...');
    const response = await aiClient.models.generateContent({
      model: selectedModel,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });
    
    console.log('📝 AI Response received:', response.text);
    const rawSuggestions = parseJsonResponse<ExternalLinkSuggestion[]>(response.text, []);
    console.log(`🔗 AI suggested ${rawSuggestions.length} links for verification`);
    
    // Log all suggested URLs for debugging
    rawSuggestions.forEach((suggestion, index) => {
      console.log(`🔗 Suggestion ${index + 1}:`);
      console.log(`   URL: ${suggestion.url}`);
      console.log(`   Anchor: ${suggestion.anchorText}`);
      console.log(`   Context: ${suggestion.context}`);
    });
    
    // Verify each suggested link
    const verifiedSuggestions: ExternalLinkSuggestion[] = [];
    
    for (const suggestion of rawSuggestions) {
      console.log(`🔍 Verifying link: ${suggestion.url}`);
      
      // First check if it's a placeholder URL (common issue)
      if (isPlaceholderUrl(suggestion.url)) {
        console.log(`❌ Skipping placeholder URL: ${suggestion.url}`);
        continue;
      }
      
      // Check if it's a properly formatted URL
      if (!isValidUrl(suggestion.url)) {
        console.log(`❌ Skipping invalid URL format: ${suggestion.url}`);
        continue;
      }
      
      // Check domain reputation first (faster)
      if (!isReputableDomain(suggestion.url)) {
        console.log(`❌ Skipping low-reputation domain: ${suggestion.url}`);
        continue;
      }
      
      // Verify link is accessible
      const verification = await verifyLinkQuality(suggestion.url);
      if (verification.isValid) {
        console.log(`✅ Link verified: ${suggestion.url} (Status: ${verification.statusCode})`);
        verifiedSuggestions.push(suggestion);
      } else {
        console.log(`❌ Link failed verification: ${suggestion.url} (${verification.error || 'Status: ' + verification.statusCode})`);
      }
    }
    
    console.log(`📊 Final result: ${verifiedSuggestions.length} verified links out of ${rawSuggestions.length} suggestions`);
    return verifiedSuggestions;
  } catch (error) {
    console.error('💥 Error in suggestExternalLinks:', error);
    handleApiError(error, 'suggestExternalLinks');
  }
}

// Enhanced Multi-Source Search Functions

export async function searchRedditTrends(query: string): Promise<Article[]> {
  const aiClient = await initializeAI();
  try {
    const response = await aiClient.models.generateContent({
      model: DEFAULT_TEXT_MODEL,
      contents: `Search Reddit for trending discussions about "${query}". Find the top 3-5 most engaging posts or discussions related to this topic. Focus on recent, high-engagement content (upvotes, comments).

For each Reddit post, format exactly like this:

ARTICLE_START
TITLE: [Post title or discussion topic]
LINK: [Full Reddit URL to the post]
SNIPPET: [Brief summary of the discussion, key points, or top comments]
ARTICLE_END`,
      config: {
        tools: [{googleSearch: {}}],
      },
    });

    const textResponse = response.text;
    const articles: Article[] = [];
    
    if (textResponse) {
      const articleBlockRegex = /ARTICLE_START([\s\S]*?)ARTICLE_END/g;
      let blockMatch;
      while ((blockMatch = articleBlockRegex.exec(textResponse)) !== null) {
        const block = blockMatch[1];
        const titleMatch = block.match(/TITLE:\s*([\s\S]*?)\s*LINK:/);
        const linkMatch = block.match(/LINK:\s*([\s\S]*?)\s*SNIPPET:/);
        const snippetMatch = block.match(/SNIPPET:\s*([\s\S]*)/);

        const title = titleMatch?.[1]?.trim();
        const link = linkMatch?.[1]?.trim();
        const snippet = snippetMatch?.[1]?.trim();

        if (title && link && snippet) {
          articles.push({
            title: `[Reddit] ${title}`,
            link,
            snippet,
            source: 'Reddit'
          });
        }
      }
    }

    return articles;
  } catch (error) {
    console.error('Error searching Reddit trends:', error);
    return []; // Return empty array on error rather than throwing
  }
}

export async function searchTwitterTrends(query: string): Promise<Article[]> {
  const aiClient = await initializeAI();
  try {
    const response = await aiClient.models.generateContent({
      model: DEFAULT_TEXT_MODEL,
      contents: `Search for trending Twitter/X discussions about "${query}". Find recent viral tweets, thread discussions, or trending hashtags related to this topic. Focus on high-engagement content.

For each trending item, format exactly like this:

ARTICLE_START
TITLE: [Tweet or discussion topic]
LINK: [Twitter/X URL if available, or use hashtag/trend identifier]
SNIPPET: [Summary of the trending discussion, key points, or viral content]
ARTICLE_END`,
      config: {
        tools: [{googleSearch: {}}],
      },
    });

    const textResponse = response.text;
    const articles: Article[] = [];
    
    if (textResponse) {
      const articleBlockRegex = /ARTICLE_START([\s\S]*?)ARTICLE_END/g;
      let blockMatch;
      while ((blockMatch = articleBlockRegex.exec(textResponse)) !== null) {
        const block = blockMatch[1];
        const titleMatch = block.match(/TITLE:\s*([\s\S]*?)\s*LINK:/);
        const linkMatch = block.match(/LINK:\s*([\s\S]*?)\s*SNIPPET:/);
        const snippetMatch = block.match(/SNIPPET:\s*([\s\S]*)/);

        const title = titleMatch?.[1]?.trim();
        const link = linkMatch?.[1]?.trim();
        const snippet = snippetMatch?.[1]?.trim();

        if (title && link && snippet) {
          articles.push({
            title: `[Twitter] ${title}`,
            link,
            snippet,
            source: 'Twitter'
          });
        }
      }
    }

    return articles;
  } catch (error) {
    console.error('Error searching Twitter trends:', error);
    return []; // Return empty array on error rather than throwing
  }
}

export async function analyzeCurrentTrends(query: string): Promise<{
  trendScore: number;
  trendDirection: 'rising' | 'declining' | 'stable';
  keyInsights: string[];
}> {
  const aiClient = await initializeAI();
  try {
    const response = await aiClient.models.generateContent({
      model: DEFAULT_TEXT_MODEL,
      contents: `Analyze current trends for "${query}". Search for recent data about this topic's popularity, search trends, and social media engagement. 

Provide analysis in this JSON format:
{
  "trendScore": number (0-100, where 100 is extremely trending),
  "trendDirection": "rising" | "declining" | "stable",
  "keyInsights": ["insight1", "insight2", "insight3"] (3-5 key trending insights)
}`,
      config: {
        tools: [{googleSearch: {}}],
      },
    });

    return parseJsonResponse(response.text, {
      trendScore: 50,
      trendDirection: 'stable' as const,
      keyInsights: ['No trend data available']
    });
  } catch (error) {
    console.error('Error analyzing trends:', error);
    return {
      trendScore: 50,
      trendDirection: 'stable' as const,
      keyInsights: ['Trend analysis unavailable']
    };
  }
}

export async function performEnhancedTopicSearch(query: string): Promise<{
  articles: Article[];
  groundingSources: GroundingSource[];
  trendAnalysis: {
    trendScore: number;
    trendDirection: 'rising' | 'declining' | 'stable';
    keyInsights: string[];
  };
  diverseSources: {
    reddit: Article[];
    twitter: Article[];
  };
}> {
  try {
    // Run all searches in parallel for better performance
    const [newsResults, trendAnalysis, redditResults, twitterResults] = await Promise.all([
      searchGoogleNews(query),
      analyzeCurrentTrends(query),
      searchRedditTrends(query),
      searchTwitterTrends(query)
    ]);

    return {
      articles: newsResults.articles,
      groundingSources: newsResults.groundingSources,
      trendAnalysis,
      diverseSources: {
        reddit: redditResults,
        twitter: twitterResults
      }
    };
  } catch (error) {
    handleApiError(error, 'performEnhancedTopicSearch');
  }
}

/**
 * Generate category and tag suggestions based on blog content and focus keywords
 */
export const generateCategoriesAndTags = async (
  content: string,
  focusKeywords: string,
  profileData?: WriterProfileData
): Promise<{ categories: string; tags: string }> => {
  try {
    console.log('🏷️ Starting generateCategoriesAndTags...');
    const aiClient = await initializeAI();
    const selectedModel = profileData?.selectedModel || DEFAULT_TEXT_MODEL;
    console.log('🏷️ Using model:', selectedModel);
    
    const brandVoiceContext = profileData?.brandVoice ? `Brand Voice Context: ${profileData.brandVoice}\n\n` : '';
    const websiteContext = profileData?.websiteContext ? `Website Context: ${profileData.websiteContext}\n\n` : '';
    
    const prompt = `${brandVoiceContext}${websiteContext}Analyze the following blog content and focus keywords to suggest appropriate categories and tags:

**Blog Content:**
${content.slice(0, 2000)}...

**Focus Keywords:**
${focusKeywords}

Please suggest:
1. **Categories**: 2-4 broad, high-level categories that this content fits into (e.g., "Marketing, Technology, Business")
2. **Tags**: 6-10 specific, relevant tags that describe the content in detail (e.g., "content marketing, SEO optimization, digital strategy, blog writing")

Requirements:
- Categories should be broad and suitable for website navigation
- Tags should be specific and searchable
- Use the same industry terminology as the website context
- Consider the brand voice and target audience
- Make suggestions that would help with SEO and content organization

Format your response as:
Categories: category1, category2, category3
Tags: tag1, tag2, tag3, tag4, tag5, tag6, tag7, tag8`;

    console.log('🏷️ Making API call...');
    const response: GenerateContentResponse = await aiClient.models.generateContent({
      model: selectedModel,
      contents: prompt,
      config: {
        temperature: 0.7,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 200,
      }
    });
    
    console.log('🏷️ API response received:', response);
    const text = response.text;
    console.log('🏷️ Response text:', text);

    // Parse the response
    const categoryMatch = text.match(/Categories:\s*([^\n]+)/i);
    const tagMatch = text.match(/Tags:\s*([^\n]+)/i);
    
    const categories = categoryMatch ? categoryMatch[1].trim() : '';
    const tags = tagMatch ? tagMatch[1].trim() : '';

    return {
      categories,
      tags
    };
  } catch (error) {
    handleApiError(error, 'generateCategoriesAndTags');
    return { categories: '', tags: '' };
  }
}