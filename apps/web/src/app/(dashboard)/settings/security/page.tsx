import type { Metadata } from 'next';
import Link from 'next/link';

import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { getServerComponentFlag } from '@documenso/lib/server-only/feature-flags/get-server-component-feature-flag';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';

import { SettingsHeader } from '~/components/(dashboard)/settings/layout/header';

export const metadata: Metadata = {
  title: 'Security',
};

export default async function SecuritySettingsPage() {
  const { user } = await getRequiredServerComponentSession();

  const isPasskeyEnabled = await getServerComponentFlag('app_passkey');

  return (
    <div>
      <SettingsHeader title="Security" subtitle="Here you can manage your recent activity." />

      <Alert
        className="mt-6 flex flex-col justify-between p-6 sm:flex-row sm:items-center"
        variant="neutral"
      >
        <div className="mb-4 mr-4 sm:mb-0">
          <AlertTitle>Recent activity</AlertTitle>

          <AlertDescription className="mr-2">
            View all recent security activity related to your account.
          </AlertDescription>
        </div>

        <Button asChild variant="outline" className="bg-background">
          <Link href="/settings/security/activity">View activity</Link>
        </Button>
      </Alert>
    </div>
  );
}
