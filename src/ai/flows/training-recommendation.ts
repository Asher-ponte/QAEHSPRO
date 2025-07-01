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

const TrainingRecommendationOutputSchema = z.object({
  recommendedCourses: z.string().describe('The recommended courses for the employee.'),
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

You will use the employee's role, skills, and learning history to recommend the best courses for them.

Employee Role: {{{employeeRole}}}
Employee Skills: {{{employeeSkills}}}
Learning History: {{{learningHistory}}}

Recommend the best courses for the employee:
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
