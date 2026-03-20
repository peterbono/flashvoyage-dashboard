declare module "google-trends-api" {
  interface TrendsOptions {
    keyword: string | string[];
    startTime?: Date;
    endTime?: Date;
    geo?: string;
    hl?: string;
  }
  const googleTrends: {
    interestOverTime(options: TrendsOptions): Promise<string>;
    relatedQueries(options: TrendsOptions): Promise<string>;
    dailyTrends(options: { trendDate: Date; geo?: string }): Promise<string>;
  };
  export default googleTrends;
}
