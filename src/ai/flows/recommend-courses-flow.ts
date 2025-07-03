'use server';
/**
 * @fileOverview An AI flow to recommend courses to a user.
 *
 * - recommendCourses - A function that suggests courses based on user's profile.
 * - RecommendCoursesInput - The input type for the recommendCourses function.
 * - RecommendCoursesOutput - The return type for the recommendCourses function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit/zod';

const RecommendationSchema = z.object({
  title: z.string().describe('The exact title of the recommended course.'),
  reason: z.string().describe('A brief, one-sentence explanation for why this course is recommended.'),
});

const RecommendCoursesInputSchema = z.object({
  enrolledCourses: z.array(z.string()).describe("A list of courses the user is already enrolled in."),
  availableCourses: z.array(z.string()).describe("A list of courses available for recommendation that the user is NOT enrolled in."),
});
export type RecommendCoursesInput = z.infer<typeof RecommendCoursesInputSchema>;

const RecommendCoursesOutputSchema = z.object({
  recommendations: z.array(RecommendationSchema).describe('A list of up to 3 course recommendations.'),
});
export type RecommendCoursesOutput = z.infer<typeof RecommendCoursesOutputSchema>;

export async function recommendCourses(input: RecommendCoursesInput): Promise<RecommendCoursesOutput> {
  return recommendCoursesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'recommendCoursesPrompt',
  input: {schema: RecommendCoursesInputSchema},
  output: {schema: RecommendCoursesOutputSchema},
  prompt: `You are a helpful career and training advisor. Your goal is to help users discover new skills.

Based on the list of courses the user is already enrolled in, please recommend up to 3 courses from the list of available courses. For each recommendation, provide a short, compelling, one-sentence reason why it would be a good next step for the user.

Do not recommend a course the user is already enrolled in. Only choose from the available courses list.

Courses the user is enrolled in:
{{#each enrolledCourses}}
- {{{this}}}
{{/each}}

List of available courses to choose from:
{{#each availableCourses}}
- {{{this}}}
{{/each}}
`,
});

const recommendCoursesFlow = ai.defineFlow(
  {
    name: 'recommendCoursesFlow',
    inputSchema: RecommendCoursesInputSchema,
    outputSchema: RecommendCoursesOutputSchema,
  },
  async input => {
    // If there are no available courses, return an empty list.
    if (input.availableCourses.length === 0) {
      return { recommendations: [] };
    }
      
    const {output} = await prompt(input);
    return output!;
  }
);
