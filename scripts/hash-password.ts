import bcrypt from 'bcryptjs';

const password = process.argv[2];
if (!password) {
  console.error('Uso: npx tsx scripts/hash-password.ts <password>');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);
console.log('Hash generado:');
console.log(hash);
console.log('\nAgregar a .env como:');
console.log(`ADMIN_PASS_HASH=${hash}`);
console.log(`PRES_PASS_HASH=${hash}`);
console.log(`VOCAL_PASS_HASH=${hash}`);
console.log(`CAPT_PASS_HASH=${hash}`);
console.log('\nO usarlo directamente en server.ts.');
