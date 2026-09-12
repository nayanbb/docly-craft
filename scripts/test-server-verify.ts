import fs from 'fs';
import path from 'path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { resolveUserEntitlement } from '../src/lib/monetization/entitlements';
import { isPermanentAdminProUser } from '../src/lib/monetization/entitlements';

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

const adminDb = createClient(url, serviceKey);

async function testFixedVerification() {
  const { data: linkData } = await adminDb.auth.admin.generateLink({
    type: 'magiclink',
    email: 'ayankoji15@gmail.com',
  });
  const tokenHash = linkData?.properties?.hashed_token;

  const clientDb = createClient(url, anonKey);
  const { data: sessionData } = await clientDb.auth.verifyOtp({
    token_hash: tokenHash!,
    type: 'magiclink',
  });

  const token = sessionData.session!.access_token;
  console.log('Got user token for:', sessionData.user!.email);

  // Test 0: Current verifyServerUserSubscription function
  const { verifyServerUserSubscription } = await import('../src/lib/monetization/subscription');
  const req = new Request('http://localhost/api/ai/summarize', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const currentResult = await verifyServerUserSubscription(req);
  console.log('Test 0 (Current verifyServerUserSubscription) - isPro:', currentResult.isPro, 'plan:', currentResult.plan, 'subData:', currentResult.subscriptionData?.plan);

  // Test 1: Using service role client
  const serverDb1 = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData1 } = await serverDb1.auth.getUser(token);
  const userId = userData1.user!.id;

  const [subResult1, entResult1] = await Promise.all([
    serverDb1
      .from('subscriptions')
      .select('plan, status, current_period_start, current_period_end, cancel_at_period_end, provider, provider_subscription_id, provider_customer_id, provider_plan_id, razorpay_customer_id, razorpay_subscription_id, razorpay_plan_id')
      .eq('user_id', userId)
      .maybeSingle(),
    serverDb1
      .from('entitlements')
      .select('plan, grant_type, expires_at, notes')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  const eval1 = resolveUserEntitlement(userId, subResult1.data, entResult1.data);
  console.log('Test 1 (Service Role) - isPro:', eval1.isPro, 'plan:', eval1.effectivePlan, 'sub:', subResult1.data?.plan, subResult1.data?.status);

  // Test 2: Using user token client (fallback if no service key)
  const serverDb2 = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const [subResult2, entResult2] = await Promise.all([
    serverDb2
      .from('subscriptions')
      .select('plan, status, current_period_start, current_period_end, cancel_at_period_end, provider, provider_subscription_id, provider_customer_id, provider_plan_id, razorpay_customer_id, razorpay_subscription_id, razorpay_plan_id')
      .eq('user_id', userId)
      .maybeSingle(),
    serverDb2
      .from('entitlements')
      .select('plan, grant_type, expires_at, notes')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  const eval2 = resolveUserEntitlement(userId, subResult2.data, entResult2.data);
  console.log('Test 2 (User Bearer Token) - isPro:', eval2.isPro, 'plan:', eval2.effectivePlan, 'sub:', subResult2.data?.plan, subResult2.data?.status);
}

testFixedVerification().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
