import { describe, expect, it } from "vitest";

import {
  mergeListingFeatureValues,
  splitListingFeatureValues
} from "../../src/lib/listing-quality";

describe("listing feature helpers", () => {
  it("merges selected and custom feature values while removing duplicates", () => {
    expect(mergeListingFeatureValues(["Balcony", "Air Conditioning"], "balcony, Rooftop Terrace")).toEqual([
      "Balcony",
      "Air Conditioning",
      "Rooftop Terrace"
    ]);
  });

  it("splits saved values into known selected options and custom text", () => {
    expect(
      splitListingFeatureValues(["air conditioning", "Custom Rooftop", "Pre Paid Meter"], [
        "Air Conditioning",
        "Pre-Paid Meter"
      ])
    ).toEqual({
      selected: ["Air Conditioning", "Pre-Paid Meter"],
      customText: "Custom Rooftop"
    });
  });
});
