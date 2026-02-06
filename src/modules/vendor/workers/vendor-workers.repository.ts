import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, like, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';

import { Drizzle, DRIZZLE_ORM } from 'src/common/database/drizzle.module';
import {
  NewWorkLog,
  NewWorker,
  NewWorkerPayment,
  WorkLog,
  Worker,
  WorkerPayment,
  workers,
  workLogs,
  workerPayments,
  projects,
  users,
  smetaItems,
} from 'src/common/database/schemas';

export type WorkLogWithRelations = WorkLog & {
  worker?: { id: string; name: string } | null;
  project?: { id: string; name: string };
  smetaItem?: { id: string; name: string } | null;
  loggedBy: { id: string; name: string };
  validatedBy?: { id: string; name: string } | null;
};

export type WorkerPaymentWithRelations = WorkerPayment & {
  worker: { id: string; name: string };
  paidBy: { id: string; name: string };
};

@Injectable()
export class VendorWorkersRepository {
  constructor(@Inject(DRIZZLE_ORM) private readonly db: Drizzle) {}

  async createWorker(data: NewWorker): Promise<Worker> {
    const id = randomUUID();
    await this.db.insert(workers).values({ ...data, id });
    const [result] = await this.db.select().from(workers).where(eq(workers.id, id));
    return result;
  }

  async findAllWorkers(
    orgId: string,
    params: { page: number; limit: number; search?: string },
  ): Promise<{ data: Worker[]; total: number }> {
    const { page, limit, search } = params;
    const offset = (page - 1) * limit;

    const conditions: ReturnType<typeof eq>[] = [eq(workers.orgId, orgId)];
    if (search) {
      conditions.push(like(workers.name, `%${search}%`));
    }

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(workers)
      .where(and(...conditions));

    const data = await this.db
      .select()
      .from(workers)
      .where(and(...conditions))
      .orderBy(desc(workers.createdAt))
      .limit(limit)
      .offset(offset);

    return { data, total: Number(countResult.count) };
  }

  async findWorkerById(id: string, orgId: string): Promise<Worker | null> {
    const [result] = await this.db
      .select()
      .from(workers)
      .where(and(eq(workers.id, id), eq(workers.orgId, orgId)));
    return result ?? null;
  }

  async updateWorker(id: string, data: Partial<NewWorker>): Promise<Worker> {
    await this.db.update(workers).set(data).where(eq(workers.id, id));
    const [result] = await this.db.select().from(workers).where(eq(workers.id, id));
    return result;
  }

  async deleteWorker(id: string): Promise<void> {
    await this.db.delete(workers).where(eq(workers.id, id));
  }

  async createWorkLog(data: NewWorkLog): Promise<WorkLog> {
    const id = randomUUID();
    await this.db.insert(workLogs).values({ ...data, id });
    const [result] = await this.db.select().from(workLogs).where(eq(workLogs.id, id));
    return result;
  }

  async findWorkLogs(
    orgId: string,
    params: { page: number; limit: number; workerId?: string; projectId?: string },
  ): Promise<{ data: WorkLogWithRelations[]; total: number }> {
    const { page, limit, workerId, projectId } = params;
    const offset = (page - 1) * limit;

    const conditions: ReturnType<typeof eq>[] = [eq(projects.orgId, orgId)];
    if (workerId) {
      conditions.push(eq(workLogs.workerId, workerId));
    }
    if (projectId) {
      conditions.push(eq(workLogs.projectId, projectId));
    }

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(workLogs)
      .innerJoin(projects, eq(workLogs.projectId, projects.id))
      .where(and(...conditions));

    const loggedByUsers = this.db.$with('logged_by_users').as(
      this.db.select({ id: users.id, name: users.name }).from(users),
    );

    const results = await this.db
      .select({
        workLog: workLogs,
        project: { id: projects.id, name: projects.name },
        loggedBy: { id: users.id, name: users.name },
      })
      .from(workLogs)
      .innerJoin(projects, eq(workLogs.projectId, projects.id))
      .innerJoin(users, eq(workLogs.loggedById, users.id))
      .where(and(...conditions))
      .orderBy(desc(workLogs.date))
      .limit(limit)
      .offset(offset);

    const data: WorkLogWithRelations[] = [];
    for (const r of results) {
      let worker: { id: string; name: string } | null = null;
      if (r.workLog.workerId) {
        const [workerResult] = await this.db
          .select({ id: workers.id, name: workers.name })
          .from(workers)
          .where(eq(workers.id, r.workLog.workerId));
        worker = workerResult ?? null;
      }

      let smetaItem: { id: string; name: string } | null = null;
      if (r.workLog.smetaItemId) {
        const [itemResult] = await this.db
          .select({ id: smetaItems.id, name: smetaItems.name })
          .from(smetaItems)
          .where(eq(smetaItems.id, r.workLog.smetaItemId));
        smetaItem = itemResult ?? null;
      }

      let validatedBy: { id: string; name: string } | null = null;
      if (r.workLog.validatedById) {
        const [validatorResult] = await this.db
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(eq(users.id, r.workLog.validatedById));
        validatedBy = validatorResult ?? null;
      }

      data.push({
        ...r.workLog,
        project: r.project,
        worker,
        smetaItem,
        loggedBy: r.loggedBy,
        validatedBy,
      });
    }

    return { data, total: Number(countResult.count) };
  }

  async findWorkLogById(id: string, orgId: string): Promise<WorkLogWithRelations | null> {
    const results = await this.db
      .select({
        workLog: workLogs,
        project: { id: projects.id, name: projects.name },
        loggedBy: { id: users.id, name: users.name },
      })
      .from(workLogs)
      .innerJoin(projects, eq(workLogs.projectId, projects.id))
      .innerJoin(users, eq(workLogs.loggedById, users.id))
      .where(and(eq(workLogs.id, id), eq(projects.orgId, orgId)));

    if (results.length === 0) return null;

    const r = results[0];

    let worker: { id: string; name: string } | null = null;
    if (r.workLog.workerId) {
      const [workerResult] = await this.db
        .select({ id: workers.id, name: workers.name })
        .from(workers)
        .where(eq(workers.id, r.workLog.workerId));
      worker = workerResult ?? null;
    }

    let smetaItem: { id: string; name: string } | null = null;
    if (r.workLog.smetaItemId) {
      const [itemResult] = await this.db
        .select({ id: smetaItems.id, name: smetaItems.name })
        .from(smetaItems)
        .where(eq(smetaItems.id, r.workLog.smetaItemId));
      smetaItem = itemResult ?? null;
    }

    let validatedBy: { id: string; name: string } | null = null;
    if (r.workLog.validatedById) {
      const [validatorResult] = await this.db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(eq(users.id, r.workLog.validatedById));
      validatedBy = validatorResult ?? null;
    }

    return {
      ...r.workLog,
      project: r.project,
      worker,
      smetaItem,
      loggedBy: r.loggedBy,
      validatedBy,
    };
  }

  async updateWorkLog(id: string, data: Partial<NewWorkLog>): Promise<WorkLog> {
    await this.db.update(workLogs).set(data).where(eq(workLogs.id, id));
    const [result] = await this.db.select().from(workLogs).where(eq(workLogs.id, id));
    return result;
  }

  async deleteWorkLog(id: string): Promise<void> {
    await this.db.delete(workLogs).where(eq(workLogs.id, id));
  }

  async createPayment(data: NewWorkerPayment): Promise<WorkerPayment> {
    const id = randomUUID();
    await this.db.insert(workerPayments).values({ ...data, id });
    const [result] = await this.db.select().from(workerPayments).where(eq(workerPayments.id, id));
    return result;
  }

  async findPayments(
    orgId: string,
    params: { page: number; limit: number; workerId?: string },
  ): Promise<{ data: WorkerPaymentWithRelations[]; total: number }> {
    const { page, limit, workerId } = params;
    const offset = (page - 1) * limit;

    const conditions: ReturnType<typeof eq>[] = [eq(workers.orgId, orgId)];
    if (workerId) {
      conditions.push(eq(workerPayments.workerId, workerId));
    }

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(workerPayments)
      .innerJoin(workers, eq(workerPayments.workerId, workers.id))
      .where(and(...conditions));

    const results = await this.db
      .select({
        payment: workerPayments,
        worker: { id: workers.id, name: workers.name },
        paidBy: { id: users.id, name: users.name },
      })
      .from(workerPayments)
      .innerJoin(workers, eq(workerPayments.workerId, workers.id))
      .innerJoin(users, eq(workerPayments.paidById, users.id))
      .where(and(...conditions))
      .orderBy(desc(workerPayments.createdAt))
      .limit(limit)
      .offset(offset);

    const data: WorkerPaymentWithRelations[] = results.map((r) => ({
      ...r.payment,
      worker: r.worker,
      paidBy: r.paidBy,
    }));

    return { data, total: Number(countResult.count) };
  }

  async findPaymentById(id: string, orgId: string): Promise<WorkerPaymentWithRelations | null> {
    const results = await this.db
      .select({
        payment: workerPayments,
        worker: { id: workers.id, name: workers.name },
        paidBy: { id: users.id, name: users.name },
      })
      .from(workerPayments)
      .innerJoin(workers, eq(workerPayments.workerId, workers.id))
      .innerJoin(users, eq(workerPayments.paidById, users.id))
      .where(and(eq(workerPayments.id, id), eq(workers.orgId, orgId)));

    if (results.length === 0) return null;

    const r = results[0];
    return {
      ...r.payment,
      worker: r.worker,
      paidBy: r.paidBy,
    };
  }

  async getProjectOrgId(projectId: string): Promise<string | null> {
    const [result] = await this.db.select({ orgId: projects.orgId }).from(projects).where(eq(projects.id, projectId));
    return result?.orgId ?? null;
  }

  async getWorkerOrgId(workerId: string): Promise<string | null> {
    const [result] = await this.db.select({ orgId: workers.orgId }).from(workers).where(eq(workers.id, workerId));
    return result?.orgId ?? null;
  }

  async findUnvalidatedWorkLogs(
    orgId: string,
    params: { page: number; limit: number; projectId?: string },
  ): Promise<{ data: WorkLogWithRelations[]; total: number }> {
    const { page, limit, projectId } = params;
    const offset = (page - 1) * limit;

    const conditions: ReturnType<typeof eq>[] = [
      eq(projects.orgId, orgId),
      eq(workLogs.isValidated, false),
    ];
    if (projectId) {
      conditions.push(eq(workLogs.projectId, projectId));
    }

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(workLogs)
      .innerJoin(projects, eq(workLogs.projectId, projects.id))
      .where(and(...conditions));

    const results = await this.db
      .select({
        workLog: workLogs,
        project: { id: projects.id, name: projects.name },
        loggedBy: { id: users.id, name: users.name },
      })
      .from(workLogs)
      .innerJoin(projects, eq(workLogs.projectId, projects.id))
      .innerJoin(users, eq(workLogs.loggedById, users.id))
      .where(and(...conditions))
      .orderBy(desc(workLogs.date))
      .limit(limit)
      .offset(offset);

    const data: WorkLogWithRelations[] = [];
    for (const r of results) {
      let worker: { id: string; name: string } | null = null;
      if (r.workLog.workerId) {
        const [workerResult] = await this.db
          .select({ id: workers.id, name: workers.name })
          .from(workers)
          .where(eq(workers.id, r.workLog.workerId));
        worker = workerResult ?? null;
      }

      let smetaItem: { id: string; name: string } | null = null;
      if (r.workLog.smetaItemId) {
        const [itemResult] = await this.db
          .select({ id: smetaItems.id, name: smetaItems.name })
          .from(smetaItems)
          .where(eq(smetaItems.id, r.workLog.smetaItemId));
        smetaItem = itemResult ?? null;
      }

      data.push({
        ...r.workLog,
        project: r.project,
        worker,
        smetaItem,
        loggedBy: r.loggedBy,
        validatedBy: null,
      });
    }

    return { data, total: Number(countResult.count) };
  }
}
