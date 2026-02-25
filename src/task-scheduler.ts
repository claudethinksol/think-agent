import cron from "node-cron";
import { getDb } from "./db.js";
import { logger } from "./index.js";

type SkillFn = () => Promise<void>;
const registeredSkills: Map<string, SkillFn> = new Map();

export function registerSkill(name: string, fn: SkillFn): void {
  registeredSkills.set(name, fn);
}

interface TaskRow {
  id: string;
  name: string;
  cron: string;
  skill: string;
  enabled: number;
}

export function startScheduler(): void {
  const db = getDb();
  const tasks = db.prepare("SELECT * FROM scheduled_tasks WHERE enabled = 1").all() as TaskRow[];

  if (tasks.length === 0) {
    logger.info("No scheduled tasks configured");
    return;
  }

  for (const task of tasks) {
    const skillFn = registeredSkills.get(task.skill);
    if (!skillFn) {
      logger.warn({ task: task.name, skill: task.skill }, "Skill not registered, skipping task");
      continue;
    }

    if (!cron.validate(task.cron)) {
      logger.warn({ task: task.name, cron: task.cron }, "Invalid cron expression, skipping task");
      continue;
    }

    cron.schedule(task.cron, async () => {
      logger.info({ task: task.name }, "Running scheduled task");
      try {
        await skillFn();
        db.prepare("UPDATE scheduled_tasks SET last_run = strftime('%s','now') WHERE id = ?").run(task.id);
      } catch (err) {
        logger.error({ err, task: task.name }, "Scheduled task failed");
      }
    });

    logger.info({ task: task.name, cron: task.cron }, "Scheduled task registered");
  }
}

export function addScheduledTask(id: string, name: string, cronExpr: string, skill: string): void {
  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO scheduled_tasks (id, name, cron, skill, enabled)
    VALUES (?, ?, ?, ?, 1)
  `).run(id, name, cronExpr, skill);
}
