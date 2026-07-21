import { expect, test } from "@playwright/test";

import { LISTING_GALLERY_PICKER_ACCEPT } from "../../src/lib/image-limits";

test("mobile file input accepts multiple selected listing photos", async ({ page }) => {
  await page.setContent(`
    <label>
      Choose Files
      <input
        class="input"
        name="images"
        type="file"
        multiple
        accept="${LISTING_GALLERY_PICKER_ACCEPT}"
      />
    </label>
    <p data-testid="selected-count">No file chosen</p>
    <div data-testid="preview-grid"></div>
    <script>
      const input = document.querySelector('input[name="images"]');
      const count = document.querySelector('[data-testid="selected-count"]');
      const previewGrid = document.querySelector('[data-testid="preview-grid"]');
      input.addEventListener('change', () => {
        const files = Array.from(input.files || []);
        count.textContent = files.length + '/10 selected';
        previewGrid.innerHTML = files.map((file) => '<article>' + file.name + '</article>').join('');
      });
    </script>
  `);

  const input = page.locator('input[name="images"]');
  await expect(input).toHaveAttribute("multiple", "");
  await expect(input).toHaveAttribute("accept", LISTING_GALLERY_PICKER_ACCEPT);
  await input.setInputFiles([
    {
      name: "android-gallery-1.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("image-one")
    },
    {
      name: "android-gallery-2.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("image-two")
    }
  ]);

  await expect(page.getByTestId("selected-count")).toHaveText("2/10 selected");
  await expect(page.getByText("android-gallery-1.jpg")).toBeVisible();
  await expect(page.getByText("android-gallery-2.jpg")).toBeVisible();
});

test("real agent dashboard upload preview can be checked when an authenticated test URL is provided", async ({ page }) => {
  const dashboardUrl = process.env.E2E_AGENT_DASHBOARD_URL;
  if (!dashboardUrl) {
    test.skip(true, "Set E2E_AGENT_DASHBOARD_URL to a signed-in agent dashboard URL to run the real form check.");
  }

  await page.goto(dashboardUrl);
  const input = page.locator('input[name="images"][type="file"]').first();
  await expect(input).toHaveAttribute("multiple", "");
  await input.setInputFiles([
    {
      name: "mobile-check-1.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("image-one")
    },
    {
      name: "mobile-check-2.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("image-two")
    }
  ]);

  await expect(page.getByText(/2\/10 selected/i)).toBeVisible();
  await expect(page.getByText("mobile-check-1.jpg")).toBeVisible();
  await expect(page.getByText("mobile-check-2.jpg")).toBeVisible();
});
