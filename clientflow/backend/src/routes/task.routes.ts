import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../services/prisma';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

const taskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  dueDate: z.string().transform((s) => s ? new Date(s) : undefined).optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  clientId: z.string().uuid().optional().or(z.literal('')),
});

router.use(authenticate);

router.get('/', async (req: AuthRequest, res) => {
  try {
    const { status, clientId } = req.query;
    const where: any = { userId: req.user?.id };
    
    if (status) {
      where.status = status;
    }
    if (clientId) {
      where.clientId = clientId || null;
    }

    const tasks = await prisma.task.findMany({
      where,
      include: { client: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ tasks });
  } catch (error) {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const validation = taskSchema.parse(req.body);
    
    // Se houver clientId, verificar se cliente pertence ao utilizador
    if (validation.clientId) {
      const client = await prisma.client.findFirst({
        where: { id: validation.clientId, userId: req.user?.id }
      });
      if (!client) {
        res.status(404).json({ error: 'Cliente não encontrado' });
        return;
      }
    }

    const task = await prisma.task.create({
      data: { 
        ...validation, 
        clientId: validation.clientId || null,
        userId: req.user!.id 
      },
      include: { client: { select: { id: true, name: true } } }
    });

    res.status(201).json({ task });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Dados inválidos', details: error.errors });
      return;
    }
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const validation = taskSchema.partial().parse(req.body);

    const task = await prisma.task.findFirst({
      where: { id, userId: req.user?.id }
    });

    if (!task) {
      res.status(404).json({ error: 'Tarefa não encontrada' });
      return;
    }

    const updatedTask = await prisma.task.update({
      where: { id },
      data: validation,
      include: { client: { select: { id: true, name: true } } }
    });

    res.json({ task: updatedTask });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Dados inválidos', details: error.errors });
      return;
    }
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    
    const task = await prisma.task.findFirst({
      where: { id, userId: req.user?.id }
    });

    if (!task) {
      res.status(404).json({ error: 'Tarefa não encontrada' });
      return;
    }

    await prisma.task.delete({ where: { id } });
    res.json({ message: 'Tarefa eliminada' });
  } catch (error) {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;
