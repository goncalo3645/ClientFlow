import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../services/prisma';

// Hash de password
export const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10');
  return bcrypt.hash(password, saltRounds);
};

// Verificar password
export const verifyPassword = async (
  password: string,
  hashedPassword: string
): Promise<boolean> => {
  return bcrypt.compare(password, hashedPassword);
};

// Gerar access token
export const generateAccessToken = (userId: string, email: string): string => {
  const jwtSecret = process.env.JWT_SECRET || 'fallback-secret';
  const expiresIn = process.env.JWT_EXPIRES_IN || '15m';
  
  return jwt.sign({ userId, email }, jwtSecret, { expiresIn });
};

// Gerar refresh token e guardar na BD
export const generateRefreshToken = async (userId: string): Promise<string> => {
  const refreshToken = uuidv4();
  const expiresAt = new Date();
  const days = parseInt(process.env.REFRESH_TOKEN_EXPIRES_IN?.replace('d', '') || '7');
  expiresAt.setDate(expiresAt.getDate() + days);

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId,
      expiresAt,
    },
  });

  return refreshToken;
};

// Verificar refresh token
export const verifyRefreshToken = async (token: string): Promise<{ userId: string } | null> => {
  const refreshTokenRecord = await prisma.refreshToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!refreshTokenRecord) {
    return null;
  }

  if (refreshTokenRecord.expiresAt < new Date()) {
    await prisma.refreshToken.delete({ where: { token } });
    return null;
  }

  return { userId: refreshTokenRecord.userId };
};

// Revogar refresh token
export const revokeRefreshToken = async (token: string): Promise<void> => {
  await prisma.refreshToken.deleteMany({ where: { token } });
};

// Revogar todos os refresh tokens de um usuário
export const revokeAllUserTokens = async (userId: string): Promise<void> => {
  await prisma.refreshToken.deleteMany({ where: { userId } });
};
