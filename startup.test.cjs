const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('startup binds navigation with querySelectorAll so later login handlers still execute',()=>{
  const source=fs.readFileSync(__dirname+'/app.js','utf8');
  assert.match(source,/\$\$\('\[data-page\]'\)\s*\.forEach/);
  assert.doesNotMatch(source,/\$\('\[data-page\]'\)\s*\.forEach/);

  const navigation=source.indexOf("$$('[data-page]')");
  const googleLogin=source.indexOf("$('#googleLogin')");
  const initialize=source.indexOf('initializeAuth();');

  assert.ok(navigation>=0);
  assert.ok(googleLogin>navigation);
  assert.ok(initialize>googleLogin);
});
