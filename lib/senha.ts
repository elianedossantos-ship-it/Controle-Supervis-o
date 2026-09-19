import bcrypt from 'bcryptjs';

const RODADAS = 12;

export async function hashSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, RODADAS);
}

export async function conferirSenha(senha: string, hash: string): Promise<boolean> {
  return bcrypt.compare(senha, hash);
}
