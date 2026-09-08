import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../services/prisma';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

const contactSchema = z.object({
  type: z.enum(['CALL', 'EMAIL', 'MEETING', 'MESSAGE', 'OTHER']),
  date: z.string().transform((s) => new Date(s)),
  description: z.string().min(1),
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

    const contacts = await prisma.contact.findMany({
      where,
      include: { client: { select: { id: true, name: true } } },
      orderBy: { date: 'desc' }
    });

    res.json({ contacts });
  } catch (error) {
    console.error('Erro ao listar contactos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const validation = contactSchema.parse(req.body);
    
    // Verificar se cliente pertence ao utilizador
    const client = await prisma.client.findFirst({
      where: { id: validation.clientId, userId: req.user?.id }
    });

    if (!client) {
      res.status(404).json({ error: 'Cliente não encontrado' });
      return;
    }

    const contact = await prisma.contact.create({
      data: { ...validation, userId: req.user!.id },
      include: { client: { select: { id: true, name: true } } }
    });

    res.status(201).json({ contact });
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
    
    const contact = await prisma.contact.findFirst({
      where: { id, userId: req.user?.id }
    });

    if (!contact) {
      res.status(404).json({ error: 'Contacto não encontrado' });
      return;
    }

    await prisma.contact.delete({ where: { id } });
    res.json({ message: 'Contacto eliminado' });
  } catch (error) {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;
