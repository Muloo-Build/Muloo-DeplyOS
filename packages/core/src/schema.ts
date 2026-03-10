import { z } from "zod";

const propertyOptionSchema = z
  .object({
    label: z.string().min(1),
    value: z.string().min(1),
    displayOrder: z.number().int().nonnegative().optional(),
    hidden: z.boolean().optional()
  })
  .strict();

export const desiredPropertySchema = z
  .object({
    name: z
      .string()
      .regex(
        /^[a-z0-9_]+$/,
        "Property names must use lowercase letters, numbers, and underscores."
      ),
    label: z.string().min(1),
    type: z.enum([
      "string",
      "number",
      "date",
      "datetime",
      "enumeration",
      "bool"
    ]),
    fieldType: z.enum([
      "text",
      "textarea",
      "number",
      "date",
      "booleancheckbox",
      "radio",
      "select",
      "checkbox"
    ]),
    description: z.string().min(1).optional(),
    groupName: z.string().min(1).optional(),
    formField: z.boolean().optional(),
    options: z.array(propertyOptionSchema).min(1).optional()
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.type === "enumeration" &&
      (!value.options || value.options.length === 0)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enumeration properties must define at least one option.",
        path: ["options"]
      });
    }
  });

export const onboardingSpecSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    client: z
      .object({
        name: z.string().min(1),
        slug: z
          .string()
          .regex(
            /^[a-z0-9-]+$/,
            "Client slug must use lowercase letters, numbers, and hyphens."
          )
      })
      .strict(),
    crm: z
      .object({
        objectType: z.literal("contacts"),
        properties: z.array(desiredPropertySchema).min(1)
      })
      .strict()
  })
  .strict();

export type DesiredPropertyDefinition = z.infer<typeof desiredPropertySchema>;
export type OnboardingSpec = z.infer<typeof onboardingSpecSchema>;
