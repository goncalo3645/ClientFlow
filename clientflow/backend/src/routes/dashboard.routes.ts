import { Router } from 'express';
import { prisma } from '../services/prisma';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

// GET /api/dashboard - Dashboard overview
router.get('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    // Contagem total de clientes
    const totalClients = await prisma.client.count({ where: { userId } });

    // Contagem por status
    const clientsByStatus = await prisma.client.groupBy({
      by: ['status'],
      where: { userId },
      _count: true
    });

    // Tarefas pendentes
    const pendingTasks = await prisma.task.count({
      where: { userId, status: 'PENDING' }
    });

    // Tarefas concluídas
    const completedTasks = await prisma.task.count({
      where: { userId, status: 'COMPLETED' }
    });

    // Últimos contactos
    const recentContacts = await prisma.contact.findMany({
      where: { userId },
      take: 5,
      orderBy: { date: 'desc' },
      include: {
        client: { select: { id: true, name: true } }
      }
    });

    // Novos clientes este mês
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const newClientsThisMonth = await prisma.client.count({
      where: {
        userId,
        createdAt: { gte: startOfMonth }
      }
    });

    res.json({
      dashboard: {
        totalClients,
        clientsByStatus: clientsByStatus.reduce((acc, item) => {
          acc[item.status] = item._count;
          return acc;
        }, {} as Record<string, number>),
        tasks: {
          pending: pendingTasks,
          completed: completedTasks
        },
        recentContacts,
        newClientsThisMonth
      }
    });
  } catch (error) {
    console.error('Erro ao obter dashboard:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;
