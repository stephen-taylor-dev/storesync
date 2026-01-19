import { test, expect } from "@playwright/test";

test.describe("Campaigns", () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto("/login");
    await page.getByLabel(/username/i).fill("admin");
    await page.getByLabel(/password/i).fill("admin123");
    await page.getByRole("button", { name: /sign in/i }).click();

    // Wait for redirect to dashboard
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
  });

  test.describe("Campaign List", () => {
    test("should display campaigns page", async ({ page }) => {
      await page.goto("/dashboard/campaigns");

      await expect(page.getByRole("heading", { name: /campaigns/i })).toBeVisible();
    });

    test("should show campaign list or empty state", async ({ page }) => {
      await page.goto("/dashboard/campaigns");

      // Either shows campaigns or an empty state
      const hasCampaigns = await page
        .locator('[data-testid="campaign-item"], [data-testid="campaign-card"], table tbody tr')
        .count();

      if (hasCampaigns > 0) {
        await expect(page.locator('[data-testid="campaign-item"], [data-testid="campaign-card"], table tbody tr').first()).toBeVisible();
      } else {
        // Empty state or "no campaigns" message
        await expect(page.getByText(/no campaigns|create your first/i)).toBeVisible();
      }
    });

    test("should have create campaign button", async ({ page }) => {
      await page.goto("/dashboard/campaigns");

      await expect(
        page.getByRole("link", { name: /create|new campaign/i })
      ).toBeVisible();
    });

    test("should filter campaigns by status", async ({ page }) => {
      await page.goto("/dashboard/campaigns");

      // Look for a status filter
      const statusFilter = page.getByRole("combobox", { name: /status/i });
      if (await statusFilter.isVisible()) {
        await statusFilter.click();
        await page.getByRole("option", { name: /draft/i }).click();

        // URL should update with filter
        await expect(page).toHaveURL(/status=draft/);
      }
    });
  });

  test.describe("Create Campaign", () => {
    test("should navigate to create campaign page", async ({ page }) => {
      await page.goto("/dashboard/campaigns");

      await page.getByRole("link", { name: /create|new campaign/i }).click();

      await expect(page).toHaveURL(/campaigns\/new|campaigns\/create/);
    });

    test("should display campaign form", async ({ page }) => {
      await page.goto("/dashboard/campaigns/new");

      await expect(page.getByText(/location/i)).toBeVisible();
      await expect(page.getByText(/template/i)).toBeVisible();
      await expect(page.getByText(/schedule/i)).toBeVisible();
    });

    test("should show validation errors when submitting empty form", async ({
      page,
    }) => {
      await page.goto("/dashboard/campaigns/new");

      await page.getByRole("button", { name: /create campaign/i }).click();

      // Should show validation errors
      await expect(page.getByText(/brand is required/i)).toBeVisible();
    });

    test("should enable location select after brand selection", async ({
      page,
    }) => {
      await page.goto("/dashboard/campaigns/new");

      // Location should initially show "Select brand first"
      await expect(page.getByText(/select brand first/i)).toBeVisible();

      // Select a brand
      const brandSelect = page.getByText(/select a brand/i);
      await brandSelect.click();

      // Wait for brand options and select first one
      const brandOption = page.getByRole("option").first();
      if (await brandOption.isVisible()) {
        await brandOption.click();

        // Location should now show "Select a location"
        await expect(page.getByText(/select a location/i)).toBeVisible();
      }
    });
  });

  test.describe("Campaign Detail", () => {
    test("should display campaign details", async ({ page }) => {
      await page.goto("/dashboard/campaigns");

      // Click on first campaign if one exists
      const campaignLink = page.locator(
        '[data-testid="campaign-item"] a, [data-testid="campaign-card"] a, table tbody tr a'
      ).first();

      if (await campaignLink.isVisible()) {
        await campaignLink.click();

        // Should show campaign detail page with status
        await expect(page.getByText(/status/i)).toBeVisible();
      }
    });

    test("should show workflow actions for draft campaign", async ({ page }) => {
      await page.goto("/dashboard/campaigns");

      // Find a draft campaign
      const draftCampaign = page.locator(
        ':has-text("Draft") [data-testid="campaign-item"], :has-text("Draft") [data-testid="campaign-card"]'
      ).first();

      if (await draftCampaign.isVisible()) {
        await draftCampaign.click();

        // Should show draft actions
        await expect(
          page.getByRole("button", { name: /submit for review/i })
        ).toBeVisible();
      }
    });
  });

  test.describe("Campaign Workflow", () => {
    test("should submit draft campaign for review", async ({ page }) => {
      await page.goto("/dashboard/campaigns");

      // Find and click on a draft campaign
      const draftCampaign = page.locator('text=Draft').first();

      if (await draftCampaign.isVisible()) {
        // Get the parent link/row
        const campaignRow = draftCampaign.locator("xpath=ancestor::a | xpath=ancestor::tr");
        await campaignRow.click();

        // Click submit for review
        const submitButton = page.getByRole("button", {
          name: /submit for review/i,
        });

        if (await submitButton.isVisible()) {
          await submitButton.click();

          // A dialog should appear
          await expect(page.getByRole("dialog")).toBeVisible();

          // Confirm submission
          const confirmButton = page.getByRole("button", { name: /submit|confirm/i });
          await confirmButton.click();

          // Status should change or success message should appear
          await expect(
            page.getByText(/submitted|pending review|success/i)
          ).toBeVisible({ timeout: 10000 });
        }
      }
    });
  });
});

test.describe("Campaign Templates", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/username/i).fill("admin");
    await page.getByLabel(/password/i).fill("admin123");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
  });

  test("should display templates page", async ({ page }) => {
    await page.goto("/dashboard/templates");

    await expect(
      page.getByRole("heading", { name: /templates/i })
    ).toBeVisible();
  });

  test("should list available templates", async ({ page }) => {
    await page.goto("/dashboard/templates");

    // Either shows templates or empty state
    const hasTemplates = await page
      .locator('[data-testid="template-item"], [data-testid="template-card"], table tbody tr')
      .count();

    if (hasTemplates > 0) {
      await expect(page.locator('[data-testid="template-item"], [data-testid="template-card"], table tbody tr').first()).toBeVisible();
    }
  });
});
