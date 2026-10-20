import { z } from 'zod';

const noul = z.object({
  type: z.literal('noul'),
  instructions: z.string().min(1),
  criteria: z.object({ true: z.string(), false: z.string() }).partial().optional(),
});
const choice = z.object({
  type: z.literal('choice'),
  instructions: z.string().min(1),
  criteria: z.record(z.string(), z.string()).optional(),
});
const score = z.object({
  type: z.literal('score'),
  instructions: z.string().min(1),
  criteria: z.array(z.string()).optional(),
});

export const question = z.discriminatedUnion('type', [noul, choice, score]);

const jsonValue = z.json();
const state = z.union([z.string(), z.array(jsonValue), z.record(z.string(), jsonValue)]);

export const decisionRequest = z.object({
  state,
  questions: z.record(z.string().min(1), question),
});
export type DecisionRequest = z.infer<typeof decisionRequest>;
