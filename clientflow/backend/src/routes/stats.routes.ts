import { Router } from 'express';
import { prisma } from '../services/prisma';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

// GET /api/stats - Estatísticas detalhadas
router.get('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    // Clientes por estado
    const clientsByStatus = await prisma.client.groupBy({
      by: ['status'],
      where: { userId },
      _count: true
    });

    // Tarefas por estado
    const tasksByStatus = await prisma.task.groupBy({
      by: ['status'],
      where: { userId },
      _count: true
    });

    // Tarefas por prioridade
    const tasksByPriority = await prisma.task.groupBy({
      by: ['priority'],
      where: { userId },
      _count: true
    });

    // Contactos por tipo (últimos 30 dias)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const contactsByType = await prisma.contact.groupBy({
      by: ['type'],
      where: {
        userId,
        date: { gte: thirtyDaysAgo }
      },
      _count: true
    });

    // Taxa de conversão (Prospect → Ativo)
    const totalProspects = await prisma.client.count({
      where: { userId, status: 'PROSPECT' }
    });
    
    const totalActive = await prisma.client.count({
      where: { userId, status: 'ACTIVE' }
    });

    const conversionRate = totalProspects > 0 
      ? ((totalActive / (totalActive + totalProspects)) * 100).toFixed(1)
      : '0';

    // Tarefas atrasadas
    const now = new Date();
    const overdueTasks = await prisma.task.count({
      where: {
        userId,
        status: { not: 'COMPLETED' },
        dueDate: { lt: now }
      }
    });

    // Novos clientes por mês (últimos 6 meses)
    const newClientsPerMonth = [];
    for (let i = 5; i >= 0; i--) {
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - i);
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);

      const count = await prisma.client.count({
        where: {
          userId,
          createdAt: {
            gte: startDate,
            lt: endDate
          }
        }
      });

      newClientsPerMonth.push({
        month: startDate.toLocaleDateString('pt-PT', { month: 'short', year: '2-digit' }),
        count
      });
    }

    res.json({
      stats: {
        clientsByStatus: clientsByStatus.reduce((acc, item) => {
          acc[item.status] = item._count;
          return acc;
        }, {} as Record<string, number>),
        tasksByStatus: tasksByStatus.reduce((acc, item) => {
          acc[item.status] = item._count;
          return acc;
        }, {} as Record<string, number>),
        tasksByPriority: tasksByPriority.reduce((acc, item) => {
          acc[item.priority] = item._count;
          return acc;
        }, {} as Record<string, number>),
        contactsByType: contactsByType.reduce((acc, item) => {
          acc[item.type] = item._count;
          return acc;
        }, {} as Record<string, number>),
        conversionRate: parseFloat(conversionRate),
        overdueTasks,
        newClientsPerMonth
      }
    });
  } catch (error) {
    console.error('Erro ao obter estatísticas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;
