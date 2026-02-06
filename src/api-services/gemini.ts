import {
  GRANT_GOAL_CHOICES,
  GRANT_HARDWARE_CHOICES,
  GRANT_OS_CHOICES,
  GRANT_ROLE_CHOICES,
  GrantDetails,
} from '@/types/grant';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function validateGrantDataWithAI(data: GrantDetails) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `
    Analyze the following user data for a grant application and determine if it is legitimate or potentially spam.
    Return a JSON response in the format: {"valid": boolean, "reason": string}
    The reasons should be concise, suitable for display in a UI.

    User Data:
    ${JSON.stringify(data, null, 2)}

    Criteria:
    - Names should be reasonable.
    - Email should be valid format and not a throwaway email.
    - Discord or Telegram handle should look real.
    - General quality of responses.
    - Role, Hardware, OS, Goal should be valid values from the following lists:
    -- Role (single choice): ${JSON.stringify(GRANT_ROLE_CHOICES)}
    -- Hardware (multiple choices): ${JSON.stringify(GRANT_HARDWARE_CHOICES)}
    -- OS (single choice): ${JSON.stringify(GRANT_OS_CHOICES)}
    -- Goal (single choice): ${JSON.stringify(GRANT_GOAL_CHOICES)}
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Extract JSON from potential markdown code blocks
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return { valid: false, reason: 'Failed to perform validation' };
  } catch (error) {
    console.error('Gemini AI validation error:', error);
    return { valid: true, reason: 'Validation service unavailable' };
  }
}
