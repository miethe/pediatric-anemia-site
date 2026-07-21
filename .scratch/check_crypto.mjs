console.log(typeof crypto, typeof crypto.subtle, typeof crypto.subtle.digest);
crypto.subtle.digest('SHA-256', new TextEncoder().encode('hello')).then((buf) => {
  const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  console.log(hex);
  console.log(hex === '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824' ? 'MATCH' : 'MISMATCH');
});
