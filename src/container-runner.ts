import { spawn } from "child_process";
import { config } from "./config.js";
import { logger } from "./index.js";

export interface ContainerTask {
  id: string;
  image: string;
  command: string[];
  env?: Record<string, string>;
  onOutput?: (data: string) => void;
  onError?: (err: Error) => void;
  onExit?: (code: number | null) => void;
}

export async function runInContainer(task: ContainerTask): Promise<void> {
  if (!config.CONTAINER_ISOLATION) {
    logger.debug({ taskId: task.id }, "Container isolation disabled, running task in-process");
    return;
  }

  const envArgs: string[] = [];
  if (task.env) {
    for (const [key, value] of Object.entries(task.env)) {
      envArgs.push("-e", `${key}=${value}`);
    }
  }

  const dockerArgs = [
    "run",
    "--rm",
    "--name", `think-agent-task-${task.id}`,
    "--memory", "256m",
    "--cpus", "0.5",
    "--network", "host",
    ...envArgs,
    task.image,
    ...task.command,
  ];

  logger.info({ taskId: task.id, image: task.image }, "Spawning container");

  return new Promise((resolve, reject) => {
    const proc = spawn("docker", dockerArgs, { stdio: "pipe" });

    proc.stdout?.on("data", (data: Buffer) => {
      const text = data.toString();
      logger.debug({ taskId: task.id }, text.trim());
      task.onOutput?.(text);
    });

    proc.stderr?.on("data", (data: Buffer) => {
      const text = data.toString();
      logger.warn({ taskId: task.id }, text.trim());
    });

    proc.on("error", (err) => {
      logger.error({ err, taskId: task.id }, "Container failed to start");
      task.onError?.(err);
      reject(err);
    });

    proc.on("exit", (code) => {
      task.onExit?.(code);
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Container exited with code ${code}`));
      }
    });
  });
}

export async function stopContainer(taskId: string): Promise<void> {
  return new Promise((resolve) => {
    const proc = spawn("docker", ["stop", `think-agent-task-${taskId}`], { stdio: "ignore" });
    proc.on("exit", () => resolve());
    proc.on("error", () => resolve());
  });
}
