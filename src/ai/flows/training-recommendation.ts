// src/ai/flows/training-recommendation.ts
'use server';

/**
 * @fileOverview A training recommendation AI agent.
 *
 * - trainingRecommendation - A function that handles the training recommendation process.
 * - TrainingRecommendationInput - The input type for the trainingRecommendation function.
 * - TrainingRecommendationOutput - The return type for the trainingRecommendation function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const TrainingRecommendationInputSchema = z.object({
  employeeRole: z.string().describe('The role of the employee.'),
  employeeSkills: z.string().describe('The current skills of the employee.'),
  learningHistory: z.string().describe('The learning history of the employee.'),
});

export type TrainingRecommendationInput = z.infer<typeof TrainingRecommendationInputSchema>;

const RecommendedCourseSchema = z.object({
  id: z.string().describe('A unique identifier for the course, can be a slug or number. e.g., "advanced-react" or "2".'),
  title: z.string().describe('The title of the recommended course.'),
  description: z.string().describe('A short description of why this course is recommended.'),
});

const TrainingRecommendationOutputSchema = z.object({
  recommendedCourses: z.array(RecommendedCourseSchema).describe('A list of recommended courses for the employee.'),
});

export type TrainingRecommendationOutput = z.infer<typeof TrainingRecommendationOutputSchema>;

export async function trainingRecommendation(input: TrainingRecommendationInput): Promise<TrainingRecommendationOutput> {
  return trainingRecommendationFlow(input);
}

const prompt = ai.definePrompt({
  name: 'trainingRecommendationPrompt',
  input: {schema: TrainingRecommendationInputSchema},
  output: {schema: TrainingRecommendationOutputSchema},
  prompt: `You are an expert training recommendation system.

You will use the employee's role, skills, and learning history to recommend a list of the 3 to 5 best courses for them.
For each course, provide a title, a short description, and a unique ID.

The available courses that you can recommend from have IDs: "1" (Leadership Principles), "2" (Advanced React), "3" (Cybersecurity Basics), "4" (Effective Communication), "5" (Data Analysis with Python), "6" (Project Management Fundamentals). Use these existing IDs when applicable. For novel recommendations, create a new slug-based id (e.g. 'advanced-python').

Employee Role: {{{employeeRole}}}
Employee Skills: {{{employeeSkills}}}
Learning History: {{{learningHistory}}}

Recommend the best courses for the employee in the specified format.
`,
});

const trainingRecommendationFlow = ai.defineFlow(
  {
    name: 'trainingRecommendationFlow',
    inputSchema: TrainingRecommendationInputSchema,
    outputSchema: TrainingRecommendationOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
