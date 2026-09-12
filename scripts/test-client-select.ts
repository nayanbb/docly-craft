import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const envContent = fs.readFileSync(path.resolve('.env'), 'utf8');
const env: Record<string, string> = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const idx = trimmed.indexOf('=');
    if (idx !== -1) {
      const k = trimmed.substring(0, idx).trim();
      let v = trimmed.substring(idx + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.substring(1, v.length - 1);
      }
      env[k] = v;
    }
  }
}

const url = env['VITE_SUPABASE_URL'] || '';
const anonKey = env['VITE_SUPABASE_ANON_KEY'] || '';
const serviceKey = env['SUPABASE_SERVICE_ROLE_KEY'] || '';

console.log('url:', !!url, 'anonKey:', !!anonKey, 'serviceKey:', !!serviceKey);

const adminDb = createClient(url, serviceKey);

async function test() {
  const { data: linkData, error: linkErr } = await adminDb.auth.admin.generateLink({
    type: 'magiclink',
    email: 'ayankoji15@gmail.com',
  });
  const tokenHash = linkData?.properties?.hashed_token;

  // Now create a client like the browser would
  const clientDb = createClient(url, anonKey);
  const { data: sessionData, error: sessionErr } = await clientDb.auth.verifyOtp({
    token_hash: tokenHash!,
    type: 'magiclink',
  });

  const user = sessionData.user;
  console.log('User signed in:', user?.id, user?.email);

  // Try SELECT as authenticated user
  const { data: sub, error: subErr } = await clientDb
    .from('subscriptions')
    .select('plan, status, current_period_start, current_period_end, cancel_at_period_end, provider, provider_subscription_id, provider_customer_id, provider_plan_id, razorpay_customer_id, razorpay_subscription_id, razorpay_plan_id')
    .eq('user_id', user!.id)
    .maybeSingle();

  console.log('Client SELECT result:', { sub, subErr });
}
test().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
