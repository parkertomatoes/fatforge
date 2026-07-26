import { expect, test } from '@playwright/test';

test('creates a floppy image and opens a text file in a dock tab', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('Failed to load resource')) {
      errors.push(message.text());
    }
  });

  await page.goto('/');
  await page.getByRole('menuitem', { name: 'File', exact: true }).click();
  await page.getByText('New Floppy Image').click();
  await page.locator('#floppy-label').fill('TESTDISK');
  await page.getByRole('button', { name: 'OK' }).click();

  await expect(page.getByText(/TESTDISK/)).toBeVisible();

  await page.getByTitle('File actions').click();
  await page.getByText('New Text File').click();
  await page.locator('#name-dialog-input').fill('HELLO.TXT');
  await page.getByRole('button', { name: 'OK' }).click();

  await expect(page.getByText('HELLO.TXT')).toBeVisible();
  await page.getByText('HELLO.TXT').dblclick();
  await expect(page.locator('.monaco-editor')).toBeVisible();
  expect(errors).toEqual([]);
});

test('undo and redo include file rename actions', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('Failed to load resource')) {
      errors.push(message.text());
    }
  });

  await page.goto('/');
  await page.getByRole('menuitem', { name: 'File', exact: true }).click();
  await page.getByText('New Floppy Image').click();
  await page.locator('#floppy-label').fill('TESTDISK');
  await page.getByRole('button', { name: 'OK' }).click();

  await page.getByTitle('File actions').click();
  await page.getByText('New Text File').click();
  await page.locator('#name-dialog-input').fill('HELLO.TXT');
  await page.getByRole('button', { name: 'OK' }).click();

  const hello = page.locator('.tree-name').filter({ hasText: /^HELLO\.TXT$/ });
  const renamed = page.locator('.tree-name').filter({ hasText: /^RENAMED\.TXT$/ });
  await expect(hello).toHaveCount(1);

  await hello.click();
  await page.getByTitle('File actions').click();
  await page.getByText('Rename').click();
  await page.locator('#name-dialog-input').fill('RENAMED.TXT');
  await page.getByRole('button', { name: 'OK' }).click();

  await expect(hello).toHaveCount(0);
  await expect(renamed).toHaveCount(1);

  await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Undo', exact: true }).click();
  await expect(hello).toHaveCount(1);
  await expect(renamed).toHaveCount(0);

  await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Redo', exact: true }).click();
  await expect(hello).toHaveCount(0);
  await expect(renamed).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('double-clicking an already-open file activates its existing tab', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('Failed to load resource')) {
      errors.push(message.text());
    }
  });

  await page.goto('/');
  await page.getByRole('menuitem', { name: 'File', exact: true }).click();
  await page.getByText('New Floppy Image').click();
  await page.locator('#floppy-label').fill('TESTDISK');
  await page.getByRole('button', { name: 'OK' }).click();

  for (const name of ['ONE.TXT', 'TWO.TXT']) {
    await page.getByTitle('File actions').click();
    await page.getByText('New Text File').click();
    await page.locator('#name-dialog-input').fill(name);
    await page.getByRole('button', { name: 'OK' }).click();
  }

  const oneTreeItem = page.locator('.tree-name').filter({ hasText: /^ONE\.TXT$/ });
  const twoTreeItem = page.locator('.tree-name').filter({ hasText: /^TWO\.TXT$/ });
  const oneTab = page.locator('.dv-tab').filter({ hasText: /^ONE\.TXT$/ });
  const twoTab = page.locator('.dv-tab').filter({ hasText: /^TWO\.TXT$/ });

  await oneTreeItem.dblclick();
  await twoTreeItem.dblclick();
  await expect(oneTab).toHaveAttribute('aria-selected', 'false');
  await expect(twoTab).toHaveAttribute('aria-selected', 'true');

  await oneTreeItem.dblclick();
  await expect(oneTab).toHaveAttribute('aria-selected', 'true');
  await expect(twoTab).toHaveAttribute('aria-selected', 'false');
  await expect(oneTab).toHaveCount(1);
  expect(errors).toEqual([]);
});
