import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../services/prisma';
import { hashPassword, verifyPassword, generateAccessToken, generateRefreshToken, verifyRefreshToken, revokeRefreshToken, revokeAllUserTokens } from '../utils/auth.utils';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

// Schemas de validação
const registerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Password deve ter pelo menos 6 caracteres'),
});

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Password é obrigatória'),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token é obrigatório'),
});

// POST /api/auth/register - Registar novo utilizador
router.post('/register', async (req: Request, res: Response) => {
  try {
    const validation = registerSchema.safeParse(req.body);
    
    if (!validation.success) {
      res.status(400).json({ 
        error: 'Dados inválidos',
        details: validation.error.errors 
      });
      return;
    }

    const { name, email, password } = validation.data;

    // Verificar se email já existe
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      res.status(409).json({ error: 'Email já registado' });
      return;
    }

    // Hash da password
    const passwordHash = await hashPassword(password);

    // Criar utilizador
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      }
    });

    // Gerar tokens
    const accessToken = generateAccessToken(user.id, user.email);
    const refreshToken = await generateRefreshToken(user.id);

    res.status(201).json({
      message: 'Utilizador criado com sucesso',
      user,
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error('Erro no registo:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/auth/login - Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const validation = loginSchema.safeParse(req.body);
    
    if (!validation.success) {
      res.status(400).json({ 
        error: 'Dados inválidos',
        details: validation.error.errors 
      });
      return;
    }

    const { email, password } = validation.data;

    // Encontrar utilizador
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      res.status(401).json({ error: 'Email ou password inválidos' });
      return;
    }

    // Verificar password
    const isValidPassword = await verifyPassword(password, user.passwordHash);

    if (!isValidPassword) {
      res.status(401).json({ error: 'Email ou password inválidos' });
      return;
    }

    // Gerar tokens
    const accessToken = generateAccessToken(user.id, user.email);
    const refreshToken = await generateRefreshToken(user.id);

    res.json({
      message: 'Login efetuado com sucesso',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/auth/refresh - Refresh token
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const validation = refreshTokenSchema.safeParse(req.body);
    
    if (!validation.success) {
      res.status(400).json({ 
        error: 'Dados inválidos',
        details: validation.error.errors 
      });
      return;
    }

    const { refreshToken: token } = validation.data;

    // Verificar refresh token
    const result = await verifyRefreshToken(token);

    if (!result) {
      res.status(401).json({ error: 'Refresh token inválido ou expirado' });
      return;
    }

    // Obter dados do utilizador
    const user = await prisma.user.findUnique({
      where: { id: result.userId },
      select: { id: true, name: true, email: true, role: true }
    });

    if (!user) {
      res.status(401).json({ error: 'Utilizador não encontrado' });
      return;
    }

    // Gerar novos tokens
    const newAccessToken = generateAccessToken(user.id, user.email);
    const newRefreshToken = await generateRefreshToken(user.id);
    
    // Revogar token antigo
    await revokeRefreshToken(token);

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    console.error('Erro no refresh token:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/auth/logout - Logout
router.post('/logout', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { refreshToken: token } = req.body;

    if (token) {
      await revokeRefreshToken(token);
    } else {
      // Se não houver token, revogar todos os tokens do utilizador
      if (req.user?.id) {
        await revokeAllUserTokens(req.user.id);
      }
    }

    res.json({ message: 'Logout efetuado com sucesso' });
  } catch (error) {
    console.error('Erro no logout:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/auth/me - Obter perfil do utilizador atual
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }

    res.json({ user: req.user });
  } catch (error) {
    console.error('Erro ao obter perfil:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;
