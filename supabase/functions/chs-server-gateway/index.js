import {createGateway} from './gateway.mjs';
let secretKeys={};try{secretKeys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');}catch{}
Deno.serve(createGateway({url:Deno.env.get('SUPABASE_URL'),serviceKey:secretKeys.default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}));
