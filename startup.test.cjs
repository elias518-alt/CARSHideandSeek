const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('startup binds navigation with querySelectorAll so later login handlers still execute',()=>{
  const source=fs.readFileSync(__dirname+'/app.js','utf8');
  assert.match(source,/\$\$\('\[data-page\]'\)\s*\.forEach/);
  assert.equal(source.includes("\n$('[data-page]')\n  .forEach"),false);

  const navigation=source.indexOf("$$('[data-page]')");
  const googleLoginBinding=source.indexOf("$('#googleLogin')\n  ?.addEventListener");
  const initialize=source.lastIndexOf('initializeAuth();');

  assert.ok(navigation>=0);
  assert.ok(googleLoginBinding>navigation);
  assert.ok(initialize>googleLoginBinding);
});
