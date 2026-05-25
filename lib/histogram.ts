export type HistogramBucket = {
  bucket: string;
  count: number;
};

export function buildAdaptiveHistogram(values: number[]): HistogramBucket[] {
  if (!values.length) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  if (min === max) return [{ bucket: formatBucketLabel(min, max), count: values.length }];

  const targetBuckets = Math.min(12, Math.max(5, Math.ceil(Math.sqrt(values.length) * 1.5)));
  let step = niceStep((max - min) / targetBuckets);
  let start = Math.floor(min / step) * step;
  let end = Math.ceil(max / step) * step;
  let bucketCount = Math.max(1, Math.ceil((end - start) / step));

  while (bucketCount > 14) {
    step = niceStep(step * 2);
    start = Math.floor(min / step) * step;
    end = Math.ceil(max / step) * step;
    bucketCount = Math.max(1, Math.ceil((end - start) / step));
  }

  const buckets = Array.from({ length: bucketCount }, (_, index) => {
    const lower = start + index * step;
    const upper = index === bucketCount - 1 ? end : lower + step;
    return { bucket: formatBucketLabel(lower, upper), count: 0 };
  });

  for (const value of values) {
    const index = Math.min(bucketCount - 1, Math.max(0, Math.floor((value - start) / step)));
    buckets[index].count += 1;
  }

  return buckets;
}

function niceStep(rawStep: number) {
  if (rawStep <= 0) return 1;
  const exponent = Math.floor(Math.log10(rawStep));
  const fraction = rawStep / 10 ** exponent;
  const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return niceFraction * 10 ** exponent;
}

function formatBucketLabel(lower: number, upper: number) {
  if (lower === upper) return formatMoney(lower);
  return `${formatMoney(lower)}-${formatMoney(upper)}`;
}

function formatMoney(value: number) {
  return `$${Math.round(value).toLocaleString()}`;
}
