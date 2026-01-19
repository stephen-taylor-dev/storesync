import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test.describe("Login Page", () => {
    test("should display login form", async ({ page }) => {
      await page.goto("/login");

      await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
      await expect(page.getByLabel(/username/i)).toBeVisible();
      await expect(page.getByLabel(/password/i)).toBeVisible();
      await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
    });

    test("should show validation errors for empty fields", async ({ page }) => {
      await page.goto("/login");

      await page.getByRole("button", { name: /sign in/i }).click();

      await expect(page.getByText(/username is required/i)).toBeVisible();
      await expect(page.getByText(/password is required/i)).toBeVisible();
    });

    test("should show error for invalid credentials", async ({ page }) => {
      await page.goto("/login");

      await page.getByLabel(/username/i).fill("invaliduser");
      await page.getByLabel(/password/i).fill("wrongpassword");
      await page.getByRole("button", { name: /sign in/i }).click();

      // Should show error toast or message
      await expect(page.getByText(/login failed|invalid/i)).toBeVisible({
        timeout: 10000,
      });
    });

    test("should redirect to login when accessing protected route", async ({
      page,
    }) => {
      await page.goto("/dashboard");

      // Should be redirected to login
      await expect(page).toHaveURL(/login/);
    });
  });

  test.describe("Authenticated User", () => {
    test.beforeEach(async ({ page }) => {
      // Login before each test
      await page.goto("/login");
      await page.getByLabel(/username/i).fill("admin");
      await page.getByLabel(/password/i).fill("admin123");
      await page.getByRole("button", { name: /sign in/i }).click();

      // Wait for redirect to dashboard
      await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
    });

    test("should access dashboard after login", async ({ page }) => {
      await expect(page.getByText(/dashboard|campaigns/i)).toBeVisible();
    });

    test("should logout successfully", async ({ page }) => {
      // Find and click logout button/link
      const userMenu = page.getByRole("button", { name: /user|account|profile/i });
      if (await userMenu.isVisible()) {
        await userMenu.click();
      }

      const logoutButton = page.getByRole("button", { name: /logout|sign out/i });
      if (await logoutButton.isVisible()) {
        await logoutButton.click();
      }

      // Should be redirected to login
      await expect(page).toHaveURL(/login/, { timeout: 10000 });
    });

    test("should persist session across page refresh", async ({ page }) => {
      await page.reload();

      // Should still be on dashboard after refresh
      await expect(page).toHaveURL(/dashboard/);
    });
  });
});
