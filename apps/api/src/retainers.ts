export const retainerServiceLines = [
  "TECHNICAL_DELIVERY",
  "CONSULTING"
] as const;

export const retainerCurrencies = [
  "ZAR",
  "USD",
  "GBP",
  "EUR",
  "AUD",
  "CAD"
] as const;

export const retainerStatuses = ["DRAFT", "ACTIVE", "PAUSED", "ENDED"] as const;

export const retainerProducedByValues = ["HUMAN", "AGENT", "HYBRID"] as const;

export type RetainerServiceLine = (typeof retainerServiceLines)[number];
export type RetainerCurrency = (typeof retainerCurrencies)[number];
export type RetainerStatus = (typeof retainerStatuses)[number];
export type RetainerProducedBy = (typeof retainerProducedByValues)[number];

export const minimumRetainerBlockHours = 10;
export const borrowForwardCapRatio = 0.25;
export const rolloverCapRatio = 0.25;
export const rolloverExpiryDays = 90;
export const topUpDefaultHours = 10;

const baseRatesZar: Record<RetainerServiceLine, number> = {
  TECHNICAL_DELIVERY: 1700,
  CONSULTING: 2200
};

const retainerRateBands = [
  {
    minHours: 10,
    maxHours: 50,
    technicalDeliveryRateZar: 1700
  },
  {
    minHours: 51,
    maxHours: 100,
    technicalDeliveryRateZar: 1615
  },
  {
    minHours: 101,
    maxHours: 150,
    technicalDeliveryRateZar: 1564
  },
  {
    minHours: 151,
    maxHours: Number.POSITIVE_INFINITY,
    technicalDeliveryRateZar: 1530
  }
] as const;

export function getBaseHourlyRateZar(serviceLine: RetainerServiceLine) {
  return baseRatesZar[serviceLine];
}

export function getRetainerRateBand(blockSize: number) {
  assertValidBlockSize(blockSize);
  return retainerRateBands.find(
    (band) => blockSize >= band.minHours && blockSize <= band.maxHours
  );
}

export function deriveRetainerRate(input: {
  serviceLine: RetainerServiceLine;
  blockSize: number;
  currency: RetainerCurrency;
  fxRateFromZar?: number;
}) {
  if (input.serviceLine === "CONSULTING") {
    return convertZarRateToCurrency({
      zarRate: baseRatesZar.CONSULTING,
      currency: input.currency,
      ...(input.fxRateFromZar !== undefined
        ? { fxRateFromZar: input.fxRateFromZar }
        : {}),
      rateKind: "retainers"
    });
  }

  const band = getRetainerRateBand(input.blockSize);
  if (!band) {
    throw new Error("No retainer rate band found for block size.");
  }

  return convertZarRateToCurrency({
    zarRate: band.technicalDeliveryRateZar,
    currency: input.currency,
    ...(input.fxRateFromZar !== undefined
      ? { fxRateFromZar: input.fxRateFromZar }
      : {}),
    rateKind: "retainers"
  });
}

export function deriveTopUpRate(input: {
  serviceLine: RetainerServiceLine;
  currency: RetainerCurrency;
  fxRateFromZar?: number;
}) {
  return convertZarRateToCurrency({
    zarRate: getBaseHourlyRateZar(input.serviceLine),
    currency: input.currency,
    ...(input.fxRateFromZar !== undefined
      ? { fxRateFromZar: input.fxRateFromZar }
      : {}),
    rateKind: "top-ups"
  });
}

export function getBorrowForwardCap(blockHours: number) {
  assertValidBlockSize(blockHours);
  return Math.floor(blockHours * borrowForwardCapRatio);
}

export function getRolloverCap(blockHours: number) {
  assertValidBlockSize(blockHours);
  return Math.floor(blockHours * rolloverCapRatio);
}

export function calculateCurrentRetainerBalance(input: {
  blockHours: number;
  rolledInHours: number;
  approvedTopUpHours: number;
  consumedHours: number;
  borrowedFromNext: number;
}) {
  return roundHours(
    input.blockHours +
      input.rolledInHours +
      input.approvedTopUpHours -
      input.consumedHours -
      input.borrowedFromNext
  );
}

export function getOverageTriggerHours(input: {
  blockHours: number;
  rolledInHours: number;
}) {
  return (
    input.blockHours +
    input.rolledInHours +
    getBorrowForwardCap(input.blockHours)
  );
}

export function getPeriodUsageState(input: {
  blockHours: number;
  rolledInHours: number;
  consumedHours: number;
}) {
  const borrowCap = getBorrowForwardCap(input.blockHours);
  const overageTriggerHours = getOverageTriggerHours(input);

  if (input.consumedHours <= input.blockHours + input.rolledInHours) {
    return {
      state: "UNDER_BLOCK" as const,
      borrowedHours: 0,
      overageHours: 0
    };
  }

  if (input.consumedHours <= overageTriggerHours) {
    return {
      state: "BORROWING_FORWARD" as const,
      borrowedHours: roundHours(
        Math.min(
          borrowCap,
          input.consumedHours - input.blockHours - input.rolledInHours
        )
      ),
      overageHours: 0
    };
  }

  return {
    state: "OVERAGE" as const,
    borrowedHours: borrowCap,
    overageHours: roundHours(input.consumedHours - overageTriggerHours)
  };
}

export function calculateRolledOutHours(input: {
  blockHours: number;
  rolledInHours?: number;
  consumedHours: number;
}) {
  const unusedHours = Math.max(
    0,
    input.blockHours + (input.rolledInHours ?? 0) - input.consumedHours
  );
  return Math.min(getRolloverCap(input.blockHours), Math.floor(unusedHours));
}

export type RolloverBucketForConsumption = {
  id: string;
  hoursRemaining: number;
  expiresAt: Date;
};

export type ConsumptionBucketBreakdown = {
  rollover: Array<{
    bucketId: string;
    hours: number;
    expiresAt: string;
  }>;
  currentBlockHours: number;
};

export function calculateConsumptionBucketBreakdown(input: {
  hoursToConsume: number;
  rolloverBuckets: RolloverBucketForConsumption[];
}) {
  if (!Number.isFinite(input.hoursToConsume) || input.hoursToConsume < 0) {
    throw new Error("Hours to consume must be a valid non-negative number.");
  }

  let remaining = roundHours(input.hoursToConsume);
  const rollover: ConsumptionBucketBreakdown["rollover"] = [];
  const sortedBuckets = [...input.rolloverBuckets].sort((left, right) => {
    const expiryDiff = left.expiresAt.getTime() - right.expiresAt.getTime();
    return expiryDiff !== 0 ? expiryDiff : left.id.localeCompare(right.id);
  });

  for (const bucket of sortedBuckets) {
    if (remaining <= 0) {
      break;
    }

    const available = Math.max(0, roundHours(bucket.hoursRemaining));
    if (available <= 0) {
      continue;
    }

    const consumed = roundHours(Math.min(available, remaining));
    rollover.push({
      bucketId: bucket.id,
      hours: consumed,
      expiresAt: bucket.expiresAt.toISOString()
    });
    remaining = roundHours(remaining - consumed);
  }

  return {
    rollover,
    currentBlockHours: remaining
  };
}

export function addDaysUtc(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function addMonthsUtc(date: Date, months: number) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1)
  );
}

export function validateRetainerStartDate(startDate: Date) {
  if (Number.isNaN(startDate.getTime())) {
    throw new Error("Retainer start date must be valid.");
  }
}

export function getUtcMonthStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function validateBilledHoursOverride(input: {
  plannedHours: number;
  billedHours: number;
  overrideReason?: string | null;
}) {
  if (!Number.isFinite(input.plannedHours) || input.plannedHours < 0) {
    throw new Error("Planned hours must be a valid non-negative number.");
  }

  if (!Number.isFinite(input.billedHours) || input.billedHours < 0) {
    throw new Error("Billed hours must be a valid non-negative number.");
  }

  if (input.billedHours > input.plannedHours * 2) {
    throw new Error("Billed hours cannot exceed 2x planned hours.");
  }

  const planned = input.plannedHours;
  const differsByMoreThanTwentyFivePercent =
    planned === 0
      ? input.billedHours > 0
      : Math.abs(input.billedHours - planned) / planned > 0.25;

  if (
    differsByMoreThanTwentyFivePercent &&
    !(input.overrideReason && input.overrideReason.trim())
  ) {
    throw new Error(
      "Override reason is required when billed hours differ by more than 25%."
    );
  }
}

export function assertValidBlockSize(blockSize: number) {
  if (!Number.isInteger(blockSize) || blockSize < minimumRetainerBlockHours) {
    throw new Error(
      "Retainer block size must be an integer of at least 10 hours."
    );
  }
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function roundHours(value: number) {
  return Math.round(value * 100) / 100;
}

function convertZarRateToCurrency(input: {
  zarRate: number;
  currency: RetainerCurrency;
  fxRateFromZar?: number;
  rateKind: string;
}) {
  if (input.currency === "ZAR") {
    return roundMoney(input.zarRate);
  }

  if (
    typeof input.fxRateFromZar !== "number" ||
    !Number.isFinite(input.fxRateFromZar) ||
    input.fxRateFromZar <= 0
  ) {
    throw new Error(`fxRateFromZar is required for non-ZAR ${input.rateKind}.`);
  }

  return roundMoney(input.zarRate * input.fxRateFromZar);
}
