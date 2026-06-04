import { describe, it, expect } from "vitest";
import { getAsaasCheckoutUrl, formatCurrency, mapAsaasStatus } from "@/lib/asaas";

describe("getAsaasCheckoutUrl", () => {
  it("should generate sandbox checkout URL when isSandbox is true", () => {
    const subscriptionId = "sub_123456";
    const url = getAsaasCheckoutUrl(subscriptionId, true);
    expect(url).toBe("https://sandbox.asaas.com/checkout/sub_123456");
  });

  it("should generate production checkout URL when isSandbox is false", () => {
    const subscriptionId = "sub_789012";
    const url = getAsaasCheckoutUrl(subscriptionId, false);
    expect(url).toBe("https://www.asaas.com/checkout/sub_789012");
  });

  it("should default to production URL when isSandbox is not provided", () => {
    const subscriptionId = "sub_default";
    const url = getAsaasCheckoutUrl(subscriptionId);
    expect(url).toBe("https://www.asaas.com/checkout/sub_default");
  });
});

describe("formatCurrency", () => {
  it("should format number as Brazilian currency", () => {
    expect(formatCurrency(7.9)).toBe("R$\u00A07,90");
    expect(formatCurrency(59.9)).toBe("R$\u00A059,90");
    expect(formatCurrency(100)).toBe("R$\u00A0100,00");
  });
});

describe("mapAsaasStatus", () => {
  it("should map ACTIVE to RECEIVED", () => {
    expect(mapAsaasStatus("ACTIVE")).toBe("RECEIVED");
  });

  it("should map RECEIVED to RECEIVED", () => {
    expect(mapAsaasStatus("RECEIVED")).toBe("RECEIVED");
  });

  it("should map CANCELLED to CANCELLED", () => {
    expect(mapAsaasStatus("CANCELLED")).toBe("CANCELLED");
  });

  it("should map unknown status to INACTIVE", () => {
    expect(mapAsaasStatus("UNKNOWN")).toBe("INACTIVE");
  });
});