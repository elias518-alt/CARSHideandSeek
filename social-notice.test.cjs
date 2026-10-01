const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function fixture(rpc){
  const nodes=new Map();
  const make=()=>({dataset:{},setAttribute(){},addEventListener(){},remove(){nodes.delete(this.id);}});
  const friends={classList:{contains:()=>false}},list={textContent:''};
  const context=vm.createContext({authSession:{user:{id:'account-a'}},supabaseClient:{rpc},socialAction(){},
    $:selector=>selector==='#friends'?friends:list,
    document:{getElementById:id=>nodes.get(id),createElement:make,body:{append(node){nodes.set(node.id,node);}}},
    profileImageSource:value=>typeof value==='string'&&value.startsWith('https://')?value:'',
    esc:value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
  });
  const source=fs.readFileSync(__dirname+'/social.js','utf8');
  vm.runInContext(source.slice(source.indexOf('let socialRows ='),source.indexOf('async function searchPlayers()')),context);
  return {context,nodes,load:()=>vm.runInContext('loadFriends()',context)};
}
test('incoming friend requests show sender names globally, preserve escaping and disappear after acceptance',async()=>{
  let rows=[{username:'Lea <img>',player_tag:'#LEA',request_id:'r1',incoming:true,status:'pending'},
    {username:'',player_tag:'#BEN',request_id:'r2',incoming:true,status:'pending'},
    {username:'Outgoing',request_id:'r3',incoming:false,status:'pending'}];
  const f=fixture(async()=>({data:rows,error:null}));await f.load();
  const markup=f.nodes.get('incomingFriendNotice').innerHTML;
  assert.match(markup,/Lea &lt;img&gt;/);assert.match(markup,/#BEN/);assert.doesNotMatch(markup,/Outgoing/);
  assert.match(markup,/data-accept="r1"/);assert.match(markup,/data-decline="r2"/);
  rows=rows.map(row=>({...row,status:'accepted'}));await f.load();assert.equal(f.nodes.has('incomingFriendNotice'),false);
});
test('a pending result for an old account never shows its requests on the new account',async()=>{
  let resolve;const f=fixture(()=>new Promise(done=>resolve=done));const pending=f.load();
  f.context.authSession={user:{id:'account-b'}};
  resolve({data:[{username:'Old account',request_id:'r1',incoming:true,status:'pending'}],error:null});
  await pending;assert.equal(f.nodes.has('incomingFriendNotice'),false);
});
test('logging out clears request notices and a failed poll keeps already shown requests',async()=>{
  let fail=false;
  const f=fixture(async()=>fail?{error:{message:'Network error'}}:{data:[{username:'Lea',request_id:'r1',incoming:true,status:'pending'}],error:null});
  await f.load();fail=true;await f.load();assert.ok(f.nodes.has('incomingFriendNotice'));
  f.context.authSession=null;await f.load();assert.equal(f.nodes.has('incomingFriendNotice'),false);
});

test('notification counts combine only incoming requests and received unread messages',()=>{
 const f=fixture(async()=>({data:[],error:null}));const result=vm.runInContext(`socialCounts([{status:'pending',incoming:true},{status:'pending',incoming:false},{status:'accepted',unread_count:2},{status:'accepted',unread_count:-5},{status:'pending',incoming:false,unread_count:99}])`,f.context);
 assert.deepEqual(JSON.parse(JSON.stringify(result)),{requests:1,messages:2});
});
test('request avatars accept safe image URLs and always escape names and identifiers',async()=>{
 const f=fixture(async()=>({data:[{username:'Lea <script>',request_id:'r"1',incoming:true,status:'pending',avatar_url:'https://example.com/avatar.webp'},{username:'Ben',request_id:'r2',incoming:true,status:'pending',avatar_url:'javascript:alert(1)'}]}));await f.load();const html=f.nodes.get('incomingFriendNotice').innerHTML;
 assert.match(html,/avatar\.webp/);assert.match(html,/Lea &lt;script&gt;/);assert.match(html,/r&quot;1/);assert.doesNotMatch(html,/javascript:|<script>/);
});
