import { z } from "zod";

export const VisibilitySchema = z.enum(["public", "private"]);
export type Visibility = z.infer<typeof VisibilitySchema>;

export const CreateProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  visibility: VisibilitySchema.optional(),
});

export const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  visibility: VisibilitySchema.optional(),
});

export const ProjectResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  status: z.enum(["active", "archived"]),
  visibility: VisibilitySchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;
export type ProjectResponse = z.infer<typeof ProjectResponseSchema>;
