import { BRAND } from '@worldrush/shared';
import { SignIn } from './_components/SignIn';
import { getWorldIdPublicAppId } from '../lib/world-config';

export default function HomePage() {
  return (
    <main className="shell">
      <h1>{BRAND.name}</h1>
      <p>Phase 2 scaffold: wallet-auth and World ID plumbing. The game is not built yet.</p>
      <SignIn worldIdAppId={getWorldIdPublicAppId()} />
    </main>
  );
}
