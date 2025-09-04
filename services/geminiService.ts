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


const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set. AI features will not work.");
}
const ai = new GoogleGenAI({ apiKey: API_KEY }); 

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
  if (profileData?.knowledgeDocumentsText && (context === 'text' || context === 'keywordAnalysis' || context === 'seo')) { 
    fullPrompt += `\n\n**Relevant Knowledge Base (Use this information to inform your response if relevant):**\n${profileData.knowledgeDocumentsText}`;
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
  if (!API_KEY) return Promise.reject(new Error("API Key not configured. Cannot generate blog post."));

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
    const response: GenerateContentResponse = await ai.models.generateContent({
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
          const conclusionResponse = await ai.models.generateContent({
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
  if (!API_KEY) return Promise.reject(new Error("API Key not configured."));

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
    const response: GenerateContentResponse = await ai.models.generateContent({
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
    const selectedModel = profileData?.selectedModel || DEFAULT_TEXT_MODEL;

    const baseSystemInstruction = `You are an SEO expert. Your task is to generate SEO elements for a blog post based on its content.
You must return a single JSON object with the following keys: "suggestedTitle", "suggestedMetaTitle", "suggestedMetaDescription", "suggestedSlug".
Each field has STRICT length requirements.
- suggestedTitle: A compelling H1 title. Must be between ${TITLE_MIN_LENGTH} and ${TITLE_MAX_LENGTH} characters.
- suggestedMetaTitle: A concise and keyword-rich HTML title tag. Must be between ${META_TITLE_MIN_LENGTH} and ${META_TITLE_MAX_LENGTH} characters.
- suggestedMetaDescription: An enticing meta description. MUST be between ${META_DESCRIPTION_MIN_LENGTH} and ${META_DESCRIPTION_MAX_LENGTH} characters. It ABSOLUTELY MUST NOT exceed ${META_DESCRIPTION_MAX_LENGTH} characters.
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
        const response: GenerateContentResponse = await ai.models.generateContent({
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
  const selectedModel = profileData?.selectedModel || DEFAULT_TEXT_MODEL;
  const baseSystemInstruction = `You are a creative assistant. Your task is to read a blog post and suggest a single, detailed, and visually interesting image prompt for a text-to-image model. The prompt should capture the essence of the blog post.`;
  const userRequest = `
Blog Content (first 2000 characters for context):
${mainContent.substring(0, 2000)}

Based on the content, generate one creative prompt for a feature image. The prompt should be descriptive and ready to be used by an image generation AI.
`;
  const prompt = buildPromptWithProfile(baseSystemInstruction, userRequest, profileData, 'imagePrompt');
  try {
    const response = await ai.models.generateContent({ model: selectedModel, contents: prompt });
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
  const selectedModel = profileData?.selectedModel || DEFAULT_TEXT_MODEL;
  const baseSystemInstruction = `You are a prompt engineer. Your task is to refine an existing image generation prompt based on user instructions. You must return only the new, updated prompt.`;
  const userRequest = `
Current Image Prompt: "${currentPrompt}"

User's Refinement Instructions: "${refinementInstructions}"

Rewrite the prompt to incorporate the user's instructions. Output only the final, complete prompt.
`;
  const prompt = buildPromptWithProfile(baseSystemInstruction, userRequest, profileData, 'imagePrompt');
  try {
    const response = await ai.models.generateContent({ model: selectedModel, contents: prompt });
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
  try {
    const response = await ai.models.generateImages({
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
    const response = await ai.models.generateContent({
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
    const response = await ai.models.generateContent({
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
        const response: GenerateContentResponse = await ai.models.generateContent({
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
  try {
    const response = await ai.models.generateContent({
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
    try {
        const response = await ai.models.generateContent({
            model: DEFAULT_TEXT_MODEL,
            contents: `Based on the information found at the URL "${link}", please provide a detailed summary of the article titled "${title}". Focus on the key points, data, and conclusions. The initial snippet is: "${snippet}". Structure the output as a comprehensive research summary that can be used as source material for a blog post. Use markdown for formatting (headings, bullet points).`,
            config: {
                tools: [{ googleSearch: {} }] // Using general search with a specific URI is a good pattern
            }
        });

        const researchSummary = response.text || "[No detailed summary could be generated from the source.]";
        
        return `### Research on: ${title}\n\n**Source URL:** ${link}\n\n${researchSummary}`;
    } catch (error) {
        handleApiError(error, 'deepResearchOnTopic');
    }
}

export async function analyzeArticleViralPotential(article: Article): Promise<ArticleStats> {
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
    const response = await ai.models.generateContent({
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
    const response = await ai.models.generateContent({
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
    try {
        const response = await ai.models.generateContent({
            model: DEFAULT_TEXT_MODEL,
            contents: `You are an expert research assistant. Your goal is to conduct a thorough analysis of a given headline topic and provide a comprehensive summary.

            Follow this multi-step process:
            1.  **Formulate Search Queries:** Based on the headline "${headline}", create 2-3 effective search queries to gather diverse information.
            2.  **Execute Search:** Use your Google Search tool to find relevant articles, studies, and data points using the queries you formulated.
            3.  **Synthesize Findings:** Analyze the search results and synthesize the information into a detailed research summary. This summary will be used as the foundation for writing a blog post. It should cover key arguments, statistics, different perspectives, and actionable insights.

            **Output Formatting:**
            - Structure the entire summary using markdown for clarity (e.g., use H2s or H3s for sections, bullet points for lists).
            - **CRITICAL:** If, after searching, you cannot find sufficient information to create a meaningful summary, you MUST respond with ONLY the exact phrase: "Research was inconclusive." Do not add any other text.

            Begin your research.`,
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
        
        return `### Research on Headline Idea: ${headline}\n\n${researchSummary}`;
    } catch (error) {
      if (error instanceof Error && (error.message.includes('429') || /quota|rate limit/i.test(error.message))) {
        handleApiError(error, 'researchHeadlineIdea');
      }
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during deep research.";
      throw new Error(errorMessage);
    }
}

export async function generateWebsiteContext(urls: string[]): Promise<string> {
  const model = ai.models.generateContent;

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
    const response = await ai.models.generateContent({
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

export async function suggestExternalLinks(
  mainContent: string,
  keywords: string[],
  profileData?: WriterProfileData
): Promise<ExternalLinkSuggestion[]> {
  const selectedModel = profileData?.selectedModel || DEFAULT_TEXT_MODEL;

  const baseSystemInstruction = `You are a meticulous SEO expert and research analyst with a focus on sourcing high-quality, authoritative, and **currently live** external links. Your reputation depends on the quality and validity of the links you suggest. Every link you provide must lead to a valid, working webpage.

**CRITICAL RULES for Link Sourcing & Verification:**
1.  **Live Verification is Mandatory:** You MUST use your Google Search tool to find and verify every single link you suggest. DO NOT suggest any URL from your own knowledge base or memory. If a search result looks promising but the link might be dead (e.g., an old press release), you must find a different, more reliable source. **A 404 error is a complete failure.**
2.  **Prioritize Authority:** Your primary goal is to find sources that add significant credibility. Give strong preference to:
    *   Educational institutions (.edu)
    *   Government websites (.gov)
    *   Major non-profit organizations (.org)
    *   Well-established, reputable industry publications (e.g., Forbes, Harvard Business Review, major scientific journals).
    *   Primary research studies or data sources.
3.  **AVOID Low-Quality Sources:** You MUST NOT suggest links from:
    *   Direct competitors or commercial product pages.
    *   User-generated content sites (e.g., forums, Quora, Reddit).
    *   Personal blogs unless they are widely recognized as an authority in the field.
    *   Press releases, especially older ones, as they often lead to 404s.
    *   Content farms or sites with excessive advertising.
4.  **Link to Specific Content:** Do not link to homepages (e.g., \`forbes.com\`). Link to the specific, relevant article or resource (e.g., \`forbes.com/sites/...\`).
5.  **Perform a Common-Sense Check:** Before suggesting a link, ask: "Is this a source I would trust and cite in a professional research paper? Does it look like it's actively maintained?" If the answer is no, find a better one.

You MUST return a single, clean JSON array of objects. Do not add any commentary before or after the JSON.
The array should contain up to 5 suggestion objects. Each object must have this exact structure:
{
  "url": string, // The full, verified, and working URL of the authoritative external source.
  "anchorText": string, // The specific text within the 'context' sentence that should become the hyperlink.
  "context": string // The complete, original sentence from the blog post where the link should be placed. This must be an exact match.
}`;

  const keywordGuidance = keywords && keywords.length > 0
    ? `**Guiding Keywords:** Use these keyword phrases to focus your search for relevant sources. Find articles that discuss these topics:\n- ${keywords.join('\n- ')}\n`
    : '';

  const userRequest = `
Analyze the following blog content. Find up to 5 opportunities to add valuable external links.
For each opportunity, identify the source URL, the best anchor text, and the full sentence from the original content that provides the context.

${keywordGuidance}
Blog Content to Analyze:
${mainContent}

Return your findings in the specified JSON format.
`;

  const prompt = buildPromptWithProfile(baseSystemInstruction, userRequest, profileData, 'externalLinking');

  try {
    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });
    return parseJsonResponse<ExternalLinkSuggestion[]>(response.text, []);
  } catch (error) {
    handleApiError(error, 'suggestExternalLinks');
  }
}