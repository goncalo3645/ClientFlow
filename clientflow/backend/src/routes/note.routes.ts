import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../services/prisma';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

const noteSchema = z.object({
  content: z.string().min(1),
  clientId: z.string().uuid(),
});

router.use(authenticate);

router.get('/', async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.query;
    const where: any = { userId: req.user?.id };
    
    if (clientId) {
      where.clientId = clientId;
    }

    const notes = await prisma.note.findMany({
      where,
      include: { client: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ notes });
  } catch (error) {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const validation = noteSchema.parse(req.body);
    
    const client = await prisma.client.findFirst({
      where: { id: validation.clientId, userId: req.user?.id }
    });

    if (!client) {
      res.status(404).json({ error: 'Cliente não encontrado' });
      return;
    }

    const note = await prisma.note.create({
      data: { ...validation, userId: req.user!.id },
      include: { client: { select: { id: true, name: true } } }
    });

    res.status(201).json({ note });
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
    const { content } = req.body;

    const note = await prisma.note.findFirst({
      where: { id, userId: req.user?.id }
    });

    if (!note) {
      res.status(404).json({ error: 'Nota não encontrada' });
      return;
    }

    const updatedNote = await prisma.note.update({
      where: { id },
      data: { content }
    });

    res.json({ note: updatedNote });
  } catch (error) {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    
    const note = await prisma.note.findFirst({
      where: { id, userId: req.user?.id }
    });

    if (!note) {
      res.status(404).json({ error: 'Nota não encontrada' });
      return;
    }

    await prisma.note.delete({ where: { id } });
    res.json({ message: 'Nota eliminada' });
  } catch (error) {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;
