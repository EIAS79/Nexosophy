export type EntitlementValue = boolean | number | string;

export type EffectiveEntitlements = Readonly<Record<string, EntitlementValue>>;

export interface BillingProvider {
  createCheckoutSession(input: {
    billingAccountId: string;
    priceExternalId: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ id: string; url: string }>;

  createPortalSession(input: {
    customerExternalId: string;
    returnUrl: string;
  }): Promise<{ url: string }>;
}
