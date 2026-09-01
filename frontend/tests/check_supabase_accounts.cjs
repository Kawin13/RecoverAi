const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ikgsrrmzxmmbumcdgxgq.supabase.co';
const supabaseAnonKey = 'sb_publishable_biwradPEk0HjBOSaHpPXeA_NZ-8Kyhq';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testAuth() {
  console.log('Testing Supabase login with test.ops@recoverai.io...');
  const { data: dataA, error: errA } = await supabase.auth.signInWithPassword({
    email: 'test.ops@recoverai.io',
    password: 'RecoverAiPass2026!'
  });

  if (errA) {
    console.error('Login A error:', errA.message);
  } else {
    console.log('Login A Success! User:', {
      id: dataA.user.id,
      email: dataA.user.email,
      fullName: dataA.user.user_metadata?.full_name,
      provider: dataA.user.app_metadata?.provider,
      created_at: dataA.user.created_at,
      last_sign_in_at: dataA.user.last_sign_in_at
    });
  }

  // Let's test if signup creates user with auto-confirm or if another user exists
  const userBEmail = 'demo.operator@recoverai.io';
  console.log(`\nTesting login with ${userBEmail}...`);
  const { data: dataB, error: errB } = await supabase.auth.signInWithPassword({
    email: userBEmail,
    password: 'RecoverAiPass2026!'
  });

  if (errB) {
    console.log(`Login B failed (${errB.message}). Attempting signup for ${userBEmail}...`);
    const { data: signupB, error: signupErrB } = await supabase.auth.signUp({
      email: userBEmail,
      password: 'RecoverAiPass2026!',
      options: {
        data: { full_name: 'Monish Balasubramanian' }
      }
    });
    console.log('Signup B result:', signupB?.user ? 'User created' : 'Failed', signupErrB?.message || 'No error');
    if (signupB?.session) {
      console.log('Auto-confirmed session received for User B!');
    }
  } else {
    console.log('Login B Success! User B:', {
      id: dataB.user.id,
      email: dataB.user.email,
      fullName: dataB.user.user_metadata?.full_name,
      provider: dataB.user.app_metadata?.provider
    });
  }
}

testAuth();
