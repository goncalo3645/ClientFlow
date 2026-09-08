import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../services/prisma';

// Interface para o payload do JWT
interface JwtPayload {
  userId: string;
  email: string;
}

// Extendendo a interface Request para incluir o usuário
export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

// Middleware de autenticação
export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Access token não fornecido' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const jwtSecret = process.env.JWT_SECRET || 'fallback-secret';

    const decoded = jwt.verify(token, jwtSecret) as JwtPayload;

    // Verificar se o usuário existe
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true, role: true }
    });

    if (!user) {
      res.status(401).json({ error: 'Usuário não encontrado' });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Token expirado' });
      return;
    }
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: 'Token inválido' });
      return;
    }
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Middleware para verificar permissões (RBAC - Fase 2)
export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Acesso não autorizado' });
      return;
    }

    next();
  };
};
