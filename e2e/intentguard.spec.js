import { test, expect } from '@playwright/test';

test.describe('IntentGuard Enterprise E2E Test Suite', () => {

  test('Page navigation and Command Center verification', async ({ page }) => {
    await page.goto('/');

    // Check title and brand
    await expect(page).toHaveTitle(/IntentGuard Enterprise/i);
    await expect(page.locator('h1')).toContainText('IntentGuard');

    // Verify 7 navigation tabs exist
    await expect(page.getByRole('button', { name: /Command Center/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Transaction Explorer/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Journey Visualizer/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Attack Simulation Lab/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Policy Workbench/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Audit Explorer/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Settings/i })).toBeVisible();

    // Verify Command Center KPI cards
    await expect(page.getByText('TOTAL PROCESSED')).toBeVisible();
    await expect(page.getByText('BLOCKED VIOLATIONS')).toBeVisible();
    await expect(page.getByText('APPROVED CHECKOUTS')).toBeVisible();
    await expect(page.getByText('ACTIVE CONTRACTS')).toBeVisible();
  });

  test('Transaction Explorer and Side-by-Side Inspector', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Transaction Explorer/i }).click();

    await expect(page.locator('h2')).toContainText('Transaction Explorer');
    await expect(page.getByPlaceholder(/Search by transaction ID/i)).toBeVisible();
  });

  test('Attack Simulation Lab scenario selection', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Attack Simulation Lab/i }).click();

    await expect(page.locator('h2')).toContainText('Attack Simulation Lab');
    await expect(page.getByText(/Master Scenario: Gaming Laptop Intent Drift/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Run Test Scenario/i })).toBeVisible();
  });

  test('Policy Workbench embedded Monaco editor and tabs', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Policy Workbench/i }).click();

    await expect(page.locator('h2')).toContainText('Monaco Policy Workbench');
    await expect(page.getByRole('button', { name: /Sandbox Test Runner/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Version Diff/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Schema Reference/i })).toBeVisible();
  });

  test('Audit Explorer cryptographic hash-chain status', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Audit Explorer/i }).click();

    await expect(page.locator('h2')).toContainText('Cryptographic Audit Explorer');
    await expect(page.getByRole('button', { name: /Verify Cryptographic Ledger/i })).toBeVisible();
  });

});
