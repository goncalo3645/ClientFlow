import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../services/prisma';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

// Schema de validação para Cliente
const clientSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  company: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  status: z.enum(['PROSPECT', 'ACTIVE', 'INACTIVE', 'LOST']).optional(),
  notes: z.string().optional(),
});

// Middleware de autenticação para todas as rotas
router.use(authenticate);

// GET /api/clients - Listar todos os clientes (com filtros e paginação)
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { 
      page = '1', 
      limit = '10', 
      search = '', 
      status = '',
      sortBy = 'createdAt',
      order = 'desc'
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = { userId: req.user?.id };

    // Pesquisa global
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Filtro por status
    if (status) {
      where.status = status;
    }

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { [sortBy as string]: order },
        include: {
          contacts: { select: { id: true, type: true, date: true } },
          tasks: { select: { id: true, status: true } },
          _count: { select: { contacts: true, notes: true, tasks: true } }
        }
      }),
      prisma.client.count({ where })
    ]);

    res.json({
      clients,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Erro ao listar clientes:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/clients/:id - Obter cliente por ID
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const client = await prisma.client.findFirst({
      where: { id, userId: req.user?.id },
      include: {
        contacts: { orderBy: { date: 'desc' } },
        notes: { orderBy: { createdAt: 'desc' } },
        tasks: { orderBy: { createdAt: 'desc' } },
        statusHistory: { orderBy: { changedAt: 'desc' } }
      }
    });

    if (!client) {
      res.status(404).json({ error: 'Cliente não encontrado' });
      return;
    }

    res.json({ client });
  } catch (error) {
    console.error('Erro ao obter cliente:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/clients - Criar novo cliente
router.post('/', async (req: AuthRequest, res) => {
  try {
    const validation = clientSchema.parse(req.body);
    
    const client = await prisma.client.create({
      data: {
        ...validation,
        userId: req.user!.id,
      },
      include: {
        _count: { select: { contacts: true, notes: true, tasks: true } }
      }
    });

    // Registar no log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'CREATE',
        entity: 'Client',
        entityId: client.id,
        details: { name: client.name },
        userId: req.user!.id,
      }
    });

    res.status(201).json({ client });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Dados inválidos', details: error.errors });
      return;
    }
    console.error('Erro ao criar cliente:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/clients/:id - Atualizar cliente
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const validation = clientSchema.partial().parse(req.body);

    // Verificar se cliente existe e pertence ao utilizador
    const existingClient = await prisma.client.findFirst({
      where: { id, userId: req.user?.id }
    });

    if (!existingClient) {
      res.status(404).json({ error: 'Cliente não encontrado' });
      return;
    }

    // Registar mudança de status se aplicável
    if (validation.status && validation.status !== existingClient.status) {
      await prisma.statusChange.create({
        data: {
          clientId: id,
          fromStatus: existingClient.status,
          toStatus: validation.status,
          changedBy: req.user!.id,
        }
      });
    }

    const client = await prisma.client.update({
      where: { id },
      data: validation,
      include: {
        _count: { select: { contacts: true, notes: true, tasks: true } }
      }
    });

    // Registar no log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'UPDATE',
        entity: 'Client',
        entityId: client.id,
        details: { changes: validation },
        userId: req.user!.id,
      }
    });

    res.json({ client });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Dados inválidos', details: error.errors });
      return;
    }
    console.error('Erro ao atualizar cliente:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/clients/:id - Eliminar cliente
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const existingClient = await prisma.client.findFirst({
      where: { id, userId: req.user?.id }
    });

    if (!existingClient) {
      res.status(404).json({ error: 'Cliente não encontrado' });
      return;
    }

    await prisma.client.delete({ where: { id } });

    // Registar no log de auditoria
    await prisma.auditLog.create({
      data: {
        action: 'DELETE',
        entity: 'Client',
        entityId: id,
        details: { name: existingClient.name },
        userId: req.user!.id,
      }
    });

    res.json({ message: 'Cliente eliminado com sucesso' });
  } catch (error) {
    console.error('Erro ao eliminar cliente:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;
