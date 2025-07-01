"use server"

import {
  trainingRecommendation,
  type TrainingRecommendationInput,
} from "@/ai/flows/training-recommendation"

export async function getTrainingRecommendations(
  input: TrainingRecommendationInput
) {
  try {
    const result = await trainingRecommendation(input)
    return { success: true, data: result }
  } catch (error) {
    console.error(error)
    return { success: false, error: "Failed to get recommendations. Please try again." }
  }
}
