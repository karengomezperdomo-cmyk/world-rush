import { getWorldIdPublicAppId } from '../lib/world-config';
import { AppShell } from './_components/AppShell';

export default function HomePage() {
  return <AppShell worldIdAppId={getWorldIdPublicAppId()} />;
}
