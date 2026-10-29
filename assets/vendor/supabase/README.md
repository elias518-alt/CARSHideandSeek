# Supabase browser client

Pinned @supabase/supabase-js 2.118.0 UMD build, MIT licensed.
Source: https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.js

Served from the app origin so login does not depend on a third-party script CDN.
The Google login anchor uses the same Supabase implicit OAuth endpoint as
signInWithOAuth; return URL is the current origin when scripts are available,
and the production origin as the HTML fallback. Token/session processing stays
with the SDK. No Google credentials or user tokens are included in this bundle.
