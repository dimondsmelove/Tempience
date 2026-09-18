import { z } from "zod";
import { scopeKindSchema } from "./scope";
import { uidSchema } from "./common";
import { dateOnlySchema } from "./space-profile";
import { lifeMapProfileSchema, lifeMapRangeSchema } from "./life-map";

export const lifeMapDensityResolutionSchema = z.enum(["week", "month", "year", "decade"]);
export const lifeMapDensityLayerSchema = z.enum(["traces", "scope"]);

export const lifeMapDensityQuerySchema = z
	.object({
		from: dateOnlySchema.optional(),
		to: dateOnlySchema.optional(),
		space_uid: z.string().min(1).default("personal"),
		resolution: lifeMapDensityResolutionSchema.default("week"),
		layer: lifeMapDensityLayerSchema.default("traces"),
		scope_kind: scopeKindSchema.optional(),
		scope_uid: uidSchema.optional(),
		scope_include_future: z
			.union([z.literal("true"), z.literal("false"), z.literal("1"), z.literal("0")])
			.optional()
			.transform((value) => value === "true" || value === "1")
			.default("false")
	})
	.superRefine((value, ctx) => {
		if (value.layer === "scope" && (!value.scope_kind || !value.scope_uid)) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "scope_kind and scope_uid are required when layer=scope",
				path: ["scope_uid"]
			});
		}
	});

export const lifeMapProfileQuerySchema = z.object({
	space_uid: z.string().min(1).default("personal")
});

export const lifeMapDensityBucketSchema = z.object({
	key: z.string().min(1),
	filled: z.boolean(),
	weight: z.number().int().min(0)
});

export const lifeMapDensityStatsSchema = z.object({
	total_buckets: z.number().int().min(0),
	filled_buckets: z.number().int().min(0)
});

export const lifeMapDensitySchema = z.object({
	profile: lifeMapProfileSchema,
	range: lifeMapRangeSchema,
	current_week_start: dateOnlySchema,
	resolution: lifeMapDensityResolutionSchema,
	layer: lifeMapDensityLayerSchema,
	scope_kind: scopeKindSchema.optional(),
	scope_uid: uidSchema.optional(),
	buckets: z.array(lifeMapDensityBucketSchema),
	stats: lifeMapDensityStatsSchema
});

export const lifeMapProfileResponseSchema = z.object({
	profile: lifeMapProfileSchema,
	range: lifeMapRangeSchema,
	current_week_start: dateOnlySchema
});

export type LifeMapDensityResolution = z.infer<typeof lifeMapDensityResolutionSchema>;
export type LifeMapDensityLayer = z.infer<typeof lifeMapDensityLayerSchema>;
export type LifeMapDensityQuery = z.infer<typeof lifeMapDensityQuerySchema>;
export type LifeMapDensityBucket = z.infer<typeof lifeMapDensityBucketSchema>;
export type LifeMapDensity = z.infer<typeof lifeMapDensitySchema>;
export type LifeMapProfileResponse = z.infer<typeof lifeMapProfileResponseSchema>;
