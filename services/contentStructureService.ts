import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import type { WriterProfileData } from '../types';
import { DEFAULT_TEXT_MODEL } from '../constants';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set. AI features will not work.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

// Centralized API error handler
const handleApiError = (error: unknown, context: string): never => {
  console.error(`Error in ${context}:`, error);
  const errorMessage = error instanceof Error ? error.message : String(error);

  if (errorMessage.includes('429') || /quota|rate limit/i.test(errorMessage)) {
      throw new Error("You've sent too many requests in a short period. Please wait a moment before trying again.");
  }
  
  throw new Error(`Gemini API error in ${context}: ${errorMessage}`);
};

// Helper function to handle JSON parsing
const parseJsonResponse = <T>(text: string | undefined, fallback: T): T => {
  if (!text) {
    return fallback;
  }
  let jsonStr = text.trim();
  
  const fenceRegex = /^```(?:\w*)?\s*\n?(.*?)\n?\s*```$/s;
  const match = jsonStr.match(fenceRegex);
  
  if (match && match[1]) {
    jsonStr = match[1].trim();
  }
  
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
    return JSON.parse(jsonStr) as T;
  } catch (e) {
    console.error("Failed to parse JSON response:", e);
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
  
  fullPrompt += `\n\n---\n\n**User Request:**\n${userRequest}`;
  return fullPrompt;
}

// Content Structure Enhancement Functions

export async function optimizeIntroduction(
  mainContent: string,
  title: string,
  primaryKeyword: string,
  profileData?: WriterProfileData
): Promise<string> {
  const selectedModel = profileData?.selectedModel || DEFAULT_TEXT_MODEL;

  const baseSystemInstruction = `You are an expert content strategist specializing in engaging introductions. Your task is to analyze and optimize the introduction of a blog post to maximize reader engagement and SEO effectiveness.

**INTRODUCTION OPTIMIZATION RULES:**
1. **Hook Creation:** Start with a compelling hook (statistic, question, bold statement, or story)
2. **Keyword Integration:** Naturally incorporate the primary keyword within the first 100 words
3. **Value Preview:** Clearly preview what readers will learn or gain from the article
4. **Length Control:** Keep the introduction between 100-150 words
5. **Flow Enhancement:** Use smooth transitions that pull readers into the main content`;

  const userRequest = `
Analyze and optimize the introduction of this blog post:

**Blog Title:** ${title}
**Primary Keyword:** ${primaryKeyword}

**Current Content (first 500 characters for context):**
${mainContent.substring(0, 500)}

Create an optimized introduction that:
- Hooks readers immediately
- Incorporates "${primaryKeyword}" naturally
- Previews the article's value
- Maintains the same tone as the original content

Return only the optimized introduction HTML (no explanations).
`;

  const prompt = buildPromptWithProfile(baseSystemInstruction, userRequest, profileData, 'text');

  try {
    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: prompt,
      config: {
        temperature: 0.8,
        topP: 0.9,
      },
    });
    const text = response.text;
    if (!text) {
      throw new Error("Failed to optimize introduction, response was empty.");
    }
    return text.trim();
  } catch (error) {
    handleApiError(error, 'optimizeIntroduction');
  }
}

export async function generateConclusionWithCTA(
  mainContent: string,
  title: string,
  primaryKeyword: string,
  profileData?: WriterProfileData
): Promise<string> {
  const selectedModel = profileData?.selectedModel || DEFAULT_TEXT_MODEL;

  const baseSystemInstruction = `You are an expert content strategist specializing in compelling conclusions and call-to-actions. Your task is to create a strong conclusion that summarizes key points and encourages reader engagement.

**CONCLUSION OPTIMIZATION RULES:**
1. **Key Point Summary:** Briefly recap the 3-5 main takeaways
2. **Keyword Reinforcement:** Naturally mention the primary keyword once more
3. **Call-to-Action:** Include an engaging CTA (comment, share, try something, etc.)
4. **Length Control:** Keep the conclusion between 100-200 words
5. **Action-Oriented:** End with language that encourages next steps`;

  const userRequest = `
Create an optimized conclusion for this blog post:

**Blog Title:** ${title}
**Primary Keyword:** ${primaryKeyword}

**Blog Content (for context):**
${mainContent.substring(0, 3000)}

Create a conclusion that:
- Summarizes key takeaways
- Reinforces "${primaryKeyword}" naturally
- Includes an engaging call-to-action
- Maintains the same tone as the original content

Return only the conclusion HTML with appropriate tags (no explanations).
`;

  const prompt = buildPromptWithProfile(baseSystemInstruction, userRequest, profileData, 'text');

  try {
    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: prompt,
      config: {
        temperature: 0.7,
        topP: 0.9,
      },
    });
    const text = response.text;
    if (!text) {
      throw new Error("Failed to generate conclusion with CTA, response was empty.");
    }
    return text.trim();
  } catch (error) {
    handleApiError(error, 'generateConclusionWithCTA');
  }
}

export async function analyzeHeadingStructure(
  mainContent: string,
  profileData?: WriterProfileData
): Promise<{
  issues: string[];
  suggestions: string[];
  improvedStructure?: string;
}> {
  const selectedModel = profileData?.selectedModel || DEFAULT_TEXT_MODEL;

  const baseSystemInstruction = `You are an expert content structure analyst. Your task is to analyze the heading hierarchy (H2, H3, H4) in blog content and provide optimization recommendations.

**HEADING STRUCTURE ANALYSIS CRITERIA:**
1. **Hierarchy Logic:** Check if H2 > H3 > H4 structure is logical
2. **Spacing Balance:** Ensure 200-300 words between major headings
3. **Keyword Integration:** Verify headings include relevant keywords
4. **Readability Flow:** Assess if headings create smooth content flow
5. **SEO Optimization:** Check for proper heading distribution

You must return a JSON object with this structure:
{
  "issues": ["Issue 1", "Issue 2", ...],
  "suggestions": ["Suggestion 1", "Suggestion 2", ...],
  "improvedStructure": "optional HTML with improved headings"
}`;

  const userRequest = `
Analyze the heading structure of this blog content:

${mainContent}

Identify structural issues and provide specific suggestions for improvement.
If major improvements are needed, include an "improvedStructure" with optimized HTML.
Return only the JSON object.
`;

  const prompt = buildPromptWithProfile(baseSystemInstruction, userRequest, profileData, 'text');

  try {
    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: prompt,
      config: {
        temperature: 0.3,
        responseMimeType: "application/json",
      },
    });
    return parseJsonResponse(response.text, {
      issues: [],
      suggestions: [],
    });
  } catch (error) {
    handleApiError(error, 'analyzeHeadingStructure');
  }
}

export async function generateCallToActionSuggestions(
  mainContent: string,
  title: string,
  industry?: string,
  profileData?: WriterProfileData
): Promise<string[]> {
  const selectedModel = profileData?.selectedModel || DEFAULT_TEXT_MODEL;

  const baseSystemInstruction = `You are an expert conversion optimization specialist. Your task is to generate compelling call-to-action suggestions tailored to specific content and industry.

**CTA GENERATION RULES:**
1. **Action-Oriented:** Use strong action verbs (discover, learn, get, start, etc.)
2. **Value-Focused:** Clearly communicate the benefit to the reader
3. **Context-Relevant:** Match the tone and topic of the content
4. **Variety:** Provide different types (engagement, educational, social, etc.)
5. **Industry-Appropriate:** Consider the target audience and industry norms

You must return a JSON array of strings, each containing a complete CTA suggestion.`;

  const userRequest = `
Generate 5-7 call-to-action suggestions for this content:

**Blog Title:** ${title}
${industry ? `**Industry:** ${industry}` : ''}

**Content Summary (first 1000 characters):**
${mainContent.substring(0, 1000)}

Create diverse CTAs including:
- Engagement (comments, shares)
- Educational (downloads, resources)
- Social (community, discussion)
- Next-step actions

Return only a JSON array of CTA strings.
`;

  const prompt = buildPromptWithProfile(baseSystemInstruction, userRequest, profileData, 'text');

  try {
    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: prompt,
      config: {
        temperature: 0.8,
        responseMimeType: "application/json",
      },
    });
    return parseJsonResponse<string[]>(response.text, []);
  } catch (error) {
    handleApiError(error, 'generateCallToActionSuggestions');
  }
}

export async function ensureArticleCompletion(
  incompleteContent: string,
  title: string,
  primaryKeyword: string,
  profileData?: WriterProfileData
): Promise<string> {
  const selectedModel = profileData?.selectedModel || DEFAULT_TEXT_MODEL;

  const baseSystemInstruction = `You are an expert content editor specializing in completing unfinished articles. Your task is to analyze incomplete blog content and provide a proper completion.

**COMPLETION REQUIREMENTS:**
1. **Maintain Continuity:** Match the existing tone, style, and structure
2. **Proper Conclusion:** Always end with a strong conclusion that summarizes key points
3. **Call-to-Action:** Include an engaging CTA in the conclusion
4. **HTML Formatting:** Use proper HTML tags consistent with the existing content
5. **Keyword Integration:** Naturally incorporate the primary keyword in the completion if possible`;

  const userRequest = `
Complete this unfinished blog article:

**Blog Title:** ${title}
**Primary Keyword:** ${primaryKeyword}

**Incomplete Content (last 800 characters):**
${incompleteContent.substring(-800)}

**Task:** Add a proper conclusion that:
- Completes any unfinished thoughts or sections
- Summarizes the main points covered in the article
- Includes an engaging call-to-action
- Uses proper HTML formatting
- Maintains consistency with the existing content

Return only the completion content to append to the article.
`;

  const prompt = buildPromptWithProfile(baseSystemInstruction, userRequest, profileData, 'text');

  try {
    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: prompt,
      config: {
        temperature: 0.6,
        maxOutputTokens: 1500,
      },
    });
    const text = response.text;
    if (!text) {
      throw new Error("Failed to complete article, response was empty.");
    }
    return text.trim();
  } catch (error) {
    handleApiError(error, 'ensureArticleCompletion');
  }
}