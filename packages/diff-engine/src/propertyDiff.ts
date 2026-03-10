import type {
  ComparablePropertyDefinition,
  DesiredPropertyDefinition,
  HubSpotObjectType,
  PropertyDiffChange,
  PropertyDiffResult,
  PropertyOption
} from "@muloo/core";

const comparableFields: Array<keyof Omit<ComparablePropertyDefinition, "name">> = [
  "label",
  "type",
  "fieldType",
  "description",
  "groupName",
  "formField",
  "options"
];

function normalizeOptions(options?: ComparablePropertyDefinition["options"]): string {
  if (!options || options.length === 0) {
    return "[]";
  }

  return JSON.stringify(
    [...options].sort((left, right) => left.value.localeCompare(right.value)).map((option) => ({
      label: option.label,
      value: option.value,
      displayOrder: option.displayOrder ?? null,
      hidden: option.hidden ?? false
    }))
  );
}

function copyOptions(options?: DesiredPropertyDefinition["options"]): PropertyOption[] | undefined {
  if (!options || options.length === 0) {
    return undefined;
  }

  return options.map((option) => {
    const copied: PropertyOption = {
      label: option.label,
      value: option.value
    };

    if (option.displayOrder !== undefined) {
      copied.displayOrder = option.displayOrder;
    }

    if (option.hidden !== undefined) {
      copied.hidden = option.hidden;
    }

    return copied;
  });
}

function isSameValue(field: keyof Omit<ComparablePropertyDefinition, "name">, desired: unknown, existing: unknown): boolean {
  if (field === "options") {
    return normalizeOptions(desired as ComparablePropertyDefinition["options"]) === normalizeOptions(existing as ComparablePropertyDefinition["options"]);
  }

  return (desired ?? null) === (existing ?? null);
}

function collectChanges(
  desired: DesiredPropertyDefinition,
  existing: ComparablePropertyDefinition
): PropertyDiffChange[] {
  return comparableFields.reduce<PropertyDiffChange[]>((changes, field) => {
    const desiredValue = desired[field];
    const existingValue = existing[field];

    if (!isSameValue(field, desiredValue, existingValue)) {
      changes.push({
        field,
        desired: desiredValue,
        existing: existingValue
      });
    }

    return changes;
  }, []);
}

function toComparableProperty(property: DesiredPropertyDefinition): ComparablePropertyDefinition {
  const comparable: ComparablePropertyDefinition = {
    name: property.name,
    label: property.label,
    type: property.type,
    fieldType: property.fieldType
  };

  if (property.description !== undefined) {
    comparable.description = property.description;
  }

  if (property.groupName !== undefined) {
    comparable.groupName = property.groupName;
  }

  if (property.formField !== undefined) {
    comparable.formField = property.formField;
  }

  const options = copyOptions(property.options);
  if (options !== undefined) {
    comparable.options = options;
  }

  return comparable;
}

export function diffProperties(params: {
  objectType: HubSpotObjectType;
  desired: DesiredPropertyDefinition[];
  existing: ComparablePropertyDefinition[];
}): PropertyDiffResult {
  const existingByName = new Map(params.existing.map((property) => [property.name, property]));

  const result: PropertyDiffResult = {
    objectType: params.objectType,
    unchanged: [],
    toCreate: [],
    needsReview: []
  };

  for (const desiredProperty of params.desired) {
    const existingProperty = existingByName.get(desiredProperty.name);

    if (!existingProperty) {
      result.toCreate.push({ property: toComparableProperty(desiredProperty) });
      continue;
    }

    const changes = collectChanges(desiredProperty, existingProperty);
    if (changes.length === 0) {
      result.unchanged.push({ name: desiredProperty.name });
      continue;
    }

    result.needsReview.push({
      name: desiredProperty.name,
      changes
    });
  }

  return result;
}
